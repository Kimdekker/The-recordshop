import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useAuth } from '../context/auth.tsx';
import { PlayerSlot, useListening } from '../context/listening.tsx';
import Turntable from '../components/turntable/Turntable.tsx';
import ArtistLink from '../components/ArtistLink.tsx';
import AlbumDetails from '../components/listen/AlbumDetails.tsx';
import { fmtTime, fmtTokens } from '../lib/format.ts';
import type { AlbumDetail } from '../../shared/types.ts';

export default function ListenPage() {
  const { id = '' } = useParams();
  const { user, loading } = useAuth();
  const location = useLocation();
  const listening = useListening();
  // Already on the turntable? Then don't fetch, just keep playing.
  const current = listening.album?.id === id ? listening.album : null;
  const album = useAsync(() => (current ? Promise.resolve(current) : api.album(id).then((r) => r.album)), [id]);

  // Put the record on (does nothing if it's already playing).
  useEffect(() => {
    if (user && album.data) listening.load(album.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, album.data]);

  if (loading || album.loading) return <p role="status">Plaat uit de hoes halen…</p>;
  if (album.error)
    return (
      <p className="notice error" role="alert">
        {album.error.message}
      </p>
    );
  if (!user)
    return (
      <section className="stack" aria-labelledby="login-needed">
        <h1 id="login-needed">Eerst even inloggen</h1>
        <p>Log in om {album.data!.title} op te leggen en tokens te verdienen voor het luisteren.</p>
        <p>
          <Link className="btn btn-primary" to="/inloggen" state={{ from: location.pathname }}>
            Inloggen
          </Link>
        </p>
      </section>
    );
  if (listening.album?.id !== id) return <p role="status">Plaat opleggen…</p>;
  return <Listening album={listening.album} />;
}

function Listening({ album }: { album: AlbumDetail }) {
  const l = useListening();
  const tracks = album.tracks;
  const current = tracks[l.loc.track];

  return (
    <article className="listen-page" aria-labelledby="listen-title">
      <header className="listen-head">
        <p className="eyebrow">Op de draaitafel</p>
        <h1 id="listen-title">
          {album.title}{' '}
          <span className="by">
            — <ArtistLink name={album.artist} />
          </span>
        </h1>
      </header>

      {l.error && (
        <p className="notice error" role="alert">
          {l.error}
        </p>
      )}

      <div className="listen-layout">
        <Turntable
          cover={album.cover}
          title={album.title}
          tracks={tracks}
          elapsed={l.elapsed}
          needle={l.needle}
          spinning={l.spinning}
          onDrop={l.onDrop}
          onLift={l.onLift}
          onRest={l.onRest}
          onToggleMotor={l.onToggleMotor}
        />

        <aside className="listen-side" aria-label="Wat er speelt">
          <section className="now-playing" aria-live="polite" aria-atomic="true">
            <h2 className="visually-hidden">Nu</h2>
            {l.needle === 'down' ? (
              <>
                <p className="eyebrow">
                  Nummer {l.loc.track + 1} van {tracks.length}
                  {l.buffering && ' · laden…'}
                </p>
                <p className="track-title">{current.title}</p>
              </>
            ) : (
              <p className="track-title muted">{l.result ? 'Kant uit.' : 'De naald rust.'}</p>
            )}
          </section>
          <p className="time" aria-hidden="true">
            {fmtTime(l.loc.position)} / {fmtTime(current.duration)}
          </p>
          {l.autoplayBlocked && (
            <p className="notice" role="status">
              Je browser hield automatisch afspelen tegen. Druk op <strong>Start</strong> om de plaat te laten draaien.
            </p>
          )}
          {l.playerError && (
            <p className="notice" role="status">
              {l.playerError}
            </p>
          )}

          <div className="earnings">
            <label htmlFor="heard">
              Gehoord: <strong>{Math.round(l.coverage * 100)}%</strong>
            </label>
            <meter id="heard" min={0} max={1} low={0.5} optimum={1} value={l.coverage}>
              {Math.round(l.coverage * 100)}%
            </meter>
            <p className="muted">
              {l.isRepeat ? 'Herbeluistering' : 'Eerste keer'}: tot {fmtTokens(l.potential)} tokens. Minstens de helft horen om
              te verdienen. Je kunt gerust verder kijken in de app: de plaat blijft draaien.
            </p>
          </div>

          {/* YouTube requires a visible player (min. 200×200); the app-wide player is positioned here. */}
          <section className="yt-monitor" aria-label="Videobron (YouTube)">
            <PlayerSlot className="yt-screen" />
            <p className="muted">Bron: YouTube</p>
          </section>

          <ol className="tracklist compact" aria-label="Tracklist">
            {tracks.map((t, i) => (
              <li key={t.videoId} aria-current={l.needle === 'down' && i === l.loc.track ? 'true' : undefined}>
                <span className="title">{t.title}</span>
                <span className="dur">{fmtTime(t.duration)}</span>
              </li>
            ))}
          </ol>

          <div className="album-actions">
            {l.result ? (
              <button className="btn" type="button" onClick={l.replay}>
                Opnieuw opleggen
              </button>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={l.finish} disabled={!l.session}>
                Haal de plaat eraf
              </button>
            )}
          </div>
        </aside>
      </div>

      <AlbumDetails album={album} trackIndex={l.loc.track} />
    </article>
  );
}
