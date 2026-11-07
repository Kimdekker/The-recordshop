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
        <h1 id="diary-title">Diary</h1>
        <p>Every album you've listened to all the way through.</p>
      </div>
      {loading && <p role="status">Flipping through…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      {data && !data.entries.length && <p className="muted">Nothing played yet. Your first record is waiting.</p>}
      {data && data.entries.length > 0 && (
        <div className="table-wrap">
          <table className="table diary">
            <caption className="visually-hidden">Listening history, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Album</th>
                <th scope="col">Rating</th>
                <th scope="col">Heard</th>
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
                          {e.isRepeat && ' · repeat'}
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
