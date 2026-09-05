import json
from storage import get_db
from config import file_path

if file_path.exists():
    with open(file_path, "r") as f:
        old_data = json.load(f)
    conn = get_db()
    cursor = conn.cursor()
    for key, val in old_data.items():
        str_val = json.dumps(val) if isinstance(val, (dict, list)) else str(val)
        cursor.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, str_val))
    conn.commit()
    conn.close()
    print("[+] Migrated existing JSON records into schools.db successfully!")