import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useAuth } from '../context/auth.tsx';
import { PlayerSlot, useListening } from '../context/listening.tsx';
import Turntable from '../components/turntable/Turntable.tsx';
import ArtistLink from '../components/ArtistLink.tsx';
import AlbumDetails, { TrackDetails, useAlbumMeta } from '../components/listen/AlbumDetails.tsx';
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

  if (loading || album.loading) return <p role="status">Pulling the record out of its sleeve…</p>;
  if (album.error)
    return (
      <p className="notice error" role="alert">
        {album.error.message}
      </p>
    );
  if (!user)
    return (
      <section className="stack" aria-labelledby="login-needed">
        <h1 id="login-needed">Log in first</h1>
        <p>Log in to put {album.data!.title} on the turntable and earn tokens for listening.</p>
        <p>
          <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>
        </p>
      </section>
    );
  if (listening.album?.id !== id) return <p role="status">Putting the record on…</p>;
  return <Listening album={listening.album} />;
}

function Listening({ album }: { album: AlbumDetail }) {
  const l = useListening();
  const tracks = album.tracks;
  const current = tracks[l.loc.track];
  const { meta, loading } = useAlbumMeta(album.id);

  return (
    <article className="listen-page" aria-labelledby="listen-title">
      <header className="listen-head">
        <p className="eyebrow">On the turntable</p>
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
        <div className="listen-main">
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
          <TrackDetails album={album} trackIndex={l.loc.track} meta={meta} loading={loading} />
        </div>

        <aside className="listen-side" aria-label="Now playing">
          <section className="now-playing" aria-live="polite" aria-atomic="true">
            <h2 className="visually-hidden">Now</h2>
            {l.needle === 'down' ? (
              <>
                <p className="eyebrow">
                  Track {l.loc.track + 1} of {tracks.length}
                  {l.buffering && ' · loading…'}
                </p>
                <p className="track-title">{current.title}</p>
              </>
            ) : (
              <p className="track-title muted">{l.result ? 'Side over.' : 'The needle is resting.'}</p>
            )}
          </section>
          <p className="time" aria-hidden="true">
            {fmtTime(l.loc.position)} / {fmtTime(current.duration)}
          </p>
          {l.autoplayBlocked && (
            <p className="notice" role="status">
              Your browser blocked autoplay. Press <strong>Start</strong> to spin the record.
            </p>
          )}
          {l.playerError && (
            <p className="notice" role="status">
              {l.playerError}
            </p>
          )}

          <div className="earnings">
            {/* What this record has earned so far; only counts from half heard */}
            <p className="tokens tokens-live" data-pending={l.coverage < 0.5 || undefined}>
              <span className="coin" aria-hidden="true" />
              <span>
                {fmtTokens(Math.round(l.potential * l.coverage))}
                <span className="of"> / {fmtTokens(l.potential)} tokens</span>
              </span>
            </p>
            <label htmlFor="heard">
              Heard: <strong>{Math.round(l.coverage * 100)}%</strong>
            </label>
            <meter id="heard" min={0} max={1} low={0.5} optimum={1} value={l.coverage}>
              {Math.round(l.coverage * 100)}%
            </meter>
            <p className="muted">
              {l.isRepeat ? 'Repeat listen' : 'First listen'}: up to {fmtTokens(l.potential)} tokens. Hear at least half to
              earn them. Feel free to browse the app: the record keeps spinning.
            </p>
          </div>

          {/* YouTube requires a visible player (min. 200×200); the app-wide player is positioned here. */}
          <section className="yt-monitor" aria-label="Video source (YouTube)">
            <PlayerSlot className="yt-screen" />
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
                Play again
              </button>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={l.finish} disabled={!l.session}>
                Take the record off
              </button>
            )}
          </div>
        </aside>
      </div>

      <AlbumDetails album={album} trackIndex={l.loc.track} meta={meta} loading={loading} />
    </article>
  );
}
