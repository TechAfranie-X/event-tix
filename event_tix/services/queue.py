from collections import deque
from typing import Dict, Optional, Tuple
from datetime import datetime
from event_tix.models import TicketTypeEnum
import uuid

# In-memory queues
vip_queue: deque = deque()
regular_queue: deque = deque()

# Track request_id -> queue entry dict
request_tracker: Dict[str, dict] = {}

# Track processing status: request_id -> status
processing_status: Dict[str, str] = {}  # "queued", "processing", "done"

# Global arrival counter
_arrival_counter = 0


def enqueue(user_id: int, event_id: int, ticket_type: TicketTypeEnum) -> Tuple[str, int]:
    """
    Enqueue a ticket request.
    Returns (request_id, position_in_queue)
    """
    global _arrival_counter
    _arrival_counter += 1
    
    request_id = str(uuid.uuid4())
    created_at = datetime.utcnow()
    
    entry = {
        'request_id': request_id,
        'user_id': user_id,
        'event_id': event_id,
        'ticket_type_name': ticket_type.value,
        'arrival_counter': _arrival_counter,
        'created_at': created_at
    }
    
    if ticket_type == TicketTypeEnum.VIP:
        position = len(vip_queue) + 1
        vip_queue.append(entry)
    else:
        position = len(regular_queue) + 1
        regular_queue.append(entry)
    
    request_tracker[request_id] = entry
    processing_status[request_id] = 'queued'
    
    return request_id, position


def dequeue() -> Optional[dict]:
    """
    Dequeue next request (VIP first, then Regular).
    Returns queue entry dict or None if both queues empty.
    """
    if vip_queue:
        entry = vip_queue.popleft()
        processing_status[entry['request_id']] = 'processing'
        return entry
    elif regular_queue:
        entry = regular_queue.popleft()
        processing_status[entry['request_id']] = 'processing'
        return entry
    return None


def get_position(request_id: str) -> Optional[Tuple[int, TicketTypeEnum]]:
    """
    Get current position in queue for a request_id.
    Returns (position, ticket_type) or None if not found.
    """
    if request_id not in request_tracker:
        return None
    
    entry = request_tracker[request_id]
    ticket_type_name = entry['ticket_type_name']
    ticket_type = TicketTypeEnum.VIP if ticket_type_name == 'VIP' else TicketTypeEnum.REGULAR
    
    # Recalculate position based on current queue state
    if ticket_type == TicketTypeEnum.VIP:
        for idx, item in enumerate(vip_queue, start=1):
            if item['request_id'] == request_id:
                return idx, ticket_type
    else:
        for idx, item in enumerate(regular_queue, start=1):
            if item['request_id'] == request_id:
                return idx, ticket_type
    
    # Not in queue anymore (being processed or done)
    return None


def get_status(request_id: str) -> str:
    """Get processing status for a request_id"""
    return processing_status.get(request_id, 'unknown')


def mark_done(request_id: str):
    """Mark request as done"""
    processing_status[request_id] = 'done'
    if request_id in request_tracker:
        del request_tracker[request_id]


def remove_from_tracker(request_id: str):
    """Remove request from tracker (called when processing completes)"""
    if request_id in request_tracker:
        del request_tracker[request_id]
    if request_id in processing_status:
        del processing_status[request_id]
