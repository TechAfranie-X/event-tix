# event_tix/services/promos.py
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from event_tix.models.promo import PromoCode, PromoRedemption

def _now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def normalize(code: str) -> str:
    return (code or "").strip().upper()

def validate_promo(db: Session, *, code: str, user_id: int | None, event_id: int, ticket_type: str, qty: int, unit_price_cents: int):
    codeN = normalize(code)
    if not codeN:
        return (False, "Empty promo code", 0, qty * unit_price_cents)

    promo = db.query(PromoCode).filter(func.upper(PromoCode.code) == codeN).first()
    if not promo or not promo.is_active:
        return (False, "Invalid promo code", 0, qty * unit_price_cents)

    # scope checks
    if promo.event_id and promo.event_id != event_id:
        return (False, "Promo not valid for this event", 0, qty * unit_price_cents)
    if promo.ticket_type and promo.ticket_type != ticket_type:
        return (False, "Promo not valid for this ticket type", 0, qty * unit_price_cents)

    now = _now_utc()
    if promo.starts_at and now < promo.starts_at:
        return (False, "Promo not started yet", 0, qty * unit_price_cents)
    if promo.ends_at and now > promo.ends_at:
        return (False, "Promo expired", 0, qty * unit_price_cents)

    # limits
    if promo.max_total_uses is not None and promo.used_count >= promo.max_total_uses:
        return (False, "Promo usage limit reached", 0, qty * unit_price_cents)

    if user_id is not None and promo.max_uses_per_user:
        used_by_user = db.query(PromoRedemption).filter(
            PromoRedemption.promo_id == promo.id,
            PromoRedemption.user_id == user_id
        ).count()
        if used_by_user >= promo.max_uses_per_user:
            return (False, "You have already used this promo", 0, qty * unit_price_cents)

    line_total = unit_price_cents * qty
    if promo.min_order_cents and line_total < promo.min_order_cents:
        return (False, "Order total too low for this promo", 0, line_total)

    # discount
    discount = 0
    if promo.percent_off is not None:
        discount = (line_total * promo.percent_off) // 100
    elif promo.amount_off_cents is not None:
        discount = min(promo.amount_off_cents, line_total)

    new_total = max(0, line_total - discount)
    return (True, "Promo applied", discount, new_total)

def redeem_promo(db: Session, *, promo_code: str, user_id: int, order_id: int):
    codeN = normalize(promo_code)
    promo = db.query(PromoCode).filter(func.upper(PromoCode.code) == codeN).first()
    if not promo:
        return
    promo.used_count = (promo.used_count or 0) + 1
    red = PromoRedemption(promo_id=promo.id, user_id=user_id, order_id=order_id)
    db.add(red)

