import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';
import { formatDateTime } from '../lib/dates';

interface ExternalEvent {
  source: 'ticketmaster' | 'seatgeek' | 'local';
  external_id: string | null;
  id?: number; // Internal ID for local events
  name: string;
  image_url: string | null;
  location: string;
  starts_at: string | null;
  url: string | null;
  category: string;
}

// Category-based Unsplash placeholders
const CATEGORY_IMAGES: Record<string, string> = {
  Technology: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&q=80&auto=format&fit=crop",
  Music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80&auto=format&fit=crop",
  Business: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80&auto=format&fit=crop",
  General: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80&auto=format&fit=crop"
};

function getCategoryImage(category: string | null): string {
  if (!category) return CATEGORY_IMAGES.General;
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.General;
}

function getEventImage(event: ExternalEvent): string {
  if (event.image_url) return event.image_url;
  return getCategoryImage(event.category);
}


export default function Landing() {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCity, setSearchCity] = useState('');

  const fetchEvents = async (keyword?: string, city?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('size', '24');
      if (keyword) params.append('q', keyword);
      if (city) params.append('city', city);
      
      const data = await getJson<ExternalEvent[]>(`/api/external/events?${params.toString()}`);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents(searchKeyword || undefined, searchCity || undefined);
  };


  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="container">
          <h1 className="hero-title">Discover Amazing Events</h1>
          <p className="hero-subtitle">Find concerts, conferences, and experiences happening near you</p>
          
          <form onSubmit={handleSearch} className="hero-search">
            <input
              type="text"
              placeholder="Search keyword..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="hero-search-input"
            />
            <input
              type="text"
              placeholder="City..."
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="hero-search-input"
            />
            <button type="submit" className="btn btn-primary hero-search-btn">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Events Grid */}
      <section className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <h2 className="section-title">Happening near you</h2>
        
        {error && (
          <div className="card" style={{ background: '#fee', color: '#c33', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="card">
            <p>Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="card">
            <p>No events found. Try adjusting your search.</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event, index) => {
              const eventImage = getEventImage(event);
              const isLocal = event.source === 'local';
              
              return (
                <div
                  key={event.external_id || event.id || `event-${index}`}
                  className="event-card"
                >
                  {isLocal && event.id ? (
                    <Link to={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="event-card-image">
                        <img src={eventImage} alt={event.name} />
                      </div>
                      <div className="event-card-content">
                        <span className="event-category-badge">{event.category}</span>
                        <h3 className="event-card-title">{event.name}</h3>
                        <p className="event-card-location">📍 {event.location}</p>
                        <p className="event-card-date">📅 {formatDateTime(event.starts_at)}</p>
                        <span className="event-card-link">View Details →</span>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <div className="event-card-image">
                        <img src={eventImage} alt={event.name} />
                      </div>
                      <div className="event-card-content">
                        <span className="event-category-badge">{event.category}</span>
                        <h3 className="event-card-title">{event.name}</h3>
                        <p className="event-card-location">📍 {event.location}</p>
                        <p className="event-card-date">📅 {formatDateTime(event.starts_at)}</p>
                        {(event.source === 'ticketmaster' || event.source === 'seatgeek') && event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-card-link"
                          >
                            {event.source === 'ticketmaster' ? 'View on Ticketmaster →' : 'View on SeatGeek →'}
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

