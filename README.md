# The Recordshop

An old-school way to discover music: **only complete albums**, from start to finish. No single tracks, no shuffle, no playlists. You put a record on the turntable and you hear the whole story.

- **Turntable**: a spinning LP with the cover as its label. You skip only by lifting the tonearm and putting it down somewhere else (or with the arrow keys / PageUp / PageDown on the focused arm).
- **Tokens**: listening to a whole album earns tokens. A first listen earns up to 200, a repeat listen up to 50, and lesser-known albums pay up to 2× as much. If you skip, you hear less and earn proportionally less, and below 50% heard you earn nothing.
- **Record collection**: buy albums with your tokens. Classics cost more, hidden gems less.
- **Reviews**: ½–5 stars, a heart and a text, Letterboxd style. You can only post after a complete listen.
- **Diary**: every album you've heard in full, with your rating.

## Stack

| | |
| --- | --- |
| Frontend | React 19 + TypeScript, React Router 7, Vite |
| Backend | Node.js (native TypeScript) + Express |
| Database | MongoDB via Mongoose |
| Music | YouTube Data API (search/metadata, server-side) + IFrame Player (playback) |

Shared types live in [`shared/types.ts`](shared/types.ts). The token rules are all in [`server/lib/tokens.ts`](server/lib/tokens.ts).

## Getting started

```bash
npm install
cp .env.example .env   # fill in YOUTUBE_API_KEY
npm run dev            # http://localhost:5173
```

Without `MONGODB_URI`, development starts an **embedded MongoDB** that keeps its data in `.data/` (the first start downloads the MongoDB binary once, ~70 MB). For Atlas or a local installation, set `MONGODB_URI` in `.env`.

Dev test account (local database only): `devluisteraar` / `recordshop-dev-2026`.

## How listening is counted

The player sends a heartbeat every 10 seconds (and right before and after a needle jump). The server only counts seconds as "heard" when the position moved forward no faster than the time that actually passed. Needle jumps therefore don't count. Only one turntable can be active per user at a time, and a session pays out only once. Coverage = heard / album length; payout = reward × coverage (with a minimum of 50%).

## YouTube

- Quota: search costs 100 units (out of 10,000 per day) and is cached for a week in MongoDB. Importing an album costs about 3 units, and after that the album lives in the database. Playback, Discover shelves and album pages cost nothing.
- Starter catalog: in development the server fills the catalog in the background with a list of well-known albums (`server/lib/seed.ts`), about 120 units per album, once. Progress is stored, so restarts don't spend quota again. In production it only runs with `SEED_CATALOGUE=1`.
- YouTube's rules require the video player to stay **visible** (at least 200×200). That's why it sits next to the turntable as a small "monitor".
- Albums only: search results are filtered (no live sets, compilations or lyrics playlists), and an import must have at least 4 playable tracks and 15 minutes of music.

## Scripts

- `npm run dev`: API + Vite
- `npm run typecheck`: TypeScript check over client and server
- `npm run build && npm start`: production (Express serves `dist/` and requires `MONGODB_URI`)
