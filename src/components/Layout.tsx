import { NavLink, Outlet, Link, ScrollRestoration } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import TokenBadge from './TokenBadge.tsx';
import MiniPlayer from './MiniPlayer.tsx';
import { ListeningProvider } from '../context/listening.tsx';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    // ListeningProvider sits here (above <Outlet />), so the record keeps playing between pages.
    <ListeningProvider>
      <ScrollRestoration />
      <a className="skip-link" href="#main">
        Naar de inhoud
      </a>
      <header className="site-header">
        <div className="inner">
          <Link to="/" className="brand" viewTransition>
            <span className="disc" aria-hidden="true" />
            The Recordshop
          </Link>
          <nav className="main-nav" aria-label="Hoofdmenu">
            <ul>
              <li>
                <NavLink to="/" end viewTransition>
                  Ontdekken
                </NavLink>
              </li>
              {user && (
                <>
                  <li>
                    <NavLink to="/kast" viewTransition>
                      Mijn platenkast
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/dagboek" viewTransition>
                      Dagboek
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </nav>
          <div className="account">
            {user ? (
              <>
                <TokenBadge tokens={user.tokens} />
                <span className="muted username" translate="no">
                  {user.username}
                </span>
                <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
                  Uitloggen
                </button>
              </>
            ) : (
              <Link to="/inloggen" className="btn btn-primary btn-small">
                Inloggen
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>The Recordshop: hele albums, van begin tot eind. Muziek via YouTube.</p>
      </footer>
      <MiniPlayer />
    </ListeningProvider>
  );
}
