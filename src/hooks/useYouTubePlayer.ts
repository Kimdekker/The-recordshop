import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/* Minimal types for the YouTube IFrame Player API. */
interface YTPlayer {
  loadPlaylist(ids: string[], index?: number, startSeconds?: number): void;
  cuePlaylist(ids: string[], index?: number, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlaylistIndex(): number;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: object) => YTPlayer; PlayerState: Record<string, number> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

let apiPromise: Promise<void> | undefined;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiPromise;
}

export interface PlayerEvents {
  /** The last video of the playlist has ended. */
  onAlbumEnd?: () => void;
  onTrackChange?: (index: number) => void;
}

/**
 * Wraps the YouTube IFrame Player. No API key needed.
 * YouTube's own controls are off: you control playback with the turntable.
 */
export function useYouTubePlayer(
  mount: RefObject<HTMLDivElement | null>,
  videoIds: string[],
  events: PlayerEvents = {},
  /** Only load YouTube once there's actually something to play. */
  enabled = true,
) {
  const player = useRef<YTPlayer | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const idsRef = useRef(videoIds);
  idsRef.current = videoIds;

  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  /** Command given before the player was ready; executed in onReady. */
  const pending = useRef<[number, number] | null>(null);
  /** Which playlist is loaded in the player now (videoIds joined). */
  const loadedKey = useRef('');
  const load = (i: number, seconds: number) => {
    loadedKey.current = idsRef.current.join(',');
    player.current?.loadPlaylist(idsRef.current, i, seconds);
  };
  const [state, setState] = useState<number>(STATE.UNSTARTED);
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const failTimer = setTimeout(
      () => !cancelled && setError('De YouTube-speler kon niet laden. Wordt youtube.com geblokkeerd in deze browser?'),
      10_000,
    );
    loadApi().then(() => {
      if (cancelled || !mount.current || !window.YT) return;
      const host = document.createElement('div');
      mount.current.replaceChildren(host);
      player.current = new window.YT.Player(host, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3 },
        events: {
          onReady: () => {
            clearTimeout(failTimer);
            setError(null);
            readyRef.current = true;
            setReady(true);
            if (pending.current) {
              load(...pending.current);
              pending.current = null;
            }
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            setState(e.data);
            const i = e.target.getPlaylistIndex();
            if (i >= 0) {
              setIndex((prev) => {
                if (prev !== i) eventsRef.current.onTrackChange?.(i);
                return i;
              });
            }
            if (e.data === STATE.PLAYING) setError(null);
            if (e.data === STATE.ENDED && i === idsRef.current.length - 1) eventsRef.current.onAlbumEnd?.();
          },
          onError: (e: { data: number; target: YTPlayer }) => {
            const msg: Record<number, string> = {
              100: 'Dit nummer is niet (meer) beschikbaar',
              101: 'Dit nummer mag niet ingesloten worden',
              150: 'Dit nummer mag niet ingesloten worden',
            };
            setError(`${msg[e.data] ?? `Afspeelfout ${e.data}`} — door naar het volgende nummer`);
            const i = e.target.getPlaylistIndex();
            if (i < idsRef.current.length - 1) setTimeout(() => load(i + 1, 0), 1500);
            else eventsRef.current.onAlbumEnd?.();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(failTimer);
      player.current?.destroy();
      player.current = null;
      readyRef.current = false;
      setReady(false);
    };
  }, [mount, enabled]);

  // Track the position closely while playing, for a smooth tonearm.
  useEffect(() => {
    if (state !== STATE.PLAYING) return;
    const t = setInterval(() => setTime(player.current?.getCurrentTime() ?? 0), 250);
    return () => clearInterval(t);
  }, [state]);

  /** Drop the needle: start at track `i`, `seconds` in. */
  const playFrom = useCallback(
    (i: number, seconds: number) => {
      setIndex(i);
      setTime(seconds);
      const p = player.current;
      // Player methods only exist after onReady.
      if (!p || !readyRef.current) {
        pending.current = [i, seconds];
        return;
      }
      // Only seek within the current track if it's still the same album.
      const sameAlbum = loadedKey.current === idsRef.current.join(',');
      if (sameAlbum && i === p.getPlaylistIndex() && state !== STATE.UNSTARTED && state !== STATE.CUED) {
        p.seekTo(seconds, true);
        p.playVideo();
      } else {
        load(i, seconds);
      }
    },
    [state],
  );

  return {
    ready,
    state,
    playing: state === STATE.PLAYING,
    buffering: state === STATE.BUFFERING,
    index,
    time,
    error,
    playFrom,
    pause: () => {
      pending.current = null;
      if (readyRef.current) player.current?.pauseVideo();
    },
    resume: () => readyRef.current && player.current?.playVideo(),
  };
}
