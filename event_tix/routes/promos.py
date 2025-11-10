from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from event_tix.db import get_db
from event_tix.auth import get_current_user_optional, get_current_user
from event_tix.services.promos import validate_promo, normalize
from event_tix.models.promo import PromoCode
from datetime import datetime

router = APIRouter(prefix="/api", tags=["promos"])

class ValidateReq(BaseModel):
    code: str
    event_id: int
    ticket_type: str
    qty: int
    unit_price_cents: int

@router.post("/promos/validate")
def validate(req: ValidateReq, db: Session = Depends(get_db), user=Depends(get_current_user_optional)):
    uid = user.id if user else None
    ok, msg, discount, new_total = validate_promo(
        db,
        code=req.code,
        user_id=uid,
        event_id=req.event_id,
        ticket_type=req.ticket_type,
        qty=req.qty,
        unit_price_cents=req.unit_price_cents,
    )
    return {"valid": ok, "message": msg, "discount_cents": discount, "new_total_cents": new_total}

# Organizer CRUD (minimal create & list)
class PromoCreate(BaseModel):
    code: str
    event_id: int | None = None
    ticket_type: str | None = None
    percent_off: int | None = None
    amount_off_cents: int | None = None
    max_total_uses: int | None = None
    max_uses_per_user: int | None = 1
    min_order_cents: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True

@router.post("/organizer/promos")
def create_promo(payload: PromoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # must be organizer/admin
    if user.role not in ("organizer", "admin"):
        raise HTTPException(status_code=403, detail="Organizer only")
    # unique code (case-insensitive)
    codeN = normalize(payload.code)
    existing = db.query(PromoCode).filter(func.upper(PromoCode.code) == codeN).first()
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")

    if (payload.percent_off is None) == (payload.amount_off_cents is None):
        raise HTTPException(status_code=400, detail="Provide either percent_off OR amount_off_cents")

    promo = PromoCode(
        code=codeN,  # Store normalized (uppercase) code
        organizer_id=user.id,
        event_id=payload.event_id,
        ticket_type=payload.ticket_type,
        percent_off=payload.percent_off,
        amount_off_cents=payload.amount_off_cents,
        max_total_uses=payload.max_total_uses,
        max_uses_per_user=payload.max_uses_per_user,
        min_order_cents=payload.min_order_cents,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        is_active=payload.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return {"id": promo.id, "code": promo.code}

@router.get("/organizer/promos")
def list_promos(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("organizer", "admin"):
        raise HTTPException(status_code=403, detail="Organizer only")
    promos = db.query(PromoCode).filter(PromoCode.organizer_id == user.id).order_by(PromoCode.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "event_id": p.event_id,
            "ticket_type": p.ticket_type,
            "percent_off": p.percent_off,
            "amount_off_cents": p.amount_off_cents,
            "used_count": p.used_count,
            "max_total_uses": p.max_total_uses,
            "is_active": p.is_active,
            "starts_at": p.starts_at,
            "ends_at": p.ends_at,
        } for p in promos
    ]

