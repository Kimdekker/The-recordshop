import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function RequireUser() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Laden…</p>;
  if (!user) return <Navigate to="/inloggen" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
