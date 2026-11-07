import { Fragment, useId, useState, type CSSProperties } from 'react';
import { fmtRating } from '../lib/format.ts';

export function Stars({ rating, size }: { rating: number; size?: string }) {
  return (
    <span
      className="stars"
      role="img"
      aria-label={`${fmtRating(rating)} out of 5 stars`}
      style={{ '--rating': rating, ...(size ? { '--size': size } : {}) } as CSSProperties}
    />
  );
}

const VALUES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5]; // reversed, see row-reverse in CSS

/** Half-star rating as a native radio group: works with arrow keys and screen readers. */
export function StarInput({
  name,
  value,
  onChange,
  legend = 'Your rating',
}: {
  name: string;
  value: number | null;
  onChange: (v: number) => void;
  legend?: string;
}) {
  const base = useId();
  const [focused, setFocused] = useState(false);
  return (
    <fieldset className="star-input">
      <legend>{legend}</legend>
      <div className="star-row" data-focused={focused}>
        {VALUES.map((v) => {
          const id = `${base}-${v}`;
          return (
            <Fragment key={v}>
              <input
                type="radio"
                id={id}
                name={name}
                value={v}
                checked={value === v}
                onChange={() => onChange(v)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                required
              />
              <label htmlFor={id} className={Number.isInteger(v) ? 'right' : 'left'} title={`${fmtRating(v)} stars`}>
                <span className="visually-hidden">{fmtRating(v)} stars</span>
              </label>
            </Fragment>
          );
        })}
      </div>
      <output className="star-value" aria-hidden="true">
        {value ? `${fmtRating(value)} / 5` : 'No stars yet'}
      </output>
    </fieldset>
  );
}
