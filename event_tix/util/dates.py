# event_tix/util/dates.py
from datetime import datetime, timezone

def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        # treat incoming naive as UTC (assuming client already sent UTC)
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_utc_iso(dt: datetime | None) -> str | None:
    """Convert datetime to UTC ISO string with Z suffix"""
    if dt is None:
        return None
    utc_dt = ensure_utc(dt)
    return utc_dt.isoformat().replace("+00:00", "Z")

