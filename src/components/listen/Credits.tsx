import type { Credit } from '../../../shared/types.ts';
import ArtistLink from '../ArtistLink.tsx';

/** Credits as a description list: role → names. */
export default function Credits({ credits, artist }: { credits: Credit[]; artist: string }) {
  if (!credits.length) return <p className="muted">Geen credits bekend.</p>;
  return (
    <dl className="credits">
      {credits.map((c) => (
        <div key={c.role}>
          <dt>{c.role}</dt>
          <dd>
            {c.names.map((n, i) => (
              <span key={n}>
                {i > 0 && ', '}
                {/* The album artist is a link to their artist page */}
                {n.toLowerCase() === artist.toLowerCase() ? <ArtistLink name={n} /> : n}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
