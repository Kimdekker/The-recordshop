import { Link } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { Stars } from '../components/Stars.tsx';
import { fmtDate, fmtTokens } from '../lib/format.ts';

export default function DiaryPage() {
  const { data, loading, error } = useAsync(() => api.diary(), []);
  return (
    <section aria-labelledby="diary-title">
      <div className="section-head">
        <h1 id="diary-title">Dagboek</h1>
        <p>Elk album dat je helemaal hebt geluisterd.</p>
      </div>
      {loading && <p role="status">Bladeren…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {data && !data.entries.length && <p className="muted">Nog niets geluisterd. Je eerste plaat wacht.</p>}
      {data && data.entries.length > 0 && (
        <div className="table-wrap">
          <table className="table diary">
            <caption className="visually-hidden">Luistergeschiedenis, nieuwste eerst</caption>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Album</th>
                <th scope="col">Beoordeling</th>
                <th scope="col">Gehoord</th>
                <th scope="col">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <time dateTime={e.finishedAt}>{fmtDate(e.finishedAt)}</time>
                  </td>
                  <td>
                    <div className="diary-album">
                      {e.album.cover && <img src={e.album.cover} alt="" width="48" height="48" loading="lazy" />}
                      <div>
                        <Link to={`/album/${e.album.id}`}>{e.album.title}</Link>
                        <div className="muted">
                          {e.album.artist}
                          {e.isRepeat && ' · opnieuw'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{e.rating ? <Stars rating={e.rating} size="0.9em" /> : <span className="muted">—</span>}</td>
                  <td className="num">{Math.round(e.coverage * 100)}%</td>
                  <td className="num">+{fmtTokens(e.tokensAwarded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
