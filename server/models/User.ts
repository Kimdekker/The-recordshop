import { Schema, model, type Types } from 'mongoose';

export interface UserDoc {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  tokens: number;
  records: { album: string; acquiredAt: Date; price: number }[];
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    tokens: { type: Number, default: 0, min: 0 },
    records: [
      {
        _id: false,
        album: { type: String, ref: 'Album', required: true },
        acquiredAt: { type: Date, default: Date.now },
        price: Number,
      },
    ],
  },
  { timestamps: true },
);

export const User = model<UserDoc>('User', userSchema);
