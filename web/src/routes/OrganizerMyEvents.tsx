import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson, delJson } from '../lib/api';
import RequireAuth from '../components/RequireAuth';
import { isOrganizer } from '../lib/auth';
import Toast from '../components/Toast';

interface Event {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  category?: string;
  organizer_id?: number;
  is_published: boolean;
}

export default function OrganizerMyEvents() {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!isOrganizer()) {
      window.location.href = '/';
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<Event[]>('/api/organizer/events');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (!confirm('Unpublish this event?')) return;
    try {
      await delJson(`/api/organizer/events/${id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish event');
    }
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="container" style={{ maxWidth: 900, margin: '2rem auto' }}>
          <h2>My Events</h2>
          <p>Loading...</p>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="container" style={{ maxWidth: 900, margin: '2rem auto' }}>
        <h2>My Events</h2>
        {error && (
          <Toast
            message={error}
            type="error"
            onClose={() => setError(null)}
          />
        )}
        {items.length === 0 ? (
          <p>No events found. <Link to="/organizer/create">Create your first event</Link></p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {items.map((e) => (
              <li
                key={e.id}
                style={{
                  marginBottom: 12,
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <Link to={`/events/${e.id}`} style={{ textDecoration: 'none' }}>
                    <strong>{e.name}</strong>
                  </Link>
                  <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                    {e.is_published ? '· Published' : '· Unpublished'}
                  </span>
                  {e.location && (
                    <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                      · {e.location}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="btn btn-secondary"
                  style={{ marginLeft: 12 }}
                >
                  Unpublish
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireAuth>
  );
}

