import { useState } from 'react';
import { postJson } from '../lib/api';
import { isAuthenticated } from '../lib/auth';
import Toast from './Toast';

interface TicketButtonsProps {
  onRequestCreated: (requestId: string, ticketType: string, position: number) => void;
  onError?: (message: string) => void;
  eventId?: number;
}

export default function TicketButtons({ onRequestCreated, onError, eventId = 1 }: TicketButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (ticketType: 'VIP' | 'Regular') => {
    if (!isAuthenticated()) {
      const msg = 'Please login to request tickets';
      setError(msg);
      if (onError) onError(msg);
      return;
    }

    setLoading(ticketType);
    setError(null);

    try {
      const response = await postJson<{
        request_id: string;
        position: number;
        ticket_type: string;
      }>('/api/ticket-requests', {
        ticket_type: ticketType,
        event_id: eventId,
      });

      onRequestCreated(response.request_id, response.ticket_type, response.position);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create ticket request';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="ticket-buttons">
      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}
      <button
        className="btn btn-primary"
        onClick={() => handleRequest('VIP')}
        disabled={loading !== null}
      >
        {loading === 'VIP' ? 'Requesting...' : 'Request VIP Ticket'}
      </button>
      <button
        className="btn btn-primary"
        onClick={() => handleRequest('Regular')}
        disabled={loading !== null}
      >
        {loading === 'Regular' ? 'Requesting...' : 'Request Regular Ticket'}
      </button>
    </div>
  );
}

