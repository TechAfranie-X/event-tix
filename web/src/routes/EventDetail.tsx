import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getJson, postJson } from '../lib/api';
import Toast from '../components/Toast';
import { getToken } from '../lib/auth';

// Category-based Unsplash placeholders
const CATEGORY_IMAGES: Record<string, string> = {
  Technology: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&q=80&auto=format&fit=crop",
  Music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80&auto=format&fit=crop",
  Business: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80&auto=format&fit=crop",
  General: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80&auto=format&fit=crop"
};

function getEventImage(event: EventDetail): string {
  if (event.image_url) return event.image_url;
  const category = event.category || 'General';
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.General;
}

interface TicketType {
  id: number;
  name: string;
  capacity: number;
  sold_count: number;
  price_cents: number;
}

interface EventDetail {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  category: string | null;
  tags: string | null;
  ticket_types: TicketType[];
}

interface Availability {
  vip_left: number;
  regular_left: number;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = parseInt(id || '1', 10);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [quote, setQuote] = useState<{
    ticket_price_cents: number;
    discount_cents: number;
    total_cents: number;
    promo_applied: { code: string; type: string; amount: number } | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await getJson<EventDetail>(`/api/events/${eventId}`);
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Fetch availability every 4s
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const data = await getJson<Availability>(`/api/availability?event_id=${eventId}`);
        setAvailability(data);
      } catch (err) {
        console.error('Failed to fetch availability:', err);
      }
    };

    fetchAvailability();
    const interval = setInterval(fetchAvailability, 4000);
    return () => clearInterval(interval);
  }, [eventId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleApplyPromo = async (ticketTypeName?: string) => {
    if (!promoCode.trim()) {
      setPromoError(null);
      setQuote(null);
      return;
    }

    setApplyingPromo(true);
    setPromoError(null);

    try {
      // Use provided ticket type, or default to VIP if available, else Regular
      if (!ticketTypeName && event) {
        const vipType = event.ticket_types.find(tt => tt.name === 'VIP');
        ticketTypeName = vipType ? 'VIP' : 'Regular';
      }
      
      if (!ticketTypeName) {
        setPromoError('Please select a ticket type first');
        setApplyingPromo(false);
        return;
      }

      const response = await postJson<{
        ok: boolean;
        ticket_price_cents: number;
        discount_cents: number;
        total_cents: number;
        promo_applied: { code: string; type: string; amount: number } | null;
      }>('/api/quote', {
        event_id: eventId,
        ticket_type_name: ticketTypeName,
        promo_code: promoCode.trim() || undefined,
      });

      setQuote(response);
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Invalid promo code');
      setQuote(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  const handlePurchase = async (ticketTypeName: string) => {
    const authed = !!getToken();
    if (!authed) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // If promo code is entered but not yet validated, validate it first
    if (promoCode.trim() && !quote) {
      await handleApplyPromo(ticketTypeName);
      // If validation failed, don't proceed
      if (promoError) {
        return;
      }
    }

    setPurchasing(ticketTypeName);

    try {
      const response = await postJson<{
        ok: boolean;
        order_id: number;
        message: string;
      }>('/api/checkout', {
        event_id: eventId,
        ticket_type_name: ticketTypeName,
        promo_code: promoCode.trim() || undefined,
      });

      setToast({ 
        message: response.message, 
        type: 'success' 
      });
      
      // Send receipt email (stub)
      try {
        await postJson(`/api/email/receipt`, { order_id: response.order_id });
        setToast({
          message: 'Receipt emailed (demo)',
          type: 'info'
        });
      } catch (err) {
        // Silently fail - email is just a stub
        console.error('Failed to send receipt email:', err);
      }
      
      // Clear promo code and quote
      setPromoCode('');
      setQuote(null);
      setPromoError(null);
      
      // Refresh availability
      const data = await getJson<Availability>(`/api/availability?event_id=${eventId}`);
      setAvailability(data);
      
      // Redirect to orders after a short delay
      setTimeout(() => {
        navigate('/orders');
      }, 2000);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to purchase ticket',
        type: 'error'
      });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="container">
        <div className="card">
          <h2>Event not found</h2>
          <p>{error || 'The event you are looking for does not exist.'}</p>
          <Link to="/events" className="btn btn-primary">Back to Events</Link>
        </div>
      </div>
    );
  }

  const vipType = event.ticket_types.find(tt => tt.name === 'VIP');
  const regularType = event.ticket_types.find(tt => tt.name === 'Regular');
  
  // Use live availability if available, otherwise use ticket_types data
  const vipAvailable = availability ? availability.vip_left : (vipType ? vipType.capacity - vipType.sold_count : 0);
  const regularAvailable = availability ? availability.regular_left : (regularType ? regularType.capacity - regularType.sold_count : 0);
  
  // Check auth status
  const authed = !!getToken();

  return (
    <div className="container">
      <Link to="/events" className="back-link">← Back to Events</Link>
      
      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="event-detail">
        {/* Hero Section */}
        <div className="event-hero">
          <img src={getEventImage(event)} alt={event.name} className="event-hero-image" />
          <div className="event-hero-content">
            <h1>{event.name}</h1>
            {event.category && (
              <span className="event-category-badge">{event.category}</span>
            )}
            <div className="event-hero-details">
              {event.location && (
                <p>📍 {event.location}</p>
              )}
              <p>📅 {formatDate(event.starts_at)}</p>
              {event.ends_at && (
                <p>⏰ Ends: {formatDate(event.ends_at)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="card">
            <h2>About</h2>
            <p>{event.description}</p>
          </div>
        )}


        {/* Ticket Availability */}
        <div className="card">
          <h2>Ticket Availability</h2>
          <div className="ticket-types-list">
            {vipType && (
              <div className="ticket-type-card">
                <h3>{vipType.name}</h3>
                <p className="ticket-price">{formatPrice(vipType.price_cents)}</p>
                <p className="ticket-availability">
                  {vipAvailable} / {vipType.capacity} available
                </p>
              </div>
            )}
            {regularType && (
              <div className="ticket-type-card">
                <h3>{regularType.name}</h3>
                <p className="ticket-price">{formatPrice(regularType.price_cents)}</p>
                <p className="ticket-availability">
                  {regularAvailable} / {regularType.capacity} available
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Tickets */}
        {authed ? (
          <div className="card">
            <h2>Purchase Tickets</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="promo-code" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Promo Code (optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="promo-code"
                  type="text"
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApplyPromo()}
                  disabled={applyingPromo}
                >
                  {applyingPromo ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {promoError && (
                <p style={{ color: '#c33', marginTop: '0.5rem', fontSize: '0.9rem' }}>{promoError}</p>
              )}
              {quote && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Ticket Price:</span>
                    <span>{formatPrice(quote.ticket_price_cents)}</span>
                  </div>
                  {quote.discount_cents > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#28a745' }}>
                      <span>Discount:</span>
                      <span>-{formatPrice(quote.discount_cents)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', paddingTop: '0.5rem', borderTop: '1px solid #ddd' }}>
                    <span>Total:</span>
                    <span>{formatPrice(quote.total_cents)}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {vipType && (
                <button
                  className="btn btn-primary"
                  onClick={() => handlePurchase('VIP')}
                  disabled={purchasing}
                >
                  {purchasing === 'VIP' ? 'Processing...' : `Purchase VIP Ticket`}
                </button>
              )}
              {regularType && (
                <button
                  className="btn btn-primary"
                  onClick={() => handlePurchase('Regular')}
                  disabled={purchasing}
                >
                  {purchasing === 'Regular' ? 'Processing...' : `Purchase Regular Ticket`}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>Purchase Tickets</h2>
            <p style={{ color: '#666' }}>
              <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`}>Login</Link> or <Link to="/register">Register</Link> to purchase tickets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

