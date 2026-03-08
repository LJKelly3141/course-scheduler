from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.academic_year import AcademicYear
from app.models.settings import AppSetting
from app.models.term import Term
from app.schemas.schemas import AcademicYearCreate, AcademicYearRead

router = APIRouter()


def _get_start_month(db: Session) -> int:
    """Get the configured academic year start month (default: 7 = July)."""
    setting = db.query(AppSetting).filter(AppSetting.key == "academic_year_start_month").first()
    if setting:
        try:
            month = int(setting.value)
            if 1 <= month <= 12:
                return month
        except ValueError:
            pass
    return 7


def get_or_create_academic_year(db: Session, d: date) -> AcademicYear:
    """Given a date, find or create the academic year it falls in.

    Uses the configured start month (default July). A date in July 2025
    with start_month=7 belongs to "2025-2026".
    """
    start_month = _get_start_month(db)

    if d.month >= start_month:
        start_year = d.year
    else:
        start_year = d.year - 1

    end_year = start_year + 1
    label = f"{start_year}-{end_year}"

    existing = db.query(AcademicYear).filter(AcademicYear.label == label).first()
    if existing:
        return existing

    start_date = date(start_year, start_month, 1)
    # End date is the last day of the month before start_month in end_year
    if start_month == 1:
        end_date = date(start_year, 12, 31)
    else:
        end_date = date(end_year, start_month, 1) - __import__("datetime").timedelta(days=1)

    ay = AcademicYear(
        label=label,
        start_date=start_date,
        end_date=end_date,
        is_current=False,
    )
    db.add(ay)
    db.flush()
    return ay


def auto_link_term_to_academic_year(db: Session, term: Term) -> None:
    """Set a term's academic_year_id based on its start_date."""
    if term.start_date:
        ay = get_or_create_academic_year(db, term.start_date)
        term.academic_year_id = ay.id


def update_current_academic_year(db: Session) -> None:
    """Mark the academic year containing today as current."""
    today = date.today()
    current = get_or_create_academic_year(db, today)

    # Clear all is_current flags, then set the right one
    db.query(AcademicYear).filter(AcademicYear.is_current == True).update(
        {"is_current": False}, synchronize_session=False
    )
    current.is_current = True


@router.get("", response_model=List[AcademicYearRead])
def list_academic_years(db: Session = Depends(get_db)):
    return (
        db.query(AcademicYear)
        .order_by(AcademicYear.start_date.desc())
        .all()
    )


@router.post("", response_model=AcademicYearRead, status_code=201)
def create_academic_year(payload: AcademicYearCreate, db: Session = Depends(get_db)):
    existing = db.query(AcademicYear).filter(AcademicYear.label == payload.label).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Academic year '{payload.label}' already exists")

    if payload.is_current:
        db.query(AcademicYear).filter(AcademicYear.is_current == True).update(
            {"is_current": False}, synchronize_session=False
        )

    ay = AcademicYear(
        label=payload.label,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_current=payload.is_current,
    )
    db.add(ay)
    db.commit()
    db.refresh(ay)
    return ay


@router.get("/current", response_model=Optional[AcademicYearRead])
def get_current_academic_year(db: Session = Depends(get_db)):
    update_current_academic_year(db)
    db.commit()
    current = db.query(AcademicYear).filter(AcademicYear.is_current == True).first()
    return current


@router.get("/{academic_year_id}", response_model=AcademicYearRead)
def get_academic_year(academic_year_id: int, db: Session = Depends(get_db)):
    ay = db.query(AcademicYear).filter(AcademicYear.id == academic_year_id).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic year not found")
    return ay
