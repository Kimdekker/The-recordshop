export default function AlbumGrid({ albums, currentId, onPlay, shelf }) {
  return (
    <ul className="grid">
      {albums.map((a) => {
        const saved = shelf.has(a.id);
        return (
          <li key={a.id} className={`sleeve ${a.id === currentId ? 'is-playing' : ''}`}>
            <button className="sleeve-cover" onClick={() => onPlay(a)} aria-label={`Speel ${a.title} van ${a.channel}`}>
              <span className="vinyl" aria-hidden="true" />
              {a.thumbnail ? <img src={a.thumbnail} alt="" loading="lazy" /> : <span className="cover-blank" />}
              <span className="play-badge" aria-hidden="true">▶</span>
            </button>
            <div className="sleeve-meta">
              <div className="sleeve-text">
                <strong title={a.title}>{a.title}</strong>
                <span>{a.channel}</span>
              </div>
              <button
                className={`shelf-btn ${saved ? 'saved' : ''}`}
                onClick={() => shelf.toggle(a)}
                aria-pressed={saved}
                title={saved ? 'Uit je kast halen' : 'In je kast zetten'}
              >
                {saved ? '✓ Kast' : '+ Kast'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
