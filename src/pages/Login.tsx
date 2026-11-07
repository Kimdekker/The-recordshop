import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await (mode === 'login' ? login : register)(String(form.get('username')), String(form.get('password')));
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{isLogin ? 'Welkom terug' : 'Word lid'}</h1>
      <p className="muted">
        {isLogin ? 'Log in om platen op te leggen en tokens te verdienen.' : 'Maak een account en begin je platenkast.'}
      </p>
      <form className="stack" onSubmit={onSubmit} noValidate={false}>
        <div className="field">
          <label htmlFor="username">Gebruikersnaam</label>
          <input
            id="username"
            name="username"
            className="input"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_.\-]+"
            autoComplete="username"
            aria-describedby={isLogin ? undefined : 'username-hint'}
          />
          {!isLogin && (
            <span id="username-hint" className="hint">
              3–24 tekens: letters, cijfers, punt, streepje of underscore.
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">Wachtwoord</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            aria-describedby={isLogin ? undefined : 'password-hint'}
          />
          {!isLogin && (
            <span id="password-hint" className="hint">
              Minstens 8 tekens.
            </span>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Even geduld…' : isLogin ? 'Inloggen' : 'Account maken'}
        </button>
      </form>
      <p className="switch">
        {isLogin ? 'Nog geen account?' : 'Al een account?'}{' '}
        <button type="button" className="link-button" onClick={() => setMode(isLogin ? 'register' : 'login')}>
          {isLogin ? 'Word lid' : 'Log in'}
        </button>
      </p>
    </section>
  );
}
