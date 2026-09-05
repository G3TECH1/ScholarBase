import sqlite3
import json
import datetime
from config import get_secure_db_path

db_path = get_secure_db_path("school.db")


def get_db():
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA cache_size = -20000;")
    return conn


def initialize_schema():
    with get_db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_store_key ON store(key)")
        conn.execute("CREATE TABLE IF NOT EXISTS graduated (id TEXT PRIMARY KEY, data TEXT, date TEXT)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_graduated_date ON graduated(date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_graduated_id ON graduated(id)")


initialize_schema()


def log_activity(action_text):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM store WHERE key = 'logs:activities'")
    row = cursor.fetchone()

    logs = json.loads(row[0]) if row else []
    timestamp = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    plain_text_log = f"ADMIN : ({timestamp}) {action_text.lower()}"
    logs.insert(0, plain_text_log)
    logs = logs[:100]

    cursor.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", ("logs:activities", json.dumps(logs)))
    conn.commit()
    conn.close()

def archive_graduated_student(student_id, reason="Graduated"):
    conn = get_db()
    cursor = conn.cursor()
    key = f"student:{student_id}"
    
    cursor.execute("SELECT value FROM store WHERE key = ?", (key,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False, "Student not found in active records"

    student_data = json.loads(row[0])
    student_data["departureReason"] = reason
    student_data["departureDate"] = datetime.datetime.now().strftime("%Y-%m-%d")

    # Insert into graduated table and remove from active store
    cursor.execute("INSERT OR REPLACE INTO graduated (id, data, date) VALUES (?, ?, ?)", 
                   (student_id, json.dumps(student_data), student_data["departureDate"]))
    cursor.execute("DELETE FROM store WHERE key = ?", (key,))
    conn.commit()
    conn.close()

    log_activity(f"Student {student_data.get('Firstname')} {student_data.get('Lastname')} (ID: {student_id}) moved to Archives ({reason}).")
    return True, "Student successfully archived"