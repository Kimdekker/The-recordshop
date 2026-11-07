import { api } from '../../api/client.ts';
import { useAsync } from '../../hooks/useAsync.ts';
import type { AlbumDetail } from '../../../shared/types.ts';
import Credits from './Credits.tsx';

const fmtDate = (d?: string) => {
  if (!d) return null;
  const parts = d.split('-').map(Number);
  if (parts.length === 1) return String(parts[0]);
  const opts: Intl.DateTimeFormatOptions = parts.length === 2 ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('nl-NL', opts).format(new Date(parts[0], parts[1] - 1, parts[2] ?? 1));
};

const COUNTRY = new Intl.DisplayNames(['nl'], { type: 'region' });
const country = (c?: string) => {
  if (!c || c === 'XW') return c === 'XW' ? 'Wereldwijd' : null;
  if (c === 'XE') return 'Europa';
  try {
    return COUNTRY.of(c) ?? c;
  } catch {
    return c;
  }
};

/**
 * Everything there is to know: the story (Wikipedia), release data, credits
 * per track. Only open data: no lyrics, because they need a licence.
 */
export default function AlbumDetails({
  album,
  trackIndex,
}: {
  album: AlbumDetail;
  trackIndex: number;
}) {
  const { data, loading } = useAsync(() => api.meta(album.id).then((r) => r.meta), [album.id]);
  const meta = data;
  const track = album.tracks[trackIndex];
  const trackMeta = meta?.tracks.find((t) => t.index === trackIndex);

  return (
    <div className="album-details">
      <section className="details-now" aria-labelledby="now-title">
        <p className="eyebrow">Nummer {trackIndex + 1}</p>
        <h2 id="now-title">{trackMeta?.mbTitle ?? track.title}</h2>

        <h3>Op dit nummer</h3>
        {loading && !meta ? <p className="muted">Credits opzoeken…</p> : <Credits credits={trackMeta?.credits ?? []} artist={album.artist} />}
      </section>

      <section className="details-album" aria-labelledby="about-title" aria-busy={loading}>
        <h2 id="about-title">Over {album.title}</h2>
        {loading && !meta && <p className="muted" role="status">Albuminformatie opzoeken bij MusicBrainz en Wikipedia…</p>}
        {meta && !meta.found && <p className="muted">Geen extra informatie gevonden over dit album.</p>}
        {meta?.found && (
          <>
            {meta.wiki && (
              <blockquote className="wiki" cite={meta.wiki.url}>
                <p>{meta.wiki.extract}</p>
                <footer>
                  <a href={meta.wiki.url} target="_blank" rel="noreferrer">
                    Lees verder op Wikipedia{meta.wiki.lang !== 'nl' && ' (Engels)'}
                  </a>
                </footer>
              </blockquote>
            )}

            <dl className="facts">
              {(meta.firstReleased || meta.releaseDate) && (
                <div>
                  <dt>Uitgebracht</dt>
                  <dd>
                    <time dateTime={meta.firstReleased ?? meta.releaseDate}>{fmtDate(meta.firstReleased ?? meta.releaseDate)}</time>
                  </dd>
                </div>
              )}
              {meta.labels.length > 0 && (
                <div>
                  <dt>Label</dt>
                  <dd>
                    {meta.labels.map((l) => (
                      <span key={l.name} className="label-line">
                        {l.name}
                        {l.catalogNumber && <span className="muted"> · {l.catalogNumber}</span>}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {country(meta.country) && (
                <div>
                  <dt>Land</dt>
                  <dd>{country(meta.country)}</dd>
                </div>
              )}
              {meta.formats.length > 0 && (
                <div>
                  <dt>Formaat</dt>
                  <dd>{meta.formats.join(', ')}</dd>
                </div>
              )}
              {meta.barcode && (
                <div>
                  <dt>Barcode</dt>
                  <dd className="num">{meta.barcode}</dd>
                </div>
              )}
            </dl>

            {meta.genres.length > 0 && (
              <ul className="genres" aria-label="Genres">
                {meta.genres.map((g) => (
                  <li key={g} className="badge">
                    {g}
                  </li>
                ))}
              </ul>
            )}

            {meta.credits.length > 0 && (
              <>
                <h3>Credits van het album</h3>
                <Credits credits={meta.credits} artist={album.artist} />
              </>
            )}

            <h3>Credits per nummer</h3>
            <ol className="track-credits">
              {album.tracks.map((t) => {
                const tm = meta.tracks.find((x) => x.index === t.index);
                return (
                  <li key={t.videoId}>
                    <details open={t.index === trackIndex}>
                      <summary aria-current={t.index === trackIndex ? 'true' : undefined}>{tm?.mbTitle ?? t.title}</summary>
                      <Credits credits={tm?.credits ?? []} artist={album.artist} />
                    </details>
                  </li>
                );
              })}
            </ol>

            {meta.links.length > 0 && (
              <>
                <h3>Verder lezen</h3>
                <ul className="ext-links">
                  {meta.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="source">
              Bronnen:{' '}
              {meta.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </span>
              ))}
              {meta.wiki && ' (tekst onder CC BY-SA)'}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
