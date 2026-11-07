import { Link, useLocation } from 'react-router';
import { PlayerSlot, useListening } from '../context/listening.tsx';
import ArtistLink from './ArtistLink.tsx';
import { fmtTime } from '../lib/format.ts';
import Icon, { type IconName } from './Icon.tsx';

/**
 * Appears at the side as soon as a record is on and you leave the turntable.
 * The panel is the sleeve; the LP slides halfway out of it and keeps spinning.
 */
function IconButton({ icon, label, onClick, primary }: { icon: IconName; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" className={primary ? 'icon-btn primary' : 'icon-btn'} onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

export default function MiniPlayer() {
  const l = useListening();
  const { pathname } = useLocation();
  const album = l.album;
  if (!album || pathname === `/listen/${album.id}`) return null;

  const track = album.tracks[l.loc.track];
  const progress = album.totalDuration ? Math.min(1, l.elapsed / album.totalDuration) : 0;
  const turntable = `/listen/${album.id}`;

  return (
    <aside className="mini-player" aria-label={`Player: ${album.title}`} data-spinning={l.spinning}>
      <Link to={turntable} className="mini-record" viewTransition aria-label={`Back to the turntable: ${album.title}`}>
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
              ? 'Side over.'
              : l.needle === 'down'
                ? `${l.loc.track + 1}. ${track.title} · ${fmtTime(l.loc.position)}`
                : 'The needle is resting.'}
          </p>
          {/* Transport: play/stop, progress, take off. Icons with a name for screen readers. */}
          <div className="mini-transport">
            {l.result ? (
              <IconButton icon="replay" label="Play again" onClick={l.replay} primary />
            ) : l.needle === 'rest' ? (
              <IconButton icon="play" label="Drop the needle" onClick={() => l.onDrop(l.elapsed)} primary />
            ) : (
              <IconButton icon={l.motor ? 'pause' : 'play'} label={l.motor ? 'Stop' : 'Start'} onClick={l.onToggleMotor} primary />
            )}
            <progress className="mini-progress" max={1} value={progress} aria-label="Progress through the album">
              {Math.round(progress * 100)}%
            </progress>
            {l.result ? (
              <IconButton icon="close" label="Close player" onClick={l.eject} />
            ) : (
              <IconButton icon="eject" label="Take the record off" onClick={l.finish} />
            )}
          </div>
          {l.autoplayBlocked && <p className="mini-hint">Playback was blocked. Press play.</p>}
        </div>

        {/* YouTube: player stays visible (min. 200×200); kept as subtle as allowed */}
        <div className="mini-monitor">
          <PlayerSlot fixed className="mini-screen" to={turntable} />
        </div>
      </div>
    </aside>
  );
}
