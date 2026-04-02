"""
Course rotation plan: CRUD for planned offering patterns + apply-to-term.
"""
from __future__ import annotations

import datetime
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.course import Course
from app.models.course_rotation import CourseRotation, YearParity, RotationSemester
from app.models.instructor import Instructor
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section, SectionStatus
from app.models.term import Term
from app.models.time_block import TimeBlock

router = APIRouter()


# ── Schemas ──

class RotationEntryCreate(BaseModel):
    course_id: int
    semester: str  # fall, spring, summer, winter
    year_parity: str = "every_year"  # every_year, even_years, odd_years
    num_sections: int = 1
    enrollment_cap: int = 30
    modality: str = "in_person"
    time_block_id: Optional[int] = None
    days_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None
    instructor_id: Optional[int] = None
    room_id: Optional[int] = None
    session: Optional[str] = None


class RotationEntryUpdate(BaseModel):
    semester: Optional[str] = None
    year_parity: Optional[str] = None
    num_sections: Optional[int] = None
    enrollment_cap: Optional[int] = None
    modality: Optional[str] = None
    time_block_id: Optional[int] = None
    days_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None
    instructor_id: Optional[int] = None
    room_id: Optional[int] = None
    session: Optional[str] = None


class ApplyRotationRequest(BaseModel):
    term_id: int


def _parse_time(t: Optional[str]) -> Optional[datetime.time]:
    if not t:
        return None
    try:
        parts = t.split(":")
        return datetime.time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    except (ValueError, IndexError):
        return None


def _time_str(t) -> Optional[str]:
    if t is None:
        return None
    if hasattr(t, 'strftime'):
        return t.strftime("%H:%M:%S")
    return str(t)


# ── CRUD ──

@router.get("")
def list_rotation_entries(
    department: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all rotation entries, optionally filtered by department/semester."""
    query = (
        db.query(CourseRotation)
        .join(Course, CourseRotation.course_id == Course.id)
        .options(
            joinedload(CourseRotation.course),
            joinedload(CourseRotation.time_block),
            joinedload(CourseRotation.instructor),
            joinedload(CourseRotation.room).joinedload(Room.building),
        )
    )
    if department:
        query = query.filter(Course.department_code == department)
    if semester:
        query = query.filter(CourseRotation.semester == semester)

    entries = query.order_by(
        Course.department_code, Course.course_number, CourseRotation.semester
    ).all()

    return [_serialize(e) for e in entries]


@router.post("", status_code=201)
def create_rotation_entry(body: RotationEntryCreate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == body.course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")

    try:
        sem = RotationSemester(body.semester)
    except ValueError:
        raise HTTPException(400, f"Invalid semester: {body.semester}")
    try:
        parity = YearParity(body.year_parity)
    except ValueError:
        raise HTTPException(400, f"Invalid year_parity: {body.year_parity}")

    entry = CourseRotation(
        course_id=body.course_id,
        semester=sem,
        year_parity=parity,
        num_sections=body.num_sections,
        enrollment_cap=body.enrollment_cap,
        modality=body.modality,
        time_block_id=body.time_block_id,
        days_of_week=body.days_of_week,
        start_time=_parse_time(body.start_time),
        end_time=_parse_time(body.end_time),
        notes=body.notes,
        instructor_id=body.instructor_id,
        room_id=body.room_id,
        session=body.session,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.course  # trigger lazy load
    return _serialize(entry)


@router.put("/{entry_id}")
def update_rotation_entry(
    entry_id: int,
    body: RotationEntryUpdate,
    db: Session = Depends(get_db),
):
    entry = db.query(CourseRotation).filter(CourseRotation.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Rotation entry not found")

    if body.semester is not None:
        try:
            entry.semester = RotationSemester(body.semester)
        except ValueError:
            raise HTTPException(400, f"Invalid semester: {body.semester}")
    if body.year_parity is not None:
        try:
            entry.year_parity = YearParity(body.year_parity)
        except ValueError:
            raise HTTPException(400, f"Invalid year_parity: {body.year_parity}")
    if body.num_sections is not None:
        entry.num_sections = body.num_sections
    if body.enrollment_cap is not None:
        entry.enrollment_cap = body.enrollment_cap
    if body.modality is not None:
        entry.modality = body.modality
    if body.time_block_id is not None:
        entry.time_block_id = body.time_block_id if body.time_block_id != 0 else None
    if body.days_of_week is not None:
        entry.days_of_week = body.days_of_week or None
    if body.start_time is not None:
        entry.start_time = _parse_time(body.start_time)
    if body.end_time is not None:
        entry.end_time = _parse_time(body.end_time)
    if body.notes is not None:
        entry.notes = body.notes
    if body.instructor_id is not None:
        entry.instructor_id = body.instructor_id if body.instructor_id != 0 else None
    if body.room_id is not None:
        entry.room_id = body.room_id if body.room_id != 0 else None
    if body.session is not None:
        entry.session = body.session or None

    db.commit()
    db.refresh(entry)
    return _serialize(entry)


@router.delete("/{entry_id}")
def delete_rotation_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(CourseRotation).filter(CourseRotation.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Rotation entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.post("/batch", status_code=201)
def batch_set_rotation(
    entries: List[RotationEntryCreate],
    db: Session = Depends(get_db),
):
    """Replace all rotation entries for the given courses with new ones."""
    course_ids = {e.course_id for e in entries}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}
    for cid in course_ids:
        if cid not in course_map:
            raise HTTPException(404, f"Course {cid} not found")

    # Delete existing entries for these courses
    db.query(CourseRotation).filter(
        CourseRotation.course_id.in_(course_ids)
    ).delete(synchronize_session="fetch")

    # Insert new entries
    created = []
    for e in entries:
        try:
            sem = RotationSemester(e.semester)
        except ValueError:
            raise HTTPException(400, f"Invalid semester: {e.semester}")
        try:
            parity = YearParity(e.year_parity)
        except ValueError:
            raise HTTPException(400, f"Invalid year_parity: {e.year_parity}")

        entry = CourseRotation(
            course_id=e.course_id,
            semester=sem,
            year_parity=parity,
            num_sections=e.num_sections,
            enrollment_cap=e.enrollment_cap,
            modality=e.modality,
            time_block_id=e.time_block_id,
            days_of_week=e.days_of_week,
            start_time=_parse_time(e.start_time),
            end_time=_parse_time(e.end_time),
            notes=e.notes,
            instructor_id=e.instructor_id,
            room_id=e.room_id,
            session=e.session,
        )
        db.add(entry)
        created.append(entry)

    db.commit()
    for e in created:
        db.refresh(e)
    return [_serialize(e) for e in created]


# ── Apply rotation to term ──

@router.post("/apply")
def apply_rotation_to_term(
    body: ApplyRotationRequest,
    db: Session = Depends(get_db),
):
    """
    Create sections (and meetings if time blocks are specified) in the target
    term based on the rotation plan.
    """
    term = db.query(Term).filter(Term.id == body.term_id).first()
    if not term:
        raise HTTPException(404, "Term not found")
    if term.status == "final":
        raise HTTPException(400, "Cannot modify a finalized term")

    sem_map = {"fall": "fall", "spring": "spring", "summer": "summer", "winter": "winter"}
    term_semester = sem_map.get(term.type, "fall")

    year = term.start_date.year if hasattr(term.start_date, 'year') else int(str(term.start_date)[:4])
    is_even = year % 2 == 0

    matching_entries = (
        db.query(CourseRotation)
        .options(joinedload(CourseRotation.time_block))
        .filter(CourseRotation.semester == term_semester)
        .all()
    )

    applicable = []
    for entry in matching_entries:
        if entry.year_parity == YearParity.every_year:
            applicable.append(entry)
        elif entry.year_parity == YearParity.even_years and is_even:
            applicable.append(entry)
        elif entry.year_parity == YearParity.odd_years and not is_even:
            applicable.append(entry)

    # Get existing sections in this term, grouped by course+modality
    existing = db.query(Section).filter(Section.term_id == term.id).all()
    existing_by_course_modality: dict[tuple[int, str], int] = {}
    existing_by_course_total: dict[int, int] = {}
    for s in existing:
        key = (s.course_id, s.modality)
        existing_by_course_modality[key] = existing_by_course_modality.get(key, 0) + 1
        existing_by_course_total[s.course_id] = existing_by_course_total.get(s.course_id, 0) + 1

    created_sections: list[dict] = []
    meetings_created = 0

    for entry in applicable:
        modality_val = entry.modality or "in_person"
        current_count = existing_by_course_modality.get((entry.course_id, modality_val), 0)
        needed = entry.num_sections - current_count
        if needed <= 0:
            continue

        course = db.query(Course).filter(Course.id == entry.course_id).first()
        if not course:
            continue

        total_for_course = existing_by_course_total.get(entry.course_id, 0)
        already_created_for_course = sum(
            1 for c in created_sections
            if c["course"] == f"{course.department_code} {course.course_number}"
        )

        # Resolve time info: prefer time_block, fall back to custom days/times
        tb = entry.time_block
        meeting_days = None
        meeting_start = None
        meeting_end = None
        meeting_tb_id = None

        if tb:
            meeting_tb_id = tb.id
            meeting_days = tb.days_of_week
            meeting_start = tb.start_time
            meeting_end = tb.end_time
        elif entry.days_of_week and entry.start_time and entry.end_time:
            meeting_days = entry.days_of_week
            meeting_start = entry.start_time
            meeting_end = entry.end_time

        has_meeting_info = meeting_days is not None

        for i in range(needed):
            section_number = str(total_for_course + already_created_for_course + i + 1).zfill(2)
            section = Section(
                course_id=entry.course_id,
                term_id=term.id,
                section_number=section_number,
                enrollment_cap=entry.enrollment_cap,
                modality=modality_val,
                session="regular",
                status=SectionStatus.scheduled if has_meeting_info else SectionStatus.unscheduled,
            )
            db.add(section)
            db.flush()  # get section.id for meeting FK

            # Create meeting if time info is available
            if has_meeting_info:
                meeting = Meeting(
                    section_id=section.id,
                    days_of_week=meeting_days,
                    start_time=meeting_start,
                    end_time=meeting_end,
                    time_block_id=meeting_tb_id,
                )
                db.add(meeting)
                meetings_created += 1

            time_label = ""
            if tb:
                time_label = tb.label
            elif meeting_days:
                time_label = f"{meeting_days} {_time_str(meeting_start)}-{_time_str(meeting_end)}"

            created_sections.append({
                "course": f"{course.department_code} {course.course_number}",
                "section_number": section_number,
                "enrollment_cap": entry.enrollment_cap,
                "modality": modality_val,
                "time": time_label,
            })

    db.commit()

    return {
        "term_id": term.id,
        "term_name": term.name,
        "entries_matched": len(applicable),
        "sections_created": len(created_sections),
        "meetings_created": meetings_created,
        "details": created_sections,
    }


# ── Extract rotation from existing term ──

@router.get("/from-term/{term_id}")
def extract_rotation_from_term(term_id: int, db: Session = Depends(get_db)):
    """
    Analyze an existing term's sections/meetings and return proposed rotation
    entries.  Groups sections by (course, modality, time_block) and returns
    one entry per group with the section count and most-common enrollment cap.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(404, "Term not found")

    sem_map = {"fall": "fall", "spring": "spring", "summer": "summer", "winter": "winter"}
    term_semester = sem_map.get(term.type, "fall")

    sections = (
        db.query(Section)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
        )
        .all()
    )

    # For each section, find its first meeting to get time block, room, instructor info
    section_ids = [s.id for s in sections]
    meetings = (
        db.query(Meeting)
        .filter(Meeting.section_id.in_(section_ids))
        .options(
            joinedload(Meeting.time_block),
            joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Meeting.instructor),
        )
        .all()
    ) if section_ids else []

    meeting_by_section: dict[int, Meeting] = {}
    for m in meetings:
        if m.section_id not in meeting_by_section:
            meeting_by_section[m.section_id] = m

    # Preload instructor lookup for adjunct detection
    instructor_ids = set()
    for s in sections:
        if s.instructor_id:
            instructor_ids.add(s.instructor_id)
    for m in meetings:
        if m.instructor_id:
            instructor_ids.add(m.instructor_id)
    instructors_map: dict[int, Instructor] = {}
    if instructor_ids:
        for inst in db.query(Instructor).filter(Instructor.id.in_(instructor_ids)).all():
            instructors_map[inst.id] = inst

    def _resolve_instructor(inst_id):
        """Return (id, name) for faculty; (None, None) for adjunct/unknown."""
        if not inst_id:
            return None, None
        inst = instructors_map.get(inst_id)
        if not inst:
            return None, None
        is_adjunct = (
            (inst.instructor_type or "").lower() == "adjunct"
            or (getattr(inst, "rank", None) or "").lower() == "adjunct_instructor"
        )
        if is_adjunct:
            return None, None
        return inst.id, inst.name

    # Group by (course_id, modality, session, instructor_id, time_block_id, room_id)
    # to preserve all meaningful distinctions between sections
    groups: dict[tuple, list] = {}
    for s in sections:
        meeting = meeting_by_section.get(s.id)
        tb_id = meeting.time_block_id if meeting else None
        room_id = meeting.room_id if meeting else None
        # Resolve instructor: prefer section-level, then meeting-level
        inst_id = s.instructor_id
        if not inst_id and meeting:
            inst_id = meeting.instructor_id
        resolved_inst_id, _ = _resolve_instructor(inst_id)
        session_val = s.session if s.session else "regular"

        key = (s.course_id, s.modality, session_val, resolved_inst_id, tb_id, room_id)
        if key not in groups:
            groups[key] = []
        groups[key].append(s)

    results = []
    for (course_id, modality, session_val, resolved_inst_id, tb_id, room_id), group_sections in groups.items():
        course = group_sections[0].course
        if not course:
            continue

        # Most common enrollment cap in this group
        caps = [s.enrollment_cap for s in group_sections]
        cap = max(set(caps), key=caps.count) if caps else 30

        # Time block info
        tb_label = None
        days = None
        start = None
        end = None
        if tb_id:
            sample_meeting = meeting_by_section.get(group_sections[0].id)
            if sample_meeting and sample_meeting.time_block:
                tb = sample_meeting.time_block
                tb_label = tb.label
                days = tb.days_of_week
                start = _time_str(tb.start_time)
                end = _time_str(tb.end_time)
        elif group_sections[0].id in meeting_by_section:
            m = meeting_by_section[group_sections[0].id]
            days = m.days_of_week
            start = _time_str(m.start_time)
            end = _time_str(m.end_time)

        # Instructor name
        resolved_instructor_name = None
        if resolved_inst_id:
            inst = instructors_map.get(resolved_inst_id)
            if inst:
                resolved_instructor_name = inst.name

        # Room info
        resolved_room_label = None
        if room_id:
            sample_m = meeting_by_section.get(group_sections[0].id)
            if sample_m and sample_m.room:
                room = sample_m.room
                bldg = room.building
                resolved_room_label = f"{bldg.abbreviation} {room.room_number}" if bldg else room.room_number

        results.append({
            "course_id": course_id,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "title": course.title,
            "credits": course.credits,
            "semester": term_semester,
            "year_parity": "every_year",
            "num_sections": len(group_sections),
            "enrollment_cap": cap,
            "modality": modality if isinstance(modality, str) else (modality.value if hasattr(modality, 'value') else str(modality)),
            "time_block_id": tb_id,
            "time_block_label": tb_label,
            "days_of_week": days,
            "start_time": start,
            "end_time": end,
            "notes": None,
            "instructor_id": resolved_inst_id,
            "instructor_name": resolved_instructor_name,
            "room_id": room_id,
            "room_label": resolved_room_label,
            "session": session_val if session_val != "regular" else None,
        })

    results.sort(key=lambda r: (r["department_code"], r["course_number"], r["modality"], r["session"] or ""))
    return {
        "term_id": term.id,
        "term_name": term.name,
        "semester": term_semester,
        "entries": results,
    }


# ── Helpers ──

def _serialize(entry: CourseRotation) -> dict:
    course = entry.course
    tb = entry.time_block
    inst = entry.instructor
    room = entry.room
    return {
        "id": entry.id,
        "course_id": entry.course_id,
        "department_code": course.department_code if course else "",
        "course_number": course.course_number if course else "",
        "title": course.title if course else "",
        "credits": course.credits if course else 0,
        "semester": entry.semester.value if hasattr(entry.semester, 'value') else str(entry.semester),
        "year_parity": entry.year_parity.value if hasattr(entry.year_parity, 'value') else str(entry.year_parity),
        "num_sections": entry.num_sections,
        "enrollment_cap": entry.enrollment_cap,
        "modality": entry.modality,
        "time_block_id": entry.time_block_id,
        "time_block_label": tb.label if tb else None,
        "days_of_week": entry.days_of_week,
        "start_time": _time_str(entry.start_time),
        "end_time": _time_str(entry.end_time),
        "notes": entry.notes,
        "instructor_id": entry.instructor_id,
        "instructor_name": inst.name if inst else None,
        "room_id": entry.room_id,
        "room_label": f"{room.building.abbreviation} {room.room_number}" if room and room.building else (room.room_number if room else None),
        "session": entry.session,
    }
