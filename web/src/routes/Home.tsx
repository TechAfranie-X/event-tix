import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AvailabilityCard from '../components/AvailabilityCard';
import TicketButtons from '../components/TicketButtons';
import Toast from '../components/Toast';
import { getJson } from '../lib/api';
import { isAuthenticated } from '../lib/auth';

interface Availability {
  vip_left: number;
  regular_left: number;
}

interface QueueStatus {
  status: string;
  position: number | null;
}

export default function Home() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [queueInfo, setQueueInfo] = useState<{
    requestId: string;
    ticketType: string;
    position: number;
    status?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

      // Fetch availability on mount and every 4s
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const data = await getJson<Availability>('/api/availability?event_id=1');
        setAvailability(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch availability';
        console.error('Failed to fetch availability:', err);
        setToast({ message: errorMessage, type: 'error' });
      }
    };

    fetchAvailability();
    const interval = setInterval(fetchAvailability, 4000);

    return () => clearInterval(interval);
  }, []);

  // Poll queue position every 3s if queued
  useEffect(() => {
    if (!queueInfo) return;

    let isMounted = true;
    const requestId = queueInfo.requestId;

    const pollQueue = async () => {
      if (!isMounted) return;
      
      try {
        const status = await getJson<QueueStatus>(
          `/api/queue/position?request_id=${requestId}`
        );

        if (!isMounted) return;

        if (status.status === 'done') {
          setQueueInfo(null);
          setToast({ 
            message: 'Your ticket request has been processed! Check your Orders page.', 
            type: 'success' 
          });
          // Refresh availability
          const data = await getJson<Availability>('/api/availability?event_id=1');
          setAvailability(data);
        } else if (status.status === 'processing') {
          // Update status to processing
          setQueueInfo((prev) => {
            if (!prev || prev.requestId !== requestId) return prev;
            return { ...prev, status: 'processing' };
          });
        } else if (status.status === 'queued' && status.position !== null) {
          // Update position if queued
          setQueueInfo((prev) => {
            if (!prev || prev.requestId !== requestId) return prev;
            return { ...prev, position: status.position!, status: 'queued' };
          });
        }
        } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to poll queue';
        console.error('Failed to poll queue:', err);
        // Don't show toast for every poll error, just log it
      }
    };

    pollQueue();
    const interval = setInterval(pollQueue, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [queueInfo]);

  const handleRequestCreated = (requestId: string, ticketType: string, position: number) => {
    setQueueInfo({ requestId, ticketType, position });
    setToast({ message: `You're queued as ${ticketType} #${position}`, type: 'success' });
  };

  return (
    <div className="container">
      <h1>Event Ticketing</h1>
      
      {availability && (
        <AvailabilityCard vipLeft={availability.vip_left} regularLeft={availability.regular_left} />
      )}

      {queueInfo && (
        <div className="card queue-info">
          <p>You're queued as <strong>{queueInfo.ticketType} #{queueInfo.position}</strong></p>
          <p className="queue-status">
            Status: {queueInfo.status === 'processing' ? 'Processing...' : 'Queued'} (checking every 3s)
          </p>
        </div>
      )}

      {isAuthenticated() ? (
        <TicketButtons 
          onRequestCreated={handleRequestCreated}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      ) : (
        <div className="card login-callout">
          <h3>Please log in to request tickets</h3>
          <p>You need to <Link to="/login">login</Link> or <Link to="/register">register</Link> to request tickets.</p>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

