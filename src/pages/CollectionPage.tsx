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
    <section aria-labelledby="kast-title" className="collection-page">
      <div className="section-head">
        <h1 id="kast-title">Mijn platenkast</h1>
        {data && (
          <p>
            {data.records.length} {data.records.length === 1 ? 'plaat' : 'platen'} · {fmtTokens(user?.tokens ?? 0)} tokens te besteden
          </p>
        )}
      </div>
      {loading && <p role="status">Kast openen…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {data && !data.records.length && (
        <div className="empty-shelf stack">
          <p>Je kast is nog leeg.</p>
          <p className="muted">Luister albums helemaal om tokens te verdienen, en koop daarmee de platen die je wilt houden.</p>
          <p>
            <Link className="btn btn-primary" to="/">
              Ontdek albums
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
