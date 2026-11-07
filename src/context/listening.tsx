import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.ts';
import { useAuth } from './auth.tsx';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer.ts';
import { locate } from '../components/turntable/Turntable.tsx';
import { fmtTokens } from '../lib/format.ts';
import type { AlbumDetail, ListenResult, ListenStart } from '../../shared/types.ts';

/*
 * The record keeps playing while you browse the app. That's why the player,
 * the listen session and the turntable state live here, above all pages
 * (in Layout), instead of in the listen page.
 *
 * The YouTube iframe stays in one place in the DOM (moving it would reload
 * it and stop the music). It's positioned over a "slot": the monitor on the
 * listen page, or the one in the mini player.
 */

const BEAT_MS = 10_000;

interface Slot {
  el: HTMLElement;
  /** Slot sits in a position:fixed container (mini player). */
  fixed: boolean;
}

export interface ListeningValue {
  album: AlbumDetail | null;
  session: ListenStart | null;
  error: string | null;
  needle: 'rest' | 'down';
  motor: boolean;
  spinning: boolean;
  /** Seconds since the start of the album. */
  elapsed: number;
  loc: { track: number; position: number };
  coverage: number;
  result: ListenResult | null;
  isRepeat: boolean;
  potential: number;
  playing: boolean;
  buffering: boolean;
  playerError: string | null;
  autoplayBlocked: boolean;
  /** Put a record on. Same album: keep playing. Different album: settle the previous one. */
  load: (album: AlbumDetail) => void;
  onDrop: (sec: number) => void;
  onLift: () => void;
  onRest: () => void;
  onToggleMotor: () => void;
  /** Take the record off and settle (shows the result). */
  finish: () => void;
  replay: () => void;
  /** Close the mini player: settle and clear the turntable. */
  eject: () => void;
  setSlot: Dispatch<SetStateAction<Slot | null>>;
}

const ListeningContext = createContext<ListeningValue | null>(null);

export function ListeningProvider({ children }: { children: ReactNode }) {
  const { user, setTokens } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [session, setSession] = useState<ListenStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState<'rest' | 'down'>('rest');
  const [motor, setMotor] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [result, setResult] = useState<ListenResult | null>(null);
  const [restElapsed, setRestElapsed] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [dropToken, setDropToken] = useState(0);

  const tracks = album?.tracks ?? [];
  const starts = tracks.reduce<number[]>((acc, t, i) => (acc.push(i ? acc[i - 1] + tracks[i - 1].duration : 0), acc), []);
  const total = tracks.reduce((s, t) => s + t.duration, 0);

  const finishRef = useRef<(final?: boolean) => void>(() => {});
  const player = useYouTubePlayer(
    hostRef,
    tracks.map((t) => t.videoId),
    { onAlbumEnd: () => finishRef.current(true) },
    Boolean(album),
  );

  const elapsed = !album ? 0 : needle === 'rest' ? restElapsed : (starts[player.index] ?? 0) + player.time;
  const loc = album ? locate(tracks, Math.min(elapsed, total - 0.01)) : { track: 0, position: 0 };

  // Refs for intervals, callbacks and cleanup, so they see the latest values.
  const live = useRef({
    album: null as AlbumDetail | null,
    session: null as ListenStart | null,
    finished: false,
    track: 0,
    position: 0,
  });
  live.current.album = album;
  live.current.track = loc.track;
  live.current.position = loc.position;

  // --- Session -----------------------------------------------------------------

  /** Session starts at the first needle drop; one in-flight start at a time. */
  const starting = useRef<Promise<ListenStart | null> | null>(null);
  function ensureSession() {
    const a = live.current.album;
    if (!a) return Promise.resolve(null);
    if (live.current.session) return Promise.resolve(live.current.session);
    starting.current ??= api
      .startListen(a.id)
      .then(
        (s) => {
          live.current.session = s;
          live.current.finished = false;
          setSession(s);
          setError(null);
          return s;
        },
        (e: Error) => {
          setError(e.message);
          return null;
        },
      )
      .finally(() => {
        starting.current = null;
      });
    return starting.current;
  }

  const beat = useCallback(async (track: number, position: number) => {
    const s = live.current.session;
    if (!s || live.current.finished) return;
    try {
      const r = await api.beat(s.sessionId, track, position);
      setCoverage(r.coverage);
    } catch {
      /* missed heartbeat: no problem, the next one counts */
    }
  }, []);

  useEffect(() => {
    if (!player.playing) return;
    const t = setInterval(() => beat(live.current.track, live.current.position), BEAT_MS);
    return () => clearInterval(t);
  }, [player.playing, beat]);

  /** Settle the open session without UI (switching albums, closing the tab). */
  function settleQuietly(keepalive = false) {
    const { session: s, finished, track, position } = live.current;
    if (!s || finished) return;
    live.current.finished = true;
    api
      .finishListen(s.sessionId, track, position, keepalive)
      .then((r) => setTokens(r.balance))
      .catch(() => {});
  }

  function resetTurntable() {
    player.pause();
    live.current.session = null;
    live.current.finished = false;
    setSession(null);
    setResult(null);
    setCoverage(0);
    setRestElapsed(0);
    setNeedle('rest');
    setMotor(false);
    setAutoplayBlocked(false);
    setError(null);
  }

  async function finish(final = false) {
    const s = live.current.session;
    const a = live.current.album;
    if (!s || !a || live.current.finished) return;
    live.current.finished = true;
    player.pause();
    setMotor(false);
    const last = a.tracks.at(-1)!;
    const [track, position] = final ? [last.index, last.duration] : [live.current.track, live.current.position];
    setRestElapsed(final ? total : elapsed);
    setNeedle('rest');
    try {
      const r = await api.finishListen(s.sessionId, track, position);
      setResult(r);
      setCoverage(r.coverage);
      setTokens(r.balance);
      dialogRef.current?.showModal();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  finishRef.current = finish;

  // Closing the tab / leaving the app: settle in the background.
  useEffect(() => {
    const onHide = () => settleQuietly(true);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logged out: record off.
  useEffect(() => {
    if (!user && live.current.album) {
      settleQuietly();
      resetTurntable();
      setAlbum(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Turntable actions -------------------------------------------------------

  async function onDrop(sec: number) {
    const a = live.current.album;
    if (!a || result) return;
    const s = await ensureSession();
    if (!s) return;
    if (needle === 'down' && player.playing) await beat(loc.track, loc.position);
    const to = locate(a.tracks, sec);
    setNeedle('down');
    setMotor(true);
    beat(to.track, to.position);
    player.playFrom(to.track, to.position);
  }

  function onLift() {
    if (needle === 'down') {
      player.pause();
      beat(loc.track, loc.position);
    }
  }

  function onRest() {
    if (needle === 'down') {
      player.pause();
      beat(loc.track, loc.position);
      setRestElapsed(elapsed);
    }
    setNeedle('rest');
    setMotor(false);
  }

  function onToggleMotor() {
    if (motor) {
      player.pause();
      beat(loc.track, loc.position);
      setMotor(false);
    } else if (needle === 'down') {
      player.resume();
      setMotor(true);
      setAutoplayBlocked(false);
    }
  }

  // Auto-drop: after load()/replay() the arm swings onto the record.
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  useEffect(() => {
    if (!dropToken) return;
    const t = setTimeout(() => dropRef.current(0), 700);
    return () => clearTimeout(t);
  }, [dropToken]);

  function load(next: AlbumDetail) {
    if (live.current.album?.id === next.id) return;
    settleQuietly();
    resetTurntable();
    live.current.album = next;
    setAlbum(next);
    setDropToken((n) => n + 1);
  }

  function replay() {
    resetTurntable();
    setDropToken((n) => n + 1);
  }

  function eject() {
    settleQuietly();
    resetTurntable();
    live.current.album = null;
    setAlbum(null);
  }

  // Blocked autoplay: stop the record and ask for a press on Start.
  useEffect(() => {
    if (player.playing) return setAutoplayBlocked(false);
    if (!player.ready || needle !== 'down' || !motor || player.buffering) return;
    const t = setTimeout(() => {
      setMotor(false);
      setAutoplayBlocked(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [player.ready, player.playing, player.buffering, needle, motor]);

  const isRepeat = session?.isRepeat ?? Boolean(album?.me?.listens);
  const value: ListeningValue = {
    album,
    session,
    error,
    needle,
    motor,
    spinning: motor && needle === 'down',
    elapsed,
    loc,
    coverage,
    result,
    isRepeat,
    potential: session?.potentialTokens ?? (album ? (isRepeat ? album.reward.repeat : album.reward.first) : 0),
    playing: player.playing,
    buffering: player.buffering,
    playerError: player.error,
    autoplayBlocked,
    load,
    onDrop,
    onLift,
    onRest,
    onToggleMotor,
    finish: () => finish(false),
    replay,
    eject,
    setSlot,
  };

  return (
    <ListeningContext value={value}>
      {children}
      <PlayerHost hostRef={hostRef} slot={album ? slot : null} />
      <ResultDialog dialogRef={dialogRef} album={album} result={result} />
    </ListeningContext>
  );
}

export function useListening() {
  const ctx = use(ListeningContext);
  if (!ctx) throw new Error('useListening buiten ListeningProvider');
  return ctx;
}

/**
 * Marks where the YouTube player should appear. The player itself (one
 * iframe for the whole app) is positioned over it.
 */
export function PlayerSlot({ fixed = false, className }: { fixed?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { setSlot } = useListening();
  useLayoutEffect(() => {
    const el = ref.current!;
    setSlot({ el, fixed });
    // Only clear if no other slot has taken over in the meantime.
    return () => setSlot((cur) => (cur?.el === el ? null : cur));
  }, [fixed, setSlot]);
  return <div ref={ref} className={className} />;
}

/** The one YouTube iframe; follows the active slot (or hides). */
function PlayerHost({ hostRef, slot }: { hostRef: RefObject<HTMLDivElement | null>; slot: Slot | null }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current!;
    if (!slot) {
      box.dataset.hidden = 'true';
      return;
    }
    delete box.dataset.hidden;
    box.style.position = slot.fixed ? 'fixed' : 'absolute';
    let raf = 0;
    let prev = '';
    // Every frame: cheap, and it catches every layout shift (images loading, view transitions…).
    const follow = () => {
      const r = slot.el.getBoundingClientRect();
      const top = r.top + (slot.fixed ? 0 : window.scrollY);
      const left = r.left + (slot.fixed ? 0 : window.scrollX);
      const key = `${top}|${left}|${r.width}|${r.height}`;
      if (key !== prev) {
        prev = key;
        Object.assign(box.style, { top: `${top}px`, left: `${left}px`, width: `${r.width}px`, height: `${r.height}px` });
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [slot]);

  return (
    <div ref={boxRef} className="yt-host" data-hidden="true">
      <div ref={hostRef} className="yt-host-inner" />
    </div>
  );
}

function ResultDialog({
  dialogRef,
  album,
  result,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  album: AlbumDetail | null;
  result: ListenResult | null;
}) {
  return (
    <dialog ref={dialogRef} className="modal" aria-labelledby="result-title">
      {result && album && (
        <>
          <h2 id="result-title">{result.qualified ? 'Kant uit!' : 'Plaat eraf gehaald'}</h2>
          {result.qualified ? (
            <>
              <p className="big-number">+{fmtTokens(result.tokensAwarded)}</p>
              <p>
                tokens voor {album.title}. Je hoorde {Math.round(result.coverage * 100)}% van het album
                {result.tokensAwarded < result.potentialTokens && ` (maximaal ${fmtTokens(result.potentialTokens)})`}.
              </p>
            </>
          ) : (
            <p>
              Je hoorde {Math.round(result.coverage * 100)}% van het album. Pas vanaf de helft verdien je tokens. Volgende keer
              het hele verhaal?
            </p>
          )}
          <p className="muted">Saldo: {fmtTokens(result.balance)} tokens</p>
          <form method="dialog" className="actions">
            {result.qualified && (
              <Link className="btn btn-primary" to={`/album/${album.id}#reviews`} onClick={() => dialogRef.current?.close()}>
                Schrijf een recensie
              </Link>
            )}
            <Link className="btn" to="/" onClick={() => dialogRef.current?.close()}>
              Volgend album ontdekken
            </Link>
            <button className="btn btn-ghost">Sluiten</button>
          </form>
        </>
      )}
    </dialog>
  );
}
