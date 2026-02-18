from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import AppSetting
from app.schemas.schemas import AppSettingRead, AppSettingWrite

router = APIRouter()

KNOWN_KEYS = {
    "export_directory": "",
    "github_repo_url": "",
    "github_token": "",
    "department_name": "",
}


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
        setting = db.query(AppSetting).filter(AppSetting.key == item.key).first()
        if setting:
            setting.value = item.value
        else:
            setting = AppSetting(key=item.key, value=item.value)
            db.add(setting)
    db.commit()

    return list_settings(db)
