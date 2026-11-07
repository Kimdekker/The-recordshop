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

  if (album.loading && !album.data) return <p role="status">Pulling the album from the crate…</p>;
  if (album.error)
    return (
      <div className="stack">
        <h1>No record here</h1>
        <p className="notice error" role="alert">
          {album.error.message}
        </p>
        <p>
          <Link to="/">Back to Discover</Link>
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
            alt={`Cover of ${a.title}`}
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
                <dt>Year</dt>
                <dd>{a.year}</dd>
              </div>
            )}
            <div>
              <dt>Tracks</dt>
              <dd>{a.trackCount}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{fmtMinutes(a.totalDuration)}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                {a.ratingAvg != null ? (
                  <>
                    <Stars rating={a.ratingAvg} /> <span className="muted">({a.ratingCount})</span>
                  </>
                ) : (
                  <span className="muted">none yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Full listens</dt>
              <dd>{a.listenCount}×</dd>
            </div>
          </dl>

          <div className="album-actions">
            <Link className="btn btn-primary" to={`/listen/${a.id}`} viewTransition>
              Play the record
            </Link>
            {user &&
              (owned ? (
                <span className="badge gold">In your collection</span>
              ) : (
                <button className="btn" type="button" onClick={buy} disabled={buyState.busy || user.tokens < a.price}>
                  Buy for {fmtTokens(a.price)} tokens
                </button>
              ))}
          </div>
          <p className="reward muted">
            {a.me?.listens
              ? `You've listened to this album all the way through ${a.me.listens}×. Another listen earns up to ${a.reward.repeat} tokens.`
              : `Listening all the way through earns up to ${a.reward.first} tokens.`}
            {user && !owned && user.tokens < a.price && ` You need ${fmtTokens(a.price - user.tokens)} more tokens to buy it.`}
          </p>
          {buyState.error && (
            <p className="notice error" role="alert">
              {buyState.error}
            </p>
          )}
          {buyState.done && (
            <p className="notice success" role="status">
              Bought! {a.title} is now in your collection.
            </p>
          )}
        </div>
      </header>

      <div className="album-body">
        <section aria-labelledby="tracks-title">
          <h2 id="tracks-title">Side A to the end</h2>
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
          <h2 id="reviews-title">Reviews</h2>
          <MyReview album={a} onSaved={() => (reviews.reload(), album.reload())} />
          {reviews.data?.length ? (
            <ul className="review-list">
              {reviews.data.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </ul>
          ) : (
            <p className="muted">No reviews yet. Be the first, after a full listen.</p>
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
            <span className="liked" role="img" aria-label="marked as a favorite">
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
        <Link to="/login">Log in</Link> to write a review after listening.
      </p>
    );
  if (!album.me?.listens)
    return <p className="notice">Listen to the whole album first, then you can rate it. That way you know the whole story.</p>;

  if (existing && !editing)
    return (
      <div className="my-review">
        <p>
          You gave this album <Stars rating={existing.rating} /> ({fmtRating(existing.rating)})
          {existing.liked && ' and a heart'}.
        </p>
        <button className="btn btn-small btn-ghost" type="button" onClick={() => setEditing(true)}>
          Edit review
        </button>
      </div>
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setStatus({ error: 'Pick a star rating first.' });
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
      <h3 id="my-review-title">{existing ? 'Edit your review' : 'What did you think?'}</h3>
      <StarInput name="rating" value={rating} onChange={setRating} />
      <label className="checkbox">
        <input type="checkbox" checked={liked} onChange={(e) => setLiked(e.target.checked)} />
        Favorite ♥
      </label>
      <div className="field">
        <label htmlFor="review-text">Review (optional)</label>
        <textarea
          id="review-text"
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder="What story does this album tell? Which track stuck with you?"
        />
      </div>
      {status.error && (
        <p className="notice error" role="alert">
          {status.error}
        </p>
      )}
      <div className="album-actions">
        <button className="btn btn-primary" type="submit" disabled={status.busy}>
          Save
        </button>
        {existing && (
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
