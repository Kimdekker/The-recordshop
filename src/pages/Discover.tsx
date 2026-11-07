import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import AlbumCard from '../components/AlbumCard.tsx';
import type { AlbumSummary } from '../../shared/types.ts';

function Shelf({ title, intro, albums }: { title: string; intro: string; albums: AlbumSummary[] }) {
  const id = title.replace(/\W+/g, '-').toLowerCase();
  if (!albums.length) return null;
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        <p>{intro}</p>
      </div>
      <ul className="shelf">
        {albums.map((a) => (
          <li key={a.id}>
            <AlbumCard album={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const shelves = useAsync(() => api.shelves(), []);
  const search = useAsync(() => (q ? api.search(q) : Promise.resolve({ results: [] })), [q]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    setParams(next ? { q: next } : {});
  }

  const s = shelves.data;
  const empty = s && !s.recent.length && !s.topRated.length && !s.gems.length;

  return (
    <div className="discover">
      <section className="section hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Hele albums. Van kant A tot het einde.</h1>
        <p className="lede">
          Geen losse nummers, geen shuffle. Leg een plaat op, luister het hele verhaal en ontdek wat je nog niet kende.
        </p>
        <search>
          <form className="search-form" onSubmit={onSubmit}>
            <label htmlFor="q" className="visually-hidden">
              Zoek een album of artiest
            </label>
            <input
              id="q"
              className="input"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Zoek een album of artiest…"
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
              Zoek
            </button>
          </form>
        </search>
      </section>

      {q && (
        <section className="section" aria-labelledby="results-title" aria-busy={search.loading}>
          <div className="section-head">
            <h2 id="results-title">
              Albums voor <q>{q}</q>
            </h2>
          </div>
          {search.loading && <p role="status">Bakken doorzoeken…</p>}
          {search.error && (
            <p className="notice error" role="alert">
              {search.error.message}
            </p>
          )}
          {search.data && !search.data.results.length && (
            <p className="muted">Geen albums gevonden. Probeer artiest én albumtitel.</p>
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

      {s && (
        <>
          <Shelf title="Net gedraaid" intro="Wat anderen hier recent helemaal hebben geluisterd." albums={s.recent} />
          <Shelf title="Verborgen parels" intro="Minder bekend, meer tokens." albums={s.gems} />
          <Shelf title="Hoogst gewaardeerd" intro="Volgens de luisteraars van The Recordshop." albums={s.topRated} />
        </>
      )}
      {empty && !q && <p className="muted section">De bakken zijn nog leeg. Zoek een album om de eerste plaat op te leggen.</p>}
    </div>
  );
}
