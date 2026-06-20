import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (onAllowed: () => void, from = `${location.pathname}${location.search}`) => {
    if (loading) return;
    if (!user) {
      navigate('/login', { state: { from } });
      return;
    }
    onAllowed();
  };
}
