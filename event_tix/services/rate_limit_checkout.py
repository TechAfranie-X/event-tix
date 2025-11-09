from typing import Dict, Tuple
from datetime import datetime, timedelta
from collections import deque

# Token bucket per user_id: user_id -> deque of request timestamps
_checkout_buckets: Dict[int, deque] = {}
CHECKOUT_MAX_REQUESTS = 5
CHECKOUT_WINDOW_SECONDS = 60


def check_checkout_rate_limit(user_id: int) -> Tuple[bool, str]:
    """
    Check if user can make a checkout request using token bucket.
    Returns (is_allowed, message)
    """
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=CHECKOUT_WINDOW_SECONDS)
    
    # Get or create bucket for user
    if user_id not in _checkout_buckets:
        _checkout_buckets[user_id] = deque()
    
    bucket = _checkout_buckets[user_id]
    
    # Remove timestamps outside the window
    while bucket and bucket[0] < window_start:
        bucket.popleft()
    
    # Check if bucket is full
    if len(bucket) >= CHECKOUT_MAX_REQUESTS:
        oldest_request = bucket[0]
        wait_until = oldest_request + timedelta(seconds=CHECKOUT_WINDOW_SECONDS)
        wait_seconds = (wait_until - now).total_seconds()
        return False, f"Rate limit exceeded. Maximum {CHECKOUT_MAX_REQUESTS} requests per minute. Please wait {wait_seconds:.0f} seconds."
    
    # Add current request timestamp
    bucket.append(now)
    return True, ""


def clear_checkout_rate_limit(user_id: int):
    """Clear rate limit for a user (for testing)"""
    if user_id in _checkout_buckets:
        _checkout_buckets[user_id].clear()




