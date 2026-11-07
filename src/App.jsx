import { useEffect, useState } from 'react';
import { getStatus, searchAlbums } from './lib/api.js';
import { useShelf } from './lib/useShelf.js';
import AlbumGrid from './components/AlbumGrid.jsx';
import Player from './components/Player.jsx';

export default function App() {
  const [status, setStatus] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const shelf = useShelf();

  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus({ hasKey: false, offline: true }));
  }, []);

  async function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const { results } = await searchAlbums(q);
      setResults({ q, items: results });
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={`app ${current ? 'has-player' : ''}`}>
      <header className="top">
        <div className="brand">
          <span className="brand-disc" aria-hidden="true" />
          <h1>The Recordshop</h1>
        </div>
        <form className="search" onSubmit={onSearch} role="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een album of artiest…"
            aria-label="Zoek een album of artiest"
          />
          <button type="submit" disabled={searching || !query.trim()}>
            {searching ? 'Zoeken…' : 'Zoek'}
          </button>
        </form>
      </header>

      {status && !status.hasKey && (
        <div className="notice">
          {status.offline
            ? 'De API-server draait niet. Start het project met npm run dev.'
            : 'Er staat nog geen YOUTUBE_API_KEY in .env. Voeg die toe en herstart de server.'}
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      <main className="content">
        {results && (
          <section>
            <h2>
              Resultaten voor <em>{results.q}</em>
            </h2>
            {results.items.length ? (
              <AlbumGrid albums={results.items} currentId={current?.id} onPlay={setCurrent} shelf={shelf} />
            ) : (
              <p className="empty">Niets gevonden. Probeer artiest en albumtitel samen.</p>
            )}
          </section>
        )}

        <section>
          <h2>Jouw platenkast</h2>
          {shelf.shelf.length ? (
            <AlbumGrid albums={shelf.shelf} currentId={current?.id} onPlay={setCurrent} shelf={shelf} />
          ) : (
            <p className="empty">
              Nog leeg. Zoek een album en klik op <strong>+ Kast</strong> om het hier te bewaren.
            </p>
          )}
        </section>
      </main>

      <Player album={current} onClose={() => setCurrent(null)} />
    </div>
  );
}
