import { useEffect, useRef, useState } from 'react';
import { getTracks } from '../lib/api.js';
import { useYouTubePlayer } from '../lib/useYouTubePlayer.js';

const fmt = (s) => {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function Player({ album, onClose }) {
  const mountRef = useRef(null);
  const player = useYouTubePlayer(mountRef);
  const [tracks, setTracks] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // Fetch the track list and start the album whenever a new one is chosen.
  useEffect(() => {
    if (!album) return;
    let cancelled = false;
    setTracks([]);
    setLoadError(null);
    getTracks(album.id)
      .then(({ tracks }) => !cancelled && setTracks(tracks))
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [album]);

  useEffect(() => {
    if (album && player.ready) player.loadAlbum(album.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album, player.ready]);

  const now = tracks[player.index];
  const pct = player.time.duration ? (player.time.current / player.time.duration) * 100 : 0;

  return (
    <aside className={`player ${album ? 'open' : ''}`} aria-label="Speler" aria-hidden={!album}>
      <div className="player-head">
        <div>
          <span className="eyebrow">Nu op de draaitafel</span>
          <h2>{album?.title}</h2>
          <p>{album?.channel}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Speler sluiten">✕</button>
      </div>

      {/* YouTube requires the player to stay visible (min. 200×200). */}
      <div className="screen">
        <div ref={mountRef} />
      </div>

      <div className="now">
        <strong>{now?.title || (player.buffering ? 'Laden…' : '—')}</strong>
        <span>{now?.artist}</span>
        {player.error && <span className="warn">{player.error} — volgende track…</span>}
      </div>

      <div className="progress">
        <span>{fmt(player.time.current)}</span>
        <input
          type="range"
          min="0"
          max={player.time.duration || 0}
          step="1"
          value={player.time.current}
          onChange={(e) => player.seek(Number(e.target.value))}
          style={{ '--pct': `${pct}%` }}
          aria-label="Positie in track"
        />
        <span>{fmt(player.time.duration)}</span>
      </div>

      <div className="controls">
        <button className="icon-btn" onClick={player.prev} aria-label="Vorige track">⏮</button>
        <button className="play-btn" onClick={player.toggle} aria-label={player.playing ? 'Pauzeer' : 'Speel'}>
          {player.playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={player.next} aria-label="Volgende track">⏭</button>
      </div>

      <ol className="tracks">
        {loadError && <li className="warn">{loadError}</li>}
        {!loadError && !tracks.length && album && <li className="muted">Tracklist laden…</li>}
        {tracks.map((t, i) => (
          <li key={`${t.videoId}-${i}`}>
            <button
              className={i === player.index ? 'active' : ''}
              disabled={!t.available}
              onClick={() => player.playAt(i)}
            >
              <span className="num">{i === player.index && player.playing ? '♪' : i + 1}</span>
              <span className="t">{t.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
