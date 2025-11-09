import csv
import os
from datetime import datetime
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent / "data" / "transactions.csv"
ERROR_LOG_PATH = Path(__file__).parent.parent / "data" / "errors.log"
EMAIL_LOG_PATH = Path(__file__).parent.parent / "data" / "emails.log"


def ensure_csv_header():
    """Ensure CSV file exists with header"""
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CSV_PATH.exists():
        try:
            with open(CSV_PATH, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'timestamp', 'user_name', 'user_email', 'ticket_type',
                    'request_id', 'status', 'reason'
                ])
        except Exception as e:
            log_error('ensure_csv_header', f"Failed to create CSV header: {e}")


def log_transaction(entry: dict):
    """
    Log a transaction to CSV.
    entry should contain: user_name, user_email, ticket_type, request_id, status, reason
    """
    ensure_csv_header()
    timestamp = datetime.utcnow().isoformat()
    
    row = [
        timestamp,
        entry.get('user_name', ''),
        entry.get('user_email', ''),
        entry.get('ticket_type', ''),
        entry.get('request_id', ''),
        entry.get('status', ''),
        entry.get('reason', '')
    ]
    
    # Retry once on failure
    for attempt in range(2):
        try:
            with open(CSV_PATH, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(row)
            return
        except Exception as e:
            if attempt == 0:
                # Retry once
                continue
            else:
                # Log error and continue
                log_error('log_transaction', f"Failed to write CSV after retry: {e}")
                return


def log_error(context: str, message: str):
    """Log an error to errors.log"""
    ERROR_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().isoformat()
    
    try:
        with open(ERROR_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] [{context}] {message}\n")
    except Exception as e:
        # If we can't write to error log, print to console
        print(f"CRITICAL: Failed to write to error log: {e}")
        print(f"Original error: [{context}] {message}")


def get_last_transactions(n: int = 10) -> list:
    """Get last N transactions from CSV"""
    if not CSV_PATH.exists():
        return []
    
    try:
        transactions = []
        with open(CSV_PATH, 'r', newline='') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            # Get last N rows
            for row in rows[-n:]:
                transactions.append(row)
        
        return transactions
    except Exception as e:
        log_error('get_last_transactions', f"Failed to read transactions: {e}")
        return []


def log_email(to: str, subject: str, order_id: int):
    """Log an email to emails.log"""
    EMAIL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().isoformat()
    
    try:
        with open(EMAIL_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] To: {to} | Subject: {subject} | Order ID: {order_id}\n")
    except Exception as e:
        log_error('log_email', f"Failed to write to email log: {e}")
