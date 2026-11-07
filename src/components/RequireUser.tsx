import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function RequireUser() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
