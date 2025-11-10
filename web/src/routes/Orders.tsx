import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson, postJson } from '../lib/api';
import Toast from '../components/Toast';
import { formatDateTime } from '../lib/dates';
import { getUser } from '../lib/auth';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface Order {
  id: number;
  event_id: number;
  status: string;
  ticket_type: string;
  qr_token: string | null;
  ticket_price_cents: number | null;
  discount_cents: number;
  total_cents: number | null;
  promo_code: string | null;
  created_at: string;
}

interface EventInfo {
  id: number;
  name: string;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return 'N/A';
  return `$${(cents / 100).toFixed(2)}`;
}

interface VerifyResult {
  valid: boolean;
  status: string | null;
  order_id: number | null;
}

interface CheckinResult {
  ok: boolean;
  previous_status: string | null;
  new_status: string | null;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Record<number, EventInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult | null>>({});
  const [checkinResults, setCheckinResults] = useState<Record<string, CheckinResult | null>>({});
  const [verifying, setVerifying] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getJson<Order[]>('/api/orders');
        setOrders(data.slice(0, 10)); // Last 10 orders
        setError(null);
        
        // Fetch event names for all unique event IDs
        const eventIds = [...new Set(data.map(o => o.event_id))];
        const eventMap: Record<number, EventInfo> = {};
        for (const eventId of eventIds) {
          try {
            const eventData = await getJson<EventInfo>(`/api/events/${eventId}`);
            eventMap[eventId] = eventData;
          } catch {
            // If event fetch fails, use a placeholder
            eventMap[eventId] = { id: eventId, name: `Event #${eventId}` };
          }
        }
        setEvents(eventMap);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
        // Don't show toast for unauthorized - redirect will handle it
        if (!errorMessage.includes('Unauthorized')) {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const verifyTicket = async (qrToken: string) => {
    setVerifying(qrToken);
    try {
      const result = await getJson<VerifyResult>(`/api/tickets/verify/${qrToken}`);
      setVerifyResults(prev => ({ ...prev, [qrToken]: result }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify ticket';
      if (!errorMessage.includes('Unauthorized')) {
        setError(errorMessage);
      }
      setVerifyResults(prev => ({ ...prev, [qrToken]: { valid: false, status: null, order_id: null } }));
    } finally {
      setVerifying(null);
    }
  };

  const checkinTicket = async (qrToken: string) => {
    setCheckingIn(qrToken);
    try {
      const result = await postJson<CheckinResult>(`/api/tickets/checkin/${qrToken}`, {});
      setCheckinResults(prev => ({ ...prev, [qrToken]: result }));
      
      // Refresh orders to get updated status
      const data = await getJson<Order[]>('/api/orders');
      setOrders(data.slice(0, 10));
      
      // Clear verify result since status changed
      setVerifyResults(prev => ({ ...prev, [qrToken]: null }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check in ticket';
      if (!errorMessage.includes('Unauthorized')) {
        setError(errorMessage);
      }
    } finally {
      setCheckingIn(null);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const handleCancelOrder = async (order: Order) => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    setCancelling(order.id);

    try {
      await postJson(`/api/orders/${order.id}/cancel`, {});
      
      // Refresh orders
      const data = await getJson<Order[]>('/api/orders');
      setOrders(data.slice(0, 10));
      
      // Refresh event names if needed
      const eventIds = [...new Set(data.map(o => o.event_id))];
      const eventMap: Record<number, EventInfo> = {};
      for (const eventId of eventIds) {
        if (!events[eventId]) {
          try {
            const eventData = await getJson<EventInfo>(`/api/events/${eventId}`);
            eventMap[eventId] = eventData;
          } catch {
            eventMap[eventId] = { id: eventId, name: `Event #${eventId}` };
          }
        }
      }
      if (Object.keys(eventMap).length > 0) {
        setEvents(prev => ({ ...prev, ...eventMap }));
      }
      
      // Refresh availability for the cancelled order's event
      // This is handled by the backend processor, but we can show a success message
      setToast({
        message: 'Order cancelled successfully. Ticket availability has been updated.',
        type: 'success'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order';
      if (!errorMessage.includes('Unauthorized')) {
        setError(errorMessage);
      }
    } finally {
      setCancelling(null);
    }
  };

  const downloadReceipt = (order: Order) => {
    const user = getUser();
    const eventName = events[order.event_id]?.name || `Event #${order.event_id}`;
    
    // CSV columns: order_id, user_email, event_name, ticket_type, ticket_price_cents, discount_cents, total_cents, created_at, promo_code
    const csvRows = [
      [
        'order_id',
        'user_email',
        'event_name',
        'ticket_type',
        'ticket_price_cents',
        'discount_cents',
        'total_cents',
        'created_at',
        'promo_code'
      ],
      [
        order.id.toString(),
        user?.email || '',
        eventName,
        order.ticket_type,
        (order.ticket_price_cents ?? 0).toString(),
        order.discount_cents.toString(),
        (order.total_cents ?? 0).toString(),
        order.created_at,
        order.promo_code || ''
      ]
    ];
    
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `receipt_order_${order.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Orders</h1>
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {error && !error.includes('Unauthorized') && (
        <div className="card" style={{ background: '#fee', color: '#c33', marginBottom: '2rem' }}>
          <strong>Error:</strong> {error}
          <button
            onClick={() => window.location.reload()}
            className="btn btn-secondary"
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h3>No orders yet</h3>
          <p>You haven't placed any ticket orders yet.</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/events" className="btn btn-primary">Browse Events</Link>
          </p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order) => {
            const verifyResult = order.qr_token ? verifyResults[order.qr_token] : null;
            const checkinResult = order.qr_token ? checkinResults[order.qr_token] : null;
            
            return (
              <div key={order.id} className="card order-card">
                <div className="order-header">
                  <h3>Order #{order.id}</h3>
                  <span className={`status-badge status-${order.status}`}>
                    {order.status}
                  </span>
                </div>
                <div className="order-details">
                  <p><strong>Type:</strong> {order.ticket_type}</p>
                  <p><strong>Created:</strong> {formatDate(order.created_at)}</p>
                  {order.status === 'confirmed' && (
                    <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => downloadReceipt(order)}
                        style={{ fontSize: '0.9rem' }}
                      >
                        📥 Download Receipt (CSV)
                      </button>
                      {(!order.qr_token || (order.qr_token && verifyResults[order.qr_token]?.status !== 'checked_in')) && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleCancelOrder(order)}
                          disabled={cancelling === order.id}
                          style={{ fontSize: '0.9rem', background: '#dc3545', color: 'white' }}
                        >
                          {cancelling === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  )}
                  {order.ticket_price_cents !== null && (
                    <div className="order-pricing" style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span>Ticket Price:</span>
                        <span>{formatPrice(order.ticket_price_cents)}</span>
                      </div>
                      {order.discount_cents > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: '#28a745' }}>
                            <span>Discount:</span>
                            <span>-{formatPrice(order.discount_cents)}</span>
                          </div>
                          {order.promo_code && (
                            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>
                              Promo Code: {order.promo_code}
                            </div>
                          )}
                        </>
                      )}
                      {order.total_cents !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', paddingTop: '0.5rem', borderTop: '1px solid #ddd', marginTop: '0.5rem' }}>
                          <span>Total:</span>
                          <span>{formatPrice(order.total_cents)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {order.qr_token && (
                    <div className="qr-token">
                      <strong>QR Token:</strong>
                      <div className="qr-token-row">
                        <code>{order.qr_token}</code>
                        <button
                          className="btn btn-small"
                          onClick={() => copyToClipboard(order.qr_token!)}
                        >
                          {copiedToken === order.qr_token ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => verifyTicket(order.qr_token!)}
                          disabled={verifying === order.qr_token}
                        >
                          {verifying === order.qr_token ? 'Verifying...' : 'Verify'}
                        </button>
                        {verifyResult && (
                          <div className="verify-result">
                            <span className={verifyResult.valid ? 'verify-valid' : 'verify-invalid'}>
                              {verifyResult.valid ? '✓ Valid' : '✗ Invalid'}
                            </span>
                            {verifyResult.status && (
                              <span className="verify-status">Status: {verifyResult.status}</span>
                            )}
                            {verifyResult.valid && verifyResult.status === 'issued' && (
                              <button
                                className="btn btn-small btn-checkin"
                                onClick={() => checkinTicket(order.qr_token!)}
                                disabled={checkingIn === order.qr_token}
                              >
                                {checkingIn === order.qr_token ? 'Checking in...' : 'Check-in'}
                              </button>
                            )}
                          </div>
                        )}
                        {checkinResult && (
                          <div className="checkin-result">
                            {checkinResult.ok ? (
                              <span className="checkin-success">
                                ✓ Checked in! ({checkinResult.previous_status} → {checkinResult.new_status})
                              </span>
                            ) : (
                              <span className="checkin-error">
                                ✗ Check-in failed
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
