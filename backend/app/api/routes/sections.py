from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.meeting import Meeting
from app.models.section import Section
from app.models.term import Term, TermStatus
from app.models.term_session import TermSession
from app.schemas.schemas import (
    SectionCreate,
    SectionReadWithCourse,
    SectionUpdate,
)
from app.services.session_dates import compute_session_end_date

router = APIRouter()


@router.get("", response_model=list[SectionReadWithCourse])
def list_sections(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    sections = (
        db.query(Section)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.term_session),
        )
        .filter(Section.term_id == term_id)
        .all()
    )
    return sections


def _require_draft_term(db: Session, term_id: int):
    """Raise 409 if the term is locked (final)."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if term and term.status == TermStatus.final:
        raise HTTPException(status_code=409, detail="Term is locked (final). Unlock it to make changes.")


def _compute_section_dates(db: Session, section: Section):
    """Set start_date/end_date on a section based on its term_session_id or legacy session field."""
    # New path: use term_session_id directly
    if section.term_session_id:
        ts = db.query(TermSession).filter(TermSession.id == section.term_session_id).first()
        if ts:
            if ts.start_date and ts.end_date:
                section.start_date = ts.start_date
                section.end_date = ts.end_date
                return
            elif ts.start_date and section.duration_weeks:
                section.start_date = ts.start_date
                section.end_date = compute_session_end_date(ts.start_date, section.duration_weeks)
                return

    # Legacy fallback: use session enum
    _SESSION_NAME_MAP = {"session_a": "A", "session_b": "B", "session_c": "C", "session_d": "D"}
    sess_name = _SESSION_NAME_MAP.get(section.session)
    if sess_name and section.duration_weeks:
        ts = (
            db.query(TermSession)
            .filter(TermSession.term_id == section.term_id, TermSession.name == sess_name)
            .first()
        )
        if ts and ts.start_date:
            section.start_date = ts.start_date
            if ts.end_date:
                section.end_date = ts.end_date
            else:
                section.end_date = compute_session_end_date(ts.start_date, section.duration_weeks)
            return

    # Clear dates if no session or duration
    section.start_date = None
    section.end_date = None


@router.post("", response_model=SectionReadWithCourse, status_code=201)
def create_section(payload: SectionCreate, db: Session = Depends(get_db)):
    _require_draft_term(db, payload.term_id)
    section = Section(
        course_id=payload.course_id,
        term_id=payload.term_id,
        section_number=payload.section_number,
        enrollment_cap=payload.enrollment_cap,
        modality=payload.modality,
        session=payload.session,
        term_session_id=payload.term_session_id,
        instructor_id=payload.instructor_id,
        duration_weeks=payload.duration_weeks,
        lecture_hours=payload.lecture_hours,
        special_course_fee=payload.special_course_fee,
        notes=payload.notes,
    )
    _compute_section_dates(db, section)
    db.add(section)
    db.commit()
    db.refresh(section)
    # Re-query with eager load for course and instructor in response
    section = (
        db.query(Section)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.term_session),
        )
        .filter(Section.id == section.id)
        .first()
    )
    return section


@router.get("/{section_id}", response_model=SectionReadWithCourse)
def get_section(section_id: int, db: Session = Depends(get_db)):
    section = (
        db.query(Section)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.term_session),
        )
        .filter(Section.id == section_id)
        .first()
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.put("/{section_id}", response_model=SectionReadWithCourse)
def update_section(
    section_id: int, payload: SectionUpdate, db: Session = Depends(get_db)
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    _require_draft_term(db, section.term_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(section, field, value)

    # When modality changes to online_async, remove all meetings and mark scheduled
    if update_data.get("modality") == "online_async":
        db.query(Meeting).filter(Meeting.section_id == section_id).delete()
        section.status = "scheduled"

    # Recompute dates if session or duration changed
    if "term_session_id" in update_data or "session" in update_data or "duration_weeks" in update_data:
        _compute_section_dates(db, section)

    db.commit()
    # Re-query with eager load for course and instructor in response
    section = (
        db.query(Section)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.term_session),
        )
        .filter(Section.id == section_id)
        .first()
    )
    return section


@router.delete("/{section_id}", status_code=204)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    _require_draft_term(db, section.term_id)

    db.delete(section)
    db.commit()
