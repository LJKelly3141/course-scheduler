from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import AppSetting
from app.schemas.schemas import AppSettingRead, AppSettingWrite

router = APIRouter()

KNOWN_KEYS = {
    "export_directory": "",
    "github_repo_url": "",
    "department_name": "",
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


@router.get("/github-status", response_model=GitHubStatusResponse)
def github_status(db: Session = Depends(get_db)):
    """Check whether GitHub is configured (without exposing the token)."""
    repo_setting = db.query(AppSetting).filter(AppSetting.key == "github_repo_url").first()
    repo_url = repo_setting.value if repo_setting else ""
    token = _read_env_value("GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
    return GitHubStatusResponse(
        configured=bool(repo_url and token),
        repo_url=repo_url,
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
