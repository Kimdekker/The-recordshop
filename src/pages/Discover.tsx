import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useAuth } from '../context/auth.tsx';
import AlbumCard from '../components/AlbumCard.tsx';
import Carousel from '../components/Carousel.tsx';

export default function Discover() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  // Reload when you log in or out: "Voor jou" depends on it.
  const shelves = useAsync(() => api.shelves(), [user?.id]);
  const search = useAsync(() => (q ? api.search(q) : Promise.resolve({ results: [] })), [q]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    setParams(next ? { q: next } : {});
  }

  return (
    <div className="discover">
      <h1 className="visually-hidden">Discover</h1>

      <search className="discover-search">
        <form className="search-form" onSubmit={onSubmit}>
          <label htmlFor="q" className="visually-hidden">
            Search for an album or artist
          </label>
          <input
            id="q"
            className="input"
            type="search"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Field cleared (also via the × in the field): back to the shelves.
              if (!e.target.value && q) setParams({});
            }}
            placeholder="Search for an album or artist…"
            autoComplete="off"
          />
          <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
            Search
          </button>
        </form>
      </search>

      {q && (
        <section className="section" aria-labelledby="results-title" aria-busy={search.loading}>
          <div className="section-head">
            <h2 id="results-title">
              Albums for <q>{q}</q>
            </h2>
          </div>
          {search.loading && <p role="status">Digging through the crates…</p>}
          {search.error && (
            <p className="notice error" role="alert">
              {search.error.message}
            </p>
          )}
          {search.data && !search.data.results.length && (
            <p className="muted">No albums found. Try both the artist and the album title.</p>
          )}
          {search.data && search.data.results.length > 0 && (
            <ul className="album-grid">
              {search.data.results.map((r) => (
                <li key={r.id}>
                  <AlbumCard album={r} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!q && (
        <div className="shelves">
          {shelves.loading && !shelves.data && <p role="status">Filling the crates…</p>}
          {shelves.data?.shelves.map((s) => (
            <Carousel key={s.id} title={s.title} intro={s.intro} to={`/discover/${s.id}`} albums={s.albums} />
          ))}
          {shelves.data && !shelves.data.shelves.length && (
            <p className="muted">The crates are being filled. In the meantime, search for an album to play the first record.</p>
          )}
        </div>
      )}
    </div>
  );
}
