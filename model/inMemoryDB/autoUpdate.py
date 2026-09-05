"""
Data Doctor Bot V2.0 - Auto-fill and normalize missing student fields

This script scans the `store` table for keys beginning with `student:` and
attempts to fill missing or invalid fields (Firstname, Lastname, age, Class,
department, residence, gender, assignedSubjects, history) using heuristics
based on the application schema in `studentDB.js`.
"""

import sqlite3
import json
import time
from storage import db_path

db_file = str(db_path)
print("Data Doctor Bot V2.0")
time.sleep(1)
print("Starting auto-update of student records...")

# Mirrors from Nodejs/model/studentDB.js
STUDENT_SUBJECTS = {
    "Not in senior class": [
        "Math", "English", "Lit-in-English", "Basic-Tech", "Basic-Science",
        "ICT", "Music", "French", "Yoruba", "Fine Art", "Civic Education", "National Security"
    ],
    "Science": [
        "Math", "English", "Biology", "Chemistry", "Agric", "DPR",
        "Physics", "Further Maths", "Food & Nuts", "Technical Drawing", "Civic Education", "Economics"
    ],
    "Art": [
        "Math", "English", "Government", "Dyeing & Bleaching", "Literature",
        "Food & Nuts", "CRS", "Civic Education", "Economics", "History"
    ],
    "Commercial": [
        "Math", "English", "Accounting", "Commerce", "Economics",
        "Civic Education", "Further Maths", "Food & Nuts", "DPR", "Agric"
    ]
}

STUDENT_SCHEMA = {
    "residence": ["Day", "Boarding"],
    "class": ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
    "department": ["Not in senior class", "Science", "Art", "Commercial"],
    "gender": ["Male", "Female", "Other"],
    "post": [
        "Senior Prefect Boy", "Senior Prefect Girl", "Assistant Senior Prefect Boy",
        "Assistant Senior Prefect Girl", "Chapel Prefect", "Food Prefect",
        "Labour Prefect", "Band Prefect", "Computer Lab Prefect", "Not a Prefect"
    ]
}

CLASS_AGE_MAP = {
    "JSS1": 11,
    "JSS2": 12,
    "JSS3": 13,
    "SS1": 14,
    "SS2": 15,
    "SS3": 16,
}

def infer_department_from_subjects(assigned):
    if not assigned:
        return "Not in senior class"
    titles = { (s.get('title') or '').strip() for s in assigned if isinstance(s, dict) }
    best = (None, 0)
    for dept, subjects in STUDENT_SUBJECTS.items():
        common = len(titles.intersection(set(subjects)))
        if common > best[1]:
            best = (dept, common)
    return best[0] or "Not in senior class"

def normalize_gender(g):
    if not g: return None
    s = str(g).strip().lower()
    if s.startswith('m'): return 'Male'
    if s.startswith('f'): return 'Female'
    if s in ('o','other'): return 'Other'
    return None

def normalize_residence(r):
    if not r: return None
    r_str = str(r).strip().title()
    return r_str if r_str in STUDENT_SCHEMA['residence'] else None

def normalize_class(c):
    if not c: return None
    c_str = str(c).strip().upper()
    # Accept 'JSS1' and 'Jss1' variants
    for valid in STUDENT_SCHEMA['class']:
        if c_str == valid.upper():
            return valid
    # Accept common short forms like 'JSS 1' or 'SS1'
    normalized = c_str.replace(' ', '')
    for valid in STUDENT_SCHEMA['class']:
        if normalized == valid.upper():
            return valid
    return None

def build_assigned_subjects(department):
    dept = department if department in STUDENT_SUBJECTS else 'Not in senior class'
    subjects = STUDENT_SUBJECTS.get(dept, STUDENT_SUBJECTS['Not in senior class'])
    return [{ 'title': t, 'examScore': 0, 'TestScore': 0 } for t in subjects]

def infer_age_from_class(c):
    if not c: return None
    return CLASS_AGE_MAP.get(c)

def safe_json_load(s):
    try:
        return json.loads(s)
    except Exception:
        return None

def process_student_record(key, raw_value):
    changed = False
    student = safe_json_load(raw_value) if isinstance(raw_value, str) else raw_value
    if not isinstance(student, dict):
        return False, None, 'invalid_json'

    # Firstname / Lastname - attempt to use name fields if present
    if not student.get('Firstname') and student.get('name'):
        student['Firstname'] = student.get('name')
        changed = True
    if not student.get('Lastname') and student.get('surname'):
        student['Lastname'] = student.get('surname')
        changed = True

    # Class normalization
    cls = normalize_class(student.get('Class'))
    if not cls and student.get('Class'):
        # sometimes 'Jss1' etc -> try casing
        cls = normalize_class(student.get('Class'))
    if cls and student.get('Class') != cls:
        student['Class'] = cls
        changed = True
    if not cls and student.get('Class') is None:
        # fallback: if department looks senior, pick SS1 else JSS1
        dep = student.get('department')
        if dep in ('Science', 'Art', 'Commercial'):
            student['Class'] = 'SS1'
        else:
            student['Class'] = 'JSS1'
        changed = True

    # Department inference from assignedSubjects
    dep = student.get('department')
    if not dep or dep not in STUDENT_SCHEMA['department']:
        inferred = infer_department_from_subjects(student.get('assignedSubjects'))
        if inferred and inferred != dep:
            student['department'] = inferred
            changed = True

    # Residence
    res = normalize_residence(student.get('residence'))
    if not res:
        student['residence'] = 'Day'
        changed = True
    else:
        if student.get('residence') != res:
            student['residence'] = res
            changed = True

    # Gender
    g = normalize_gender(student.get('gender'))
    if g and student.get('gender') != g:
        student['gender'] = g
        changed = True

    # Post
    post = student.get('post')
    if not post or post not in STUDENT_SCHEMA['post']:
        student['post'] = 'Not a Prefect'
        changed = True

    # assignedSubjects
    if not student.get('assignedSubjects') or not isinstance(student.get('assignedSubjects'), list) or len(student.get('assignedSubjects')) == 0:
        student['assignedSubjects'] = build_assigned_subjects(student.get('department'))
        changed = True

    # history
    if not student.get('history') or not isinstance(student.get('history'), dict):
        student['history'] = {}
        changed = True

    # Age inference
    try:
        age_val = student.get('age')
        if age_val is None or (isinstance(age_val, str) and not age_val.strip()):
            inferred_age = infer_age_from_class(student.get('Class'))
            if inferred_age:
                student['age'] = inferred_age
                changed = True
        else:
            # ensure numeric
            if isinstance(age_val, str) and age_val.isdigit():
                student['age'] = int(age_val)
                changed = True
            elif not isinstance(age_val, int):
                # leave as-is if cannot convert
                pass
    except Exception:
        pass

    return changed, student, None


def main():
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT key, value FROM store WHERE key LIKE 'student:%'")
        rows = cursor.fetchall()
        print(f"Found {len(rows)} student records to check...")

        updated = 0
        errors = 0
        for key, raw in rows:
            changed, new_obj, err = process_student_record(key, raw)
            if err:
                print(f"Skipping {key}: {err}")
                errors += 1
                continue
            if changed:
                try:
                    cursor.execute("UPDATE store SET value = ? WHERE key = ?", (json.dumps(new_obj), key))
                    updated += 1
                except Exception as e:
                    print(f"Failed to update {key}: {e}")
                    errors += 1

        conn.commit()
        print(f"Auto-update finished. Updated: {updated}, Errors: {errors}")

    except sqlite3.Error as e:
        print(f"DB Error: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == '__main__':
    main()