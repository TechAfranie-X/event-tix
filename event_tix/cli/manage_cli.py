import asyncio
import sys
from sqlalchemy.orm import Session
from event_tix.db import SessionLocal
from event_tix.models import TicketType, TicketTypeEnum, Order
from event_tix.services.queue import enqueue
from event_tix.services.processing import process_one_manual
from event_tix.services.logging import get_last_transactions, ensure_csv_header


def view_availability():
    """View current ticket availability"""
    db = SessionLocal()
    try:
        vip_type = db.query(TicketType).filter(
            TicketType.event_id == 1,
            TicketType.ticket_type == TicketTypeEnum.VIP
        ).first()
        
        regular_type = db.query(TicketType).filter(
            TicketType.event_id == 1,
            TicketType.ticket_type == TicketTypeEnum.REGULAR
        ).first()
        
        print("\n" + "=" * 50)
        print("Ticket Availability")
        print("=" * 50)
        
        if vip_type:
            vip_left = vip_type.capacity - vip_type.sold_count
            print(f"VIP: {vip_left}/{vip_type.capacity} available")
        else:
            print("VIP: Not found")
        
        if regular_type:
            regular_left = regular_type.capacity - regular_type.sold_count
            print(f"Regular: {regular_left}/{regular_type.capacity} available")
        else:
            print("Regular: Not found")
        
        print("=" * 50 + "\n")
    except Exception as e:
        print(f"\nError viewing availability: {e}\n")
    finally:
        db.close()


def enqueue_test_request():
    """Enqueue a test ticket request"""
    print("\nSelect ticket type:")
    print("1. VIP")
    print("2. Regular")
    
    try:
        choice = input("Choice (1-2): ").strip()
        
        if choice == "1":
            ticket_type = TicketTypeEnum.VIP
        elif choice == "2":
            ticket_type = TicketTypeEnum.REGULAR
        else:
            print("\nInvalid choice. Please enter 1 or 2.\n")
            return
        
        # Use user_id=1, event_id=1 for test
        user_id = 1
        event_id = 1
        
        # Enqueue request
        request_id, position = enqueue(
            user_id=user_id,
            event_id=event_id,
            ticket_type=ticket_type
        )
        
        # Create order with 'queued' status
        db = SessionLocal()
        try:
            order = Order(
                user_id=user_id,
                event_id=event_id,
                ticket_type=ticket_type,
                request_id=request_id,
                status='queued'
            )
            db.add(order)
            db.commit()
            
            print("\n" + "=" * 50)
            print("✓ Request Enqueued")
            print("=" * 50)
            print(f"Request ID: {request_id}")
            print(f"Position: {position}")
            print(f"Type: {ticket_type.value}")
            print("=" * 50 + "\n")
        except Exception as e:
            db.rollback()
            print(f"\nError creating order: {e}\n")
        finally:
            db.close()
            
    except KeyboardInterrupt:
        print("\n\nCancelled.\n")
    except Exception as e:
        print(f"\nError enqueueing request: {e}\n")


def process_next_tick():
    """Process one tick manually"""
    print("\nProcessing next tick...")
    try:
        # Create a new event loop for this call
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(process_one_manual())
        loop.close()
        print("✓ Tick processed\n")
    except Exception as e:
        print(f"\nError processing tick: {e}\n")


def show_transactions():
    """Show last 10 transactions"""
    try:
        # Ensure CSV exists with header
        ensure_csv_header()
        
        transactions = get_last_transactions(10)
        
        if not transactions:
            print("\nNo transactions found\n")
            return
        
        print("\n" + "=" * 100)
        print("Last 10 Transactions")
        print("=" * 100)
        print(f"{'Timestamp':<25} {'User':<20} {'Type':<10} {'Request ID':<38} {'Status':<12} {'Reason':<10}")
        print("-" * 100)
        
        for txn in transactions:
            timestamp = txn.get('timestamp', '')[:19] if txn.get('timestamp') else ''
            user_name = txn.get('user_name', '')[:18] if txn.get('user_name') else ''
            ticket_type = txn.get('ticket_type', '')[:8] if txn.get('ticket_type') else ''
            request_id = txn.get('request_id', '')[:36] if txn.get('request_id') else ''
            status = txn.get('status', '')[:10] if txn.get('status') else ''
            reason = txn.get('reason', '')[:8] if txn.get('reason') else ''
            
            print(f"{timestamp:<25} {user_name:<20} {ticket_type:<10} {request_id:<38} {status:<12} {reason:<10}")
        
        print("=" * 100 + "\n")
    except Exception as e:
        print(f"\nError showing transactions: {e}\n")


def main():
    """Main CLI menu"""
    print("\n" + "=" * 50)
    print("Event Ticketing System - CLI Manager")
    print("=" * 50)
    
    while True:
        try:
            print("\nMenu:")
            print("1) View availability")
            print("2) Enqueue test request")
            print("3) Process next tick once")
            print("4) Show last 10 transactions")
            print("5) Exit")
            print()
            
            choice = input("Choice (1-5): ").strip()
            
            if choice == "1":
                view_availability()
            elif choice == "2":
                enqueue_test_request()
            elif choice == "3":
                process_next_tick()
            elif choice == "4":
                show_transactions()
            elif choice == "5":
                print("\nGoodbye!\n")
                sys.exit(0)
            else:
                print("\nInvalid choice. Please enter a number between 1 and 5.\n")
        except KeyboardInterrupt:
            print("\n\nExiting...\n")
            sys.exit(0)
        except EOFError:
            print("\n\nExiting...\n")
            sys.exit(0)
        except Exception as e:
            print(f"\nUnexpected error: {e}\n")


if __name__ == "__main__":
    main()
