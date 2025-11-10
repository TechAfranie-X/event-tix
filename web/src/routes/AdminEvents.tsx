import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminGetJson, adminPostJson, adminPutJson } from '../lib/adminApi';
import { getJson } from '../lib/api';
import Toast from '../components/Toast';
import { formatDateTime } from '../lib/dates';

interface Event {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  category?: string;
  tags?: string;
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getJson<Event[]>('/api/events');
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Manage Events</h1>
        <Link to="/admin/events/new" className="btn btn-primary">
          Create Event
        </Link>
      </div>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Starts At</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{event.id}</td>
                  <td style={{ padding: '0.75rem' }}>{event.name}</td>
                  <td style={{ padding: '0.75rem' }}>{event.location || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {event.starts_at ? formatDateTime(event.starts_at) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <Link to={`/admin/events/${event.id}/edit`} className="btn btn-sm">
                      Edit
                    </Link>
                    <Link
                      to={`/admin/events/${event.id}/ticket-types`}
                      className="btn btn-sm"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Ticket Types
                    </Link>
                    <Link
                      to={`/admin/events/${event.id}/promos`}
                      className="btn btn-sm"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Promos
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}




