import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './Loader';

export function ProtectedRoute({ children, roles, permission }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Loader label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !(Array.isArray(permission) ? permission.some(can) : can(permission))) return <Navigate to="/dashboard" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
