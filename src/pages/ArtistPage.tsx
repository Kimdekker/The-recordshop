import { useParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import AlbumCard from '../components/AlbumCard.tsx';

export default function ArtistPage() {
  const { name = '' } = useParams();
  const { data, loading, error } = useAsync(() => api.artist(name), [name]);

  return (
    <section aria-labelledby="artist-title" aria-busy={loading}>
      <div className="section-head artist-head">
        <div>
          <p className="eyebrow">Artist</p>
          <h1 id="artist-title">{name}</h1>
        </div>
        {data && (
          <p>
            {data.albums.length} official {data.albums.length === 1 ? 'release' : 'releases'}
          </p>
        )}
      </div>
      {loading && <p role="status">Fetching discography…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {data && !data.albums.length && <p className="muted">No official albums by {name} found on YouTube.</p>}
      {data && data.albums.length > 0 && (
        <ul className="album-grid">
          {data.albums.map((a) => (
            <li key={a.id}>
              <AlbumCard album={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
