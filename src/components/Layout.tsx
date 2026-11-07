import { NavLink, Outlet, Link, ScrollRestoration } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import TokenBadge from './TokenBadge.tsx';
import MiniPlayer from './MiniPlayer.tsx';
import Icon, { type IconName } from './Icon.tsx';
import { ListeningProvider } from '../context/listening.tsx';

function NavItem({ to, icon, label, end }: { to: string; icon: IconName; label: string; end?: boolean }) {
  return (
    <li>
      <NavLink to={to} end={end} viewTransition>
        <Icon name={icon} />
        <span className="nav-label">{label}</span>
      </NavLink>
    </li>
  );
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  return (
    // ListeningProvider sits here (above <Outlet />), so the record keeps playing between pages.
    <ListeningProvider>
      <ScrollRestoration />
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Floating sidebar (wide), icon rail (medium) or floating bar at the top (phone). */}
      <header className="sidebar">
        <Link to="/" className="brand" viewTransition>
          <span className="disc" aria-hidden="true" />
          <span className="nav-label">The Recordshop</span>
        </Link>

        <nav className="main-nav" aria-label="Main menu">
          <ul>
            <NavItem to="/" end icon="discover" label="Discover" />
            {user && (
              <>
                <NavItem to="/collection" icon="shelf" label="My Collection" />
                <NavItem to="/diary" icon="diary" label="Diary" />
              </>
            )}
          </ul>
        </nav>

        <div className="account">
          {loading ? null : user ? (
            <>
              <TokenBadge tokens={user.tokens} />
              <p className="who">
                <Icon name="user" />
                <span className="nav-label" translate="no">
                  <span className="visually-hidden">Logged in as </span>
                  {user.username}
                </span>
              </p>
              <button type="button" className="side-action" onClick={logout}>
                <Icon name="logout" />
                <span className="nav-label">Log out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="side-action primary">
              <Icon name="login" />
              <span className="nav-label">Log in</span>
            </Link>
          )}
        </div>
      </header>

      <div className="page">
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="site-footer">
          <p>The Recordshop: whole albums, start to finish. Music via YouTube.</p>
        </footer>
      </div>
      <MiniPlayer />
    </ListeningProvider>
  );
}
