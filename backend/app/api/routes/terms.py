from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.routes.academic_years import auto_link_term_to_academic_year
from app.database import get_db
from app.models.dismissed_warning import DismissedWarning
from app.models.instructor import InstructorAvailability
from app.models.meeting import Meeting
from app.models.section import Section as SectionModel, SectionStatus
from app.models.term import Term
from app.models.term_session import TermSession
from app.schemas.schemas import (
    BatchDeleteRequest, TermCreate, TermRead, TermSessionCreate, TermSessionRead,
    TermUpdate, ValidationResult,
)
from app.services.availability_service import apply_templates_to_term
from app.services.term_validation import finalize_term, validate_term

# Default UWRF summer sessions: (name, week_offset, duration_weeks)
UWRF_SUMMER_SESSIONS = [
    ("1-3",   0, 3),
    ("1-6",   0, 6),
    ("1-9",   0, 9),
    ("1-13*", 0, 13),
    ("4-3",   3, 3),
    ("4-9",   3, 9),
    ("7-3",   6, 3),
    ("7-6",   6, 6),
    ("10-3",  9, 3),
]

router = APIRouter()


@router.get("", response_model=list[TermRead])
def list_terms(db: Session = Depends(get_db)):
    return db.query(Term).options(
        joinedload(Term.sessions),
        joinedload(Term.academic_year),
    ).all()


def _compute_session_dates(term_start: date, week_offset: int, duration_weeks: int):
    """Compute session start/end dates from term start date."""
    sess_start = term_start + timedelta(weeks=week_offset)
    sess_end = sess_start + timedelta(days=duration_weeks * 7 - 3)  # land on Friday
    return sess_start, sess_end


def _auto_create_sessions(db: Session, term: Term):
    """Create default UWRF summer sessions for a summer term."""
    for name, week_offset, duration_weeks in UWRF_SUMMER_SESSIONS:
        sess_start, sess_end = _compute_session_dates(
            term.start_date, week_offset, duration_weeks
        )
        db.add(TermSession(
            term_id=term.id,
            name=name,
            start_date=sess_start,
            end_date=sess_end,
        ))


@router.post("", response_model=TermRead, status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = Term(
        name=payload.name,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(term)
    db.flush()
    auto_link_term_to_academic_year(db, term)
    if payload.type == "summer":
        _auto_create_sessions(db, term)
    apply_templates_to_term(db, term)
    db.commit()
    db.refresh(term)
    return term


@router.get("/{term_id}", response_model=TermRead)
def get_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).options(
        joinedload(Term.sessions),
        joinedload(Term.academic_year),
    ).filter(Term.id == term_id).first()
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

    # Re-link to academic year if start_date changed
    if "start_date" in update_data:
        auto_link_term_to_academic_year(db, term)

    db.commit()
    db.refresh(term)
    return term


@router.post("/batch-delete", status_code=204)
def batch_delete_terms(payload: BatchDeleteRequest, db: Session = Depends(get_db)):
    terms = (
        db.query(Term)
        .options(
            joinedload(Term.sections).joinedload(SectionModel.meetings),
            joinedload(Term.instructor_availabilities),
            joinedload(Term.dismissed_warnings),
        )
        .filter(Term.id.in_(payload.ids))
        .all()
    )
    for term in terms:
        db.delete(term)
    db.commit()


@router.delete("/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    term = (
        db.query(Term)
        .options(
            joinedload(Term.sections).joinedload(SectionModel.meetings),
            joinedload(Term.instructor_availabilities),
            joinedload(Term.dismissed_warnings),
        )
        .filter(Term.id == term_id)
        .first()
    )
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


@router.post("/{term_id}/toggle-lock", response_model=TermRead)
def toggle_term_lock(term_id: int, db: Session = Depends(get_db)):
    """Toggle a term between draft and final status."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    from app.models.term import TermStatus
    term.status = TermStatus.draft if term.status == TermStatus.final else TermStatus.final
    db.commit()
    db.refresh(term)
    return term


# --- Term Sessions ---

@router.get("/{term_id}/sessions", response_model=list[TermSessionRead])
def list_term_sessions(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return db.query(TermSession).filter(TermSession.term_id == term_id).all()


@router.put("/{term_id}/sessions", response_model=list[TermSessionRead])
def upsert_term_sessions(
    term_id: int,
    payload: list[TermSessionCreate],
    db: Session = Depends(get_db),
):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    # Track which session names are in the payload
    incoming_names = set()
    for item in payload:
        incoming_names.add(item.name)
        existing = (
            db.query(TermSession)
            .filter(TermSession.term_id == term_id, TermSession.name == item.name)
            .first()
        )
        if existing:
            existing.start_date = item.start_date
            existing.end_date = item.end_date
            existing.head_count_days = item.head_count_days
            existing.head_count_date = item.head_count_date
            existing.notes = item.notes
        else:
            db.add(TermSession(
                term_id=term_id,
                name=item.name,
                start_date=item.start_date,
                end_date=item.end_date,
                head_count_days=item.head_count_days,
                head_count_date=item.head_count_date,
                notes=item.notes,
            ))

    # Delete sessions not in the payload (unless they have sections assigned)
    all_sessions = db.query(TermSession).filter(TermSession.term_id == term_id).all()
    for sess in all_sessions:
        if sess.name not in incoming_names:
            # Check if any sections reference this session
            ref_count = (
                db.query(SectionModel)
                .filter(SectionModel.term_session_id == sess.id)
                .count()
            )
            if ref_count == 0:
                db.delete(sess)

    db.commit()

    # Recompute section dates for sections in this term that reference sessions
    _recompute_term_section_dates(db, term_id)

    return db.query(TermSession).filter(TermSession.term_id == term_id).all()


@router.delete("/{term_id}/sessions/{session_id}", status_code=204)
def delete_term_session(term_id: int, session_id: int, db: Session = Depends(get_db)):
    sess = (
        db.query(TermSession)
        .filter(TermSession.id == session_id, TermSession.term_id == term_id)
        .first()
    )
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    # Clear term_session_id on any sections referencing this session
    db.query(SectionModel).filter(
        SectionModel.term_session_id == session_id
    ).update({"term_session_id": None})
    db.delete(sess)
    db.commit()


class SessionImportRequest(BaseModel):
    text: str
    mode: str = "merge"  # "replace" or "merge"


@router.post("/{term_id}/sessions/import", response_model=list[TermSessionRead])
def import_term_sessions(
    term_id: int,
    payload: SessionImportRequest,
    db: Session = Depends(get_db),
):
    """Parse pasted tab/comma-separated session table and upsert sessions."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    rows = _parse_session_table(payload.text)
    if not rows:
        raise HTTPException(status_code=422, detail="Could not parse any session rows")

    if payload.mode == "replace":
        # Unassign all sections from their sessions in this term
        db.query(SectionModel).filter(
            SectionModel.term_id == term_id,
            SectionModel.term_session_id.isnot(None),
        ).update({"term_session_id": None})
        # Delete all existing sessions for this term
        db.query(TermSession).filter(TermSession.term_id == term_id).delete()
        # Insert all parsed rows as new sessions
        for row in rows:
            db.add(TermSession(
                term_id=term_id,
                name=row["name"],
                start_date=row.get("start_date"),
                end_date=row.get("end_date"),
                head_count_days=row.get("head_count_days"),
                head_count_date=row.get("head_count_date"),
                notes=row.get("notes"),
            ))
    else:
        # Merge mode: match by name, update existing, add new
        for row in rows:
            existing = (
                db.query(TermSession)
                .filter(TermSession.term_id == term_id, TermSession.name == row["name"])
                .first()
            )
            if existing:
                if row.get("start_date"):
                    existing.start_date = row["start_date"]
                if row.get("end_date"):
                    existing.end_date = row["end_date"]
                if row.get("head_count_days") is not None:
                    existing.head_count_days = row["head_count_days"]
                if row.get("head_count_date"):
                    existing.head_count_date = row["head_count_date"]
                if row.get("notes"):
                    existing.notes = row["notes"]
            else:
                db.add(TermSession(
                    term_id=term_id,
                    name=row["name"],
                    start_date=row.get("start_date"),
                    end_date=row.get("end_date"),
                    head_count_days=row.get("head_count_days"),
                    head_count_date=row.get("head_count_date"),
                    notes=row.get("notes"),
                ))

    db.commit()
    _recompute_term_section_dates(db, term_id)
    return db.query(TermSession).filter(TermSession.term_id == term_id).all()


def _parse_session_table(text: str) -> list[dict]:
    """Parse a pasted table of session data.

    Expected columns (tab or comma separated):
    Session, Start Date, End Date, Head Count Days, Head Count Date, Notes
    """
    from datetime import datetime

    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    if not lines:
        return []

    # Detect delimiter
    first_line = lines[0]
    delimiter = "\t" if "\t" in first_line else ","

    # Check if first line looks like a header
    first_cells = [c.strip().lower() for c in first_line.split(delimiter)]
    has_header = any(kw in first_cells[0] for kw in ["session", "name", "sess"])
    data_lines = lines[1:] if has_header else lines

    results = []
    for line in data_lines:
        cells = [c.strip() for c in line.split(delimiter)]
        if not cells or not cells[0]:
            continue

        row: dict = {"name": cells[0]}

        def try_parse_date(val: str, year_hint: Optional[int] = None) -> Optional[date]:
            if not val:
                return None
            import re
            # Strip leading weekday prefix like "Tuesday, " or "Fri, "
            cleaned = re.sub(r"^[A-Za-z]+,\s*", "", val.strip())
            # Remove periods from abbreviated months (e.g. "Aug." -> "Aug")
            cleaned = re.sub(r"\.(?=\s|\d|$)", "", cleaned)
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y",
                         "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"):
                try:
                    return datetime.strptime(cleaned, fmt).date()
                except ValueError:
                    continue
            # Try without year (e.g. "May 28") — use year_hint or current year
            for fmt in ("%B %d", "%b %d"):
                try:
                    parsed = datetime.strptime(cleaned, fmt)
                    yr = year_hint or datetime.now().year
                    return parsed.replace(year=yr).date()
                except ValueError:
                    continue
            return None

        if len(cells) > 1:
            row["start_date"] = try_parse_date(cells[1])
        if len(cells) > 2:
            row["end_date"] = try_parse_date(cells[2])
        # Infer year from start_date for fields that may omit the year
        year_hint = row.get("start_date")
        year_hint = year_hint.year if year_hint else None
        if len(cells) > 3:
            try:
                row["head_count_days"] = int(cells[3]) if cells[3] else None
            except ValueError:
                row["head_count_days"] = None
        if len(cells) > 4:
            row["head_count_date"] = try_parse_date(cells[4], year_hint=year_hint)
        if len(cells) > 5:
            row["notes"] = cells[5] if cells[5] else None

        results.append(row)

    return results


def _recompute_term_section_dates(db: Session, term_id: int):
    """Recompute start/end dates for all sections with a term_session_id."""
    sessions_by_id = {
        ts.id: ts
        for ts in db.query(TermSession).filter(TermSession.term_id == term_id).all()
    }

    sections = (
        db.query(SectionModel)
        .filter(
            SectionModel.term_id == term_id,
            SectionModel.term_session_id.isnot(None),
        )
        .all()
    )
    for sec in sections:
        ts = sessions_by_id.get(sec.term_session_id)
        if ts and ts.start_date and ts.end_date:
            sec.start_date = ts.start_date
            sec.end_date = ts.end_date
        elif ts and ts.start_date and sec.duration_weeks:
            from app.services.session_dates import compute_session_end_date
            sec.start_date = ts.start_date
            sec.end_date = compute_session_end_date(ts.start_date, sec.duration_weeks)
        else:
            sec.start_date = None
            sec.end_date = None
    db.commit()


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

    # Copy term sessions and build old→new ID mapping
    src_sessions = db.query(TermSession).filter(TermSession.term_id == term_id).all()
    session_id_map: dict[int, int] = {}
    for src_sess in src_sessions:
        new_sess = TermSession(
            term_id=new_term.id,
            name=src_sess.name,
            start_date=src_sess.start_date,
            end_date=src_sess.end_date,
            head_count_days=src_sess.head_count_days,
            head_count_date=src_sess.head_count_date,
            notes=src_sess.notes,
        )
        db.add(new_sess)
        db.flush()
        session_id_map[src_sess.id] = new_sess.id

    for src_section in sections:
        new_session_id = session_id_map.get(src_section.term_session_id) if src_section.term_session_id else None
        new_section = SectionModel(
            course_id=src_section.course_id,
            term_id=new_term.id,
            section_number=src_section.section_number,
            enrollment_cap=src_section.enrollment_cap,
            modality=src_section.modality,
            session=src_section.session,
            term_session_id=new_session_id,
            instructor_id=src_section.instructor_id if payload.include_assignments else None,
            status=src_section.status if payload.include_assignments else SectionStatus.unscheduled,
            duration_weeks=src_section.duration_weeks,
            start_date=src_section.start_date,
            end_date=src_section.end_date,
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
