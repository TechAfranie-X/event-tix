import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getJson } from '../lib/api';

interface HealthResponse {
  ok: boolean;
  version: string;
  db: string;
}

export default function Nav() {
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await getJson<HealthResponse>('/api/health');
        setApiStatus('online');
      } catch {
        setApiStatus('offline');
      }
    };

    // Check immediately
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setShowAdminDropdown(false);
      }
    };

    if (showAdminDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdminDropdown]);

  const isAuthed = !!localStorage.getItem('token');
  const adminAuthed = !!localStorage.getItem('admin_token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const organizer = user && (user.role === 'organizer' || user.role === 'admin');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  const onAdminLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/';
  };

  return (
    <nav>
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          Event Ticketing
        </Link>
        <div className="nav-links">
          {apiStatus === 'offline' && (
            <span
              title="API unreachable"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#dc3545',
                marginRight: '0.5rem',
                cursor: 'help',
              }}
            />
          )}
          {adminAuthed && (
            <div ref={adminDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                className="btn-link"
                style={{ marginRight: '1rem' }}
                onClick={() => setShowAdminDropdown(!showAdminDropdown)}
              >
                Admin ▼
              </button>
              {showAdminDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  minWidth: '150px',
                  zIndex: 1000,
                }}>
                  <Link
                    to="/admin/events"
                    style={{ display: 'block', padding: '0.5rem 1rem', textDecoration: 'none', color: '#333' }}
                    onClick={() => setShowAdminDropdown(false)}
                  >
                    Manage Events
                  </Link>
                  <Link
                    to="/admin/reports"
                    style={{ display: 'block', padding: '0.5rem 1rem', textDecoration: 'none', color: '#333' }}
                    onClick={() => setShowAdminDropdown(false)}
                  >
                    Sales Reports
                  </Link>
                  <button
                    onClick={() => {
                      setShowAdminDropdown(false);
                      onAdminLogout();
                    }}
                    className="btn-link"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer' }}
                  >
                    Admin Logout
                  </button>
                </div>
              )}
            </div>
          )}
          {isAuthed ? (
            <>
              <span className="nav-greeting">Hi, {user?.name}</span>
              {organizer && (
                <>
                  <Link to="/organizer/create">Create</Link>
                  <Link to="/organizer/events">My Events</Link>
                  <Link to="/organizer/promos">Promos</Link>
                </>
              )}
              <Link to="/orders">Orders</Link>
              <Link to="/scan">Scan</Link>
              <button onClick={logout} className="btn-link">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

