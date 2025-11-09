import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';
import Toast from '../components/Toast';

interface Event {
  id: number;
  name: string;
  image_url: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  category: string | null;
}

// Category-based Unsplash placeholders
const CATEGORY_IMAGES: Record<string, string> = {
  Technology: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&q=80&auto=format&fit=crop",
  Music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80&auto=format&fit=crop",
  Business: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80&auto=format&fit=crop",
  General: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80&auto=format&fit=crop"
};

function getEventImage(event: Event): string {
  if (event.image_url) return event.image_url;
  const category = event.category || 'General';
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.General;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [city, setCity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch all events to get categories and initial events
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const data = await getJson<Event[]>('/api/events');
        const uniqueCategories = Array.from(
          new Set(data.map(e => e.category).filter(Boolean))
        ) as string[];
        setCategories(uniqueCategories);
        setEvents(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  // Debounced search effect (only when filters change, not on initial load)
  useEffect(() => {
    // Skip initial mount - handled by fetchInitial
    const isInitialMount = events.length === 0 && !searchQuery && !city && !fromDate && !toDate && !category;
    if (isInitialMount) return;

    const timeoutId = setTimeout(() => {
      const fetchEvents = async () => {
        setLoading(true);
        try {
          const hasFilters = searchQuery || city || fromDate || toDate || category;
          let data: Event[];
          
          if (hasFilters) {
            // Build search query params
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (city) params.append('city', city);
            if (fromDate) params.append('from', fromDate);
            if (toDate) params.append('to', toDate);
            if (category) params.append('category', category);
            
            data = await getJson<Event[]>(`/api/events/search?${params.toString()}`);
          } else {
            data = await getJson<Event[]>('/api/events');
          }
          
          setEvents(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch events');
        } finally {
          setLoading(false);
        }
      };

      fetchEvents();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, city, fromDate, toDate, category]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCity('');
    setFromDate('');
    setToDate('');
    setCategory('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const hasActiveFilters = searchQuery || city || fromDate || toDate || category;

  return (
    <div className="container">
      <h1>Events</h1>
      
      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {/* Search and Filters */}
      <div className="card filters-card">
        <h2>Search & Filters</h2>
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="search">Search</label>
            <input
              type="text"
              id="search"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label htmlFor="city">City</label>
            <input
              type="text"
              id="city"
              placeholder="Filter by city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="fromDate">From Date</label>
            <input
              type="date"
              id="fromDate"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label htmlFor="toDate">To Date</label>
            <input
              type="date"
              id="toDate"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        
        {hasActiveFilters && (
          <button className="btn btn-secondary" onClick={handleClearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="card">
          <p>Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card empty-state">
          <h3>No events found</h3>
          <p>
            {hasActiveFilters 
              ? 'Try adjusting your search or filters.' 
              : 'Check back later for upcoming events.'}
          </p>
          {hasActiveFilters && (
            <button className="btn btn-primary" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {hasActiveFilters && (
            <p className="results-count">Found {events.length} event{events.length !== 1 ? 's' : ''}</p>
          )}
          <div className="events-grid">
            {events.map((event) => (
                <Link key={event.id} to={`/events/${event.id}`} className="event-card">
                  <div className="event-card-image">
                    <img src={getEventImage(event)} alt={event.name} />
                  </div>
                <div className="event-card-content">
                  <h3>{event.name}</h3>
                  {event.category && (
                    <span className="event-category">{event.category}</span>
                  )}
                  <div className="event-card-details">
                    {event.location && (
                      <p className="event-location">📍 {event.location}</p>
                    )}
                    <p className="event-date">{formatDate(event.starts_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
