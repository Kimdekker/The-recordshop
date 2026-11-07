export const env = {
  production: process.env.NODE_ENV === 'production',
  youtubeKey: process.env.YOUTUBE_API_KEY ?? '',
  mongoUri: process.env.MONGODB_URI ?? '',
  /** MusicBrainz wants a recognisable client name, preferably with a contact URL. */
  metadataUserAgent: process.env.METADATA_USER_AGENT || 'TheRecordshop/0.1 (local development)',
  port:
    Number(process.env.NODE_ENV === 'production' ? process.env.PORT || process.env.API_PORT : process.env.API_PORT) ||
    3001,
};
