import json
import hashlib
from storage import get_db

def verify_teacher_access(passkey, target_subject):
    hashed_input = hashlib.sha256(str(passkey).encode('utf-8')).hexdigest()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM store WHERE key LIKE 'teacher:%'")
    teachers = cursor.fetchall()
    conn.close()

    for key, raw_val in teachers:
        try:
            teacher_data = json.loads(raw_val) if isinstance(raw_val, str) else raw_val
            db_passkey_hash = str(teacher_data.get("passkey") or "")
            
            if db_passkey_hash == hashed_input:
                assigned_subjects = teacher_data.get("subjects", [])
                
                if target_subject in assigned_subjects or "ALL" in assigned_subjects:
                    return True, teacher_data.get("name", "Teacher"), teacher_data.get("class", "ALL")
                else:
                    return False, f"UNAUTHORIZED: You are not authorized to edit {target_subject}", None
        except Exception:
            continue

    return False, "INVALID_PASSKEY", None