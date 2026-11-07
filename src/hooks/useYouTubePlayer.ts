import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/* Minimal types for the YouTube IFrame Player API. */
interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getIframe(): HTMLIFrameElement;
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
  /** The last track of the album has ended. */
  onAlbumEnd?: () => void;
  onTrackChange?: (index: number) => void;
}

/**
 * Wraps the YouTube IFrame Player. No API key needed.
 * YouTube's own controls are off: you control playback with the turntable.
 * Tracks are loaded one by one (not as a YouTube playlist), so YouTube shows
 * no previous/next buttons; the hook moves on to the next track itself.
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
  /** Which album (videoIds joined) and which track are loaded in the player now. */
  const loadedKey = useRef('');
  const loadedIndex = useRef(-1);
  const [state, setState] = useState<number>(STATE.UNSTARTED);
  const [index, setIndex] = useState(0);
  const load = (i: number, seconds: number) => {
    const videoId = idsRef.current[i];
    if (!videoId) return;
    loadedKey.current = idsRef.current.join(',');
    loadedIndex.current = i;
    setIndex(i);
    player.current?.loadVideoById({ videoId, startSeconds: seconds });
  };
  /** On to the next track, or the album is over. */
  const next = () => {
    const i = loadedIndex.current;
    if (i < idsRef.current.length - 1) {
      load(i + 1, 0);
      setTime(0);
      eventsRef.current.onTrackChange?.(i + 1);
    } else {
      eventsRef.current.onAlbumEnd?.();
    }
  };
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const failTimer = setTimeout(
      () => !cancelled && setError("The YouTube player couldn't load. Is youtube.com blocked in this browser?"),
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
          onReady: (e: { target: YTPlayer }) => {
            // Not reachable with the keyboard either: the turntable is the control.
            e.target.getIframe().tabIndex = -1;
            clearTimeout(failTimer);
            setError(null);
            readyRef.current = true;
            setReady(true);
            if (pending.current) {
              load(...pending.current);
              pending.current = null;
            }
          },
          onStateChange: (e: { data: number }) => {
            setState(e.data);
            if (e.data === STATE.PLAYING) setError(null);
            if (e.data === STATE.ENDED) next();
          },
          onError: (e: { data: number }) => {
            const msg: Record<number, string> = {
              100: 'This track is no longer available',
              101: "This track can't be embedded",
              150: "This track can't be embedded",
            };
            setError(`${msg[e.data] ?? `Playback error ${e.data}`}, skipping to the next track`);
            setTimeout(next, 1500);
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
      if (sameAlbum && i === loadedIndex.current && state !== STATE.UNSTARTED && state !== STATE.CUED) {
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
