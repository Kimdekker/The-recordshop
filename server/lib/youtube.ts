import { env } from './env.ts';
import { HttpError } from './http.ts';
import { rarityFor } from './tokens.ts';
import { Album, ALBUM_VERSION, type AlbumDoc } from '../models/Album.ts';
import type { SearchResult, Track } from '../../shared/types.ts';

/*
 * Quota costs (10,000 units/day):
 *   search.list         100 per call  → results cached in MongoDB
 *   playlists.list        1
 *   playlistItems.list    1 per 50 tracks
 *   videos.list           1 per 50 tracks
 *   channels.list         1
 *
 * "Official" — the Data API doesn't expose YouTube Music albums (OLAK5uy_).
 * So we look at the *tracks* of a playlist: a playlist counts as an official
 * release when ≥ 80% of its videos come from the artist's auto-generated
 * "Artist - Topic" channel (label audio), a VEVO channel or the artist's own
 * channel. Fan uploads, lyric channels and compilations drop out.
 */

const BASE = 'https://www.googleapis.com/youtube/v3';
export const OFFICIAL_SHARE = 0.8;
const MIN_TRACKS = 5;
const MAX_TRACKS = 40;

async function yt<T = any>(endpoint: string, params: Record<string, string | number>): Promise<T> {
  if (!env.youtubeKey) throw new HttpError(500, 'YOUTUBE_API_KEY is missing from .env');
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: env.youtubeKey })) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  const body = (await res.json()) as any;
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new HttpError(429, "The daily YouTube quota is used up. Back tomorrow!");
    if (res.status === 404 || reason === 'playlistNotFound') throw new HttpError(404, 'Album not found on YouTube');
    throw new HttpError(502, body?.error?.message ?? `YouTube API ${res.status}`);
  }
  return body as T;
}

// --- Text ----------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** search.list returns HTML-encoded titles ("d&#39;Amour"). */
export const decode = (s = '') =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e.toLowerCase()] ?? m),
  );

export const norm = (s: string) =>
  decode(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
const compact = (s: string) => norm(s).replace(/\s/g, '');

const stripTopic = (channel: string) => decode(channel).replace(/\s*-\s*Topic$/i, '').trim();
const isTopic = (channel = '') => /\s-\sTopic$/i.test(channel);
const isVevo = (channel = '') => /vevo$/i.test(channel.trim());

// Parentheticals that describe the upload, not the album.
const NOISY_PAREN = /album|vinyl|remaster|official|\bhq\b|\bhd\b|lyric|audio|playlist|explicit|\b(19|20)\d\d\b|full|complete|lossless|stream/i;
const NOISY_PART = /^(full|complete|official)?\s*(vinyl\s*)?(album|lp|playlist)$|full album|lossless|\brip\b|\bhq\b|playlist|high quality/i;
/** Playlists that are definitely not a regular album. */
export const NOT_AN_ALBUM =
  /\b(live|tour|concert|session|livestream|behind the scenes|bts|lyrics?|covers?|karaoke|reaction|instrumentals?|slowed|reverb|sped up|8d|tribute|mix|best of|greatest hits|top \d+|hits|discography|music videos?|videos|official videos|shorts|remix(es)?|acoustic|interview|singles|playlist of|essentials|deep cuts|track[- ]by[- ]track|commentary)\b/i;

const titleCase = (s: string) =>
  s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/(^|\s|\()\p{L}/gu, (c) => c.toUpperCase()) : s;

/** "Fleetwood Mac - Rumours (Official Album Playlist)" → artist + title. */
export function parseAlbumTitle(raw: string, channel: string) {
  const t = decode(raw)
    .replace(/^(album|full album|lp)\s*[-–:]\s*/i, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s*[([][^)\]]*[)\]]/g, (m) => (NOISY_PAREN.test(m) ? '' : m));
  const parts = t
    .split(/\s+[-–—|:]\s+|:\s+/)
    .filter((p) => p && !NOISY_PART.test(p.trim()))
    .map((p) => p.replace(/\s+(full\s+)?(album|lp|ep)$/i, '').trim())
    .filter(Boolean);
  let artist = stripTopic(channel).replace(/vevo$/i, '').trim();
  let title = parts.join(' - ');
  if (parts.length >= 2) {
    [artist, title] = [parts[0], parts[1]];
  } else {
    const m = /^(.+?)\s*\(([^)]+)\)$/.exec(title); // "RUMOURS (Fleetwood Mac)"
    if (m) [title, artist] = [m[1], m[2]];
  }
  return { artist: titleCase(artist.trim()), title: titleCase(title.trim() || decode(raw)) };
}

/** Album title once the artist is known: strips the name, quotes and "Album". */
export function albumTitleFor(raw: string, artist: string) {
  const t = parseAlbumTitle(raw, artist);
  // "Nas + DJ Premier - Light-Years": the parsed artist starts with the artist → take the parsed title.
  const sameArtist = norm(t.artist) === norm(artist) || norm(t.artist).startsWith(`${norm(artist)} `);
  let title = sameArtist ? t.title : decode(raw);
  title = title
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s*[([][^)\]]*[)\]]/g, (m) => (NOISY_PAREN.test(m) ? '' : m))
    // Only strip with a separator/space after it: "Nastradamus" stays intact.
    .replace(new RegExp(`^${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*[-–:|+]\\s*|\\s+)`, 'i'), '')
    .replace(/['‘’"“”]\s*(the\s+)?(album|lp)\b.*$/i, '') // "Illmatic' Album 30th Anniversary"
    .replace(/\s+(the\s+)?(album|lp)$/i, '')
    .replace(new RegExp(`(?:\\s*[-–:|]\\s*|\\s+)${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '') // "illmatic Nas"
    .trim()
    .replace(/^['‘’"“”]+|['‘’"“”]+$/g, '')
    .trim();
  return titleCase(title || decode(raw));
}

/** "Fleetwood Mac - Dreams (Official Music Video)" → "Dreams". */
function cleanTrackTitle(raw: string, artist: string) {
  let t = decode(raw).replace(/\s*[([][^)\]]*[)\]]/g, (m) =>
    /official|lyric|audio|\bhd\b|\bhq\b|\b4k\b|visuali[sz]er|video|remaster|\bmono\b|\bstereo\b|explicit/i.test(m) ? '' : m,
  );
  const prefix = new RegExp(`^${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i');
  t = t.replace(prefix, '');
  return t.trim() || decode(raw);
}

const isoDuration = (iso: string) => {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso) ?? [];
  return +(m[1] ?? 0) * 86400 + +(m[2] ?? 0) * 3600 + +(m[3] ?? 0) * 60 + +(m[4] ?? 0);
};

/**
 * maxres (1280×720) and mqdefault (320×180) are 16:9 without black bars;
 * hq/sd are 4:3 with bars. Cropped to a centred square you get the album art.
 */
const thumb = (t: any): string | null => {
  const url: string | undefined = (t?.maxres ?? t?.medium ?? t?.high ?? t?.default)?.url;
  return url?.replace(/\/(hq|sd)default(\.jpg)/, '/mqdefault$2') ?? null;
};

// --- Checking whether a playlist is an official release -----------------------

export interface Inspected {
  id: string;
  rawTitle: string;
  channel: string;
  artist: string;
  title: string;
  cover: string | null;
  count: number;
  officialShare: number;
  topicShare: number;
  /** Share of distinct songs (low = one single with remixes/versions). */
  distinctShare: number;
}

/** Majority "Artist - Song" prefix in the track titles (VEVO/own channel). */
function artistFromTrackTitles(titles: string[]) {
  const counts = new Map<string, { name: string; n: number }>();
  for (const t of titles) {
    const m = /^(.+?)\s+[-–—]\s+/.exec(decode(t));
    if (!m) continue;
    const name = m[1].split(/\s+(?:ft\.?|feat\.?|featuring|x|&|,)\s+/i)[0].trim();
    const k = norm(name);
    counts.set(k, { name, n: (counts.get(k)?.n ?? 0) + 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best && best.n >= titles.length * 0.5 ? best.name : undefined;
}

/**
 * Who uploaded the tracks? Determines the artist and the share of
 * official uploads. Costs 1 unit per playlist.
 */
async function inspect(pl: { id: string; rawTitle: string; channel: string }): Promise<Inspected | null> {
  const page = await yt('playlistItems', { part: 'snippet', playlistId: pl.id, maxResults: 50 }).catch(() => null);
  const items: any[] = page?.items ?? [];
  if (!items.length) return null;
  const owners = items.map((i) => decode(i.snippet.videoOwnerChannelTitle ?? ''));

  // Artist: majority Topic channel, otherwise the name from the playlist title.
  const topicCounts = new Map<string, number>();
  for (const o of owners) if (isTopic(o)) topicCounts.set(stripTopic(o), (topicCounts.get(stripTopic(o)) ?? 0) + 1);
  const topTopic = [...topicCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const artist = topTopic ?? artistFromTrackTitles(items.map((i) => i.snippet.title)) ?? parseAlbumTitle(pl.rawTitle, pl.channel).artist;

  const official = (o: string) =>
    (isTopic(o) && norm(stripTopic(o)).includes(norm(artist).split(' ')[0] ?? '')) ||
    (isVevo(o) && compact(o).includes(compact(artist).slice(0, 6))) ||
    norm(o) === norm(artist);
  const officialShare = owners.filter(official).length / owners.length;
  const topicShare = owners.filter(isTopic).length / owners.length;
  const firstOfficial = items.find((i) => official(decode(i.snippet.videoOwnerChannelTitle ?? ''))) ?? items[0];

  // "Espresso", "Espresso (sped up)", "Espresso - Acoustic" → 1 song.
  const base = (t: string) =>
    norm(cleanTrackTitle(t, artist).replace(/\s*[([].*$/, '').split(/\s+[-–—]\s+/)[0]);
  const distinctShare = new Set(items.map((i) => base(i.snippet.title))).size / items.length;

  return {
    id: pl.id,
    rawTitle: decode(pl.rawTitle),
    channel: decode(pl.channel),
    artist,
    title: albumTitleFor(pl.rawTitle, artist),
    cover: thumb(firstOfficial.snippet.thumbnails),
    count: page.pageInfo?.totalResults ?? items.length,
    officialShare,
    topicShare,
    distinctShare,
  };
}

/** Playlist owned by the artist themselves (own channel or VEVO). */
const ownedByArtist = (p: Inspected) =>
  norm(p.channel) === norm(p.artist) || (isVevo(p.channel) && compact(p.channel).startsWith(compact(p.artist).slice(0, 6)));

/**
 * Official = playlist from the artist/VEVO channel itself with official
 * tracks, or (made by anyone) ≥ 80% label audio from the Topic channel.
 * Fan playlists of music videos, lyric versions and so on drop out.
 */
const isOfficialAlbum = (p: Inspected) =>
  (ownedByArtist(p) ? p.officialShare >= OFFICIAL_SHARE : p.topicShare >= OFFICIAL_SHARE) &&
  p.count >= MIN_TRACKS &&
  p.count <= MAX_TRACKS &&
  !NOT_AN_ALBUM.test(p.rawTitle) &&
  !/\bEP\b/.test(p.rawTitle) &&
  p.distinctShare >= 0.7 &&
  !NOISY_PART.test(p.title) &&
  p.title.length > 1;

/** One per album: prefer label audio (Topic), then the most official, then the artist's own channel. */
/** Same album? "Singular Act I" = "Singular Act 1", "(Deluxe)" doesn't count. */
export function albumKey(artist: string, title: string) {
  const roman: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };
  const t = norm(title)
    .replace(/\b(deluxe|edition|expanded|version)\b/g, '')
    .replace(/\b(i{1,3}|iv|v)\b/g, (r) => roman[r])
    .replace(/\s+/g, ' ')
    .trim();
  return `${norm(artist)}|${t}`;
}

function dedupe(list: Inspected[]) {
  const best = new Map<string, Inspected>();
  const score = (p: Inspected) => p.topicShare * 2 + p.officialShare + (norm(p.channel) === norm(p.artist) ? 0.5 : 0);
  for (const p of list) {
    const key = albumKey(p.artist, p.title);
    const cur = best.get(key);
    if (!cur || score(p) > score(cur)) best.set(key, p);
  }
  return [...best.values()];
}

const toResult = (p: Inspected): Omit<SearchResult, 'inCatalogue'> => ({
  id: p.id,
  title: p.title,
  artist: p.artist,
  cover: p.cover,
  official: true,
});

// --- Search ---------------------------------------------------------------------

async function searchPlaylists(q: string, max = 25) {
  const data = await yt('search', { part: 'snippet', type: 'playlist', maxResults: max, q });
  return (data.items as any[]).map((it) => ({
    id: it.id.playlistId as string,
    rawTitle: decode(it.snippet.title),
    channel: decode(it.snippet.channelTitle),
  }));
}

/** Search official albums. ~100 + 15 units, the caller caches. */
export async function searchOfficialAlbums(q: string) {
  const hits = (await searchPlaylists(`${q} album`))
    .filter((h) => !NOT_AN_ALBUM.test(h.rawTitle))
    .slice(0, 15);
  const inspected = (await Promise.all(hits.map(inspect))).filter((p): p is Inspected => !!p && isOfficialAlbum(p));
  return dedupe(inspected).map(toResult);
}

// --- Artist ---------------------------------------------------------------------

/**
 * All official albums of an artist: the playlists on the artist's own
 * channel and VEVO channel, plus verified search results.
 * ~200 + 20 units, the caller caches.
 */
export async function artistAlbums(name: string) {
  const target = norm(name);
  const channels = await yt('search', { part: 'snippet', type: 'channel', maxResults: 10, q: name });
  const candidates = (channels.items as any[])
    .map((c) => ({ id: c.id.channelId as string, title: decode(c.snippet.channelTitle) }))
    .filter((c) => !isTopic(c.title) && (norm(c.title) === target || compact(c.title) === `${compact(name)}vevo`));

  // Fakes often share the exact name: take the channel with the most subscribers (+ VEVO).
  let own: string | undefined;
  let vevo: string | undefined;
  if (candidates.length) {
    const stats = await yt('channels', { part: 'statistics', id: candidates.map((c) => c.id).join(',') });
    const subs = new Map<string, number>((stats.items as any[]).map((s) => [s.id, Number(s.statistics.subscriberCount ?? 0)]));
    const ranked = candidates.sort((a, b) => (subs.get(b.id) ?? 0) - (subs.get(a.id) ?? 0));
    own = ranked.find((c) => !isVevo(c.title))?.id;
    vevo = ranked.find((c) => isVevo(c.title))?.id;
  }

  const fromChannels: Inspected[] = [];
  for (const channelId of [own, vevo].filter(Boolean) as string[]) {
    const pls = await yt('playlists', { part: 'snippet,contentDetails', channelId, maxResults: 50 });
    const candidates = (pls.items as any[]).filter((p) => {
      const rawTitle = decode(p.snippet.title);
      const count = p.contentDetails.itemCount;
      return count >= MIN_TRACKS && count <= MAX_TRACKS && !NOT_AN_ALBUM.test(rawTitle) && !/\bEP\b/.test(rawTitle);
    });
    // Fetch the tracks too (1 unit each): weeds out single packages and gives the right cover.
    const inspected = await Promise.all(
      candidates.map((p) => inspect({ id: p.id, rawTitle: p.snippet.title, channel: p.snippet.channelTitle })),
    );
    for (const p of inspected) if (p && isOfficialAlbum({ ...p, artist: name })) fromChannels.push({ ...p, artist: name, title: albumTitleFor(p.rawTitle, name) });
  }

  const searched = (await searchOfficialAlbumsRaw(name)).filter((p) => norm(p.artist) === target);
  return dedupe([...searched, ...fromChannels]).map(toResult);
}

async function searchOfficialAlbumsRaw(q: string) {
  const hits = (await searchPlaylists(`${q} album`))
    .filter((h) => !NOT_AN_ALBUM.test(h.rawTitle))
    .slice(0, 15);
  return (await Promise.all(hits.map(inspect))).filter((p): p is Inspected => !!p && isOfficialAlbum(p));
}

// --- Importing an album ----------------------------------------------------------

const MIN_DURATION = 15 * 60;
const MAX_DURATION = 3 * 60 * 60;

/**
 * Fetches a playlist, checks that it's an official album and stores it.
 * Tracks that can't be embedded are left out.
 */
export async function importAlbum(playlistId: string): Promise<AlbumDoc> {
  const meta = await yt('playlists', { part: 'snippet', id: playlistId });
  const pl = meta.items?.[0];
  if (!pl) throw new HttpError(404, 'Album not found on YouTube');

  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const page = await yt('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {}),
    });
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken && items.length < MAX_TRACKS + 10);
  if (items.length > MAX_TRACKS) throw new HttpError(422, "This doesn't look like an album: too many tracks.");

  const ids = items.map((i) => i.contentDetails.videoId);
  const videos = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 50) {
    const v = await yt('videos', { part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(',') });
    for (const it of v.items) videos.set(it.id, it);
  }

  // Artist from the uploaders (Topic channel), otherwise from the title.
  const owners = ids.map((id) => decode(videos.get(id)?.snippet?.channelTitle ?? ''));
  const topic = owners.filter(isTopic).map(stripTopic);
  const topTopic = topic.sort((a, b) => topic.filter((x) => x === b).length - topic.filter((x) => x === a).length)[0];
  const artist = topTopic ?? parseAlbumTitle(pl.snippet.title, pl.snippet.channelTitle).artist;
  const official = (o: string) =>
    (isTopic(o) && norm(stripTopic(o)) === norm(artist)) ||
    (isVevo(o) && compact(o).includes(compact(artist).slice(0, 6))) ||
    norm(o) === norm(artist);
  const officialShare = owners.filter(official).length / Math.max(1, owners.length);
  if (officialShare < OFFICIAL_SHARE) throw new HttpError(422, "This isn't an official release by the artist.");

  const tracks: Track[] = [];
  let views = 0;
  for (const id of ids) {
    const v = videos.get(id);
    if (!v || !v.status?.embeddable || v.status?.privacyStatus === 'private') continue;
    const duration = isoDuration(v.contentDetails.duration);
    if (!duration) continue;
    tracks.push({ index: tracks.length, videoId: id, title: cleanTrackTitle(v.snippet.title, artist), duration });
    views += Number(v.statistics?.viewCount ?? 0);
  }

  const totalDuration = tracks.reduce((s, t) => s + t.duration, 0);
  if (tracks.length < MIN_TRACKS - 1 || totalDuration < MIN_DURATION)
    throw new HttpError(422, "This doesn't look like a complete album (too few playable tracks).");
  if (totalDuration > MAX_DURATION) throw new HttpError(422, "This doesn't look like an album: way too long.");

  const firstVideo = videos.get(tracks[0].videoId);
  const yearMatch = /\b(19[5-9]\d|20[0-3]\d)\b/.exec(pl.snippet.title + ' ' + (pl.snippet.description ?? ''));
  const avgViews = Math.round(views / tracks.length);

  return Album.findOneAndUpdate(
    { _id: playlistId },
    {
      $set: {
        version: ALBUM_VERSION,
        title: albumTitleFor(pl.snippet.title, artist),
        artist,
        // Cover = art of the first track: the same image as in the search results.
        cover: thumb(firstVideo?.snippet?.thumbnails) ?? thumb(pl.snippet.thumbnails),
        year: yearMatch ? Number(yearMatch[1]) : null,
        tracks,
        totalDuration,
        avgViews,
        rarity: rarityFor(avgViews),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<AlbumDoc>() as Promise<AlbumDoc>;
}

export async function getOrImportAlbum(id: string): Promise<AlbumDoc> {
  if (!/^[\w-]{10,64}$/.test(id)) throw new HttpError(400, 'Invalid album ID');
  const existing = await Album.findById(id).lean<AlbumDoc>();
  if (existing?.version === ALBUM_VERSION) return existing;
  if (!existing) return importAlbum(id);
  // Imported with older logic: refresh (counts, reviews and listens stay intact).
  return importAlbum(id).catch(() => existing);
}
