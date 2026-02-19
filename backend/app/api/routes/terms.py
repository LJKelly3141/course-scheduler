from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.dismissed_warning import DismissedWarning
from app.models.meeting import Meeting
from app.models.section import Section as SectionModel, SectionStatus
from app.models.term import Term
from app.schemas.schemas import BatchDeleteRequest, TermCreate, TermRead, TermUpdate, ValidationResult
from app.services.term_validation import finalize_term, validate_term

router = APIRouter()


@router.get("", response_model=list[TermRead])
def list_terms(db: Session = Depends(get_db)):
    return db.query(Term).all()


@router.post("", response_model=TermRead, status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = Term(
        name=payload.name,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.get("/{term_id}", response_model=TermRead)
def get_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return term


@router.put("/{term_id}", response_model=TermRead)
def update_term(term_id: int, payload: TermUpdate, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(term, field, value)

    db.commit()
    db.refresh(term)
    return term


@router.post("/batch-delete", status_code=204)
def batch_delete_terms(payload: BatchDeleteRequest, db: Session = Depends(get_db)):
    terms = db.query(Term).filter(Term.id.in_(payload.ids)).all()
    for term in terms:
        db.delete(term)
    db.commit()


@router.delete("/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(term)
    db.commit()


@router.get("/{term_id}/validate", response_model=ValidationResult)
def validate_term_endpoint(term_id: int, db: Session = Depends(get_db)):
    """
    Validate a term schedule by running hard conflict detection and
    soft warning detection.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return validate_term(db, term_id)


@router.post("/{term_id}/finalize", response_model=ValidationResult)
def finalize_term_endpoint(term_id: int, db: Session = Depends(get_db)):
    """
    Validate and finalize a term. If no hard conflicts exist, sets the
    term status to "final". Returns the validation result either way.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return finalize_term(db, term_id)


# --- Copy term ---

class TermCopyRequest(BaseModel):
    name: str
    type: str
    start_date: date
    end_date: date
    include_assignments: bool = True


@router.post("/{term_id}/copy", response_model=TermRead, status_code=201)
def copy_term(term_id: int, payload: TermCopyRequest, db: Session = Depends(get_db)):
    source = db.query(Term).filter(Term.id == term_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source term not found")

    # Load sections with their meetings
    sections = (
        db.query(SectionModel)
        .filter(SectionModel.term_id == term_id)
        .options(joinedload(SectionModel.meetings))
        .all()
    )

    new_term = Term(
        name=payload.name,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(new_term)
    db.flush()  # get new_term.id

    for src_section in sections:
        new_section = SectionModel(
            course_id=src_section.course_id,
            term_id=new_term.id,
            section_number=src_section.section_number,
            enrollment_cap=src_section.enrollment_cap,
            modality=src_section.modality,
            session=src_section.session,
            instructor_id=src_section.instructor_id if payload.include_assignments else None,
            status=src_section.status if payload.include_assignments else SectionStatus.unscheduled,
        )
        db.add(new_section)
        db.flush()  # get new_section.id

        for src_meeting in src_section.meetings:
            new_meeting = Meeting(
                section_id=new_section.id,
                days_of_week=src_meeting.days_of_week,
                start_time=src_meeting.start_time,
                end_time=src_meeting.end_time,
                time_block_id=src_meeting.time_block_id,
                room_id=src_meeting.room_id if payload.include_assignments else None,
                instructor_id=src_meeting.instructor_id if payload.include_assignments else None,
            )
            db.add(new_meeting)

    db.commit()
    db.refresh(new_term)
    return new_term


# --- Dismissed warnings ---

class DismissWarningRequest(BaseModel):
    warning_key: str


@router.get("/{term_id}/dismissed-warnings", response_model=List[str])
def list_dismissed_warnings(term_id: int, db: Session = Depends(get_db)):
    rows = db.query(DismissedWarning).filter(DismissedWarning.term_id == term_id).all()
    return [r.warning_key for r in rows]


@router.post("/{term_id}/dismissed-warnings", status_code=201)
def dismiss_warning(term_id: int, payload: DismissWarningRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(DismissedWarning)
        .filter(DismissedWarning.term_id == term_id, DismissedWarning.warning_key == payload.warning_key)
        .first()
    )
    if not existing:
        db.add(DismissedWarning(term_id=term_id, warning_key=payload.warning_key))
        db.commit()
    return {"ok": True}


@router.delete("/{term_id}/dismissed-warnings/{warning_key}", status_code=204)
def undismiss_warning(term_id: int, warning_key: str, db: Session = Depends(get_db)):
    db.query(DismissedWarning).filter(
        DismissedWarning.term_id == term_id, DismissedWarning.warning_key == warning_key
    ).delete()
    db.commit()
