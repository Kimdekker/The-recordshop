import type { Types } from 'mongoose';
import { Album, ALBUM_VERSION, toSummary, type AlbumDoc } from '../models/Album.ts';
import { Listen } from '../models/Listen.ts';
import { Review } from '../models/Review.ts';
import type { UserDoc } from '../models/User.ts';
import type { Shelf, ShelfId } from '../../shared/types.ts';

/*
 * Shelves for the discover page. Everything straight from the database: no
 * YouTube quota. Each shelf exists in short (carousel) and long (own page).
 */

const CURRENT = { version: ALBUM_VERSION };

/** Stable per day, different tomorrow: so the shelves don't look the same every visit. */
function dailyRank(id: string) {
  const day = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  for (const c of id + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}
const shuffled = (list: AlbumDoc[]) => [...list].sort((a, b) => dailyRank(a._id) - dailyRank(b._id));
const avg = (a: AlbumDoc) => (a.ratingCount ? a.ratingSum / a.ratingCount : 0);

/** Albums that are a good place to start: well-known first, in daily order. */
async function starters(exclude: Set<string>, limit: number) {
  const all = await Album.find(CURRENT).limit(500).lean<AlbumDoc[]>();
  const fame = { classic: 0, 'well-known': 0, acclaimed: 1, discovery: 2, 'hidden gem': 2 } as const;
  return shuffled(all.filter((a) => !exclude.has(a._id)))
    .sort((a, b) => fame[a.rarity] - fame[b.rarity])
    .slice(0, limit);
}

/** "Voor jou": albums with the same genres/artists as what you listened to, bought or rated well. */
async function forYou(user: UserDoc | undefined, limit: number) {
  if (!user) return { albums: await starters(new Set(), limit), personal: false };

  const [listens, reviews] = await Promise.all([
    Listen.find({ user: user._id as Types.ObjectId, finishedAt: { $ne: null } }, { album: 1 }).lean(),
    Review.find({ user: user._id as Types.ObjectId }, { album: 1, rating: 1 }).lean(),
  ]);
  const heard = new Set(listens.map((l) => l.album));
  const owned = new Set(user.records.map((r) => r.album));
  const liked = new Set([...heard, ...owned, ...reviews.filter((r) => r.rating >= 3.5).map((r) => r.album)]);
  const disliked = new Set(reviews.filter((r) => r.rating < 2.5).map((r) => r.album));
  for (const d of disliked) liked.delete(d);

  const taste = await Album.find({ _id: { $in: [...liked] } }).lean<AlbumDoc[]>();
  const genres = new Map<string, number>();
  const artists = new Set<string>();
  for (const a of taste) {
    artists.add(a.artist.toLowerCase());
    for (const g of a.meta?.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const exclude = new Set([...heard, ...owned, ...disliked]);
  if (!taste.length) return { albums: await starters(exclude, limit), personal: false };

  const candidates = (await Album.find(CURRENT).limit(500).lean<AlbumDoc[]>()).filter((a) => !exclude.has(a._id));
  const score = (a: AlbumDoc) =>
    (a.meta?.genres ?? []).reduce((s, g) => s + (genres.get(g) ?? 0), 0) +
    (artists.has(a.artist.toLowerCase()) ? 3 : 0) +
    avg(a) * 0.3 +
    dailyRank(a._id); // a pinch of variety
  const ranked = candidates.map((a) => ({ a, s: score(a) })).sort((x, y) => y.s - x.s);
  return { albums: ranked.slice(0, limit).map((x) => x.a), personal: true };
}

/** "Net gedraaid": what was listened to recently, filled up with albums worth trying. */
async function recent(limit: number) {
  const played = await Album.find({ ...CURRENT, lastListenedAt: { $ne: null } })
    .sort({ lastListenedAt: -1 })
    .limit(limit)
    .lean<AlbumDoc[]>();
  if (played.length >= limit) return played;
  return [...played, ...(await starters(new Set(played.map((a) => a._id)), limit - played.length))];
}

async function gems(limit: number) {
  return Album.find({ ...CURRENT, rarity: { $in: ['discovery', 'hidden gem'] } })
    .sort({ avgViews: 1 })
    .limit(limit)
    .lean<AlbumDoc[]>();
}

async function topRated(limit: number) {
  return Album.aggregate<AlbumDoc>([
    { $match: { ...CURRENT, ratingCount: { $gt: 0 } } },
    { $addFields: { avg: { $divide: ['$ratingSum', '$ratingCount'] } } },
    { $sort: { avg: -1, ratingCount: -1 } },
    { $limit: limit },
  ]);
}

export const SHELF_IDS: ShelfId[] = ['for-you', 'just-played', 'hidden-gems', 'top-rated'];

export async function buildShelf(id: ShelfId, user: UserDoc | undefined, limit: number): Promise<Shelf> {
  switch (id) {
    case 'for-you': {
      const { albums, personal } = await forYou(user, limit);
      return {
        id,
        title: 'For You',
        intro: personal ? 'Based on what you listen to, buy, and rate.' : 'A few records to get you started. The more you listen, the more personal this gets.',
        albums: albums.map(toSummary),
      };
    }
    case 'just-played':
      return {
        id,
        title: 'Just Played',
        intro: 'What people here recently played all the way through, plus records worth a try.',
        albums: (await recent(limit)).map(toSummary),
      };
    case 'hidden-gems':
      return { id, title: 'Hidden Gems', intro: 'Less known, more tokens.', albums: (await gems(limit)).map(toSummary) };
    case 'top-rated':
      return {
        id,
        title: 'Top Rated',
        intro: 'According to The Recordshop listeners.',
        albums: (await topRated(limit)).map(toSummary),
      };
  }
}
