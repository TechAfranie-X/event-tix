import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJson } from '../lib/api';
import RequireAuth from '../components/RequireAuth';
import { isOrganizer } from '../lib/auth';
import Toast from '../components/Toast';
import { localToUtcIso } from '../lib/dates';

export default function OrganizerCreate() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    image_url: '',
    location: '',
    starts_at: '',
    ends_at: '',
    category: 'General',
    is_published: true,
    vip_capacity: 0,
    vip_price_cents: 0,
    reg_capacity: 0,
    reg_price_cents: 0,
  });
  const [createPromo, setCreatePromo] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    ticket_type: '',
    percent_off: '',
    amount_off_cents: '',
    max_total_uses: '',
    max_uses_per_user: '1',
    min_order_cents: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(k: string, v: any) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOrganizer()) {
      window.location.href = '/';
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        image_url: form.image_url,
        location: form.location,
        starts_at: localToUtcIso(form.starts_at),
        ends_at: localToUtcIso(form.ends_at),
        category: form.category,
        is_published: form.is_published,
        vip_capacity: form.vip_capacity,
        vip_price_cents: form.vip_price_cents,
        reg_capacity: form.reg_capacity,
        reg_price_cents: form.reg_price_cents,
      };
      const evt = await postJson('/api/organizer/events', payload);
      if (evt?.id) {
        // Create promo if checkbox is checked
        if (createPromo && promoForm.code.trim()) {
          try {
            const promoPayload: any = {
              code: promoForm.code.trim(),
              event_id: evt.id,
              is_active: promoForm.is_active,
            };
            if (promoForm.ticket_type) promoPayload.ticket_type = promoForm.ticket_type;
            if (promoForm.percent_off) promoPayload.percent_off = Number(promoForm.percent_off);
            if (promoForm.amount_off_cents) promoPayload.amount_off_cents = Number(promoForm.amount_off_cents);
            if (promoForm.max_total_uses) promoPayload.max_total_uses = Number(promoForm.max_total_uses);
            if (promoForm.max_uses_per_user) promoPayload.max_uses_per_user = Number(promoForm.max_uses_per_user);
            if (promoForm.min_order_cents) promoPayload.min_order_cents = Number(promoForm.min_order_cents);
            if (promoForm.starts_at) promoPayload.starts_at = localToUtcIso(promoForm.starts_at);
            if (promoForm.ends_at) promoPayload.ends_at = localToUtcIso(promoForm.ends_at);
            await postJson('/api/organizer/promos', promoPayload);
          } catch (promoErr) {
            // Log but don't fail the event creation
            console.error('Failed to create promo:', promoErr);
          }
        }
        nav(`/events/${evt.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="container" style={{ maxWidth: 760, margin: '2rem auto' }}>
        <h2>Create Event</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="name">
              Name
              <input
                id="name"
                value={form.name}
                onChange={(e) => upd('name', e.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="description">
              Description
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => upd('description', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="image_url">
              Image URL
              <input
                id="image_url"
                type="url"
                value={form.image_url}
                onChange={(e) => upd('image_url', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="location">
              Location
              <input
                id="location"
                value={form.location}
                onChange={(e) => upd('location', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="starts_at">
              Starts At
              <input
                id="starts_at"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => upd('starts_at', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="ends_at">
              Ends At
              <input
                id="ends_at"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => upd('ends_at', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="category">
              Category
              <input
                id="category"
                value={form.category}
                onChange={(e) => upd('category', e.target.value)}
              />
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => upd('is_published', e.target.checked)}
              />
              Published
            </label>
          </div>
          <hr />
          <h4>Ticket Types</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <strong>VIP</strong>
              <div className="form-group">
                <label htmlFor="vip_capacity">
                  Capacity
                  <input
                    id="vip_capacity"
                    type="number"
                    min="0"
                    value={form.vip_capacity}
                    onChange={(e) => upd('vip_capacity', Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="vip_price_cents">
                  Price (cents)
                  <input
                    id="vip_price_cents"
                    type="number"
                    min="0"
                    value={form.vip_price_cents}
                    onChange={(e) => upd('vip_price_cents', Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
            <div>
              <strong>Regular</strong>
              <div className="form-group">
                <label htmlFor="reg_capacity">
                  Capacity
                  <input
                    id="reg_capacity"
                    type="number"
                    min="0"
                    value={form.reg_capacity}
                    onChange={(e) => upd('reg_capacity', Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="reg_price_cents">
                  Price (cents)
                  <input
                    id="reg_price_cents"
                    type="number"
                    min="0"
                    value={form.reg_price_cents}
                    onChange={(e) => upd('reg_price_cents', Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
          </div>
          <hr />
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={createPromo}
                onChange={(e) => setCreatePromo(e.target.checked)}
              />
              Create a promo for this event now?
            </label>
          </div>
          {createPromo && (
            <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
              <h4 style={{ marginTop: 0 }}>Promo Code</h4>
              <div className="form-group">
                <label htmlFor="promo_code">
                  Code
                  <input
                    id="promo_code"
                    value={promoForm.code}
                    onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })}
                    required={createPromo}
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="promo_ticket_type">
                  Ticket Type (optional)
                  <select
                    id="promo_ticket_type"
                    value={promoForm.ticket_type}
                    onChange={(e) => setPromoForm({ ...promoForm, ticket_type: e.target.value })}
                  >
                    <option value="">Any</option>
                    <option value="VIP">VIP</option>
                    <option value="Regular">Regular</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="promo_percent_off">
                    Percent Off
                    <input
                      id="promo_percent_off"
                      type="number"
                      min="0"
                      max="100"
                      value={promoForm.percent_off}
                      onChange={(e) => setPromoForm({ ...promoForm, percent_off: e.target.value })}
                      placeholder="e.g. 10"
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="promo_amount_off">
                    Amount Off (cents)
                    <input
                      id="promo_amount_off"
                      type="number"
                      min="0"
                      value={promoForm.amount_off_cents}
                      onChange={(e) => setPromoForm({ ...promoForm, amount_off_cents: e.target.value })}
                      placeholder="e.g. 500"
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="promo_max_total_uses">
                    Max Total Uses
                    <input
                      id="promo_max_total_uses"
                      type="number"
                      min="0"
                      value={promoForm.max_total_uses}
                      onChange={(e) => setPromoForm({ ...promoForm, max_total_uses: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="promo_max_uses_per_user">
                    Max Uses / User
                    <input
                      id="promo_max_uses_per_user"
                      type="number"
                      min="1"
                      value={promoForm.max_uses_per_user}
                      onChange={(e) => setPromoForm({ ...promoForm, max_uses_per_user: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="promo_min_order">
                    Min Order (cents)
                    <input
                      id="promo_min_order"
                      type="number"
                      min="0"
                      value={promoForm.min_order_cents}
                      onChange={(e) => setPromoForm({ ...promoForm, min_order_cents: e.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="promo_starts_at">
                    Starts At
                    <input
                      id="promo_starts_at"
                      type="datetime-local"
                      value={promoForm.starts_at}
                      onChange={(e) => setPromoForm({ ...promoForm, starts_at: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="promo_ends_at">
                    Ends At
                    <input
                      id="promo_ends_at"
                      type="datetime-local"
                      value={promoForm.ends_at}
                      onChange={(e) => setPromoForm({ ...promoForm, ends_at: e.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={promoForm.is_active}
                    onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
        {error && (
          <Toast
            message={error}
            type="error"
            onClose={() => setError(null)}
          />
        )}
      </div>
    </RequireAuth>
  );
}

