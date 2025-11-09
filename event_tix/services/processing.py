import asyncio
from sqlalchemy.orm import Session
from event_tix.db import SessionLocal, atomic_reserve_ticket_type
from event_tix.models import Order, Ticket, TicketTypeEnum
from event_tix.services.queue import dequeue, mark_done, remove_from_tracker
from event_tix.services.logging import log_transaction, log_error
import uuid

_processing_task = None
_processing_enabled = False


async def process_tick():
    """Process one iteration of the queue"""
    db = SessionLocal()
    try:
        # Dequeue next request (VIP first, then Regular)
        entry = dequeue()
        if entry is None:
            return  # No requests in queue
        
        request_id = entry['request_id']
        user_id = entry['user_id']
        event_id = entry['event_id']
        ticket_type_name = entry['ticket_type_name']
        ticket_type = TicketTypeEnum.VIP if ticket_type_name == 'VIP' else TicketTypeEnum.REGULAR
        
        # Find existing order by request_id
        order = db.query(Order).filter(Order.request_id == request_id).first()
        if not order:
            log_error('process_tick', f"Order not found for request_id: {request_id}")
            remove_from_tracker(request_id)
            return
        
        # Get user info for logging
        from event_tix.models import User
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            order.status = 'failed'
            order.reason = 'user_not_found'
            db.commit()
            log_transaction({
                'user_name': f'user_{user_id}',
                'user_email': 'unknown',
                'ticket_type': ticket_type_name,
                'request_id': request_id,
                'status': 'failed',
                'reason': 'user_not_found'
            })
            mark_done(request_id)
            remove_from_tracker(request_id)
            return
        
        # Get ticket type record
        from event_tix.models import TicketType
        ticket_type_record = db.query(TicketType).filter(
            TicketType.ticket_type == ticket_type,
            TicketType.event_id == event_id
        ).first()
        
        if not ticket_type_record:
            order.status = 'failed'
            order.reason = 'ticket_type_not_found'
            db.commit()
            log_transaction({
                'user_name': user.name,
                'user_email': user.email,
                'ticket_type': ticket_type_name,
                'request_id': request_id,
                'status': 'failed',
                'reason': 'ticket_type_not_found'
            })
            mark_done(request_id)
            remove_from_tracker(request_id)
            return
        
        # Try atomic reservation
        success = atomic_reserve_ticket_type(db, ticket_type_record.id)
        
        if success:
            # Refresh to get updated sold_count
            db.refresh(ticket_type_record)
            
            # Update order to confirmed
            order.status = 'confirmed'
            db.flush()
            
            # Create ticket with QR token
            qr_token = str(uuid.uuid4())
            ticket = Ticket(
                order_id=order.id,
                qr_token=qr_token
            )
            db.add(ticket)
            db.commit()
            
            log_transaction({
                'user_name': user.name,
                'user_email': user.email,
                'ticket_type': ticket_type_name,
                'request_id': request_id,
                'status': 'confirmed',
                'reason': ''
            })
        else:
            # Update order to failed
            order.status = 'failed'
            order.reason = 'sold_out'
            db.commit()
            
            log_transaction({
                'user_name': user.name,
                'user_email': user.email,
                'ticket_type': ticket_type_name,
                'request_id': request_id,
                'status': 'failed',
                'reason': 'sold_out'
            })
        
        mark_done(request_id)
        remove_from_tracker(request_id)
        
    except Exception as e:
        db.rollback()
        log_error('process_tick', f"Error processing tick: {e}")
        print(f"Error processing tick: {e}")
    finally:
        db.close()


async def run_processor(app_state=None):
    """Background processing loop (500ms tick)"""
    global _processing_enabled
    _processing_enabled = True
    try:
        while _processing_enabled:
            await process_tick()
            await asyncio.sleep(0.5)  # 500ms
    except asyncio.CancelledError:
        _processing_enabled = False
        raise


async def processing_loop():
    """Alias for run_processor for backward compatibility"""
    await run_processor()


def start_processing():
    """Start background processing task"""
    global _processing_task
    if _processing_task is None or _processing_task.done():
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        _processing_task = loop.create_task(processing_loop())


def stop_processing():
    """Stop background processing"""
    global _processing_enabled, _processing_task
    _processing_enabled = False
    if _processing_task and not _processing_task.done():
        _processing_task.cancel()


def set_processing_enabled(value: bool):
    """Set processing enabled flag"""
    global _processing_enabled
    _processing_enabled = value


async def process_one_manual():
    """Manually process one tick (for CLI)"""
    await process_tick()
