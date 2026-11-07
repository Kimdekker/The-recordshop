import { Link, useLocation } from 'react-router';
import { PlayerSlot, useListening } from '../context/listening.tsx';
import ArtistLink from './ArtistLink.tsx';
import { fmtTime } from '../lib/format.ts';

/**
 * Appears at the side as soon as a record is on and you leave the turntable.
 * The panel is the sleeve; the LP slides halfway out of it and keeps spinning.
 */
export default function MiniPlayer() {
  const l = useListening();
  const { pathname } = useLocation();
  const album = l.album;
  if (!album || pathname === `/luisteren/${album.id}`) return null;

  const track = album.tracks[l.loc.track];
  const progress = album.totalDuration ? Math.min(1, l.elapsed / album.totalDuration) : 0;
  const turntable = `/luisteren/${album.id}`;

  return (
    <aside className="mini-player" aria-label={`Speler: ${album.title}`} data-spinning={l.spinning}>
      <Link to={turntable} className="mini-record" viewTransition aria-label={`Terug naar de draaitafel: ${album.title}`}>
        <span className="mini-vinyl" aria-hidden="true">
          {album.cover && <img src={album.cover} alt="" />}
        </span>
      </Link>

      <div className="mini-sleeve">
        <div className="mini-info">
          <p className="mini-title">
            <Link to={turntable} viewTransition>
              {album.title}
            </Link>
          </p>
          <p className="mini-artist">
            <ArtistLink name={album.artist} />
          </p>
          <p className="mini-track">
            {l.result
              ? 'Kant uit.'
              : l.needle === 'down'
                ? `${l.loc.track + 1}. ${track.title} · ${fmtTime(l.loc.position)}`
                : 'De naald rust.'}
          </p>
          <progress className="mini-progress" max={1} value={progress} aria-label="Voortgang in het album">
            {Math.round(progress * 100)}%
          </progress>
          {l.autoplayBlocked && <p className="mini-hint">Afspelen werd tegengehouden. Druk op Start.</p>}
        </div>

        <div className="mini-controls">
          {l.result ? (
            <button type="button" className="btn btn-small" onClick={l.replay}>
              Opnieuw
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={l.needle === 'rest' ? () => l.onDrop(l.elapsed) : l.onToggleMotor}
              aria-pressed={l.needle === 'down' ? l.motor : undefined}
            >
              {l.needle === 'rest' ? 'Naald erop' : l.motor ? 'Stop' : 'Start'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={l.result ? l.eject : l.finish}
            title={l.result ? 'Speler sluiten' : 'Haal de plaat eraf'}
          >
            {l.result ? 'Sluiten' : 'Eraf'}
          </button>
        </div>

        {/* YouTube: player stays visible (min. 200×200); kept as subtle as allowed */}
        <div className="mini-monitor">
          <PlayerSlot fixed className="mini-screen" />
          <span>via YouTube</span>
        </div>
      </div>
    </aside>
  );
}
