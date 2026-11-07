import { Link } from 'react-router';

export const artistPath = (name: string) => `/artist/${encodeURIComponent(name)}`;

export default function ArtistLink({ name, className }: { name: string; className?: string }) {
  return (
    <Link to={artistPath(name)} className={className} viewTransition>
      {name}
    </Link>
  );
}
