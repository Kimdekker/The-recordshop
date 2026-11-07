import { Link } from 'react-router';

export default function NotFound() {
  return (
    <section className="stack" aria-labelledby="nf-title">
      <h1 id="nf-title">This crate is empty</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p>
        <Link to="/">Back to Discover</Link>
      </p>
    </section>
  );
}
