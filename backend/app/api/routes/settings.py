from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, engine
from app.models.settings import AppSetting
from app.schemas.schemas import AppSettingRead, AppSettingWrite

router = APIRouter()

KNOWN_KEYS = {
    "export_directory": "",
    "github_repo_url": "",
    "github_pages_url": "",
    "department_name": "",
    "academic_year_start_month": "7",
}

# --- .env file for secrets ---
_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


def _read_env_value(key: str) -> str:
    """Read a value from the .env file."""
    env_path = os.path.normpath(_ENV_PATH)
    if not os.path.isfile(env_path):
        return ""
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith(f"{key}="):
                return line[len(key) + 1:].strip().strip("'\"")
    return ""


def _write_env_value(key: str, value: str) -> None:
    """Write/update a value in the .env file."""
    env_path = os.path.normpath(_ENV_PATH)
    lines = []
    found = False
    if os.path.isfile(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.strip().startswith(f"{key}="):
                    lines.append(f"{key}={value}\n")
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.append(f"{key}={value}\n")
    with open(env_path, "w") as f:
        f.writelines(lines)


# --- Settings CRUD ---

@router.get("", response_model=List[AppSettingRead])
def list_settings(db: Session = Depends(get_db)):
    existing = {s.key: s.value for s in db.query(AppSetting).all()}
    result = []
    for key, default in KNOWN_KEYS.items():
        result.append(AppSettingRead(key=key, value=existing.get(key, default)))
    return result


@router.put("", response_model=List[AppSettingRead])
def update_settings(
    items: List[AppSettingWrite], db: Session = Depends(get_db)
):
    for item in items:
        if item.key not in KNOWN_KEYS:
            continue
        setting = db.query(AppSetting).filter(AppSetting.key == item.key).first()
        if setting:
            setting.value = item.value
        else:
            setting = AppSetting(key=item.key, value=item.value)
            db.add(setting)
    db.commit()

    return list_settings(db)


# --- Directory browser ---

class DirectoryEntry(BaseModel):
    name: str
    path: str
    is_dir: bool


class DirectoryListing(BaseModel):
    path: str
    parent: Optional[str] = None
    entries: List[DirectoryEntry]


@router.get("/browse-directories", response_model=DirectoryListing)
def browse_directories(path: str = Query(default="")):
    """List directories at the given path for the directory picker."""
    if not path:
        path = str(Path.home())
    path = os.path.expanduser(path)

    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")

    parent = str(Path(path).parent) if Path(path).parent != Path(path) else None

    entries = []
    try:
        for item in sorted(os.listdir(path)):
            if item.startswith("."):
                continue
            full = os.path.join(path, item)
            if os.path.isdir(full):
                entries.append(DirectoryEntry(name=item, path=full, is_dir=True))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return DirectoryListing(path=path, parent=parent, entries=entries)


class CreateDirectoryRequest(BaseModel):
    parent: str
    name: str


@router.post("/create-directory", response_model=DirectoryEntry)
def create_directory(payload: CreateDirectoryRequest):
    """Create a new subdirectory inside the given parent."""
    parent = os.path.expanduser(payload.parent)
    if not os.path.isdir(parent):
        raise HTTPException(status_code=400, detail=f"Parent is not a directory: {parent}")

    name = payload.name.strip()
    if not name or "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid folder name")

    full = os.path.join(parent, name)
    if os.path.exists(full):
        raise HTTPException(status_code=400, detail=f"'{name}' already exists")

    try:
        os.makedirs(full)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return DirectoryEntry(name=name, path=full, is_dir=True)


# --- GitHub setup ---

class GitHubSetupRequest(BaseModel):
    repo_url: str
    token: str


class GitHubSetupResponse(BaseModel):
    configured: bool
    repo_url: str


class GitHubStatusResponse(BaseModel):
    configured: bool
    repo_url: str
    pages_url: str


@router.get("/github-status", response_model=GitHubStatusResponse)
def github_status(db: Session = Depends(get_db)):
    """Check whether GitHub is configured (without exposing the token)."""
    repo_setting = db.query(AppSetting).filter(AppSetting.key == "github_repo_url").first()
    repo_url = repo_setting.value if repo_setting else ""
    pages_setting = db.query(AppSetting).filter(AppSetting.key == "github_pages_url").first()
    pages_url = pages_setting.value if pages_setting else ""
    token = _read_env_value("GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
    return GitHubStatusResponse(
        configured=bool(repo_url and token),
        repo_url=repo_url,
        pages_url=pages_url,
    )


@router.post("/github-setup", response_model=GitHubSetupResponse)
def github_setup(payload: GitHubSetupRequest, db: Session = Depends(get_db)):
    """Set up GitHub integration: save repo URL to DB, token to .env."""
    # Save repo URL to DB
    setting = db.query(AppSetting).filter(AppSetting.key == "github_repo_url").first()
    if setting:
        setting.value = payload.repo_url
    else:
        setting = AppSetting(key="github_repo_url", value=payload.repo_url)
        db.add(setting)
    db.commit()

    # Save token to .env file
    _write_env_value("GITHUB_TOKEN", payload.token)

    # Also set in current process env so it's available immediately
    os.environ["GITHUB_TOKEN"] = payload.token

    return GitHubSetupResponse(configured=True, repo_url=payload.repo_url)


# --- Database info & backup ---

class DatabaseInfoResponse(BaseModel):
    path: str
    size_bytes: int
    size_display: str


class DatabaseRelocateRequest(BaseModel):
    new_path: str
    copy_existing: bool = True


class DatabaseRelocateResponse(BaseModel):
    success: bool
    new_path: str
    copied: bool


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


@router.get("/database-info", response_model=DatabaseInfoResponse)
def database_info():
    """Return the database file path and size."""
    db_url = str(engine.url)
    # sqlite:///path -> path
    db_path = db_url.replace("sqlite:///", "")
    db_path = os.path.abspath(db_path)
    size = os.path.getsize(db_path) if os.path.isfile(db_path) else 0
    return DatabaseInfoResponse(
        path=db_path,
        size_bytes=size,
        size_display=_format_size(size),
    )


@router.get("/database-backup")
def database_backup():
    """Download a backup copy of the database (with WAL checkpoint)."""
    db_url = str(engine.url)
    db_path = db_url.replace("sqlite:///", "")
    db_path = os.path.abspath(db_path)
    if not os.path.isfile(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")

    # Checkpoint WAL to ensure backup is complete
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
    except Exception:
        pass  # Non-fatal: backup still works, just might not have latest WAL data

    return FileResponse(
        path=db_path,
        filename="scheduler-backup.db",
        media_type="application/octet-stream",
    )


@router.post("/database-relocate", response_model=DatabaseRelocateResponse)
def database_relocate(payload: DatabaseRelocateRequest):
    """Relocate the database to a new path. Requires app restart."""
    import json
    import shutil

    new_path = os.path.abspath(os.path.expanduser(payload.new_path))

    # Ensure new directory exists
    new_dir = os.path.dirname(new_path)
    if not os.path.isdir(new_dir):
        try:
            os.makedirs(new_dir, exist_ok=True)
        except OSError as e:
            raise HTTPException(status_code=400, detail=f"Cannot create directory: {e}")

    # Copy existing database if requested
    copied = False
    if payload.copy_existing:
        current_db = os.environ.get("DATABASE_PATH", "./scheduler.db")
        current_db = os.path.abspath(current_db)
        if os.path.isfile(current_db) and os.path.abspath(new_path) != current_db:
            try:
                shutil.copy2(current_db, new_path)
                copied = True
            except OSError as e:
                raise HTTPException(status_code=400, detail=f"Failed to copy database: {e}")

    # Update config.json
    config_path = os.environ.get("CONFIG_PATH", "")
    if config_path:
        config = {}
        if os.path.isfile(config_path):
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
            except (json.JSONDecodeError, OSError):
                config = {}
        config["databasePath"] = new_path
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

    return DatabaseRelocateResponse(
        success=True,
        new_path=new_path,
        copied=copied,
    )
