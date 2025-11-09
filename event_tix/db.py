from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from event_tix.models import Base
import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./event_tix.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


def atomic_reserve_ticket_type(db: Session, ticket_type_id: int) -> bool:
    """
    Atomically reserve a ticket by incrementing sold_count if capacity allows.
    Returns True if reservation succeeded, False otherwise.
    """
    try:
        result = db.execute(
            text("""
            UPDATE ticket_types 
            SET sold_count = sold_count + 1 
            WHERE id = :ticket_type_id AND sold_count < capacity
            """),
            {"ticket_type_id": ticket_type_id}
        )
        db.commit()
        return result.rowcount == 1
    except SQLAlchemyError:
        db.rollback()
        return False


def atomic_release_ticket_type(db: Session, ticket_type_id: int) -> bool:
    """
    Atomically release a ticket by decrementing sold_count (guard >= 0).
    Returns True if release succeeded, False otherwise.
    """
    try:
        result = db.execute(
            text("""
            UPDATE ticket_types 
            SET sold_count = sold_count - 1 
            WHERE id = :ticket_type_id AND sold_count > 0
            """),
            {"ticket_type_id": ticket_type_id}
        )
        db.commit()
        return result.rowcount == 1
    except SQLAlchemyError:
        db.rollback()
        return False

