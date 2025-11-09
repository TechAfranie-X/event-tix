import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminPostJson, adminPutJson } from '../lib/adminApi';
import { getJson } from '../lib/api';
import Toast from '../components/Toast';

interface TicketType {
  id: number;
  name: string;
  capacity: number;
  sold_count: number;
  price_cents: number;
}

interface Event {
  id: number;
  name: string;
}

export default function AdminTicketTypes() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ticket_type: 'VIP' as 'VIP' | 'Regular',
    capacity: 100,
    price_cents: 5000,
    sale_start: '',
    sale_end: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Use public endpoint which includes ticket_types
      const eventDetail = await getJson<any>(`/api/events/${id}`);
      setEvent({ id: eventDetail.id, name: eventDetail.name });
      setTicketTypes(eventDetail.ticket_types || []);
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
        sale_start: formData.sale_start ? new Date(formData.sale_start).toISOString() : null,
        sale_end: formData.sale_end ? new Date(formData.sale_end).toISOString() : null,
      };
      await adminPostJson(`/api/admin/events/${id}/ticket-types`, payload);
      setShowForm(false);
      setFormData({
        ticket_type: 'VIP',
        capacity: 100,
        price_cents: 5000,
        sale_start: '',
        sale_end: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket type');
    }
  };

  const handleUpdate = async (ticketTypeId: number, updates: Partial<TicketType>) => {
    try {
      await adminPutJson(`/api/admin/ticket-types/${ticketTypeId}`, updates);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket type');
    }
  };

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  return (
    <div className="container">
      <h1>Ticket Types - {event?.name}</h1>
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
          <h2>Ticket Types</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Add Ticket Type'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.ticket_type}
                onChange={(e) => setFormData({ ...formData, ticket_type: e.target.value as 'VIP' | 'Regular' })}
                required
              >
                <option value="VIP">VIP</option>
                <option value="Regular">Regular</option>
              </select>
            </div>
            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                required
                min="1"
              />
            </div>
            <div className="form-group">
              <label>Price (cents)</label>
              <input
                type="number"
                value={formData.price_cents}
                onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) })}
                required
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Sale Start</label>
              <input
                type="datetime-local"
                value={formData.sale_start}
                onChange={(e) => setFormData({ ...formData, sale_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Sale End</label>
              <input
                type="datetime-local"
                value={formData.sale_end}
                onChange={(e) => setFormData({ ...formData, sale_end: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Capacity</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Sold</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Price (cents)</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ticketTypes.map((tt) => (
              <TicketTypeRow
                key={tt.id}
                ticketType={tt}
                editing={editingId === tt.id}
                onEdit={() => setEditingId(tt.id)}
                onCancel={() => setEditingId(null)}
                onSave={(updates) => handleUpdate(tt.id, updates)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketTypeRow({
  ticketType,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  ticketType: TicketType;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: Partial<TicketType>) => void;
}) {
  const [updates, setUpdates] = useState({
    capacity: ticketType.capacity,
    price_cents: ticketType.price_cents,
  });

  if (editing) {
    return (
      <tr>
        <td style={{ padding: '0.75rem' }}>{ticketType.name}</td>
        <td style={{ padding: '0.75rem' }}>
          <input
            type="number"
            value={updates.capacity}
            onChange={(e) => setUpdates({ ...updates, capacity: parseInt(e.target.value) })}
            min={ticketType.sold_count}
            style={{ width: '100px' }}
          />
        </td>
        <td style={{ padding: '0.75rem' }}>{ticketType.sold_count}</td>
        <td style={{ padding: '0.75rem' }}>
          <input
            type="number"
            value={updates.price_cents}
            onChange={(e) => setUpdates({ ...updates, price_cents: parseInt(e.target.value) })}
            min="0"
            style={{ width: '100px' }}
          />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onSave(updates)}
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
      <td style={{ padding: '0.75rem' }}>{ticketType.name}</td>
      <td style={{ padding: '0.75rem' }}>{ticketType.capacity}</td>
      <td style={{ padding: '0.75rem' }}>{ticketType.sold_count}</td>
      <td style={{ padding: '0.75rem' }}>{ticketType.price_cents}</td>
      <td style={{ padding: '0.75rem' }}>
        <button className="btn btn-sm" onClick={onEdit}>
          Edit
        </button>
      </td>
    </tr>
  );
}

