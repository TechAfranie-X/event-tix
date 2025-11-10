from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from event_tix.models import Base

class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = {"extend_existing": True}
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)  # case-insensitive compare in code
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    ticket_type = Column(String(32), nullable=True)  # e.g., 'VIP' or 'Regular'

    percent_off = Column(Integer, nullable=True)     # 0..100 (exclusive of amount_off_cents)
    amount_off_cents = Column(Integer, nullable=True)

    max_total_uses = Column(Integer, nullable=True)  # null = unlimited
    max_uses_per_user = Column(Integer, nullable=True)  # default 1 at validation time if null
    min_order_cents = Column(Integer, nullable=True)

    starts_at = Column(DateTime, nullable=True)  # stored UTC
    ends_at = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)
    used_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class PromoRedemption(Base):
    __tablename__ = "promo_redemptions"
    __table_args__ = {"extend_existing": True}
    
    id = Column(Integer, primary_key=True, index=True)
    promo_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow)

