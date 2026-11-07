import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// API_PORT in dev (Vite proxies /api to it); PORT is honoured in production hosts.
const PORT =
  Number(process.env.NODE_ENV === 'production' ? process.env.PORT || process.env.API_PORT : process.env.API_PORT) || 3001;
const API_KEY = process.env.YOUTUBE_API_KEY;
const YT = 'https://www.googleapis.com/youtube/v3';

// ---------------------------------------------------------------------------
// Cache: search.list costs 100 quota units, playlistItems.list costs 1.
// Results are kept on disk for a week, so a repeated search costs nothing.
// ---------------------------------------------------------------------------
const CACHE_FILE = path.join(__dirname, 'cache.json');
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
} catch {
  cache = {};
}
let saveTimer;
function cacheSet(key, value) {
  cache[key] = { at: Date.now(), value };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeFile(CACHE_FILE, JSON.stringify(cache)).catch(() => {}), 500);
}
function cacheGet(key) {
  const hit = cache[key];
  return hit && Date.now() - hit.at < CACHE_TTL ? hit.value : undefined;
}

async function yt(endpoint, params) {
  const url = new URL(`${YT}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: API_KEY })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    const err = new Error(body?.error?.message || `YouTube API ${res.status}`);
    err.status = reason === 'quotaExceeded' ? 429 : res.status;
    err.reason = reason;
    throw err;
  }
  return body;
}

const bestThumb = (t = {}) => (t.maxres || t.standard || t.high || t.medium || t.default)?.url ?? null;

// Album playlists from YouTube Music have IDs starting with OLAK5uy_ and
// titles like "Album - Abbey Road". Those go to the top of the results.
const albumScore = (p) =>
  (p.id.startsWith('OLAK5uy_') ? 2 : 0) + (/^album\s*-/i.test(p.title) ? 1 : 0);

const app = express();

app.get('/api/status', (_req, res) => res.json({ hasKey: Boolean(API_KEY) }));

app.use('/api', (_req, res, next) => {
  if (!API_KEY) return res.status(500).json({ error: 'YOUTUBE_API_KEY ontbreekt in .env' });
  next();
});

app.get('/api/albums/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [], cached: true });
    const key = `search:${q.toLowerCase()}`;
    const cached = cacheGet(key);
    if (cached) return res.json({ results: cached, cached: true });

    const data = await yt('search', {
      part: 'snippet',
      type: 'playlist',
      maxResults: 12,
      q: `${q} album`,
    });
    const results = data.items
      .map((it) => ({
        id: it.id.playlistId,
        title: it.snippet.title.replace(/^album\s*-\s*/i, ''),
        rawTitle: it.snippet.title,
        channel: it.snippet.channelTitle.replace(/\s*-\s*Topic$/i, ''),
        thumbnail: bestThumb(it.snippet.thumbnails),
      }))
      .map((p) => ({ ...p, isAlbum: albumScore({ ...p, title: p.rawTitle }) > 0 }))
      .sort((a, b) => albumScore({ ...b, title: b.rawTitle }) - albumScore({ ...a, title: a.rawTitle }));

    cacheSet(key, results);
    res.json({ results, cached: false });
  } catch (e) {
    next(e);
  }
});

app.get('/api/albums/:id/tracks', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[\w-]{10,64}$/.test(id)) return res.status(400).json({ error: 'Ongeldig playlist-ID' });
    const key = `tracks:${id}`;
    const cached = cacheGet(key);
    if (cached) return res.json({ ...cached, cached: true });

    const tracks = [];
    let pageToken;
    do {
      const data = await yt('playlistItems', {
        part: 'snippet,contentDetails,status',
        playlistId: id,
        maxResults: 50,
        ...(pageToken ? { pageToken } : {}),
      });
      for (const it of data.items) {
        const s = it.snippet;
        tracks.push({
          position: s.position,
          videoId: it.contentDetails.videoId,
          title: s.title,
          artist: (s.videoOwnerChannelTitle || '').replace(/\s*-\s*Topic$/i, ''),
          thumbnail: bestThumb(s.thumbnails),
          available: !['private', 'privacyStatusUnspecified'].includes(it.status?.privacyStatus) &&
            !/^(private|deleted) video$/i.test(s.title),
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken && tracks.length < 200);

    const result = { id, tracks };
    cacheSet(key, result);
    res.json({ ...result, cached: false });
  } catch (e) {
    next(e);
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message =
    status === 429
      ? 'Het dagelijkse YouTube-quotum is op. Morgen weer, of gebruik albums die al in de cache staan.'
      : err.message;
  console.error(`[api] ${status} ${err.reason || ''} ${err.message}`);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[api] luistert op http://localhost:${PORT}${API_KEY ? '' : ' — LET OP: geen YOUTUBE_API_KEY in .env'}`);
});
