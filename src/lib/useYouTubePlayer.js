import { useCallback, useEffect, useRef, useState } from 'react';

let apiPromise;
function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

/**
 * Wraps the YouTube IFrame Player API. Playback needs no API key; the key is
 * only used server-side to find albums and read their track lists.
 */
export function useYouTubePlayer(containerRef) {
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(-1); // YT.PlayerState
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadIframeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            setState(e.data);
            const i = e.target.getPlaylistIndex?.();
            if (typeof i === 'number' && i >= 0) setIndex(i);
            if (e.data === YT.PlayerState.PLAYING) setError(null);
          },
          onError: (e) => {
            // 101/150: embedding disabled by the owner; skip to the next track.
            const msg = { 2: 'Ongeldige video', 5: 'HTML5-fout', 100: 'Video niet gevonden', 101: 'Mag niet ingesloten worden', 150: 'Mag niet ingesloten worden' }[e.data];
            setError(msg || `Afspeelfout ${e.data}`);
            setTimeout(() => e.target.nextVideo?.(), 1200);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [containerRef]);

  // Poll position while playing.
  useEffect(() => {
    if (state !== 1) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p?.getCurrentTime) setTime({ current: p.getCurrentTime(), duration: p.getDuration() });
    }, 500);
    return () => clearInterval(t);
  }, [state]);

  const loadAlbum = useCallback((playlistId, startIndex = 0) => {
    setIndex(startIndex);
    setTime({ current: 0, duration: 0 });
    playerRef.current?.loadPlaylist({ list: playlistId, listType: 'playlist', index: startIndex });
  }, []);

  const p = () => playerRef.current;
  return {
    ready,
    playing: state === 1,
    buffering: state === 3,
    index,
    time,
    error,
    loadAlbum,
    toggle: () => (state === 1 ? p()?.pauseVideo() : p()?.playVideo()),
    next: () => p()?.nextVideo(),
    prev: () => (p()?.getCurrentTime() > 3 ? p()?.seekTo(0, true) : p()?.previousVideo()),
    playAt: (i) => p()?.playVideoAt(i),
    seek: (s) => {
      p()?.seekTo(s, true);
      setTime((t) => ({ ...t, current: s }));
    },
  };
}
