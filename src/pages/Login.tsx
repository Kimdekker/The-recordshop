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
      <h1 id="auth-title">{isLogin ? 'Welcome back' : 'Join The Recordshop'}</h1>
      <p className="muted">
        {isLogin ? 'Log in to play records and earn tokens.' : 'Create an account and start your collection.'}
      </p>
      <form className="stack" onSubmit={onSubmit} noValidate={false}>
        <div className="field">
          <label htmlFor="username">Username</label>
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
              3–24 characters: letters, numbers, periods, hyphens, or underscores.
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
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
              At least 8 characters.
            </span>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'One moment…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="switch">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button type="button" className="link-button" onClick={() => setMode(isLogin ? 'register' : 'login')}>
          {isLogin ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </section>
  );
}
