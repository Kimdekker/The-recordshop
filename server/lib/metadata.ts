import { env } from './env.ts';
import { norm } from './youtube.ts';
import type { AlbumDoc } from '../models/Album.ts';
import type { AlbumMeta, Credit, TrackMeta } from '../../shared/types.ts';

/*
 * Album metadata from open sources:
 *   MusicBrainz  release, label, genres, credits per track (CC0)
 *   Wikidata     → link to the Wikipedia article
 *   Wikipedia    summary of the album (CC BY-SA, attribution on the page)
 *
 * Only open data, no licences needed. Lyrics are deliberately left out (copyright).
 *
 * MusicBrainz allows 1 request/second and requires a recognisable User-Agent.
 */

const UA = env.metadataUserAgent;
const MB = 'https://musicbrainz.org/ws/2';

// --- MusicBrainz with rate limit (1 req/s) ------------------------------------------

let mbQueue: Promise<unknown> = Promise.resolve();
function mb<T = any>(path: string): Promise<T> {
  const run = mbQueue.then(async () => {
    const res = await fetch(`${MB}${path}${path.includes('?') ? '&' : '?'}fmt=json`, { headers: { 'User-Agent': UA } });
    await new Promise((r) => setTimeout(r, 1100));
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    return res.json() as Promise<T>;
  });
  mbQueue = run.catch(() => {});
  return run;
}

async function getJson<T = any>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

const lucene = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`;

// --- Picking the right release --------------------------------------------------

/** "Short n' Sweet (Deluxe)" → also try "Short n' Sweet". */
const titleVariants = (t: string) => [...new Set([t, t.replace(/\s*[([][^)\]]*[)\]]/g, '').trim()])].filter(Boolean);

async function findRelease(album: AlbumDoc) {
  const want = album.tracks.length;
  for (const title of titleVariants(album.title)) {
    const q = `release:${lucene(title)} AND artist:${lucene(album.artist)} AND status:official`;
    const data = await mb(`/release?query=${encodeURIComponent(q)}&limit=25`);
    const releases: any[] = data.releases ?? [];
    if (!releases.length) continue;
    const scored = releases
      .map((r) => {
        let s = 0;
        if (norm(r.title) === norm(title)) s += 3;
        const count = r['track-count'] ?? 0;
        if (count === want) s += 4;
        else if (Math.abs(count - want) <= 2) s += 1;
        if (r['release-group']?.['primary-type'] === 'Album') s += 1;
        if (r.date) s += 0.5;
        return { r, s, date: r.date ?? '9999' };
      })
      .sort((a, b) => b.s - a.s || a.date.localeCompare(b.date)); // ties: oldest (often the best-credited)
    if (scored[0].s >= 3) return scored[0].r;
  }
  return null;
}

// --- Credits --------------------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function roleLabel(type: string, attrs: string[] = []) {
  const a = attrs.filter((x) => !['additional', 'assistant'].includes(x));
  switch (type) {
    case 'producer':
      return a.includes('executive') ? 'Executive producer' : a.includes('co') ? 'Co-producer' : 'Producer';
    case 'engineer':
    case 'audio':
      return 'Engineer';
    case 'sound':
      return 'Sound';
    case 'recording':
      return 'Recording';
    case 'mix':
      return 'Mix';
    case 'mastering':
      return 'Mastering';
    case 'programming':
      return 'Programming';
    case 'arranger':
    case 'instrument arranger':
    case 'vocal arranger':
      return 'Arranger';
    case 'instrument':
      return a.length ? cap(a.join(', ')) : 'Instrument';
    case 'vocal':
      if (a.includes('lead vocals')) return 'Lead vocals';
      if (a.includes('background vocals')) return 'Background vocals';
      return a.length ? cap(a.join(', ')) : 'Vocals';
    case 'performer':
      return a.includes('guest') ? 'Featured artist' : 'Performer';
    case 'composer':
      return 'Composer';
    case 'lyricist':
      return 'Lyricist';
    case 'writer':
      return 'Written by';
    case 'conductor':
      return 'Conductor';
    case 'orchestra':
      return 'Orchestra';
    case 'remixer':
      return 'Remix';
    default:
      return cap(type);
  }
}

const ROLE_ORDER = [
  'Lead vocals',
  'Vocals',
  'Featured artist',
  'Performer',
  'Producer',
  'Co-producer',
  'Executive producer',
  'Written by',
  'Lyricist',
  'Composer',
  'Arranger',
];

function collect(relations: any[] = [], includeWorks = true): Credit[] {
  const byRole = new Map<string, Set<string>>();
  const add = (role: string, name?: string) => {
    if (!name) return;
    if (!byRole.has(role)) byRole.set(role, new Set());
    byRole.get(role)!.add(name);
  };
  for (const r of relations) {
    if (r.artist) add(roleLabel(r.type, r.attributes), r['target-credit'] || r.artist.name);
    if (includeWorks && r.work) for (const wr of r.work.relations ?? []) if (wr.artist) add(roleLabel(wr.type, wr.attributes), wr.artist.name);
  }
  const rank = (role: string) => {
    const i = ROLE_ORDER.indexOf(role);
    return i === -1 ? ROLE_ORDER.length : i;
  };
  return [...byRole]
    .map(([role, names]) => ({ role, names: [...names] }))
    .sort((a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role));
}

/** Pair MusicBrainz tracks with our YouTube tracks: by title, otherwise by position. */
function matchTracks(album: AlbumDoc, mbTracks: any[]): TrackMeta[] {
  const used = new Set<number>();
  const base = (s: string) => norm(s.replace(/\s*[([].*$/, ''));
  return album.tracks.map((t, i) => {
    const want = base(t.title);
    let j = mbTracks.findIndex((m, k) => !used.has(k) && base(m.title) === want);
    if (j === -1) j = mbTracks.findIndex((m, k) => !used.has(k) && want.length > 3 && (base(m.title).includes(want) || want.includes(base(m.title))));
    if (j === -1 && mbTracks.length === album.tracks.length && !used.has(i)) j = i;
    if (j === -1) return { index: t.index, credits: [] };
    used.add(j);
    return { index: t.index, mbTitle: mbTracks[j].title, credits: collect(mbTracks[j].recording?.relations) };
  });
}

// --- Wikipedia ------------------------------------------------------------------

async function wikipedia(wikidataUrl: string | undefined) {
  const qid = wikidataUrl?.match(/Q\d+/)?.[0];
  if (!qid) return undefined;
  const entity = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const links = entity && (Object.values(entity.entities)[0] as any)?.sitelinks;
  for (const lang of ['en']) {
    const title = links?.[`${lang}wiki`]?.title;
    if (!title) continue;
    const s = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (s?.extract && s.type !== 'disambiguation')
      return { title: s.title, extract: s.extract, url: s.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`, lang };
  }
  return undefined;
}

// --- Album metadata ---------------------------------------------------------------

const LINK_TYPES: Record<string, string> = {
  discogs: 'Discogs',
  allmusic: 'AllMusic',
  review: 'Review',
  'discography entry': 'Last.fm',
  lyrics: 'Lyrics (Genius)',
};

export async function fetchAlbumMeta(album: AlbumDoc): Promise<AlbumMeta> {
  const empty: AlbumMeta = { found: false, labels: [], formats: [], genres: [], credits: [], tracks: [], links: [], sources: [] };
  const hit = await findRelease(album);
  if (!hit) return empty;

  const inc = 'recordings+artist-credits+labels+release-groups+genres+artist-rels+recording-level-rels+work-rels+work-level-rels+release-group-level-rels+url-rels';
  const r = await mb(`/release/${hit.id}?inc=${inc}`);
  const rg = r['release-group'] ?? {};
  const mbTracks = (r.media ?? []).flatMap((m: any) => m.tracks ?? []);
  const urlRels: any[] = [...(rg.relations ?? []), ...(r.relations ?? [])].filter((x) => x.url?.resource);

  const links: { label: string; url: string }[] = [];
  for (const u of urlRels) {
    const label = LINK_TYPES[u.type];
    // Reviews may appear more than once; other sources once.
    if (label && !links.some((l) => l.url === u.url.resource || (l.label === label && label !== 'Review')))
      links.push({ label, url: u.url.resource });
  }
  const wiki = await wikipedia(urlRels.find((u) => u.type === 'wikidata')?.url.resource);

  const genres = [...(rg.genres ?? []), ...(r.genres ?? [])]
    .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
    .map((g: any) => g.name)
    .filter((g: string, i: number, all: string[]) => all.indexOf(g) === i)
    .slice(0, 8);

  return {
    found: true,
    releaseDate: r.date,
    firstReleased: rg['first-release-date'],
    country: r.country,
    labels: Object.values(
      (r['label-info'] ?? [])
        .filter((l: any) => l.label)
        .reduce((acc: Record<string, { name: string; catalogNumber?: string }>, l: any) => {
          const cur = (acc[l.label.name] ??= { name: l.label.name });
          const cat = l['catalog-number'];
          if (cat) cur.catalogNumber = cur.catalogNumber ? `${cur.catalogNumber}, ${cat}` : cat;
          return acc;
        }, {}),
    ),
    barcode: r.barcode || undefined,
    formats: [...new Set<string>((r.media ?? []).map((m: any) => m.format).filter(Boolean))],
    genres,
    credits: collect(r.relations, false),
    tracks: matchTracks(album, mbTracks),
    wiki,
    links: links.slice(0, 8),
    sources: [
      { label: 'MusicBrainz', url: `https://musicbrainz.org/release/${r.id}` },
      ...(wiki ? [{ label: 'Wikipedia', url: wiki.url }] : []),
    ],
  };
}
