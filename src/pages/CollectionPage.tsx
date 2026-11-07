import { Link } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useAuth } from '../context/auth.tsx';
import AlbumCard from '../components/AlbumCard.tsx';
import { fmtTokens } from '../lib/format.ts';

export default function CollectionPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => api.collection(), [user?.id]);

  return (
    <section aria-labelledby="collection-title" className="collection-page">
      <div className="section-head">
        <h1 id="collection-title">My Collection</h1>
        {data && (
          <p>
            {data.records.length} {data.records.length === 1 ? 'record' : 'records'} · {fmtTokens(user?.tokens ?? 0)} tokens to spend
          </p>
        )}
      </div>
      {loading && <p role="status">Opening your collection…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {data && !data.records.length && (
        <div className="empty-shelf stack">
          <p>Your collection is still empty.</p>
          <p className="muted">Listen to albums all the way through to earn tokens, then use them to buy the records you want to keep.</p>
          <p>
            <Link className="btn btn-primary" to="/">
              Discover albums
            </Link>
          </p>
        </div>
      )}
      {data && data.records.length > 0 && (
        <div className="wood-shelf">
          <ul className="album-grid">
            {data.records.map((r) => (
              <li key={r.album.id}>
                <AlbumCard album={r.album} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
