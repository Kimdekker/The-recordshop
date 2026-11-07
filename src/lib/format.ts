export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export const fmtMinutes = (s: number) => `${Math.round(s / 60)} min`;

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export const fmtRating = (r: number) => r.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

export const fmtTokens = (n: number) => n.toLocaleString('nl-NL');
