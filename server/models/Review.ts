import { Schema, model, type Types } from 'mongoose';
import type { Review as ReviewDTO } from '../../shared/types.ts';

export interface ReviewDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  username: string;
  album: string;
  rating: number;
  liked: boolean;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    album: { type: String, ref: 'Album', required: true, index: true },
    rating: { type: Number, required: true, min: 0.5, max: 5 },
    liked: { type: Boolean, default: false },
    text: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true },
);
reviewSchema.index({ user: 1, album: 1 }, { unique: true });

export const Review = model<ReviewDoc>('Review', reviewSchema);

export const toReviewDTO = (r: ReviewDoc): ReviewDTO => ({
  id: String(r._id),
  albumId: r.album,
  username: r.username,
  rating: r.rating,
  liked: r.liked,
  text: r.text,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
