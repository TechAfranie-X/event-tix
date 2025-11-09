import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getToken } from '../lib/auth';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const token = getToken();
  const loc = useLocation();

  useEffect(() => {
    if (!token) {
      const next = encodeURIComponent(loc.pathname + loc.search);
      window.location.href = `/login?next=${next}`;
    }
  }, [token, loc]);

  return token ? children : null;
}

