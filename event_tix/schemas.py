from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from event_tix.models import TicketTypeEnum


# Auth schemas
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Event schemas
class EventListItem(BaseModel):
    id: int
    name: str
    image_url: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class TicketTypeInfo(BaseModel):
    id: int
    name: str  # ticket_type enum value as string
    capacity: int
    sold_count: int
    price_cents: int

    class Config:
        from_attributes = True


class EventDetail(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    ticket_types: list[TicketTypeInfo] = []

    class Config:
        from_attributes = True


# Promo code schemas
class PromoCodeResponse(BaseModel):
    id: int
    code: str
    type: str
    value_cents: Optional[int] = None
    percent: Optional[int] = None
    max_uses: Optional[int] = None
    used_count: int
    expires_at: Optional[datetime] = None
    applies_to: Optional[str] = None

    class Config:
        from_attributes = True


# Quote and checkout schemas
class QuoteRequest(BaseModel):
    event_id: int
    ticket_type_name: str
    promo_code: Optional[str] = None


class PromoApplied(BaseModel):
    code: str
    type: str
    amount: int  # discount amount in cents


class QuoteResponse(BaseModel):
    ok: bool
    ticket_price_cents: int
    discount_cents: int
    total_cents: int
    promo_applied: Optional[PromoApplied] = None


class CheckoutRequest(BaseModel):
    event_id: int
    ticket_type_name: str
    promo_code: Optional[str] = None


class CheckoutResponse(BaseModel):
    ok: bool
    order_id: int
    message: str


class EmailReceiptRequest(BaseModel):
    order_id: int


# Availability schemas
class AvailabilityResponse(BaseModel):
    vip_left: int
    regular_left: int


# Ticket request schemas
class TicketRequest(BaseModel):
    ticket_type: TicketTypeEnum
    event_id: int = 1  # Default to event_id=1
    
    class Config:
        json_schema_extra = {
            "example": {
                "ticket_type": "VIP",
                "event_id": 1
            }
        }


class TicketRequestResponse(BaseModel):
    request_id: str
    position: int
    ticket_type: TicketTypeEnum


# Queue position schemas
class QueuePositionResponse(BaseModel):
    status: str  # "queued" | "processing" | "done" | "unknown"
    position: Optional[int] = None


# Order schemas
class OrderResponse(BaseModel):
    id: int
    event_id: int
    status: str
    ticket_type: TicketTypeEnum
    qr_token: Optional[str] = None
    ticket_price_cents: Optional[int] = None
    discount_cents: int
    total_cents: Optional[int] = None
    promo_code: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Ticket verification schemas
class TicketVerifyResponse(BaseModel):
    valid: bool
    status: Optional[str] = None
    order_id: Optional[int] = None
    event_id: Optional[int] = None
    ticket_type: Optional[str] = None


class TicketCheckinResponse(BaseModel):
    ok: bool
    previous_status: Optional[str] = None
    new_status: Optional[str] = None


# Admin schemas
class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class AdminToken(BaseModel):
    access_token: str
    token_type: str
    role: str


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[str] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[str] = None


class TicketTypeCreate(BaseModel):
    ticket_type: TicketTypeEnum
    capacity: int
    price_cents: int
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    max_per_user: Optional[int] = None


class TicketTypeUpdate(BaseModel):
    capacity: Optional[int] = None
    price_cents: Optional[int] = None
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    max_per_user: Optional[int] = None


class PromoCodeCreate(BaseModel):
    code: str
    type: str  # 'percent' or 'amount'
    value_cents: Optional[int] = None
    percent: Optional[int] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    applies_to: Optional[str] = None  # CSV of ticket_type names


class PromoCodeUpdate(BaseModel):
    code: Optional[str] = None
    type: Optional[str] = None
    value_cents: Optional[int] = None
    percent: Optional[int] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    applies_to: Optional[str] = None


# Reports schemas
class TicketTypeStats(BaseModel):
    sold: int
    capacity: int
    remaining: int
    revenue_cents: int


class EventReport(BaseModel):
    event_id: int
    event_name: str
    vip: TicketTypeStats
    regular: TicketTypeStats
    totals: TicketTypeStats