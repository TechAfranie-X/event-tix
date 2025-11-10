# event_tix/cli/migrate_roles.py
from sqlalchemy import text
from event_tix.db import engine

def column_exists(table, col):
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(f"PRAGMA table_info({table});").fetchall()
        return any(r[1] == col for r in rows)

def ensure_columns():
    with engine.begin() as conn:
        # users.role
        if not column_exists("users", "role"):
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        # events.organizer_id + events.is_published
        if not column_exists("events", "organizer_id"):
            conn.exec_driver_sql("ALTER TABLE events ADD COLUMN organizer_id INTEGER")
        if not column_exists("events", "is_published"):
            conn.exec_driver_sql("ALTER TABLE events ADD COLUMN is_published INTEGER DEFAULT 1")
        # ticket_types.sale_start / sale_end (prevents earlier errors)
        if not column_exists("ticket_types", "sale_start"):
            conn.exec_driver_sql("ALTER TABLE ticket_types ADD COLUMN sale_start DATETIME")
        if not column_exists("ticket_types", "sale_end"):
            conn.exec_driver_sql("ALTER TABLE ticket_types ADD COLUMN sale_end DATETIME")
        # helpful indexes
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id)")

if __name__ == "__main__":
    ensure_columns()
    print("Role/ownership migration complete.")

