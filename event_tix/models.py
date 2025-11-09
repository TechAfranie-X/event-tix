from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class TicketTypeEnum(str, enum.Enum):
    VIP = "VIP"
    REGULAR = "Regular"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    location = Column(String, nullable=True)
    starts_at = Column(DateTime, nullable=True, index=True)
    ends_at = Column(DateTime, nullable=True)
    category = Column(String, nullable=True, default="General", index=True)
    tags = Column(String, nullable=True)  # CSV string
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket_types = relationship("TicketType", back_populates="event", cascade="all, delete-orphan")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    ticket_type = Column(SQLEnum(TicketTypeEnum), nullable=False)
    capacity = Column(Integer, nullable=False)
    sold_count = Column(Integer, default=0, nullable=False)
    price_cents = Column(Integer, default=0, nullable=False)
    sale_start = Column(DateTime, nullable=True)
    sale_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="ticket_types")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    code = Column(String, unique=True, nullable=False, index=True)
    type = Column(String, nullable=False)  # 'percent' or 'amount'
    value_cents = Column(Integer, nullable=True)  # For 'amount' type
    percent = Column(Integer, nullable=True)  # For 'percent' type (0-100)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    applies_to = Column(String, nullable=True)  # CSV of ticket_type names
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    ticket_type = Column(SQLEnum(TicketTypeEnum), nullable=False)
    request_id = Column(String, unique=True, index=True, nullable=True)
    status = Column(String, nullable=False)  # 'queued', 'processing', 'confirmed', 'failed'
    reason = Column(String, nullable=True)
    ticket_price_cents = Column(Integer, nullable=True)  # Original ticket price
    discount_cents = Column(Integer, default=0, nullable=False)  # Discount amount
    total_cents = Column(Integer, nullable=True)  # Final total
    promo_code = Column(String, nullable=True)  # Promo code used
    payment_status = Column(String, nullable=True)  # 'demo_paid', etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    event = relationship("Event")
    ticket = relationship("Ticket", back_populates="order", uselist=False, cascade="all, delete-orphan")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=True)
    qr_token = Column(String, unique=True, index=True, nullable=True)
    checked_in = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="ticket")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key = Column(String, nullable=False, index=True)
    response_hash = Column(String, nullable=True)  # Hash of response for verification
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
