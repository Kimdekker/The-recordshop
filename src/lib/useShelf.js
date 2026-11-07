import { useEffect, useState } from 'react';

const KEY = 'recordshop.shelf.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

/** Saved albums ("platenkast"), kept in this browser only. */
export function useShelf() {
  const [shelf, setShelf] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(shelf));
    } catch {
      /* storage unavailable: shelf just won't persist */
    }
  }, [shelf]);

  const has = (id) => shelf.some((a) => a.id === id);
  const toggle = (album) =>
    setShelf((s) => (s.some((a) => a.id === album.id) ? s.filter((a) => a.id !== album.id) : [album, ...s]));
  return { shelf, has, toggle };
}
