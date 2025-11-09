from typing import Dict, Tuple
from datetime import datetime, timedelta

# In-memory rate limit tracker: user_id -> last_request_time
_rate_limit_tracker: Dict[int, datetime] = {}
RATE_LIMIT_SECONDS = 2


def check_rate_limit(user_id: int) -> Tuple[bool, str]:
    """
    Check if user is rate limited.
    Returns (is_allowed, message)
    """
    now = datetime.utcnow()
    
    if user_id in _rate_limit_tracker:
        last_request = _rate_limit_tracker[user_id]
        time_since_last = (now - last_request).total_seconds()
        
        if time_since_last < RATE_LIMIT_SECONDS:
            remaining = RATE_LIMIT_SECONDS - time_since_last
            return False, f"Rate limit exceeded. Please wait {remaining:.1f} seconds."
    
    # Update last request time
    _rate_limit_tracker[user_id] = now
    return True, ""


def clear_rate_limit(user_id: int):
    """Clear rate limit for a user (for testing)"""
    if user_id in _rate_limit_tracker:
        del _rate_limit_tracker[user_id]

