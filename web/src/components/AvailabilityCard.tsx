interface AvailabilityCardProps {
  vipLeft: number;
  regularLeft: number;
}

export default function AvailabilityCard({ vipLeft, regularLeft }: AvailabilityCardProps) {
  return (
    <div className="card availability-card">
      <h2>Ticket Availability</h2>
      <div className="availability-grid">
        <div className="availability-item">
          <span className="availability-label">VIP</span>
          <span className="availability-count">{vipLeft} left</span>
        </div>
        <div className="availability-item">
          <span className="availability-label">Regular</span>
          <span className="availability-count">{regularLeft} left</span>
        </div>
      </div>
    </div>
  );
}

