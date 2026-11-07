import { Router } from 'express';
import { Album, toSummary, type AlbumDoc } from '../models/Album.ts';
import { Listen, type ListenDoc } from '../models/Listen.ts';
import { Review, type ReviewDoc } from '../models/Review.ts';
import { requireUser } from '../lib/auth.ts';
import { route } from '../lib/http.ts';
import type { CollectionEntry, DiaryEntry } from '../../shared/types.ts';

export const me = Router();

/** Your record collection: albums bought with tokens. */
me.get(
  '/collection',
  route(async (req, res) => {
    const user = requireUser(req);
    const albums = await Album.find({ _id: { $in: user.records.map((r) => r.album) } }).lean<AlbumDoc[]>();
    const byId = new Map(albums.map((a) => [a._id, a]));
    const records: CollectionEntry[] = user.records
      .filter((r) => byId.has(r.album))
      .sort((a, b) => +new Date(b.acquiredAt) - +new Date(a.acquiredAt))
      .map((r) => ({ album: toSummary(byId.get(r.album)!), acquiredAt: new Date(r.acquiredAt).toISOString() }));
    res.json({ records });
  }),
);

/** Diary: every album you heard in full, with your rating (Letterboxd style). */
me.get(
  '/diary',
  route(async (req, res) => {
    const user = requireUser(req);
    const listens = await Listen.find({ user: user._id, finishedAt: { $ne: null } })
      .sort({ finishedAt: -1 })
      .limit(200)
      .lean<ListenDoc[]>();
    const ids = [...new Set(listens.map((l) => l.album))];
    const [albums, reviews] = await Promise.all([
      Album.find({ _id: { $in: ids } }).lean<AlbumDoc[]>(),
      Review.find({ user: user._id, album: { $in: ids } }).lean<ReviewDoc[]>(),
    ]);
    const albumById = new Map(albums.map((a) => [a._id, a]));
    const ratingById = new Map(reviews.map((r) => [r.album, r.rating]));
    const entries: DiaryEntry[] = listens
      .filter((l) => albumById.has(l.album))
      .map((l) => ({
        id: String(l._id),
        album: toSummary(albumById.get(l.album)!),
        finishedAt: l.finishedAt!.toISOString(),
        coverage: l.coverage,
        tokensAwarded: l.tokensAwarded,
        isRepeat: l.isRepeat,
        rating: ratingById.get(l.album) ?? null,
      }));
    res.json({ entries });
  }),
);
