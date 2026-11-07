async function get(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Fout ${res.status}`);
  return body;
}

export const getStatus = () => get('/api/status');
export const searchAlbums = (q) => get(`/api/albums/search?q=${encodeURIComponent(q)}`);
export const getTracks = (id) => get(`/api/albums/${encodeURIComponent(id)}/tracks`);
