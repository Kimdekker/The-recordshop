import { Schema, model } from 'mongoose';

/** YouTube search results, cached for a week (search costs 100 quota units). */
const searchCacheSchema = new Schema({
  _id: { type: String, required: true },
  results: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

export const SearchCache = model('SearchCache', searchCacheSchema);
