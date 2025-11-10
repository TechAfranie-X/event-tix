import { useEffect, useState } from 'react';
import { getJson, postJson } from '../lib/api';

export default function OrganizerPromos() {
  const [promos, setPromos] = useState<any[]>([]);
  const [form, setForm] = useState({
    code: '',
    event_id: '',
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
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const data = await getJson('/api/organizer/promos');
      setPromos(data || []);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const payload: any = {
        code: form.code.trim(),
        is_active: form.is_active,
      };
      if (form.event_id) payload.event_id = Number(form.event_id);
      if (form.ticket_type) payload.ticket_type = form.ticket_type;
      if (form.percent_off) payload.percent_off = Number(form.percent_off);
      if (form.amount_off_cents) payload.amount_off_cents = Number(form.amount_off_cents);
      if (form.max_total_uses) payload.max_total_uses = Number(form.max_total_uses);
      if (form.max_uses_per_user) payload.max_uses_per_user = Number(form.max_uses_per_user);
      if (form.min_order_cents) payload.min_order_cents = Number(form.min_order_cents);
      if (form.starts_at) payload.starts_at = new Date(form.starts_at).toISOString();
      if (form.ends_at) payload.ends_at = new Date(form.ends_at).toISOString();

      const res = await postJson('/api/organizer/promos', payload);
      setMessage(`Created promo ${res.code}`);
      setForm({
        code: '',
        event_id: '',
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
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || 'Failed');
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3">Promos</h1>

      {message && <div className="mb-3 text-sm">{message}</div>}

      <form onSubmit={createPromo} className="grid gap-3 border p-3 rounded">
        <div>
          <label className="block text-sm">Code</label>
          <input name="code" value={form.code} onChange={onChange} className="w-full border p-2 rounded" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">Event ID (optional)</label>
            <input name="event_id" value={form.event_id} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Ticket Type (optional)</label>
            <input name="ticket_type" value={form.ticket_type} onChange={onChange} className="w-full border p-2 rounded" placeholder="VIP or Regular" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">Percent Off</label>
            <input name="percent_off" value={form.percent_off} onChange={onChange} className="w-full border p-2 rounded" placeholder="e.g. 10" />
          </div>
          <div>
            <label className="block text-sm">Amount Off (cents)</label>
            <input name="amount_off_cents" value={form.amount_off_cents} onChange={onChange} className="w-full border p-2 rounded" placeholder="e.g. 500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Max Total Uses</label>
            <input name="max_total_uses" value={form.max_total_uses} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Max Uses / User</label>
            <input name="max_uses_per_user" value={form.max_uses_per_user} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Min Order (cents)</label>
            <input name="min_order_cents" value={form.min_order_cents} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm">Starts At (local)</label>
            <input type="datetime-local" name="starts_at" value={form.starts_at} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">Ends At (local)</label>
            <input type="datetime-local" name="ends_at" value={form.ends_at} onChange={onChange} className="w-full border p-2 rounded" />
          </div>
        </div>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} />
          <span>Active</span>
        </label>

        <button className="border px-3 py-2 rounded">Create Promo</button>
      </form>

      <div className="mt-6">
        <h2 className="font-medium mb-2">Your Promo Codes</h2>
        <div className="grid gap-2">
          {promos.map(p => (
            <div key={p.id} className="border p-2 rounded text-sm">
              <div><b>{p.code}</b> {p.percent_off ? `- ${p.percent_off}%` : p.amount_off_cents ? `- ${p.amount_off_cents}¢` : ''}</div>
              <div>Event: {p.event_id ?? 'Any'} | Type: {p.ticket_type ?? 'Any'} | Used: {p.used_count}/{p.max_total_uses ?? '∞'} | Active: {String(p.is_active)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

