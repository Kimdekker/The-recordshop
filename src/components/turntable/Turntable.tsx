import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Track } from '../../../shared/types.ts';
import { fmtTime } from '../../lib/format.ts';
import './turntable.css';

/*
 * Geometry in SVG units (viewBox 400 × 300). The HTML layers (platter,
 * record) are positioned at the same spots in percentages, so everything
 * scales together.
 *
 * Like on a real LP the needle runs from the outer edge (start of the album)
 * to the inside (end). The position of the arm *is* the progress.
 */
const CENTER = { x: 160, y: 150 };
const R_RECORD = 120;
const R_OUTER = 114; // first groove
const R_INNER = 56; // last groove (run-out to the label)
const PIVOT = { x: 345, y: 55 };
const ARM = 190;
const A_REST = 6;

const rad = (deg: number) => (deg * Math.PI) / 180;
const tip = (deg: number) => ({ x: PIVOT.x - ARM * Math.sin(rad(deg)), y: PIVOT.y + ARM * Math.cos(rad(deg)) });
const radiusAt = (deg: number) => {
  const t = tip(deg);
  return Math.hypot(t.x - CENTER.x, t.y - CENTER.y);
};
/** Arm angle at which the needle lands at radius r (binary search; radius decreases with angle). */
function angleFor(r: number) {
  let lo = A_REST;
  let hi = 75;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (radiusAt(mid) > r) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const A_EDGE = angleFor(R_RECORD);
const A_END = angleFor(R_INNER);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const progressToRadius = (p: number) => R_OUTER - clamp(p, 0, 1) * (R_OUTER - R_INNER);
const radiusToProgress = (r: number) => clamp((R_OUTER - r) / (R_OUTER - R_INNER), 0, 1);

export interface TurntableProps {
  cover: string | null;
  title: string;
  tracks: Track[];
  /** Seconds since the start of the album. */
  elapsed: number;
  needle: 'rest' | 'down';
  spinning: boolean;
  /** Needle placed on the record at this album position. */
  onDrop: (elapsed: number) => void;
  /** Needle lifted (dragging). */
  onLift: () => void;
  /** Arm put back on its rest. */
  onRest: () => void;
  onToggleMotor: () => void;
}

export function locate(tracks: Track[], elapsed: number) {
  let start = 0;
  for (const t of tracks) {
    if (elapsed < start + t.duration) return { track: t.index, position: elapsed - start, start };
    start += t.duration;
  }
  const last = tracks.at(-1)!;
  return { track: last.index, position: last.duration, start: start - last.duration };
}

export default function Turntable(props: TurntableProps) {
  const { cover, title, tracks, elapsed, needle, spinning } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const hintId = useId();

  const total = tracks.reduce((s, t) => s + t.duration, 0);
  const playAngle = angleFor(progressToRadius(total ? elapsed / total : 0));
  const angle = drag ?? (needle === 'rest' ? A_REST : playAngle);

  // Track boundaries as lighter rings in the vinyl (the "gaps" between songs).
  const rings: number[] = [];
  let acc = 0;
  for (const t of tracks.slice(0, -1)) {
    acc += t.duration;
    rings.push(progressToRadius(acc / total));
  }

  const elapsedAtAngle = (deg: number) => radiusToProgress(radiusAt(deg)) * total;

  function describe(sec: number) {
    if (needle === 'rest' && drag === null) return 'Tonearm at rest';
    const { track, position } = locate(tracks, sec);
    const t = tracks[track];
    return `Track ${track + 1} of ${tracks.length}: ${t.title}, ${fmtTime(position)} of ${fmtTime(t.duration)}`;
  }

  function pointerAngle(e: PointerEvent) {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const deg = (Math.atan2(-(pt.x - PIVOT.x), pt.y - PIVOT.y) * 180) / Math.PI;
    return clamp(deg, A_REST, A_END);
  }

  function release(deg: number) {
    setDrag(null);
    if (deg >= A_EDGE - 0.5) props.onDrop(elapsedAtAngle(deg));
    else props.onRest();
  }

  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(angle);
    props.onLift();
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    if (drag !== null) setDrag(pointerAngle(e));
  };
  const onPointerUp = (e: PointerEvent<SVGGElement>) => {
    if (drag !== null) release(pointerAngle(e));
  };

  // Keyboard: the same as dragging, step by step.
  function onKeyDown(e: KeyboardEvent) {
    const here = needle === 'rest' ? null : elapsed;
    const loc = locate(tracks, elapsed);
    const startOf = (i: number) => tracks.slice(0, i).reduce((s, t) => s + t.duration, 0);
    const go = (sec: number) => {
      e.preventDefault();
      props.onDrop(clamp(sec, 0, total - 1));
    };
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        return here === null ? props.onDrop(elapsed > 0 ? elapsed : 0) : props.onRest();
      case 'Escape':
        e.preventDefault();
        return props.onRest();
      case 'ArrowRight':
      case 'ArrowUp':
        return go((here ?? 0) + 15);
      case 'ArrowLeft':
      case 'ArrowDown':
        return go((here ?? 0) - 15);
      case 'PageDown':
        return go(startOf(Math.min(tracks.length - 1, loc.track + 1)));
      case 'PageUp':
        return go(startOf(loc.position > 3 ? loc.track : Math.max(0, loc.track - 1)));
      case 'Home':
        return go(0);
    }
  }

  const t = tip(angle);

  return (
    <figure className="turntable" data-spinning={spinning} data-needle={drag !== null ? 'lifted' : needle}>
      <div className="plinth">
        <div className="deck">
          <div className="platter" aria-hidden="true" />
          <div className="record" aria-hidden="true">
            <div className="label">{cover && <img src={cover} alt="" draggable={false} />}</div>
          </div>
          <div className="sheen" aria-hidden="true" />

          <svg ref={svgRef} className="arm-layer" viewBox="0 0 400 300" aria-hidden={false}>
            <defs>
              <linearGradient id="tt-metal" x1="0" x2="1">
                <stop offset="0" stopColor="#8d9096" />
                <stop offset=".45" stopColor="#f3f4f6" />
                <stop offset="1" stopColor="#6b6e74" />
              </linearGradient>
              <radialGradient id="tt-base" cx=".4" cy=".35">
                <stop offset="0" stopColor="#f5f5f4" />
                <stop offset=".6" stopColor="#a8a29e" />
                <stop offset="1" stopColor="#57534e" />
              </radialGradient>
            </defs>

            <g className="rings" aria-hidden="true">
              {rings.map((r, i) => (
                <circle key={i} cx={CENTER.x} cy={CENTER.y} r={r} />
              ))}
            </g>

            {/* Arm rest */}
            <g aria-hidden="true">
              <circle cx={tip(A_REST).x + 2} cy={tip(A_REST).y - 18} r="7" fill="url(#tt-base)" />
              <rect x={tip(A_REST).x - 3} y={tip(A_REST).y - 22} width="10" height="6" rx="2" fill="#1c1917" />
            </g>

            {/* Arm base */}
            <circle cx={PIVOT.x} cy={PIVOT.y} r="24" fill="url(#tt-base)" className="arm-base" aria-hidden="true" />
            <circle cx={PIVOT.x} cy={PIVOT.y} r="11" fill="#292524" aria-hidden="true" />

            <g
              className="arm"
              style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }}
              role="slider"
              tabIndex={0}
              aria-label="Tonearm: drag or use the arrow keys to move the needle"
              aria-describedby={hintId}
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(needle === 'rest' ? 0 : elapsed)}
              aria-valuetext={describe(drag !== null ? elapsedAtAngle(drag) : elapsed)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={onKeyDown}
            >
              {/* Wide invisible grab area along the tube */}
              <line className="arm-hit" x1={PIVOT.x} y1={PIVOT.y - 40} x2={PIVOT.x} y2={PIVOT.y + ARM + 6} />
              <rect x={PIVOT.x - 10} y={PIVOT.y - 52} width="20" height="24" rx="4" fill="url(#tt-metal)" />
              {/* Tube as a rect: a gradient on a perfectly vertical line has no bounding box */}
              <rect x={PIVOT.x - 2.5} y={PIVOT.y - 30} width="5" height={ARM + 6} rx="2.5" fill="url(#tt-metal)" />
              <g transform={`rotate(-22 ${PIVOT.x} ${PIVOT.y + ARM})`}>
                <rect x={PIVOT.x - 7} y={PIVOT.y + ARM - 28} width="14" height="26" rx="2" fill="#1c1917" />
                <rect x={PIVOT.x - 5} y={PIVOT.y + ARM - 10} width="10" height="9" rx="1" fill="#b45309" />
                <path d={`M${PIVOT.x + 7} ${PIVOT.y + ARM - 24} l12 -6`} stroke="#d6d3d1" strokeWidth="2.5" strokeLinecap="round" />
              </g>
              <circle cx={PIVOT.x} cy={PIVOT.y} r="6" fill="url(#tt-metal)" />
            </g>

            {/* Needle tip — handy reference while dragging */}
            {drag !== null && <circle className="needle-dot" cx={t.x} cy={t.y} r="2.5" />}
          </svg>

          <button
            type="button"
            className="motor"
            aria-pressed={spinning}
            onClick={props.onToggleMotor}
            disabled={needle === 'rest'}
          >
            <span>{spinning ? 'Stop' : 'Start'}</span>
          </button>
          <span className="speed" aria-hidden="true">33⅓</span>
        </div>
      </div>
      {/* While playing only for screen readers (keyboard explanation of the arm); visible when the arm rests. */}
      <figcaption id={hintId} className={needle === 'rest' ? 'turntable-hint' : 'visually-hidden'}>
        {needle === 'rest'
          ? `The arm is resting. Drag it back onto the record to keep listening to ${title} (or focus the arm and press Enter).`
          : 'Drag the arm, or use the arrow keys, to skip ahead or back.'}
      </figcaption>
    </figure>
  );
}
