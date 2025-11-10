from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, nullslast

from event_tix.db import get_db
from event_tix.models import Event, TicketType, User, TicketTypeEnum
from event_tix.schemas import EventCreate, EventOut
from event_tix.auth import get_current_user
from event_tix.util.dates import ensure_utc, to_utc_iso

router = APIRouter(prefix="/api/organizer", tags=["organizer"])


def ensure_organizer(user: User):
    if user.role not in ("organizer", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organizer role required")


def can_manage(user: User, event: Event):
    return user.role == "admin" or (event.organizer_id and event.organizer_id == user.id)


@router.get("/events", response_model=List[EventOut])
def my_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_organizer(user)
    q = db.query(Event)
    if user.role != "admin":
        q = q.filter(Event.organizer_id == user.id)
    # Order by: nulls last, then ascending
    events = q.order_by(nullslast(Event.starts_at.asc())).all()
    # Convert is_published from int to bool and ensure UTC datetimes for response
    result = []
    for evt in events:
        # Ensure datetimes are UTC-aware
        starts_at_utc = ensure_utc(evt.starts_at) if evt.starts_at else None
        ends_at_utc = ensure_utc(evt.ends_at) if evt.ends_at else None
        result.append(EventOut(
            id=evt.id,
            name=evt.name,
            description=evt.description,
            image_url=evt.image_url,
            location=evt.location,
            starts_at=starts_at_utc,
            ends_at=ends_at_utc,
            category=evt.category,
            tags=evt.tags,
            organizer_id=evt.organizer_id,
            is_published=bool(evt.is_published) if evt.is_published is not None else True
        ))
    return result


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_organizer(user)
    evt = Event(
        name=payload.name.strip(),
        description=payload.description or "",
        image_url=payload.image_url,
        location=payload.location or "",
        starts_at=ensure_utc(payload.starts_at) if payload.starts_at else None,
        ends_at=ensure_utc(payload.ends_at) if payload.ends_at else None,
        category=payload.category or "General",
        is_published=1 if payload.is_published else 0,
        organizer_id=user.id if user.role != "admin" else user.id,  # admin can later get UI to choose owner
        created_at=datetime.utcnow()
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    # create ticket types if provided
    if (payload.vip_capacity or 0) > 0:
        db.add(TicketType(
            event_id=evt.id,
            ticket_type=TicketTypeEnum.VIP,
            capacity=payload.vip_capacity or 0,
            price_cents=payload.vip_price_cents or 0,
            sold_count=0
        ))
    if (payload.reg_capacity or 0) > 0:
        db.add(TicketType(
            event_id=evt.id,
            ticket_type=TicketTypeEnum.REGULAR,
            capacity=payload.reg_capacity or 0,
            price_cents=payload.reg_price_cents or 0,
            sold_count=0
        ))
    db.commit()
    db.refresh(evt)
    # Convert is_published and ensure UTC datetimes for response
    starts_at_utc = ensure_utc(evt.starts_at) if evt.starts_at else None
    ends_at_utc = ensure_utc(evt.ends_at) if evt.ends_at else None
    return EventOut(
        id=evt.id,
        name=evt.name,
        description=evt.description,
        image_url=evt.image_url,
        location=evt.location,
        starts_at=starts_at_utc,
        ends_at=ends_at_utc,
        category=evt.category,
        tags=evt.tags,
        organizer_id=evt.organizer_id,
        is_published=bool(evt.is_published) if evt.is_published is not None else True
    )


@router.put("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_organizer(user)
    evt = db.query(Event).filter(Event.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not can_manage(user, evt):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    # update fields
    evt.name = payload.name.strip()
    evt.description = payload.description or ""
    evt.image_url = payload.image_url
    evt.location = payload.location or ""
    evt.starts_at = ensure_utc(payload.starts_at) if payload.starts_at else None
    evt.ends_at = ensure_utc(payload.ends_at) if payload.ends_at else None
    evt.category = payload.category or "General"
    evt.is_published = 1 if payload.is_published else 0
    db.commit()
    db.refresh(evt)
    # Convert is_published and ensure UTC datetimes for response
    starts_at_utc = ensure_utc(evt.starts_at) if evt.starts_at else None
    ends_at_utc = ensure_utc(evt.ends_at) if evt.ends_at else None
    return EventOut(
        id=evt.id,
        name=evt.name,
        description=evt.description,
        image_url=evt.image_url,
        location=evt.location,
        starts_at=starts_at_utc,
        ends_at=ends_at_utc,
        category=evt.category,
        tags=evt.tags,
        organizer_id=evt.organizer_id,
        is_published=bool(evt.is_published) if evt.is_published is not None else True
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_organizer(user)
    evt = db.query(Event).filter(Event.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not can_manage(user, evt):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    # soft delete = unpublish
    evt.is_published = 0
    db.commit()
    return None

