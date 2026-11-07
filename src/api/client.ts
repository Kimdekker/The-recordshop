import type {
  AlbumDetail,
  AlbumMeta,
  CollectionEntry,
  DiaryEntry,
  ListenResult,
  ListenStart,
  Review,
  SearchResult,
  Shelf,
  User,
} from '../../shared/types.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Something went wrong (${res.status})`);
  return data as T;
}

const get = <T,>(url: string) => request<T>('GET', url);
const post = <T,>(url: string, body?: unknown, init?: RequestInit) => request<T>('POST', url, body ?? {}, init);

export const api = {
  me: () => get<{ user: User | null }>('/auth/me'),
  login: (username: string, password: string) => post<{ user: User }>('/auth/login', { username, password }),
  register: (username: string, password: string) => post<{ user: User }>('/auth/register', { username, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),

  search: (q: string) => get<{ results: SearchResult[] }>(`/albums/search?q=${encodeURIComponent(q)}`),
  shelves: () => get<{ shelves: Shelf[] }>('/albums/shelves'),
  shelf: (id: string) => get<{ shelf: Shelf }>(`/albums/shelves/${encodeURIComponent(id)}`),
  artist: (name: string) =>
    get<{ artist: string; albums: SearchResult[] }>(`/albums/artist/${encodeURIComponent(name)}`),
  album: (id: string) => get<{ album: AlbumDetail }>(`/albums/${encodeURIComponent(id)}`),
  meta: (id: string) => get<{ meta: AlbumMeta }>(`/albums/${encodeURIComponent(id)}/meta`),
  reviews: (id: string) => get<{ reviews: Review[] }>(`/albums/${encodeURIComponent(id)}/reviews`),
  saveReview: (id: string, review: { rating: number; text: string; liked: boolean }) =>
    request<{ review: Review }>('PUT', `/albums/${encodeURIComponent(id)}/review`, review),
  deleteReview: (id: string) => request<{ ok: true }>('DELETE', `/albums/${encodeURIComponent(id)}/review`),
  buy: (id: string) => post<{ balance: number }>(`/albums/${encodeURIComponent(id)}/buy`),

  startListen: (albumId: string) => post<ListenStart>('/listen', { albumId }),
  beat: (sessionId: string, track: number, position: number) =>
    post<{ heard: number; coverage: number }>(`/listen/${sessionId}/beat`, { track, position }),
  finishListen: (sessionId: string, track?: number, position?: number, keepalive = false) =>
    post<ListenResult>(`/listen/${sessionId}/finish`, track === undefined ? {} : { track, position }, { keepalive }),

  collection: () => get<{ records: CollectionEntry[] }>('/me/collection'),
  diary: () => get<{ entries: DiaryEntry[] }>('/me/diary'),
};
