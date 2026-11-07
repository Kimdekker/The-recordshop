import { useId } from 'react';
import { fmtTokens } from '../lib/format.ts';

/** Token balance; click for an explanation (native popover, no JS needed). */
export default function TokenBadge({ tokens }: { tokens: number }) {
  const id = useId();
  return (
    <>
      <button type="button" className="tokens" popoverTarget={id} aria-label={`${fmtTokens(tokens)} tokens, uitleg tonen`}>
        <span className="coin" aria-hidden="true" />
        <span aria-live="polite">{fmtTokens(tokens)}</span>
      </button>
      <div id={id} popover="auto" className="token-info">
        <h2>Tokens verdienen</h2>
        <ul>
          <li>Een album voor het eerst helemaal luisteren: tot 200 tokens.</li>
          <li>Een album opnieuw luisteren: tot 50 tokens.</li>
          <li>Minder bekende albums leveren meer op (tot 2×).</li>
          <li>Naald verplaatsen = minder gehoord = minder tokens. Onder de helft gehoord: niets.</li>
          <li>Met tokens koop je albums voor je platenkast.</li>
        </ul>
      </div>
    </>
  );
}
