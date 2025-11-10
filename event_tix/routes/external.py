# event_tix/routes/external.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc
from typing import Optional

from event_tix.db import get_db
from event_tix.models import Event
from event_tix.services.external_events import search_external_events
from event_tix.util.dates import ensure_utc

router = APIRouter()

def map_local_event(e: Event) -> dict:
    # Ensure UTC datetime for starts_at
    starts_at_iso = None
    if e.starts_at:
        utc_dt = ensure_utc(e.starts_at)
        starts_at_iso = utc_dt.isoformat().replace("+00:00", "Z") if utc_dt else None
    return {
        "source": "local",
        "external_id": None,
        "id": e.id,
        "name": e.name,
        "image_url": e.image_url,
        "location": e.location,
        "starts_at": starts_at_iso,
        "url": None,
        "category": e.category or "General",
    }

@router.get("/api/external/events")
def get_external_events(
    city: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    size: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # 1) Try external providers (may return [])
    try:
        external = search_external_events(city=city, keyword=q, size=size) or []
    except Exception:
        external = []

    # 2) Always include locals to fill up to `size`
    remaining = max(size - len(external), 0)
    local_limit = size if len(external) == 0 else remaining

    locals_q = (
        db.query(Event)
        .filter(Event.is_published == 1)
        .order_by(asc(Event.starts_at))
        .limit(local_limit)
        .all()
    )
    local_mapped = [map_local_event(e) for e in locals_q]

    # 3) Merge (external first, then locals), cap to size
    return (external + local_mapped)[:size]
