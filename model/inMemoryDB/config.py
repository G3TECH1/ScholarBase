import os
from pathlib import Path

APP_MODE = os.environ.get("MZ_APP_MODE", "desktop").lower()
DB_FILE = os.environ.get("MZ_DB_FILE", "database_dump.json")
GRADUATED_FILE = os.environ.get("MZ_GRADUATED_FILE", "graduated_students.json")
DB_HOST = os.environ.get("MZ_DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("MZ_DB_PORT", "31109"))


def get_secure_db_path(filename=DB_FILE):
    env_path = os.environ.get("MZ_DATA_ROOT")
    if env_path:
        try:
            root = Path(env_path)
            root.mkdir(parents=True, exist_ok=True)
            return root / filename
        except Exception:
            pass

    if APP_MODE == "web":
        root = Path(os.environ.get("MZ_WEB_DATA_ROOT") or "/var/lib/scholarbase")
        try:
            root.mkdir(parents=True, exist_ok=True)
            return root / filename
        except Exception:
            pass

    app_data_path = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or os.environ.get("USERPROFILE")
    if app_data_path:
        try:
            folder_path = Path(app_data_path) / "ScholarBase DBMS"
            folder_path.mkdir(parents=True, exist_ok=True)
            return folder_path / filename
        except PermissionError:
            pass

    return Path(filename)


def get_database_config():
    return {
        "mode": APP_MODE,
        "host": DB_HOST,
        "port": DB_PORT,
        "db_file": str(get_secure_db_path(DB_FILE)),
        "graduated_file": str(get_secure_db_path(GRADUATED_FILE)),
    }


file_path = get_secure_db_path(DB_FILE)
graduated_file_path = get_secure_db_path(GRADUATED_FILE)
