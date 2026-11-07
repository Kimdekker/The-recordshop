import { api } from '../../api/client.ts';
import { useAsync } from '../../hooks/useAsync.ts';
import type { AlbumDetail, AlbumMeta } from '../../../shared/types.ts';
import Credits from './Credits.tsx';

const fmtDate = (d?: string) => {
  if (!d) return null;
  const parts = d.split('-').map(Number);
  if (parts.length === 1) return String(parts[0]);
  const opts: Intl.DateTimeFormatOptions =
    parts.length === 2 ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(parts[0], parts[1] - 1, parts[2] ?? 1));
};

const COUNTRY = new Intl.DisplayNames(['en'], { type: 'region' });
const country = (c?: string) => {
  if (!c || c === 'XW') return c === 'XW' ? 'Worldwide' : null;
  if (c === 'XE') return 'Europe';
  try {
    return COUNTRY.of(c) ?? c;
  } catch {
    return c;
  }
};

/** Album metadata (MusicBrainz/Wikipedia), fetched once per album and cached on the server. */
export function useAlbumMeta(albumId: string) {
  const { data, loading } = useAsync(() => api.meta(albumId).then((r) => r.meta), [albumId]);
  return { meta: data, loading };
}

type MetaProps = { album: AlbumDetail; trackIndex: number; meta: AlbumMeta | null | undefined; loading: boolean };

/** The current track and who plays on it. Sits under the turntable. */
export function TrackDetails({ album, trackIndex, meta, loading }: MetaProps) {
  const track = album.tracks[trackIndex];
  const trackMeta = meta?.tracks.find((t) => t.index === trackIndex);
  return (
    <section className="details-now" aria-labelledby="now-title">
      <p className="eyebrow">Track {trackIndex + 1}</p>
      <h2 id="now-title">{trackMeta?.mbTitle ?? track.title}</h2>

      <h3>On this track</h3>
      {loading && !meta ? <p className="muted">Looking up credits…</p> : <Credits credits={trackMeta?.credits ?? []} artist={album.artist} />}
    </section>
  );
}

/**
 * Everything there is to know about the album: the story (Wikipedia), release
 * data and credits per track. Only open data: no lyrics, because they need a licence.
 */
export default function AlbumDetails({ album, trackIndex, meta, loading }: MetaProps) {
  return (
    <div className="details-album">
      <section className="details-about" aria-labelledby="about-title" aria-busy={loading}>
        <h2 id="about-title">About {album.title}</h2>
        {loading && !meta && (
          <p className="muted" role="status">
            Looking up album info on MusicBrainz and Wikipedia…
          </p>
        )}
        {meta && !meta.found && <p className="muted">No extra information found for this album.</p>}
        {meta?.found && (
          <>
            {meta.wiki && (
              <blockquote className="wiki" cite={meta.wiki.url}>
                <p>{meta.wiki.extract}</p>
                <footer>
                  <a href={meta.wiki.url} target="_blank" rel="noreferrer">
                    Read more on Wikipedia
                  </a>
                </footer>
              </blockquote>
            )}

            <dl className="facts">
              {(meta.firstReleased || meta.releaseDate) && (
                <div>
                  <dt>Released</dt>
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
                  <dt>Country</dt>
                  <dd>{country(meta.country)}</dd>
                </div>
              )}
              {meta.formats.length > 0 && (
                <div>
                  <dt>Format</dt>
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
                <h3>Album credits</h3>
                <Credits credits={meta.credits} artist={album.artist} />
              </>
            )}

            {meta.links.length > 0 && (
              <>
                <h3>Further reading</h3>
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
              Sources:{' '}
              {meta.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </span>
              ))}
              {meta.wiki && ' (text under CC BY-SA)'}
            </p>
          </>
        )}
      </section>

      {meta?.found && (
        <section className="details-tracks" aria-labelledby="tracks-title">
          <h2 id="tracks-title">On the record</h2>
          <p className="muted">Who plays on each track. The track that's playing now is expanded.</p>
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
        </section>
      )}
    </div>
  );
}
