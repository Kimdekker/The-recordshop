import { Link } from 'react-router';

export default function NotFound() {
  return (
    <section className="stack" aria-labelledby="nf-title">
      <h1 id="nf-title">Deze bak is leeg</h1>
      <p>De pagina die je zoekt bestaat niet.</p>
      <p>
        <Link to="/">Terug naar ontdekken</Link>
      </p>
    </section>
  );
}
