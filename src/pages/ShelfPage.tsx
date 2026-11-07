import { Link, useParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import AlbumCard from '../components/AlbumCard.tsx';

/** One shelf in full: /discover/for-you, /discover/just-played, … */
export default function ShelfPage() {
  const { shelf: id = '' } = useParams();
  const { data, loading, error } = useAsync(() => api.shelf(id).then((r) => r.shelf), [id]);

  if (loading) return <p role="status">Flipping through the crate…</p>;
  if (error)
    return (
      <p className="notice error" role="alert">
        {error.message}
      </p>
    );
  const shelf = data!;
  return (
    <section className="shelf-page" aria-labelledby="shelf-title">
      <p className="eyebrow">
        <Link to="/" viewTransition>
          Discover
        </Link>
      </p>
      <h1 id="shelf-title">{shelf.title}</h1>
      <p className="muted lede">{shelf.intro}</p>
      {shelf.albums.length ? (
        <ul className="album-grid">
          {shelf.albums.map((a) => (
            <li key={a.id}>
              <AlbumCard album={a} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">This crate is still empty.</p>
      )}
    </section>
  );
}
