import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminPostJson, adminPutJson } from '../lib/adminApi';
import { getJson } from '../lib/api';
import Toast from '../components/Toast';
import { localToUtcIso } from '../lib/dates';

interface EventData {
  name: string;
  description?: string;
  image_url?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  category?: string;
  tags?: string;
}

export default function AdminEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventData>({
    name: '',
    description: '',
    image_url: '',
    location: '',
    starts_at: '',
    ends_at: '',
    category: '',
    tags: '',
  });

  useEffect(() => {
    if (isEdit) {
      loadEvent();
    }
  }, [id]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      // Use public endpoint to load event data
      const event = await getJson<any>(`/api/events/${id}`);
      setFormData({
        name: event.name || '',
        description: event.description || '',
        image_url: event.image_url || '',
        location: event.location || '',
        starts_at: event.starts_at ? new Date(event.starts_at).toISOString().slice(0, 16) : '',
        ends_at: event.ends_at ? new Date(event.ends_at).toISOString().slice(0, 16) : '',
        category: event.category || '',
        tags: event.tags || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        ...formData,
        starts_at: localToUtcIso(formData.starts_at),
        ends_at: localToUtcIso(formData.ends_at),
      };
      // Remove empty strings
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '') {
          payload[key] = null;
        }
      });

      if (isEdit) {
        await adminPutJson(`/api/admin/events/${id}`, payload);
      } else {
        await adminPostJson('/api/admin/events', payload);
      }
      navigate('/admin/events');
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  return (
    <div className="container">
      <h1>{isEdit ? 'Edit Event' : 'Create Event'}</h1>
      <Link to="/admin/events" style={{ marginBottom: '1rem', display: 'block' }}>
        ← Back to Events
      </Link>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="image_url">Image URL</label>
            <input
              type="url"
              id="image_url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="starts_at">Starts At</label>
            <input
              type="datetime-local"
              id="starts_at"
              value={formData.starts_at}
              onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ends_at">Ends At</label>
            <input
              type="datetime-local"
              id="ends_at"
              value={formData.ends_at}
              onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <input
              type="text"
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags (comma-separated)</label>
            <input
              type="text"
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}

