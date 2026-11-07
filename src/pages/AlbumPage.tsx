import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/client.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { useAuth } from '../context/auth.tsx';
import { StarInput, Stars } from '../components/Stars.tsx';
import { fmtDate, fmtMinutes, fmtRating, fmtTime, fmtTokens } from '../lib/format.ts';
import type { AlbumDetail, Review } from '../../shared/types.ts';
import ArtistLink from '../components/ArtistLink.tsx';

export default function AlbumPage() {
  const { id = '' } = useParams();
  const { user, setTokens } = useAuth();
  const album = useAsync(() => api.album(id).then((r) => r.album), [id, user?.id]);
  const reviews = useAsync(() => api.reviews(id).then((r) => r.reviews), [id]);
  const [buyState, setBuyState] = useState<{ error?: string; done?: boolean; busy?: boolean }>({});

  if (album.loading && !album.data) return <p role="status">Album uit de bak halen…</p>;
  if (album.error)
    return (
      <div className="stack">
        <h1>Hier ligt geen plaat</h1>
        <p className="notice error" role="alert">
          {album.error.message}
        </p>
        <p>
          <Link to="/">Terug naar ontdekken</Link>
        </p>
      </div>
    );
  const a = album.data!;
  const owned = a.me?.owned || buyState.done;

  async function buy() {
    setBuyState({ busy: true });
    try {
      const { balance } = await api.buy(a.id);
      setTokens(balance);
      setBuyState({ done: true });
    } catch (e) {
      setBuyState({ error: (e as Error).message });
    }
  }

  return (
    <article className="album-page">
      <header className="album-hero">
        {a.cover && (
          <img
            className="album-cover"
            src={a.cover}
            alt={`Hoes van ${a.title}`}
            style={{ viewTransitionName: `cover-${a.id.replace(/[^\w-]/g, '')}` }}
          />
        )}
        <div className="album-intro stack">
          <p className="eyebrow">{a.rarity}</p>
          <h1>{a.title}</h1>
          <p className="artist">
            <ArtistLink name={a.artist} />
          </p>
          <dl className="facts">
            {a.year && (
              <div>
                <dt>Jaar</dt>
                <dd>{a.year}</dd>
              </div>
            )}
            <div>
              <dt>Nummers</dt>
              <dd>{a.trackCount}</dd>
            </div>
            <div>
              <dt>Speelduur</dt>
              <dd>{fmtMinutes(a.totalDuration)}</dd>
            </div>
            <div>
              <dt>Beoordeling</dt>
              <dd>
                {a.ratingAvg != null ? (
                  <>
                    <Stars rating={a.ratingAvg} /> <span className="muted">({a.ratingCount})</span>
                  </>
                ) : (
                  <span className="muted">nog geen</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Helemaal geluisterd</dt>
              <dd>{a.listenCount}×</dd>
            </div>
          </dl>

          <div className="album-actions">
            <Link className="btn btn-primary" to={`/luisteren/${a.id}`} viewTransition>
              Leg de plaat op
            </Link>
            {user &&
              (owned ? (
                <span className="badge gold">In je platenkast</span>
              ) : (
                <button className="btn" type="button" onClick={buy} disabled={buyState.busy || user.tokens < a.price}>
                  Koop voor {fmtTokens(a.price)} tokens
                </button>
              ))}
          </div>
          <p className="reward muted">
            {a.me?.listens
              ? `Je hebt dit album ${a.me.listens}× helemaal geluisterd. Nog een keer levert tot ${a.reward.repeat} tokens op.`
              : `Helemaal luisteren levert tot ${a.reward.first} tokens op.`}
            {user && !owned && user.tokens < a.price && ` Je hebt nog ${fmtTokens(a.price - user.tokens)} tokens nodig om hem te kopen.`}
          </p>
          {buyState.error && (
            <p className="notice error" role="alert">
              {buyState.error}
            </p>
          )}
          {buyState.done && (
            <p className="notice success" role="status">
              Gekocht! {a.title} staat nu in je platenkast.
            </p>
          )}
        </div>
      </header>

      <div className="album-body">
        <section aria-labelledby="tracks-title">
          <h2 id="tracks-title">Kant A tot het einde</h2>
          <ol className="tracklist">
            {a.tracks.map((t) => (
              <li key={t.videoId}>
                <span className="title">{t.title}</span>
                <span className="dur">{fmtTime(t.duration)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="reviews-title" id="reviews">
          <h2 id="reviews-title">Recensies</h2>
          <MyReview album={a} onSaved={() => (reviews.reload(), album.reload())} />
          {reviews.data?.length ? (
            <ul className="review-list">
              {reviews.data.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </ul>
          ) : (
            <p className="muted">Nog geen recensies. Wees de eerste, na een volledige luisterbeurt.</p>
          )}
        </section>
      </div>
    </article>
  );
}

function ReviewItem({ review: r }: { review: Review }) {
  return (
    <li className="review">
      <article>
        <header>
          <strong translate="no">{r.username}</strong>
          <Stars rating={r.rating} size="0.95em" />
          {r.liked && (
            <span className="liked" role="img" aria-label="vindt dit een favoriet">
              ♥
            </span>
          )}
          <time dateTime={r.updatedAt} className="muted">
            {fmtDate(r.updatedAt)}
          </time>
        </header>
        {r.text && <p>{r.text}</p>}
      </article>
    </li>
  );
}

function MyReview({ album, onSaved }: { album: AlbumDetail; onSaved: () => void }) {
  const { user } = useAuth();
  const existing = album.me?.review ?? null;
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [text, setText] = useState(existing?.text ?? '');
  const [liked, setLiked] = useState(existing?.liked ?? false);
  const [editing, setEditing] = useState(!existing);
  const [status, setStatus] = useState<{ error?: string; busy?: boolean }>({});

  if (!user)
    return (
      <p className="muted">
        <Link to="/inloggen">Log in</Link> om na het luisteren een recensie te schrijven.
      </p>
    );
  if (!album.me?.listens)
    return <p className="notice">Luister het album eerst helemaal, dan kun je het beoordelen. Zo weet je het hele verhaal.</p>;

  if (existing && !editing)
    return (
      <div className="my-review">
        <p>
          Jij gaf dit album <Stars rating={existing.rating} /> ({fmtRating(existing.rating)})
          {existing.liked && ' en een hartje'}.
        </p>
        <button className="btn btn-small btn-ghost" type="button" onClick={() => setEditing(true)}>
          Recensie aanpassen
        </button>
      </div>
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setStatus({ error: 'Kies eerst een aantal sterren.' });
    setStatus({ busy: true });
    try {
      await api.saveReview(album.id, { rating, text, liked });
      setStatus({});
      setEditing(false);
      onSaved();
    } catch (err) {
      setStatus({ error: (err as Error).message });
    }
  }

  return (
    <form className="review-form stack" onSubmit={onSubmit} aria-labelledby="my-review-title">
      <h3 id="my-review-title">{existing ? 'Pas je recensie aan' : 'Wat vond je ervan?'}</h3>
      <StarInput name="rating" value={rating} onChange={setRating} />
      <label className="checkbox">
        <input type="checkbox" checked={liked} onChange={(e) => setLiked(e.target.checked)} />
        Favoriet ♥
      </label>
      <div className="field">
        <label htmlFor="review-text">Recensie (optioneel)</label>
        <textarea
          id="review-text"
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder="Welk verhaal vertelt dit album? Welk nummer bleef hangen?"
        />
      </div>
      {status.error && (
        <p className="notice error" role="alert">
          {status.error}
        </p>
      )}
      <div className="album-actions">
        <button className="btn btn-primary" type="submit" disabled={status.busy}>
          Opslaan
        </button>
        {existing && (
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Annuleren
          </button>
        )}
      </div>
    </form>
  );
}
