import { Schema, model, type Types } from 'mongoose';

/** Login session (cookie). Expires automatically after 30 days. */
export interface SessionDoc {
  _id: string;
  user: Types.ObjectId;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDoc>({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

export const Session = model<SessionDoc>('Session', sessionSchema);
