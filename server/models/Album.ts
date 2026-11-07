import { Schema, model } from 'mongoose';
import type { AlbumMeta, AlbumSummary, Rarity, Track } from '../../shared/types.ts';

/** Bump when the import logic changes: older albums are re-imported automatically. */
export const ALBUM_VERSION = 2;

export interface AlbumDoc {
  version?: number;
  _id: string; // YouTube playlist ID
  title: string;
  artist: string;
  cover: string | null;
  year: number | null;
  tracks: Track[];
  totalDuration: number;
  avgViews: number;
  rarity: Rarity;
  ratingSum: number;
  ratingCount: number;
  listenCount: number;
  lastListenedAt: Date | null;
  meta?: AlbumMeta | null;
  metaFetchedAt?: Date | null;
  createdAt: Date;
}

const albumSchema = new Schema<AlbumDoc>(
  {
    _id: { type: String, required: true },
    version: Number,
    title: { type: String, required: true },
    artist: { type: String, required: true },
    cover: String,
    year: Number,
    tracks: [{ _id: false, index: Number, videoId: String, title: String, duration: Number }],
    totalDuration: Number,
    avgViews: Number,
    rarity: String,
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    listenCount: { type: Number, default: 0 },
    lastListenedAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
    metaFetchedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
albumSchema.index({ title: 'text', artist: 'text' });

export const Album = model<AlbumDoc>('Album', albumSchema);

export function toSummary(a: AlbumDoc): AlbumSummary {
  return {
    id: a._id,
    title: a.title,
    artist: a.artist,
    cover: a.cover,
    year: a.year,
    trackCount: a.tracks.length,
    totalDuration: a.totalDuration,
    rarity: a.rarity,
    ratingAvg: a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null,
    ratingCount: a.ratingCount,
    listenCount: a.listenCount,
  };
}
