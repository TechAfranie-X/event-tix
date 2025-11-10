from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, asc
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import traceback
from datetime import datetime
from typing import Optional

from event_tix.db import get_db, init_db, atomic_release_ticket_type
from event_tix.models import User, Event, TicketType, Order, Ticket, TicketTypeEnum, PromoCode, IdempotencyKey
from event_tix.schemas import (
    UserRegister, UserCreate, UserResponse, UserLogin, Token,
    AvailabilityResponse, TicketRequest, TicketRequestResponse,
    QueuePositionResponse, OrderResponse, TicketVerifyResponse, TicketCheckinResponse,
    EventListItem, EventDetail, TicketTypeInfo,
    PromoCodeResponse, QuoteRequest, QuoteResponse, PromoApplied,
    CheckoutRequest, CheckoutResponse, EmailReceiptRequest,
    AdminLogin, AdminToken, EventCreate, EventUpdate,
    TicketTypeCreate, TicketTypeUpdate, PromoCodeCreate, PromoCodeUpdate,
    EventReport, TicketTypeStats
)
from event_tix.auth import (
    get_password_hash, authenticate_user, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_admin, get_current_admin
)
from event_tix.services.queue import enqueue, get_position, get_status
from event_tix.services.rate_limit import check_rate_limit
from event_tix.services.rate_limit_checkout import check_checkout_rate_limit
from event_tix.services.rate_limit_search import check_search_rate_limit
import hashlib
import json
from event_tix.services.logging import log_email, log_transaction
from event_tix.services.processing import process_one_manual
from event_tix.services.promos import validate_promo, redeem_promo
from event_tix.routes.organizer import router as organizer_router
from event_tix.routes.external import router as external_router
from event_tix.routes.promos import router as promos_router
from event_tix.util.dates import ensure_utc
from datetime import timedelta
import asyncio

load_dotenv()

# CORS origins from env
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    import asyncio
    from event_tix.services.processing import processing_loop, set_processing_enabled
    processing_task = asyncio.create_task(processing_loop())
    yield
    # Shutdown
    set_processing_enabled(False)
    processing_task.cancel()
    try:
        await processing_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Event Ticketing API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(organizer_router)
app.include_router(external_router)
app.include_router(promos_router)


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # Log the full traceback for debugging
    print(f"Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# Auth routes
@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Clamp role to valid values
    role = user_data.role if user_data.role in ("user", "organizer", "admin") else "user"
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hashed_password,
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@app.post("/api/auth/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(id=user.id, name=user.name, email=user.email, role=user.role)
    }


# Availability route
@app.get("/api/availability", response_model=AvailabilityResponse)
def get_availability(event_id: int = 1, db: Session = Depends(get_db)):
    vip_type = db.query(TicketType).filter(
        TicketType.event_id == event_id,
        TicketType.ticket_type == TicketTypeEnum.VIP
    ).first()
    
    regular_type = db.query(TicketType).filter(
        TicketType.event_id == event_id,
        TicketType.ticket_type == TicketTypeEnum.REGULAR
    ).first()
    
    vip_left = (vip_type.capacity - vip_type.sold_count) if vip_type else 0
    regular_left = (regular_type.capacity - regular_type.sold_count) if regular_type else 0
    
    return AvailabilityResponse(vip_left=vip_left, regular_left=regular_left)


# Ticket request route
@app.post("/api/ticket-requests", response_model=TicketRequestResponse, status_code=status.HTTP_201_CREATED)
def create_ticket_request(
    request: TicketRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Rate limiting: 1 request per 2 seconds per user
    is_allowed, rate_limit_message = check_rate_limit(current_user.id)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_limit_message
        )
    
    # Validate event_id is positive
    if request.event_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="event_id must be a positive integer"
        )
    
    # Verify event exists
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Verify ticket type exists for this event
    ticket_type = db.query(TicketType).filter(
        TicketType.event_id == request.event_id,
        TicketType.ticket_type == request.ticket_type
    ).first()
    
    if not ticket_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket type not found for this event"
        )
    
    # Enqueue request
    request_id, position = enqueue(
        user_id=current_user.id,
        event_id=request.event_id,
        ticket_type=request.ticket_type
    )
    
    # Create order with 'queued' status
    order = Order(
        user_id=current_user.id,
        event_id=request.event_id,
        ticket_type=request.ticket_type,
        request_id=request_id,
        status='queued'
    )
    db.add(order)
    db.commit()
    
    return TicketRequestResponse(
        request_id=request_id,
        position=position,
        ticket_type=request.ticket_type
    )


# Queue position route
@app.get("/api/queue/position", response_model=QueuePositionResponse)
def get_queue_position(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if order exists and belongs to user
    order = db.query(Order).filter(
        Order.request_id == request_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        return QueuePositionResponse(status="unknown", position=None)
    
    # Get status from queue tracker
    queue_status = get_status(request_id)
    
    if queue_status == 'queued':
        # Check queue position
        position_info = get_position(request_id)
        if position_info:
            position, _ = position_info
            return QueuePositionResponse(status="queued", position=position)
        else:
            # Fallback to order status
            return QueuePositionResponse(status="processing", position=None)
    elif queue_status == 'processing':
        return QueuePositionResponse(status="processing", position=None)
    elif queue_status == 'done':
        return QueuePositionResponse(status="done", position=None)
    else:
        # Fallback to order status
        if order.status == 'confirmed':
            return QueuePositionResponse(status="done", position=None)
        elif order.status == 'processing':
            return QueuePositionResponse(status="processing", position=None)
        elif order.status == 'failed':
            return QueuePositionResponse(status="done", position=None)
    
    return QueuePositionResponse(status="unknown", position=None)


# Orders route
@app.get("/api/orders", response_model=list[OrderResponse])
def get_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    
    result = []
    for order in orders:
        ticket = db.query(Ticket).filter(Ticket.order_id == order.id).first()
        result.append(OrderResponse(
            id=order.id,
            event_id=order.event_id,
            status=order.status,
            ticket_type=order.ticket_type,
            qr_token=ticket.qr_token if ticket else None,
            ticket_price_cents=order.ticket_price_cents,
            discount_cents=order.discount_cents,
            total_cents=order.total_cents,
            promo_code=order.promo_code,
            created_at=order.created_at
        ))
    
    return result


# Ticket verification route
@app.get("/api/tickets/verify/{qr_token}", response_model=TicketVerifyResponse)
def verify_ticket(qr_token: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.qr_token == qr_token).first()
    
    if not ticket:
        return TicketVerifyResponse(valid=False, status=None, order_id=None, event_id=None, ticket_type=None)
    
    order = db.query(Order).filter(Order.id == ticket.order_id).first()
    
    if not order or order.status != 'confirmed':
        return TicketVerifyResponse(
            valid=False, 
            status=order.status if order else None, 
            order_id=None,
            event_id=None,
            ticket_type=None
        )
    
    # Ticket is valid if order is confirmed
    ticket_status = 'checked_in' if ticket.checked_in else 'issued'
    
    return TicketVerifyResponse(
        valid=True,
        status=ticket_status,
        order_id=order.id,
        event_id=order.event_id,
        ticket_type=order.ticket_type.value
    )


# Ticket checkin route
@app.post("/api/tickets/checkin/{qr_token}", response_model=TicketCheckinResponse)
def checkin_ticket(qr_token: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.qr_token == qr_token).first()
    
    if not ticket:
        return TicketCheckinResponse(
            ok=False,
            previous_status=None,
            new_status=None
        )
    
    order = db.query(Order).filter(Order.id == ticket.order_id).first()
    
    # Check if ticket is valid (order confirmed = "issued" status)
    if not order or order.status != 'confirmed':
        return TicketCheckinResponse(
            ok=False,
            previous_status=None,
            new_status=None
        )
    
    # Check if already checked in
    if ticket.checked_in:
        return TicketCheckinResponse(
            ok=False,
            previous_status="checked_in",
            new_status="checked_in"
        )
    
    # Check in the ticket
    previous_status = "issued"
    ticket.checked_in = True
    db.commit()
    
    return TicketCheckinResponse(
        ok=True,
        previous_status=previous_status,
        new_status="checked_in"
    )


@app.get("/")
def root():
    return {"message": "Event Ticketing API", "docs": "/docs"}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint with DB connection verification"""
    try:
        # Try to get version if available
        try:
            from event_tix import __version__
            version = __version__
        except ImportError:
            version = "unknown"
        
        # Check DB connection with lightweight query
        db_status = "ok"
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            db_status = "error"
        
        return {
            "ok": True,
            "version": version,
            "db": db_status
        }
    except Exception as e:
        return {
            "ok": False,
            "version": "unknown",
            "db": "error",
            "error": str(e)
        }


# Events routes
@app.get("/api/events", response_model=list[EventListItem])
def get_events(db: Session = Depends(get_db)):
    """Get list of all published events"""
    events = db.query(Event).filter(Event.is_published == 1).order_by(Event.starts_at.asc()).all()
    return events


@app.get("/api/events/search", response_model=list[EventListItem])
def search_events(
    q: Optional[str] = Query(None, description="Search query (searches name, description, location)"),
    city: Optional[str] = Query(None, description="Filter by city (matches location)"),
    from_date: Optional[str] = Query(None, alias="from", description="Start date (ISO format)"),
    to_date: Optional[str] = Query(None, alias="to", description="End date (ISO format)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    http_request: Request = None,
    db: Session = Depends(get_db)
):
    """Search and filter events"""
    # Rate limiting for unauthenticated users
    client_ip = http_request.client.host if http_request and http_request.client else "unknown"
    is_allowed, rate_limit_message = check_search_rate_limit(client_ip)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_limit_message
        )
    
    query = db.query(Event).filter(Event.is_published == 1)
    
    # Text search across name, description, and location (case-insensitive)
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Event.name.ilike(search_term),
                Event.description.ilike(search_term),
                Event.location.ilike(search_term)
            )
        )
    
    # City filter (matches location, case-insensitive)
    if city:
        city_term = f"%{city}%"
        query = query.filter(Event.location.ilike(city_term))
    
    # Date range filter
    if from_date:
        try:
            # Handle both YYYY-MM-DD and ISO datetime formats
            if 'T' in from_date:
                from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            else:
                from_dt = datetime.fromisoformat(f"{from_date}T00:00:00")
            query = query.filter(Event.starts_at >= from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid 'from' date format. Use YYYY-MM-DD or ISO format"
            )
    
    if to_date:
        try:
            # Handle both YYYY-MM-DD and ISO datetime formats
            if 'T' in to_date:
                to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            else:
                # Set to end of day for date-only inputs
                to_dt = datetime.fromisoformat(f"{to_date}T23:59:59")
            query = query.filter(Event.starts_at <= to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid 'to' date format. Use YYYY-MM-DD or ISO format"
            )
    
    # Category filter (case-insensitive)
    if category:
        query = query.filter(Event.category.ilike(category))
    
    events = query.order_by(Event.starts_at.asc()).all()
    return events


@app.get("/api/events/{event_id}", response_model=EventDetail)
def get_event_detail(event_id: int, db: Session = Depends(get_db)):
    """Get event details with ticket types (only published events)"""
    event = db.query(Event).filter(Event.id == event_id, Event.is_published == 1).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    ticket_types = db.query(TicketType).filter(TicketType.event_id == event_id).all()
    
    # Ensure UTC datetimes for response
    starts_at_utc = ensure_utc(event.starts_at) if event.starts_at else None
    ends_at_utc = ensure_utc(event.ends_at) if event.ends_at else None
    return EventDetail(
        id=event.id,
        name=event.name,
        description=event.description,
        image_url=event.image_url,
        location=event.location,
        starts_at=starts_at_utc,
        ends_at=ends_at_utc,
        category=event.category,
        tags=event.tags,
        organizer_id=event.organizer_id,
        is_published=bool(event.is_published) if event.is_published is not None else True,
        ticket_types=[
            TicketTypeInfo(
                id=tt.id,
                name=tt.ticket_type.value,  # Convert enum to string
                capacity=tt.capacity,
                sold_count=tt.sold_count,
                price_cents=tt.price_cents
            )
            for tt in ticket_types
        ]
    )




# Helper functions for pricing and promo codes
def validate_promo_code(
    promo_code: Optional[str],
    event_id: int,
    ticket_type_name: str,
    db: Session
) -> tuple[Optional[PromoCode], Optional[str]]:
    """
    Validate a promo code and return the promo code object or error message
    Returns: (promo_code_obj, error_message)
    """
    if not promo_code:
        return None, None
    
    promo = db.query(PromoCode).filter(
        PromoCode.code == promo_code.upper(),
        PromoCode.event_id == event_id
    ).first()
    
    if not promo:
        return None, "Promo code not found"
    
    # Check expiration
    if promo.expires_at and promo.expires_at < datetime.utcnow():
        return None, "Promo code has expired"
    
    # Check max uses
    if promo.max_uses is not None and promo.used_count >= promo.max_uses:
        return None, "Promo code has reached maximum uses"
    
    # Check if applies to this ticket type
    if promo.applies_to:
        allowed_types = [t.strip() for t in promo.applies_to.split(',')]
        if ticket_type_name not in allowed_types:
            return None, f"Promo code does not apply to {ticket_type_name} tickets"
    
    return promo, None


def calculate_discount(promo: PromoCode, ticket_price_cents: int) -> int:
    """Calculate discount amount in cents"""
    if promo.type == 'percent':
        if promo.percent is None:
            return 0
        discount = int(ticket_price_cents * promo.percent / 100)
        return min(discount, ticket_price_cents)  # Don't exceed ticket price
    elif promo.type == 'amount':
        if promo.value_cents is None:
            return 0
        return min(promo.value_cents, ticket_price_cents)  # Don't exceed ticket price
    return 0


def check_user_limit(user_id: int, event_id: int, db: Session, max_per_user: int = 2) -> tuple[bool, int]:
    """
    Check if user has reached the per-event ticket limit
    Returns: (within_limit, current_count)
    """
    confirmed_count = db.query(Order).filter(
        Order.user_id == user_id,
        Order.event_id == event_id,
        Order.status == 'confirmed'
    ).count()
    
    return confirmed_count < max_per_user, confirmed_count


def validate_sale_window(ticket_type: TicketType) -> tuple[bool, Optional[str]]:
    """
    Check if ticket type is within sale window
    Returns: (is_valid, error_message)
    """
    now = datetime.utcnow()
    
    if ticket_type.sale_start and now < ticket_type.sale_start:
        return False, "Ticket sales have not started yet"
    
    if ticket_type.sale_end and now > ticket_type.sale_end:
        return False, "Ticket sales have ended"
    
    return True, None


@app.post("/api/quote", response_model=QuoteResponse)
def get_quote(
    request: QuoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a price quote for a ticket with optional promo code
    Validates sale window, capacity, user limit, and promo code
    """
    # Get ticket type
    try:
        ticket_type_enum = TicketTypeEnum[request.ticket_type_name.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ticket type: {request.ticket_type_name}"
        )
    
    ticket_type = db.query(TicketType).filter(
        TicketType.event_id == request.event_id,
        TicketType.ticket_type == ticket_type_enum
    ).first()
    
    if not ticket_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket type not found for this event"
        )
    
    # Validate sale window
    is_valid, error_msg = validate_sale_window(ticket_type)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Check capacity
    if ticket_type.sold_count >= ticket_type.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tickets are sold out"
        )
    
    # Check user limit (default max_per_user = 2)
    within_limit, current_count = check_user_limit(
        current_user.id, request.event_id, db, max_per_user=2
    )
    if not within_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum ticket limit ({current_count} tickets) for this event"
        )
    
    # Get base price
    ticket_price_cents = ticket_type.price_cents
    
    # Validate and apply promo code
    promo, promo_error = validate_promo_code(
        request.promo_code, request.event_id, request.ticket_type_name, db
    )
    
    if request.promo_code and promo_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=promo_error
        )
    
    # Calculate discount
    discount_cents = 0
    promo_applied = None
    
    if promo:
        discount_cents = calculate_discount(promo, ticket_price_cents)
        promo_applied = PromoApplied(
            code=promo.code,
            type=promo.type,
            amount=discount_cents
        )
    
    total_cents = ticket_price_cents - discount_cents
    
    return QuoteResponse(
        ok=True,
        ticket_price_cents=ticket_price_cents,
        discount_cents=discount_cents,
        total_cents=total_cents,
        promo_applied=promo_applied
    )


@app.post("/api/checkout", response_model=CheckoutResponse)
def checkout(
    request: CheckoutRequest,
    http_request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Demo checkout - creates order and enqueues for processing
    No real payment gateway, just marks payment_status as 'demo_paid'
    Supports idempotency via Idempotency-Key header
    """
    # Rate limiting: max 5 requests per minute per user
    is_allowed, rate_limit_message = check_checkout_rate_limit(current_user.id)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_limit_message
        )
    
    # Check idempotency key
    idempotency_key = None
    if http_request:
        idempotency_key = http_request.headers.get("Idempotency-Key") or http_request.headers.get("idempotency-key")
    
    if idempotency_key:
        # Check if we've seen this key before
        existing_key = db.query(IdempotencyKey).filter(
            IdempotencyKey.user_id == current_user.id,
            IdempotencyKey.key == idempotency_key
        ).first()
        
        if existing_key and existing_key.response_hash:
            # Return cached response
            # Parse the response hash to reconstruct the response
            # For simplicity, we'll query the order if it exists
            # In a real system, you'd store the full response
            try:
                response_data = json.loads(existing_key.response_hash)
                return CheckoutResponse(**response_data)
            except:
                # If we can't parse, continue with normal flow
                pass
    # Re-validate using quote logic
    try:
        ticket_type_enum = TicketTypeEnum[request.ticket_type_name.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ticket type: {request.ticket_type_name}"
        )
    
    ticket_type = db.query(TicketType).filter(
        TicketType.event_id == request.event_id,
        TicketType.ticket_type == ticket_type_enum
    ).first()
    
    if not ticket_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket type not found for this event"
        )
    
    # Validate sale window
    is_valid, error_msg = validate_sale_window(ticket_type)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Check capacity
    if ticket_type.sold_count >= ticket_type.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tickets are sold out"
        )
    
    # Check user limit
    within_limit, current_count = check_user_limit(
        current_user.id, request.event_id, db, max_per_user=2
    )
    if not within_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum ticket limit ({current_count} tickets) for this event"
        )
    
    # Calculate pricing
    ticket_price_cents = ticket_type.price_cents
    discount_cents = 0
    
    # Validate and apply promo code if provided
    if request.promo_code:
        ok, msg, discount, new_total = validate_promo(
            db,
            code=request.promo_code,
            user_id=current_user.id,
            event_id=request.event_id,
            ticket_type=request.ticket_type_name,
            qty=1,  # Single ticket per checkout
            unit_price_cents=ticket_price_cents,
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg
            )
        discount_cents = discount
    
    total_cents = ticket_price_cents - discount_cents
    
    # Enqueue request (reuse existing queue system)
    request_id, position = enqueue(
        user_id=current_user.id,
        event_id=request.event_id,
        ticket_type=ticket_type_enum
    )
    
    # Create order with pricing info
    order = Order(
        user_id=current_user.id,
        event_id=request.event_id,
        ticket_type=ticket_type_enum,
        request_id=request_id,
        status='queued',
        ticket_price_cents=ticket_price_cents,
        discount_cents=discount_cents,
        total_cents=total_cents,
        promo_code=request.promo_code if request.promo_code else None,
        payment_status='demo_paid'
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Redeem promo code after order is successfully created
    if request.promo_code:
        redeem_promo(db, promo_code=request.promo_code, user_id=current_user.id, order_id=order.id)
        db.commit()
    
    response = CheckoutResponse(
        ok=True,
        order_id=order.id,
        message="Order placed successfully. Your ticket will be processed shortly."
    )
    
    # Store idempotency key if provided
    if idempotency_key:
        response_hash = json.dumps({
            "ok": response.ok,
            "order_id": response.order_id,
            "message": response.message
        })
        idempotency_record = IdempotencyKey(
            user_id=current_user.id,
            key=idempotency_key,
            response_hash=response_hash
        )
        db.add(idempotency_record)
        db.commit()
    
    return response


@app.get("/api/promos", response_model=list[PromoCodeResponse])
def get_promos(
    event_id: int = Query(..., description="Event ID"),
    db: Session = Depends(get_db)
):
    """
    Get list of promo codes for an event
    Public endpoint (no auth required for now)
    """
    promos = db.query(PromoCode).filter(
        PromoCode.event_id == event_id
    ).all()
    
    return promos


@app.post("/api/email/receipt")
def send_receipt_email(
    request: EmailReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send receipt email (stub - just logs to emails.log)
    Returns 204 No Content on success
    """
    # Verify order belongs to user
    order = db.query(Order).filter(
        Order.id == request.order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Log email (stub - no actual email sent)
    log_email(
        to=current_user.email,
        subject=f"Receipt for Order #{request.order_id}",
        order_id=request.order_id
    )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a confirmed order (refund and free up ticket)
    Triggers processor to attempt next queued request
    """
    # Get order and verify ownership
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check if order can be cancelled
    if order.status != 'confirmed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order with status: {order.status}"
        )
    
    # Check if ticket is already checked in
    ticket = db.query(Ticket).filter(Ticket.order_id == order.id).first()
    if ticket and ticket.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel order: ticket already checked in"
        )
    
    # Get ticket type to decrement sold_count
    from event_tix.models import TicketType
    ticket_type_record = db.query(TicketType).filter(
        TicketType.ticket_type == order.ticket_type,
        TicketType.event_id == order.event_id
    ).first()
    
    if not ticket_type_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket type not found"
        )
    
    # Atomically decrement sold_count
    success = atomic_release_ticket_type(db, ticket_type_record.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to release ticket"
        )
    
    # Update order status
    order.status = 'refunded'
    db.commit()
    
    # Log transaction
    user = db.query(User).filter(User.id == current_user.id).first()
    log_transaction({
        'user_name': user.name if user else 'unknown',
        'user_email': user.email if user else 'unknown',
        'ticket_type': order.ticket_type.value,
        'request_id': order.request_id or f'order_{order.id}',
        'status': 'refunded',
        'reason': 'user_cancelled'
    })
    
    # Trigger processor to attempt next queued request for this event (VIP-first)
    # Schedule a single processing tick to immediately process the freed ticket
    try:
        import asyncio
        # Try to get the running event loop
        try:
            loop = asyncio.get_running_loop()
            # Schedule the task in the running loop
            loop.create_task(process_one_manual())
        except RuntimeError:
            # No running loop, create a new one
            asyncio.run(process_one_manual())
    except Exception as e:
        # Log error but don't fail the cancellation
        from event_tix.services.logging import log_error
        log_error('cancel_order', f"Failed to trigger processor: {e}")
        # Processor will pick it up on next tick anyway
    
    return {"ok": True, "message": "Order cancelled successfully"}


# Admin routes
@app.post("/api/admin/login", response_model=AdminToken)
def admin_login(credentials: AdminLogin):
    """Admin login endpoint"""
    if not authenticate_admin(credentials.email, credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": credentials.email, "role": "admin"},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": "admin"
    }


@app.post("/api/admin/events", response_model=EventDetail, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new event"""
    event = Event(
        name=event_data.name,
        description=event_data.description,
        image_url=event_data.image_url,
        location=event_data.location,
        starts_at=ensure_utc(event_data.starts_at) if event_data.starts_at else None,
        ends_at=ensure_utc(event_data.ends_at) if event_data.ends_at else None,
        category=event_data.category,
        tags=event_data.tags,
        is_published=1 if event_data.is_published else 0
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    return EventDetail(
        id=event.id,
        name=event.name,
        description=event.description,
        image_url=event.image_url,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        category=event.category,
        tags=event.tags,
        organizer_id=event.organizer_id,
        is_published=bool(event.is_published) if event.is_published is not None else True,
        ticket_types=[]
    )


@app.put("/api/admin/events/{event_id}", response_model=EventDetail)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an existing event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Update fields if provided
    if event_data.name is not None:
        event.name = event_data.name
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.image_url is not None:
        event.image_url = event_data.image_url
    if event_data.location is not None:
        event.location = event_data.location
    if event_data.starts_at is not None:
        event.starts_at = ensure_utc(event_data.starts_at)
    if event_data.ends_at is not None:
        event.ends_at = ensure_utc(event_data.ends_at)
    if event_data.category is not None:
        event.category = event_data.category
    if event_data.tags is not None:
        event.tags = event_data.tags
    
    db.commit()
    db.refresh(event)
    
    # Get ticket types
    ticket_types = db.query(TicketType).filter(TicketType.event_id == event_id).all()
    
    return EventDetail(
        id=event.id,
        name=event.name,
        description=event.description,
        image_url=event.image_url,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        category=event.category,
        tags=event.tags,
        organizer_id=event.organizer_id,
        is_published=bool(event.is_published) if event.is_published is not None else True,
        ticket_types=[
            TicketTypeInfo(
                id=tt.id,
                name=tt.ticket_type.value,
                capacity=tt.capacity,
                sold_count=tt.sold_count,
                price_cents=tt.price_cents
            )
            for tt in ticket_types
        ]
    )


@app.post("/api/admin/events/{event_id}/ticket-types", response_model=TicketTypeInfo, status_code=status.HTTP_201_CREATED)
def create_ticket_type(
    event_id: int,
    ticket_type_data: TicketTypeCreate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a ticket type for an event"""
    # Verify event exists
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if ticket type already exists for this event
    existing = db.query(TicketType).filter(
        TicketType.event_id == event_id,
        TicketType.ticket_type == ticket_type_data.ticket_type
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticket type {ticket_type_data.ticket_type.value} already exists for this event"
        )
    
    ticket_type = TicketType(
        event_id=event_id,
        ticket_type=ticket_type_data.ticket_type,
        capacity=ticket_type_data.capacity,
        price_cents=ticket_type_data.price_cents,
        sale_start=ticket_type_data.sale_start,
        sale_end=ticket_type_data.sale_end
    )
    db.add(ticket_type)
    db.commit()
    db.refresh(ticket_type)
    
    return TicketTypeInfo(
        id=ticket_type.id,
        name=ticket_type.ticket_type.value,
        capacity=ticket_type.capacity,
        sold_count=ticket_type.sold_count,
        price_cents=ticket_type.price_cents
    )


@app.put("/api/admin/ticket-types/{ticket_type_id}", response_model=TicketTypeInfo)
def update_ticket_type(
    ticket_type_id: int,
    ticket_type_data: TicketTypeUpdate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update a ticket type"""
    ticket_type = db.query(TicketType).filter(TicketType.id == ticket_type_id).first()
    if not ticket_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket type not found"
        )
    
    # Update fields if provided
    if ticket_type_data.capacity is not None:
        if ticket_type_data.capacity < ticket_type.sold_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Capacity cannot be less than sold count ({ticket_type.sold_count})"
            )
        ticket_type.capacity = ticket_type_data.capacity
    if ticket_type_data.price_cents is not None:
        ticket_type.price_cents = ticket_type_data.price_cents
    if ticket_type_data.sale_start is not None:
        ticket_type.sale_start = ticket_type_data.sale_start
    if ticket_type_data.sale_end is not None:
        ticket_type.sale_end = ticket_type_data.sale_end
    
    db.commit()
    db.refresh(ticket_type)
    
    return TicketTypeInfo(
        id=ticket_type.id,
        name=ticket_type.ticket_type.value,
        capacity=ticket_type.capacity,
        sold_count=ticket_type.sold_count,
        price_cents=ticket_type.price_cents
    )


@app.post("/api/admin/events/{event_id}/promos", response_model=PromoCodeResponse, status_code=status.HTTP_201_CREATED)
def create_promo(
    event_id: int,
    promo_data: PromoCodeCreate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a promo code for an event"""
    # Verify event exists
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if promo code already exists
    existing = db.query(PromoCode).filter(PromoCode.code == promo_data.code.upper()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code already exists"
        )
    
    # Validate type and value
    if promo_data.type == 'percent':
        if promo_data.percent is None or promo_data.percent < 0 or promo_data.percent > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Percent must be between 0 and 100"
            )
    elif promo_data.type == 'amount':
        if promo_data.value_cents is None or promo_data.value_cents < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Value must be a positive integer"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type must be 'percent' or 'amount'"
        )
    
    promo = PromoCode(
        event_id=event_id,
        code=promo_data.code.upper(),
        type=promo_data.type,
        value_cents=promo_data.value_cents,
        percent=promo_data.percent,
        max_uses=promo_data.max_uses,
        expires_at=promo_data.expires_at,
        applies_to=promo_data.applies_to
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    
    return promo


@app.put("/api/admin/promos/{promo_id}", response_model=PromoCodeResponse)
def update_promo(
    promo_id: int,
    promo_data: PromoCodeUpdate,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update a promo code"""
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promo code not found"
        )
    
    # Update fields if provided
    if promo_data.code is not None:
        # Check if new code already exists
        existing = db.query(PromoCode).filter(
            PromoCode.code == promo_data.code.upper(),
            PromoCode.id != promo_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo code already exists"
            )
        promo.code = promo_data.code.upper()
    
    if promo_data.type is not None:
        promo.type = promo_data.type
    
    if promo_data.value_cents is not None:
        promo.value_cents = promo_data.value_cents
    
    if promo_data.percent is not None:
        if promo_data.percent < 0 or promo_data.percent > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Percent must be between 0 and 100"
            )
        promo.percent = promo_data.percent
    
    if promo_data.max_uses is not None:
        if promo_data.max_uses < promo.used_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Max uses cannot be less than used count ({promo.used_count})"
            )
        promo.max_uses = promo_data.max_uses
    
    if promo_data.expires_at is not None:
        promo.expires_at = promo_data.expires_at
    
    if promo_data.applies_to is not None:
        promo.applies_to = promo_data.applies_to
    
    db.commit()
    db.refresh(promo)
    
    return promo


@app.get("/api/admin/promos", response_model=list[PromoCodeResponse])
def get_admin_promos(
    event_id: Optional[int] = Query(None, description="Filter by event ID"),
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get promo codes, optionally filtered by event"""
    query = db.query(PromoCode)
    if event_id is not None:
        query = query.filter(PromoCode.event_id == event_id)
    
    promos = query.all()
    return promos


@app.get("/api/admin/reports", response_model=list[EventReport])
def get_reports(
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get sales reports for all events"""
    events = db.query(Event).all()
    reports = []
    
    for event in events:
        # Get ticket types
        vip_type = db.query(TicketType).filter(
            TicketType.event_id == event.id,
            TicketType.ticket_type == TicketTypeEnum.VIP
        ).first()
        
        regular_type = db.query(TicketType).filter(
            TicketType.event_id == event.id,
            TicketType.ticket_type == TicketTypeEnum.REGULAR
        ).first()
        
        # Calculate VIP stats
        vip_sold = vip_type.sold_count if vip_type else 0
        vip_capacity = vip_type.capacity if vip_type else 0
        vip_remaining = vip_capacity - vip_sold
        
        # Calculate VIP revenue from confirmed orders
        vip_orders = db.query(Order).filter(
            Order.event_id == event.id,
            Order.ticket_type == TicketTypeEnum.VIP,
            Order.status == 'confirmed'
        ).all()
        vip_revenue = sum(order.total_cents or 0 for order in vip_orders)
        
        # Calculate Regular stats
        regular_sold = regular_type.sold_count if regular_type else 0
        regular_capacity = regular_type.capacity if regular_type else 0
        regular_remaining = regular_capacity - regular_sold
        
        # Calculate Regular revenue from confirmed orders
        regular_orders = db.query(Order).filter(
            Order.event_id == event.id,
            Order.ticket_type == TicketTypeEnum.REGULAR,
            Order.status == 'confirmed'
        ).all()
        regular_revenue = sum(order.total_cents or 0 for order in regular_orders)
        
        # Calculate totals
        totals_sold = vip_sold + regular_sold
        totals_capacity = vip_capacity + regular_capacity
        totals_remaining = totals_capacity - totals_sold
        totals_revenue = vip_revenue + regular_revenue
        
        reports.append(EventReport(
            event_id=event.id,
            event_name=event.name,
            vip=TicketTypeStats(
                sold=vip_sold,
                capacity=vip_capacity,
                remaining=vip_remaining,
                revenue_cents=vip_revenue
            ),
            regular=TicketTypeStats(
                sold=regular_sold,
                capacity=regular_capacity,
                remaining=regular_remaining,
                revenue_cents=regular_revenue
            ),
            totals=TicketTypeStats(
                sold=totals_sold,
                capacity=totals_capacity,
                remaining=totals_remaining,
                revenue_cents=totals_revenue
            )
        ))
    
    return reports

