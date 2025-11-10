# Compatibility shim: load the legacy single-file models (event_tix/models.py)
# and re-export its symbols so imports keep working — EXCEPT promo models,
# which live in event_tix/models/promo.py to avoid double table registration.
from __future__ import annotations
import sys, importlib.util
from pathlib import Path

_pkg_dir = Path(__file__).resolve().parent
_legacy_path = (_pkg_dir.parent / "models.py").resolve()

_spec = importlib.util.spec_from_file_location("event_tix._legacy_models", _legacy_path)
if _spec is None or _spec.loader is None:
    raise ImportError(f"Cannot load legacy models from {_legacy_path}")
_legacy = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = _legacy
_spec.loader.exec_module(_legacy)  # type: ignore[attr-defined]

# Base + core models from legacy
Base = _legacy.Base
User = getattr(_legacy, "User", None)
Event = getattr(_legacy, "Event", None)
TicketType = getattr(_legacy, "TicketType", None)
Order = getattr(_legacy, "Order", None)
OrderItem = getattr(_legacy, "OrderItem", None)
Ticket = getattr(_legacy, "Ticket", None)
TicketTypeEnum = getattr(_legacy, "TicketTypeEnum", None)
IdempotencyKey = getattr(_legacy, "IdempotencyKey", None)

# Promo models come from the dedicated module (single source of truth)
from .promo import PromoCode, PromoRedemption  # noqa: E402

__all__ = [
    "Base", "User", "Event", "TicketType", "Order", "OrderItem",
    "Ticket", "TicketTypeEnum", "IdempotencyKey",
    "PromoCode", "PromoRedemption",
]
