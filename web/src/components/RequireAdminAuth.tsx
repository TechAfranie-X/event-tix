import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RequireAdminAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('admin_token');
  const loc = useLocation();

  useEffect(() => {
    if (!token) {
      const next = encodeURIComponent(loc.pathname + loc.search);
      window.location.href = `/admin/login?next=${next}`;
    }
  }, [token, loc]);

  return token ? children : null;
}




