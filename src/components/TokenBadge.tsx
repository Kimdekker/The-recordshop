import { fmtTokens } from '../lib/format.ts';

/** Token balance with a coin. */
export default function TokenBadge({ tokens }: { tokens: number }) {
  return (
    <p className="tokens" aria-live="polite">
      <span className="coin" aria-hidden="true" />
      <span>
        {fmtTokens(tokens)}
        <span className="visually-hidden"> tokens</span>
      </span>
    </p>
  );
}
