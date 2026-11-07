import { Schema, model } from 'mongoose';
import { Album, ALBUM_VERSION, type AlbumDoc } from '../models/Album.ts';
import { albumKey, getOrImportAlbum, norm, searchOfficialAlbums } from './youtube.ts';
import { fetchAlbumMeta } from './metadata.ts';
import { env } from './env.ts';
import { HttpError } from './http.ts';

/*
 * Starter catalogue: well-known (and a few lesser-known) albums, so the
 * discover page is full from day one. Runs in the background at startup and
 * only fetches what isn't done yet; progress is kept in `catalogueseeds`.
 * Cost: ~120 YouTube units per album (search + checks), once.
 */
export const STARTER_ALBUMS: [artist: string, album: string][] = [
  ['Michael Jackson', 'Thriller'],
  ['Pink Floyd', 'The Dark Side of the Moon'],
  ['Amy Winehouse', 'Back to Black'],
  ['Kendrick Lamar', 'good kid, m.A.A.d city'],
  ['Daft Punk', 'Random Access Memories'],
  ['Radiohead', 'OK Computer'],
  ['Lauryn Hill', 'The Miseducation of Lauryn Hill'],
  ['Nirvana', 'Nevermind'],
  ['Adele', '21'],
  ['Prince', 'Purple Rain'],
  ['Stevie Wonder', 'Songs in the Key of Life'],
  ['Marvin Gaye', "What's Going On"],
  ['The Beatles', 'Abbey Road'],
  ['David Bowie', 'The Rise and Fall of Ziggy Stardust and the Spiders from Mars'],
  ['Arctic Monkeys', 'AM'],
  ['Tame Impala', 'Currents'],
  ['The Strokes', 'Is This It'],
  ['A Tribe Called Quest', 'The Low End Theory'],
  ['OutKast', 'Aquemini'],
  ['Erykah Badu', 'Baduizm'],
  ["D'Angelo", 'Voodoo'],
  ['Massive Attack', 'Mezzanine'],
  ['Portishead', 'Dummy'],
  ['Bon Iver', 'For Emma, Forever Ago'],
  ['Sade', 'Diamond Life'],
  ['Miles Davis', 'Kind of Blue'],
  ['Talking Heads', 'Remain in Light'],
  ['Joni Mitchell', 'Blue'],
  ['Gorillaz', 'Demon Days'],
  ['Mac Miller', 'Swimming'],
  ['Little Simz', 'Sometimes I Might Be Introvert'],
  ['Tyler, The Creator', 'IGOR'],
  ['SZA', 'SOS'],
  ['Khruangbin', 'Con Todo El Mundo'],
  ['Hiatus Kaiyote', 'Choose Your Weapon'],
  ['Nick Drake', 'Pink Moon'],
];

const seedSchema = new Schema({
  _id: String, // albumKey of the wish
  albumId: { type: String, default: null },
  error: { type: String, default: null },
  at: { type: Date, default: Date.now },
});
const CatalogueSeed = model('CatalogueSeed', seedSchema);

const words = (s: string) => norm(s).split(' ').filter(Boolean);
/** Does the found album match the wish? Artist name and all title words must be in it. */
function matches(want: [string, string], got: { artist: string; title: string }) {
  const artistOk = norm(got.artist).includes(norm(want[0])) || norm(want[0]).includes(norm(got.artist));
  const title = new Set(words(got.title));
  return artistOk && words(want[1]).every((w) => title.has(w));
}

let running = false;

/**
 * We know the right name of starter albums, so use it: fan-made playlists of
 * official audio sometimes have titles like "12-The Beatles - Abbey road".
 * A new name means new metadata (MusicBrainz searches on it).
 */
async function useCanonicalName(albumId: string, [artist, title]: [string, string]) {
  const a = await Album.findById(albumId, { title: 1, artist: 1 }).lean<AlbumDoc>();
  if (!a || (a.title === title && a.artist === artist)) return;
  await Album.updateOne({ _id: albumId }, { $set: { title, artist, meta: null, metaFetchedAt: null } });
}

export async function seedCatalogue() {
  if (running || !env.youtubeKey) return;
  running = true;
  let added = 0;
  try {
    const seeds = await CatalogueSeed.find().lean();
    const done = new Map(seeds.map((d) => [String(d._id), d.albumId as string | null]));
    for (const want of STARTER_ALBUMS) {
      const key = albumKey(...want);
      if (done.has(key)) {
        const id = done.get(key);
        if (id) await useCanonicalName(id, want);
        continue;
      }
      try {
        const results = await searchOfficialAlbums(`${want[0]} ${want[1]}`);
        const hit = results.find((r) => matches(want, r));
        if (!hit) throw new Error('not found');
        const album = await getOrImportAlbum(hit.id);
        await CatalogueSeed.create({ _id: key, albumId: album._id });
        await useCanonicalName(album._id, want);
        added++;
      } catch (err) {
        // Quota exhausted: stop, and try again at the next start.
        if (err instanceof HttpError && err.status === 429) {
          console.warn('[seed] YouTube quota used up, continuing tomorrow');
          break;
        }
        await CatalogueSeed.create({ _id: key, error: (err as Error).message });
      }
    }
    // Albums without metadata: fetch it (genres for "Voor jou"). Free, no YouTube;
    // MusicBrainz queues itself at 1 request/s.
    const bare = await Album.find({ version: ALBUM_VERSION, meta: null }, { _id: 1 }).limit(50).lean();
    for (const { _id } of bare) {
      const album = await Album.findById(_id).lean<AlbumDoc>();
      if (!album) continue;
      const meta = await fetchAlbumMeta(album).catch(() => null);
      if (meta) await Album.updateOne({ _id }, { $set: { meta, metaFetchedAt: new Date() } });
    }
  } finally {
    running = false;
    if (added) console.log(`[seed] ${added} albums added to the catalog`);
  }
}
