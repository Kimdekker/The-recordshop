import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import AlbumCard from './AlbumCard.tsx';
import type { AlbumSummary } from '../../shared/types.ts';

/**
 * A shelf as a horizontal carousel. Swipe/scroll on touch and trackpad
 * (scroll-snap), arrow buttons for the mouse. The title links to the full list.
 */
export default function Carousel({ title, intro, to, albums }: { title: string; intro?: string; to: string; albums: AlbumSummary[] }) {
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () =>
      setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [albums.length]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <section className="carousel" aria-labelledby={id}>
      <div className="carousel-head">
        <div>
          <h2 id={id}>
            <Link to={to} viewTransition>
              {title}
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </h2>
          {intro && <p className="muted">{intro}</p>}
        </div>
        <div className="carousel-buttons">
          <button type="button" className="round-btn" onClick={() => page(-1)} disabled={edge.start} aria-label={`Previous albums in ${title}`}>
            ‹
          </button>
          <button type="button" className="round-btn" onClick={() => page(1)} disabled={edge.end} aria-label={`Next albums in ${title}`}>
            ›
          </button>
        </div>
      </div>
      <ul ref={track} className="carousel-track" tabIndex={0} aria-label={title}>
        {albums.map((a) => (
          <li key={a.id}>
            <AlbumCard album={a} />
          </li>
        ))}
        <li className="carousel-more">
          <Link to={to} viewTransition>
            See all<span className="visually-hidden"> in {title}</span> <span aria-hidden="true">→</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
