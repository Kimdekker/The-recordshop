import { Router } from 'express';
import { Album, toSummary, type AlbumDoc } from '../models/Album.ts';
import { Listen } from '../models/Listen.ts';
import { Review, toReviewDTO, type ReviewDoc } from '../models/Review.ts';
import { SearchCache } from '../models/SearchCache.ts';
import { User } from '../models/User.ts';
import { albumKey, artistAlbums, getOrImportAlbum, norm, searchOfficialAlbums } from '../lib/youtube.ts';
import { ALBUM_VERSION } from '../models/Album.ts';
import { priceFor, rewardFor } from '../lib/tokens.ts';
import { fetchAlbumMeta } from '../lib/metadata.ts';
import { requireUser } from '../lib/auth.ts';
import { HttpError, route } from '../lib/http.ts';
import type { AlbumDetail, SearchResult } from '../../shared/types.ts';

export const albums = Router();

type YtResult = Omit<SearchResult, 'inCatalogue'>;

/** Cache in MongoDB (a week): search.list costs 100 units. */
async function cached(key: string, load: () => Promise<YtResult[]>) {
  const hit = (await SearchCache.findById(key).lean())?.results as YtResult[] | undefined;
  if (hit) return hit;
  const results = await load();
  await SearchCache.updateOne({ _id: key }, { results, createdAt: new Date() }, { upsert: true });
  return results;
}

/** Albums that are already in the catalogue get its data (cover/title from the import). */
async function withCatalogue(list: YtResult[]): Promise<SearchResult[]> {
  const known = await Album.find({ _id: { $in: list.map((r) => r.id) } }).lean<AlbumDoc[]>();
  const byId = new Map(known.map((a) => [a._id, a]));
  return list.map((r) => {
    const a = byId.get(r.id);
    return a ? { ...r, title: a.title, artist: a.artist, cover: a.cover, inCatalogue: true } : { ...r, inCatalogue: false };
  });
}

/** Search: official albums only. First our own catalogue (free), then YouTube (cached). */
albums.get(
  '/search',
  route(async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    if (!q) return res.json({ results: [] });

    const [found, local] = await Promise.all([
      cached(`search:v2:${norm(q)}`, () => searchOfficialAlbums(q)),
      Album.find({ $text: { $search: q }, version: ALBUM_VERSION }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(6)
        .lean<AlbumDoc[]>(),
    ]);
    // Searching for an artist (name in the query)? Then add their full discography too.
    const nq = norm(q);
    const artist = [...new Set(found.map((r) => r.artist))].find((a) => norm(a).length > 1 && nq.includes(norm(a)));
    const discography = artist ? await cached(`artist:v2:${norm(artist)}`, () => artistAlbums(artist)).catch(() => []) : [];
    const seen = new Set(found.map((f) => albumKey(f.artist, f.title)));
    const yt = [...found, ...discography.filter((d) => !seen.has(albumKey(d.artist, d.title)))];

    const localResults: SearchResult[] = local.map((a) => ({
      id: a._id,
      title: a.title,
      artist: a.artist,
      cover: a.cover,
      official: true,
      inCatalogue: true,
    }));
    const results = [...localResults, ...(await withCatalogue(yt.filter((r) => !local.some((a) => a._id === r.id))))];
    res.json({ results });
  }),
);

/** All official albums by an artist. */
albums.get(
  '/artist/:name',
  route(async (req, res) => {
    const name = String(req.params.name).trim().slice(0, 100);
    if (!name) throw new HttpError(400, 'Geen artiest opgegeven');
    const yt = await cached(`artist:v2:${norm(name)}`, () => artistAlbums(name));
    const local = await Album.find({ artist: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), version: ALBUM_VERSION })
      .limit(50)
      .lean<AlbumDoc[]>();
    const merged = await withCatalogue([
      ...yt,
      ...local.filter((a) => !yt.some((r) => r.id === a._id)).map((a) => ({ id: a._id, title: a.title, artist: a.artist, cover: a.cover, official: true })),
    ]);
    res.json({ artist: name, albums: merged });
  }),
);

/** Shelves for the discover page, all straight from the database (no quota). */
albums.get(
  '/shelves',
  route(async (_req, res) => {
    const [recent, topRated, gems] = await Promise.all([
      Album.find({ lastListenedAt: { $ne: null } }).sort({ lastListenedAt: -1 }).limit(12).lean<AlbumDoc[]>(),
      Album.aggregate<AlbumDoc>([
        { $match: { ratingCount: { $gt: 0 } } },
        { $addFields: { avg: { $divide: ['$ratingSum', '$ratingCount'] } } },
        { $sort: { avg: -1, ratingCount: -1 } },
        { $limit: 12 },
      ]),
      Album.find({ rarity: { $in: ['ontdekking', 'verborgen parel'] } }).sort({ createdAt: -1 }).limit(12).lean<AlbumDoc[]>(),
    ]);
    res.json({ recent: recent.map(toSummary), topRated: topRated.map(toSummary), gems: gems.map(toSummary) });
  }),
);

albums.get(
  '/:id',
  route(async (req, res) => {
    const a = await getOrImportAlbum(req.params.id);
    const detail: AlbumDetail = {
      ...toSummary(a),
      tracks: a.tracks,
      reward: rewardFor(a.rarity),
      price: priceFor(a.rarity),
    };
    if (req.user) {
      const [listens, review] = await Promise.all([
        Listen.countDocuments({ user: req.user._id, album: a._id, finishedAt: { $ne: null } }),
        Review.findOne({ user: req.user._id, album: a._id }).lean<ReviewDoc>(),
      ]);
      detail.me = {
        owned: req.user.records.some((r) => r.album === a._id),
        listens,
        review: review ? toReviewDTO(review) : null,
      };
    }
    res.json({ album: detail });
  }),
);

const WEEK = 7 * 24 * 60 * 60 * 1000;
const metaInFlight = new Map<string, Promise<unknown>>();

/** Album metadata (MusicBrainz + Wikipedia). Fetched once and cached; not found is retried after a week. */
albums.get(
  '/:id/meta',
  route(async (req, res) => {
    const album = await getOrImportAlbum(req.params.id);
    const fresh = album.meta && (album.meta.found || Date.now() - +new Date(album.metaFetchedAt ?? 0) < WEEK);
    if (fresh) return res.json({ meta: album.meta });
    // Two visitors at once? Then only one fetch.
    let job = metaInFlight.get(album._id);
    if (!job) {
      job = fetchAlbumMeta(album)
        .then((meta) => Album.updateOne({ _id: album._id }, { $set: { meta, metaFetchedAt: new Date() } }).then(() => meta))
        .finally(() => metaInFlight.delete(album._id));
      metaInFlight.set(album._id, job);
    }
    res.json({ meta: await job });
  }),
);

albums.get(
  '/:id/reviews',
  route(async (req, res) => {
    const reviews = await Review.find({ album: req.params.id }).sort({ updatedAt: -1 }).limit(50).lean<ReviewDoc[]>();
    res.json({ reviews: reviews.map(toReviewDTO) });
  }),
);

/** Write or edit a review. Only after hearing the whole album at least once. */
albums.put(
  '/:id/review',
  route(async (req, res) => {
    const user = requireUser(req);
    const albumId = req.params.id;
    const rating = Number(req.body?.rating);
    if (!(rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2)))
      throw new HttpError(400, 'Beoordeling moet tussen ½ en 5 sterren liggen.');
    const text = String(req.body?.text ?? '').trim().slice(0, 5000);
    const liked = Boolean(req.body?.liked);

    const heard = await Listen.exists({ user: user._id, album: albumId, finishedAt: { $ne: null } });
    if (!heard) throw new HttpError(403, 'Luister eerst het hele album, dan kun je het beoordelen.');

    const previous = await Review.findOne({ user: user._id, album: albumId }).lean<ReviewDoc>();
    const review = await Review.findOneAndUpdate(
      { user: user._id, album: albumId },
      { $set: { rating, text, liked, username: user.username } },
      { upsert: true, new: true },
    ).lean<ReviewDoc>();

    await Album.updateOne(
      { _id: albumId },
      { $inc: { ratingSum: rating - (previous?.rating ?? 0), ratingCount: previous ? 0 : 1 } },
    );
    res.json({ review: toReviewDTO(review!) });
  }),
);

albums.delete(
  '/:id/review',
  route(async (req, res) => {
    const user = requireUser(req);
    const removed = await Review.findOneAndDelete({ user: user._id, album: req.params.id }).lean<ReviewDoc>();
    if (removed) await Album.updateOne({ _id: req.params.id }, { $inc: { ratingSum: -removed.rating, ratingCount: -1 } });
    res.json({ ok: true });
  }),
);

/** Buy an album with tokens → into your own record collection. */
albums.post(
  '/:id/buy',
  route(async (req, res) => {
    const user = requireUser(req);
    const album = await getOrImportAlbum(req.params.id);
    const price = priceFor(album.rarity);
    // Atomic: only succeeds with enough tokens and if you don't own it yet.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, tokens: { $gte: price }, 'records.album': { $ne: album._id } },
      { $inc: { tokens: -price }, $push: { records: { album: album._id, acquiredAt: new Date(), price } } },
      { new: true },
    ).lean();
    if (!updated) {
      if (user.records.some((r) => r.album === album._id)) throw new HttpError(409, 'Deze plaat staat al in je kast.');
      throw new HttpError(402, `Je hebt ${price - user.tokens} tokens te weinig.`);
    }
    res.json({ balance: updated.tokens });
  }),
);
