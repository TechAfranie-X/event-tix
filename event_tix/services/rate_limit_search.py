from typing import Dict, Tuple
from datetime import datetime, timedelta
from collections import deque

# Token bucket per IP: ip -> deque of request timestamps
_search_buckets: Dict[str, deque] = {}
SEARCH_MAX_REQUESTS = 10
SEARCH_WINDOW_SECONDS = 60


def check_search_rate_limit(ip: str) -> Tuple[bool, str]:
    """
    Check if IP can make a search request using token bucket.
    Returns (is_allowed, message)
    """
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=SEARCH_WINDOW_SECONDS)
    
    # Get or create bucket for IP
    if ip not in _search_buckets:
        _search_buckets[ip] = deque()
    
    bucket = _search_buckets[ip]
    
    # Remove timestamps outside the window
    while bucket and bucket[0] < window_start:
        bucket.popleft()
    
    # Check if bucket is full
    if len(bucket) >= SEARCH_MAX_REQUESTS:
        oldest_request = bucket[0]
        wait_until = oldest_request + timedelta(seconds=SEARCH_WINDOW_SECONDS)
        wait_seconds = (wait_until - now).total_seconds()
        return False, f"Rate limit exceeded. Maximum {SEARCH_MAX_REQUESTS} requests per minute. Please wait {wait_seconds:.0f} seconds."
    
    # Add current request timestamp
    bucket.append(now)
    return True, ""


def clear_search_rate_limit(ip: str):
    """Clear rate limit for an IP (for testing)"""
    if ip in _search_buckets:
        _search_buckets[ip].clear()




