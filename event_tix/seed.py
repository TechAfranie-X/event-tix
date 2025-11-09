from event_tix.db import SessionLocal, init_db
from event_tix.models import Event, TicketType, TicketTypeEnum, User, PromoCode
from event_tix.auth import get_password_hash
from datetime import datetime, timedelta

def seed():
    """Seed the database with demo Events, TicketTypes, and Demo User"""
    init_db()
    db = SessionLocal()
    try:
        # Check if any events exist
        event_count = db.query(Event).count()
        
        if event_count == 0:
            # Seed Event 1: Atlanta Tech Expo
            event1 = Event(
                name="Atlanta Tech Expo",
                description="Join us for the premier technology expo in Atlanta. Discover the latest innovations, network with industry leaders, and explore cutting-edge solutions.",
                image_url="https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&q=80&auto=format&fit=crop",
                location="Atlanta, GA",
                starts_at=datetime.utcnow() + timedelta(days=2),
                ends_at=datetime.utcnow() + timedelta(days=2, hours=8),
                category="Technology",
                tags="technology,expo,atlanta,business"
            )
            db.add(event1)
            db.flush()

            vip_ticket1 = TicketType(
                event_id=event1.id,
                ticket_type=TicketTypeEnum.VIP,
                capacity=20,
                sold_count=0,
                price_cents=5000  # $50.00
            )
            db.add(vip_ticket1)

            regular_ticket1 = TicketType(
                event_id=event1.id,
                ticket_type=TicketTypeEnum.REGULAR,
                capacity=80,
                sold_count=0,
                price_cents=0  # Free
            )
            db.add(regular_ticket1)

            # Seed Event 2: Music Night – Accra
            event2 = Event(
                name="Music Night – Accra",
                description="An electrifying night of music featuring local and international artists. Experience the vibrant music scene of Accra in this unforgettable event.",
                image_url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80&auto=format&fit=crop",
                location="Accra, Ghana",
                starts_at=datetime.utcnow() + timedelta(days=15),
                ends_at=datetime.utcnow() + timedelta(days=15, hours=5),
                category="Music",
                tags="music,night,accra,entertainment"
            )
            db.add(event2)
            db.flush()

            vip_ticket2 = TicketType(
                event_id=event2.id,
                ticket_type=TicketTypeEnum.VIP,
                capacity=20,
                sold_count=0,
                price_cents=5000  # $50.00
            )
            db.add(vip_ticket2)

            regular_ticket2 = TicketType(
                event_id=event2.id,
                ticket_type=TicketTypeEnum.REGULAR,
                capacity=80,
                sold_count=0,
                price_cents=0  # Free
            )
            db.add(regular_ticket2)

            # Seed Event 3: Startup Summit – Dallas
            event3 = Event(
                name="Startup Summit – Dallas",
                description="Connect with entrepreneurs, investors, and innovators at the Dallas Startup Summit. Learn from successful founders and discover the next big thing.",
                image_url="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80&auto=format&fit=crop",
                location="Dallas, TX",
                starts_at=datetime.utcnow() + timedelta(days=30),
                ends_at=datetime.utcnow() + timedelta(days=32),
                category="Business",
                tags="startup,summit,dallas,entrepreneurship"
            )
            db.add(event3)
            db.flush()

            vip_ticket3 = TicketType(
                event_id=event3.id,
                ticket_type=TicketTypeEnum.VIP,
                capacity=20,
                sold_count=0,
                price_cents=5000  # $50.00
            )
            db.add(vip_ticket3)

            regular_ticket3 = TicketType(
                event_id=event3.id,
                ticket_type=TicketTypeEnum.REGULAR,
                capacity=80,
                sold_count=0,
                price_cents=0  # Free
            )
            db.add(regular_ticket3)

            db.commit()
            print("✓ Seeded 3 events: Atlanta Tech Expo, Music Night – Accra, Startup Summit – Dallas")
        else:
            print(f"Events already exist ({event_count} found). Skipping event seed.")

        # Seed demo promo codes (idempotent)
        # Get event IDs
        events = db.query(Event).all()
        if events:
            event1 = events[0]  # First event
            
            # Promo code 1: 20% off VIP tickets
            promo1 = db.query(PromoCode).filter(PromoCode.code == "VIP20").first()
            if not promo1:
                promo1 = PromoCode(
                    event_id=event1.id,
                    code="VIP20",
                    type="percent",
                    percent=20,
                    max_uses=50,
                    used_count=0,
                    expires_at=datetime.utcnow() + timedelta(days=90),
                    applies_to="VIP"
                )
                db.add(promo1)
                print(f"✓ Created promo code: VIP20 (20% off VIP tickets)")
            
            # Promo code 2: $10 off any ticket
            promo2 = db.query(PromoCode).filter(PromoCode.code == "SAVE10").first()
            if not promo2:
                promo2 = PromoCode(
                    event_id=event1.id,
                    code="SAVE10",
                    type="amount",
                    value_cents=1000,  # $10.00
                    max_uses=100,
                    used_count=0,
                    expires_at=datetime.utcnow() + timedelta(days=60),
                    applies_to=None  # Applies to all ticket types
                )
                db.add(promo2)
                print(f"✓ Created promo code: SAVE10 ($10 off any ticket)")
            
            db.commit()

        # Seed Demo User (idempotent)
        demo_email = "demo@local.test"
        demo_user = db.query(User).filter(User.email == demo_email).first()
        
        if not demo_user:
            demo_user = User(
                name="Demo User",
                email=demo_email,
                hashed_password=get_password_hash("Passw0rd!")
            )
            db.add(demo_user)
            db.commit()
            print(f"✓ Created demo user: {demo_email} (password: Passw0rd!)")
        else:
            demo_user.name = "Demo User"
            demo_user.hashed_password = get_password_hash("Passw0rd!")
            db.commit()
            print(f"✓ Updated demo user: {demo_email} (password: Passw0rd!)")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
