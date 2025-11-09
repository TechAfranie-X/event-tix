import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminGetJson, adminPostJson, adminPutJson } from '../lib/adminApi';
import { getJson } from '../lib/api';
import Toast from '../components/Toast';

interface PromoCode {
  id: number;
  code: string;
  type: string;
  value_cents?: number;
  percent?: number;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  applies_to?: string;
}

interface Event {
  id: number;
  name: string;
}

export default function AdminPromos() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percent' as 'percent' | 'amount',
    value_cents: 0,
    percent: 10,
    max_uses: undefined as number | undefined,
    expires_at: '',
    applies_to: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, promosData] = await Promise.all([
        getJson<Event>(`/api/events/${id}`),
        adminGetJson<PromoCode[]>(`/api/admin/promos?event_id=${id}`),
      ]);
      setEvent(eventData);
      setPromos(promosData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        max_uses: formData.max_uses || null,
        applies_to: formData.applies_to || null,
      };
      if (formData.type === 'percent') {
        payload.value_cents = null;
      } else {
        payload.percent = null;
      }
      await adminPostJson(`/api/admin/events/${id}/promos`, payload);
      setShowForm(false);
      setFormData({
        code: '',
        type: 'percent',
        value_cents: 0,
        percent: 10,
        max_uses: undefined,
        expires_at: '',
        applies_to: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create promo code');
    }
  };

  const handleUpdate = async (promoId: number, updates: Partial<PromoCode>) => {
    try {
      await adminPutJson(`/api/admin/promos/${promoId}`, updates);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update promo code');
    }
  };

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  return (
    <div className="container">
      <h1>Promo Codes - {event?.name}</h1>
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

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Promo Codes</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Add Promo Code'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="form-group">
              <label>Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percent' | 'amount' })}
                required
              >
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            {formData.type === 'percent' ? (
              <div className="form-group">
                <label>Percent (0-100) *</label>
                <input
                  type="number"
                  value={formData.percent}
                  onChange={(e) => setFormData({ ...formData, percent: parseInt(e.target.value) })}
                  required
                  min="0"
                  max="100"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Value (cents) *</label>
                <input
                  type="number"
                  value={formData.value_cents}
                  onChange={(e) => setFormData({ ...formData, value_cents: parseInt(e.target.value) })}
                  required
                  min="0"
                />
              </div>
            )}
            <div className="form-group">
              <label>Max Uses</label>
              <input
                type="number"
                value={formData.max_uses || ''}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                min="1"
              />
            </div>
            <div className="form-group">
              <label>Expires At</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Applies To (comma-separated ticket types)</label>
              <input
                type="text"
                value={formData.applies_to}
                onChange={(e) => setFormData({ ...formData, applies_to: e.target.value })}
                placeholder="VIP, Regular"
              />
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Code</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Value</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Used/Max</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Expires</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((promo) => (
              <PromoRow
                key={promo.id}
                promo={promo}
                editing={editingId === promo.id}
                onEdit={() => setEditingId(promo.id)}
                onCancel={() => setEditingId(null)}
                onSave={(updates) => handleUpdate(promo.id, updates)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PromoRow({
  promo,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  promo: PromoCode;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: Partial<PromoCode>) => void;
}) {
  const [updates, setUpdates] = useState({
    code: promo.code,
    type: promo.type,
    value_cents: promo.value_cents || 0,
    percent: promo.percent || 0,
    max_uses: promo.max_uses,
    expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().slice(0, 16) : '',
    applies_to: promo.applies_to || '',
  });

  if (editing) {
    return (
      <tr>
        <td style={{ padding: '0.75rem' }}>
          <input
            type="text"
            value={updates.code}
            onChange={(e) => setUpdates({ ...updates, code: e.target.value.toUpperCase() })}
            style={{ width: '100px' }}
          />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <select
            value={updates.type}
            onChange={(e) => setUpdates({ ...updates, type: e.target.value })}
          >
            <option value="percent">Percent</option>
            <option value="amount">Amount</option>
          </select>
        </td>
        <td style={{ padding: '0.75rem' }}>
          {updates.type === 'percent' ? (
            <input
              type="number"
              value={updates.percent}
              onChange={(e) => setUpdates({ ...updates, percent: parseInt(e.target.value) })}
              min="0"
              max="100"
              style={{ width: '80px' }}
            />
          ) : (
            <input
              type="number"
              value={updates.value_cents}
              onChange={(e) => setUpdates({ ...updates, value_cents: parseInt(e.target.value) })}
              min="0"
              style={{ width: '100px' }}
            />
          )}
        </td>
        <td style={{ padding: '0.75rem' }}>
          {promo.used_count} / {promo.max_uses || '∞'}
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input
            type="datetime-local"
            value={updates.expires_at}
            onChange={(e) => setUpdates({ ...updates, expires_at: e.target.value })}
          />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const payload: any = { ...updates };
              if (payload.type === 'percent') {
                payload.value_cents = null;
              } else {
                payload.percent = null;
              }
              payload.expires_at = payload.expires_at ? new Date(payload.expires_at).toISOString() : null;
              payload.max_uses = payload.max_uses || null;
              payload.applies_to = payload.applies_to || null;
              onSave(payload);
            }}
          >
            Save
          </button>
          <button
            className="btn btn-sm"
            onClick={onCancel}
            style={{ marginLeft: '0.5rem' }}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={{ padding: '0.75rem' }}>{promo.code}</td>
      <td style={{ padding: '0.75rem' }}>{promo.type}</td>
      <td style={{ padding: '0.75rem' }}>
        {promo.type === 'percent' ? `${promo.percent}%` : `$${(promo.value_cents || 0) / 100}`}
      </td>
      <td style={{ padding: '0.75rem' }}>
        {promo.used_count} / {promo.max_uses || '∞'}
      </td>
      <td style={{ padding: '0.75rem' }}>
        {promo.expires_at ? new Date(promo.expires_at).toLocaleString() : 'Never'}
      </td>
      <td style={{ padding: '0.75rem' }}>
        <button className="btn btn-sm" onClick={onEdit}>
          Edit
        </button>
      </td>
    </tr>
  );
}




