// Types shared by the API (server/) and the React app (src/).

export interface Track {
  index: number;
  videoId: string;
  title: string;
  /** Seconds. */
  duration: number;
}

export type Rarity = 'klassieker' | 'bekend' | 'gewaardeerd' | 'ontdekking' | 'verborgen parel';

export interface AlbumSummary {
  id: string; // YouTube playlist ID
  title: string;
  artist: string;
  cover: string | null;
  year?: number | null;
  trackCount: number;
  totalDuration: number;
  rarity: Rarity;
  ratingAvg: number | null;
  ratingCount: number;
  listenCount: number;
}

export interface AlbumDetail extends AlbumSummary {
  tracks: Track[];
  /** Tokens for a first full listen, and for a repeat listen. */
  reward: { first: number; repeat: number };
  price: number;
  me?: {
    owned: boolean;
    listens: number;
    review: Review | null;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  official: boolean;
  /** Already in The Recordshop catalogue. */
  inCatalogue: boolean;
}

export interface User {
  id: string;
  username: string;
  tokens: number;
}

export interface Review {
  id: string;
  albumId: string;
  username: string;
  /** 0.5 – 5 in half steps. */
  rating: number;
  liked: boolean;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListenStart {
  sessionId: string;
  isRepeat: boolean;
  potentialTokens: number;
}

export interface ListenResult {
  coverage: number; // 0..1 of the album actually heard
  tokensAwarded: number;
  potentialTokens: number;
  qualified: boolean;
  balance: number;
}

export interface DiaryEntry {
  id: string;
  album: AlbumSummary;
  finishedAt: string;
  coverage: number;
  tokensAwarded: number;
  isRepeat: boolean;
  rating: number | null;
}

export interface CollectionEntry {
  album: AlbumSummary;
  acquiredAt: string;
}

export interface ApiError {
  error: string;
}

// --- Metadata (MusicBrainz / Wikipedia) ------------------------------------------

export interface Credit {
  role: string;
  names: string[];
}

export interface TrackMeta {
  /** Index in Album.tracks. */
  index: number;
  mbTitle?: string;
  credits: Credit[];
}

export interface AlbumMeta {
  found: boolean;
  releaseDate?: string;
  /** Date of the first release (release group). */
  firstReleased?: string;
  country?: string;
  labels: { name: string; catalogNumber?: string }[];
  barcode?: string;
  formats: string[];
  genres: string[];
  credits: Credit[];
  tracks: TrackMeta[];
  wiki?: { title: string; extract: string; url: string; lang: string };
  links: { label: string; url: string }[];
  sources: { label: string; url: string }[];
}
