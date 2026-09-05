import os
import socket
import json
from storage import get_db, archive_graduated_student, log_activity
from auth import verify_teacher_access
from config import get_database_config


def start_database_server():
    config = get_database_config()
    host = os.environ.get("MZ_DB_HOST", config["host"])
    port = int(os.environ.get("MZ_DB_PORT", config["port"]))

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((host, port))
    server_socket.listen(10)

    print(f"[*] Custom SQLite-Backed RAM DB Server listening on {host}:{port}")

    while True:
        client_socket, client_address = server_socket.accept()
        try:
            raw_data = client_socket.recv(8192)
            if not raw_data:
                continue

            incoming_command = raw_data.decode('utf-8').strip()
            parts = incoming_command.split(" ", 2)
            action = parts[0]
            response = "UNKNOWN_COMMAND\n"

            conn = get_db()
            cursor = conn.cursor()

            if action == "NEXT_ID":
                cursor.execute("SELECT value FROM store WHERE key = 'config:last_student_id'")
                row = cursor.fetchone()
                last_id = int(row[0]) if row else 0
                next_id = last_id + 1
                formatted_id = f"{next_id:03d}"
                cursor.execute("INSERT OR REPLACE INTO store (key, value) VALUES ('config:last_student_id', ?)", (str(formatted_id),))
                conn.commit()
                response = f"stu{formatted_id}\n"

            elif action == "SECURE_SET":
                sub_part = incoming_command.split(" ", 4)
                passkey, subject, key, json_data = sub_part[1], sub_part[2], sub_part[3], sub_part[4]
                is_allowed, reason, _ = verify_teacher_access(passkey=passkey, target_subject=subject)
                if is_allowed:
                    cursor.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, json_data))
                    conn.commit()
                    log_activity(f"Teacher edited grades for subject '{subject}' on record {key}")
                    response = "OK\n"
                else:
                    response = f"ERROR: {reason}\n"

            elif action == "SET":
                key, json_data = parts[1], parts[2]
                cursor.execute("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)", (key, json_data))
                conn.commit()
                response = "OK\n"

            elif action == "GET":
                key = parts[1]
                cursor.execute("SELECT value FROM store WHERE key = ?", (key,))
                row = cursor.fetchone()
                response = f"{row[0]}\n" if row else "NULL\n"

            elif action == "DELETE":
                key = parts[1]
                cursor.execute("DELETE FROM store WHERE key = ?", (key,))
                if cursor.rowcount > 0:
                    conn.commit()
                    log_activity(f"Deleted record: {key}")
                    response = "OK\n"
                else:
                    response = "ERROR: Record not found\n"

            elif action == "KEYS":
                prefix = parts[1].replace("*", "%")
                cursor.execute("SELECT key FROM store WHERE key LIKE ?", (prefix,))
                matching_keys = [r[0] for r in cursor.fetchall()]
                response = ",".join(matching_keys) + "\n"

            elif action == "GRADUATE":
                sub_part = incoming_command.split(" ", 2)
                student_id = sub_part[1]
                reason = sub_part[2] if len(sub_part) > 2 else "Graduated"
                success, msg = archive_graduated_student(student_id, reason)
                response = f"OK: {msg}\n" if success else f"ERROR: {msg}\n"

            elif action == "LOG_ACTIVITY":
                log_text = parts[1] if len(parts) > 1 else "DB Admin action executed"
                log_activity(log_text)
                response = "OK\n"

            conn.close()
            client_socket.sendall(response.encode("utf-8"))

        except Exception as e:
            print(f"[-] Error handling client data: {e}")
        finally:
            client_socket.close()

if __name__ == '__main__':
    start_database_server()