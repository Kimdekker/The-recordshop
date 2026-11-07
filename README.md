# The Recordshop

Zoek albums op YouTube en speel ze af als complete plaat, met tracklist.

## Starten

```bash
npm install
cp .env.example .env   # vul YOUTUBE_API_KEY in
npm run dev            # http://localhost:5173
```

## Hoe het werkt

- **Zoeken en tracklists** gaan via `server/index.js`. Die server houdt je API-key geheim; de browser ziet hem nooit.
- **Afspelen** gebeurt met de YouTube IFrame Player API (geen key nodig). Een album is een YouTube-playlist; albums van YouTube Music (ID begint met `OLAK5uy_`) komen bovenaan.
- **Quotum:** een zoekopdracht kost 100 eenheden (van 10.000 per dag), een tracklist 1 per 50 tracks. Alles wordt een week gecachet in `server/cache.json`.
- **Platenkast:** bewaarde albums staan in de `localStorage` van je browser.

## Productie

```bash
npm run build && npm start   # Express serveert dist/ en de API op PORT (standaard 3001)
```
