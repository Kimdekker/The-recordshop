import { Link } from 'react-router';
import type { AlbumSummary, SearchResult } from '../../shared/types.ts';
import { Stars } from './Stars.tsx';
import { fmtMinutes } from '../lib/format.ts';
import ArtistLink from './ArtistLink.tsx';

type Props = { album: AlbumSummary | SearchResult; owned?: boolean; headingLevel?: 'h2' | 'h3' };

export default function AlbumCard({ album, owned, headingLevel: H = 'h3' }: Props) {
  const full = 'rarity' in album ? album : null;
  return (
    <article className="album-card">
      <div className="sleeve">
        <span className="peek" aria-hidden="true" />
        {album.cover ? (
          <img
            className="cover"
            src={album.cover}
            alt=""
            loading="lazy"
            style={{ viewTransitionName: `cover-${album.id.replace(/[^\w-]/g, '')}` }}
          />
        ) : (
          <div className="cover" />
        )}
        <div className="badges">
          {owned && <span className="badge gold">In je kast</span>}
          {full && (full.rarity === 'verborgen parel' || full.rarity === 'ontdekking') && (
            <span className="badge accent">{full.rarity}</span>
          )}
        </div>
      </div>
      <H>
        <Link to={`/album/${album.id}`} viewTransition>
          {album.title}
        </Link>
      </H>
      <p className="meta">
        <ArtistLink name={album.artist} className="artist-link" />
        {full?.ratingAvg != null && (
          <span className="rating">
            <Stars rating={full.ratingAvg} size="0.85em" />
          </span>
        )}
        {full && <span className="visually-hidden">{fmtMinutes(full.totalDuration)}</span>}
      </p>
    </article>
  );
}
