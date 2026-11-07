import { Schema, model, type Types } from 'mongoose';

/** One time putting an album on the turntable. */
export interface ListenDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  album: string;
  isRepeat: boolean;
  potentialTokens: number;
  /** Seconds actually heard (natural playback, no jumps). */
  heard: number;
  seeks: number;
  last: { at: Date; track: number; position: number } | null;
  /** Session closed (finished, or replaced by a new session). */
  ended: boolean;
  /** Only set when the listen qualified (enough heard). */
  finishedAt: Date | null;
  coverage: number;
  tokensAwarded: number;
  createdAt: Date;
}

const listenSchema = new Schema<ListenDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    album: { type: String, ref: 'Album', required: true },
    isRepeat: Boolean,
    potentialTokens: Number,
    heard: { type: Number, default: 0 },
    seeks: { type: Number, default: 0 },
    last: { type: new Schema({ at: Date, track: Number, position: Number }, { _id: false }), default: null },
    ended: { type: Boolean, default: false },
    finishedAt: { type: Date, default: null },
    coverage: { type: Number, default: 0 },
    tokensAwarded: { type: Number, default: 0 },
  },
  { timestamps: true },
);
listenSchema.index({ user: 1, album: 1, finishedAt: 1 });

export const Listen = model<ListenDoc>('Listen', listenSchema);
