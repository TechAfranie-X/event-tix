# event_tix/cli/migrate_promos.py
from event_tix.db import engine
from sqlalchemy import text

def col_exists(table, name):
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(f"PRAGMA table_info({table});").fetchall()
        cols = {r[1] for r in rows}
        return name in cols

def table_exists(name):
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:n;", {"n": name}
        ).fetchall()
        return bool(rows)

def ensure_schema():
    with engine.begin() as conn:
        # promo_codes
        if not table_exists("promo_codes"):
            conn.exec_driver_sql("""
                CREATE TABLE promo_codes (
                    id INTEGER PRIMARY KEY,
                    code TEXT UNIQUE NOT NULL,
                    organizer_id INTEGER,
                    event_id INTEGER,
                    ticket_type TEXT,
                    percent_off INTEGER,
                    amount_off_cents INTEGER,
                    max_total_uses INTEGER,
                    max_uses_per_user INTEGER,
                    min_order_cents INTEGER,
                    starts_at DATETIME,
                    ends_at DATETIME,
                    is_active BOOLEAN DEFAULT 1,
                    used_count INTEGER DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                );
            """)
        # promo_redemptions
        if not table_exists("promo_redemptions"):
            conn.exec_driver_sql("""
                CREATE TABLE promo_redemptions (
                    id INTEGER PRIMARY KEY,
                    promo_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    order_id INTEGER NOT NULL,
                    used_at DATETIME
                );
            """)

if __name__ == "__main__":
    ensure_schema()
    print("Promo migration complete.")

