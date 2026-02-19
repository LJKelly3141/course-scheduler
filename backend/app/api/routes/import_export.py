from __future__ import annotations

import csv
import io
import json
from datetime import time as dt_time
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.building import Building
from app.models.room import Room
from app.models.instructor import Instructor, ModalityConstraint
from app.models.course import Course
from app.models.section import Section, Modality, SectionStatus
from app.models.meeting import Meeting
from app.models.time_block import TimeBlock
from app.models.term import Term
from app.schemas.schemas import ImportPreview, ImportResult, ScheduleImportPreview
from app.services.export import export_term_csv, export_print_html
from app.services.xlsx_schedule_parser import (
    read_xlsx_schedule,
    match_time_block,
    find_instructor_matches,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _read_csv(contents: bytes) -> list[dict]:
    """Decode uploaded bytes and parse as CSV, returning a list of row dicts."""
    text = contents.decode("utf-8-sig")  # handles BOM if present
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def _validate_columns(rows: list[dict], expected: list[str]) -> list[str]:
    """Check that all expected columns are present. Returns a list of error strings."""
    if not rows:
        return ["CSV file is empty or has no data rows"]
    actual = set(rows[0].keys())
    missing = [col for col in expected if col not in actual]
    if missing:
        return [f"Missing required columns: {', '.join(missing)}"]
    return []


# ---------------------------------------------------------------------------
# POST /import/rooms
# ---------------------------------------------------------------------------
ROOM_COLUMNS = ["building_name", "building_abbreviation", "room_number", "capacity"]


def _validate_room_rows(rows: list[dict]) -> tuple[list[dict], list[str]]:
    """Validate room rows. Returns (valid_rows, errors)."""
    errors = _validate_columns(rows, ROOM_COLUMNS)
    if errors:
        return [], errors

    valid_rows: list[dict] = []
    for i, row in enumerate(rows, start=2):  # row 1 is header
        row_errors: list[str] = []
        building_name = row.get("building_name", "").strip()
        building_abbr = row.get("building_abbreviation", "").strip()
        room_number = row.get("room_number", "").strip()
        capacity_str = row.get("capacity", "").strip()

        if not building_name:
            row_errors.append(f"Row {i}: building_name is required")
        if not building_abbr:
            row_errors.append(f"Row {i}: building_abbreviation is required")
        if not room_number:
            row_errors.append(f"Row {i}: room_number is required")
        if not capacity_str:
            row_errors.append(f"Row {i}: capacity is required")
        else:
            try:
                capacity = int(capacity_str)
                if capacity < 0:
                    row_errors.append(f"Row {i}: capacity must be non-negative")
            except ValueError:
                row_errors.append(f"Row {i}: capacity must be an integer")

        if row_errors:
            errors.extend(row_errors)
        else:
            valid_rows.append({
                "building_name": building_name,
                "building_abbreviation": building_abbr,
                "room_number": room_number,
                "capacity": int(capacity_str),
            })

    return valid_rows, errors


@router.post("/import/rooms", response_model=Union[ImportPreview, ImportResult])
async def import_rooms(
    file: UploadFile = File(...),
    preview: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    rows = _read_csv(contents)
    valid_rows, errors = _validate_room_rows(rows)

    if preview:
        return ImportPreview(
            rows=valid_rows,
            errors=errors,
            valid_count=len(valid_rows),
        )

    # Actual import
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    created = 0
    import_errors: list[str] = []

    for row in valid_rows:
        try:
            # Find or create building
            building = (
                db.query(Building)
                .filter(
                    Building.name == row["building_name"],
                    Building.abbreviation == row["building_abbreviation"],
                )
                .first()
            )
            if not building:
                building = Building(
                    name=row["building_name"],
                    abbreviation=row["building_abbreviation"],
                )
                db.add(building)
                db.flush()

            # Create room
            room = Room(
                building_id=building.id,
                room_number=row["room_number"],
                capacity=row["capacity"],
            )
            db.add(room)
            created += 1
        except Exception as exc:
            import_errors.append(
                f"Error importing room {row['room_number']}: {str(exc)}"
            )

    db.commit()
    return ImportResult(created=created, errors=import_errors)


# ---------------------------------------------------------------------------
# POST /import/instructors
# ---------------------------------------------------------------------------
INSTRUCTOR_COLUMNS = ["name", "email", "department", "modality_constraint", "max_credits"]

VALID_MODALITIES = {e.value for e in ModalityConstraint}


def _validate_instructor_rows(rows: list[dict]) -> tuple[list[dict], list[str]]:
    """Validate instructor rows. Returns (valid_rows, errors)."""
    errors = _validate_columns(rows, INSTRUCTOR_COLUMNS)
    if errors:
        return [], errors

    valid_rows: list[dict] = []
    for i, row in enumerate(rows, start=2):
        row_errors: list[str] = []
        name = row.get("name", "").strip()
        email = row.get("email", "").strip()
        department = row.get("department", "").strip()
        modality = row.get("modality_constraint", "any").strip()
        max_credits_str = row.get("max_credits", "12").strip()

        if not name:
            row_errors.append(f"Row {i}: name is required")
        if not email:
            row_errors.append(f"Row {i}: email is required")
        if not department:
            row_errors.append(f"Row {i}: department is required")
        if modality and modality not in VALID_MODALITIES:
            row_errors.append(
                f"Row {i}: modality_constraint must be one of {', '.join(sorted(VALID_MODALITIES))}"
            )
        if max_credits_str:
            try:
                max_credits = int(max_credits_str)
                if max_credits < 0:
                    row_errors.append(f"Row {i}: max_credits must be non-negative")
            except ValueError:
                row_errors.append(f"Row {i}: max_credits must be an integer")

        if row_errors:
            errors.extend(row_errors)
        else:
            valid_rows.append({
                "name": name,
                "email": email,
                "department": department,
                "modality_constraint": modality or "any",
                "max_credits": int(max_credits_str) if max_credits_str else 12,
            })

    return valid_rows, errors


@router.post("/import/instructors", response_model=Union[ImportPreview, ImportResult])
async def import_instructors(
    file: UploadFile = File(...),
    preview: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    rows = _read_csv(contents)
    valid_rows, errors = _validate_instructor_rows(rows)

    if preview:
        return ImportPreview(
            rows=valid_rows,
            errors=errors,
            valid_count=len(valid_rows),
        )

    if errors:
        raise HTTPException(status_code=400, detail=errors)

    created = 0
    import_errors: list[str] = []

    for row in valid_rows:
        try:
            # Check for duplicate email
            existing = (
                db.query(Instructor)
                .filter(Instructor.email == row["email"])
                .first()
            )
            if existing:
                import_errors.append(
                    f"Instructor with email {row['email']} already exists (skipped)"
                )
                continue

            instructor = Instructor(
                name=row["name"],
                email=row["email"],
                department=row["department"],
                modality_constraint=ModalityConstraint(row["modality_constraint"]),
                max_credits=row["max_credits"],
            )
            db.add(instructor)
            created += 1
        except Exception as exc:
            import_errors.append(
                f"Error importing instructor {row['name']}: {str(exc)}"
            )

    db.commit()
    return ImportResult(created=created, errors=import_errors)


# ---------------------------------------------------------------------------
# POST /import/courses
# ---------------------------------------------------------------------------
COURSE_COLUMNS = ["department_code", "course_number", "title", "credits"]


def _validate_course_rows(rows: list[dict]) -> tuple[list[dict], list[str]]:
    """Validate course rows. Returns (valid_rows, errors)."""
    errors = _validate_columns(rows, COURSE_COLUMNS)
    if errors:
        return [], errors

    valid_rows: list[dict] = []
    for i, row in enumerate(rows, start=2):
        row_errors: list[str] = []
        dept = row.get("department_code", "").strip()
        number = row.get("course_number", "").strip()
        title = row.get("title", "").strip()
        credits_str = row.get("credits", "").strip()

        if not dept:
            row_errors.append(f"Row {i}: department_code is required")
        if not number:
            row_errors.append(f"Row {i}: course_number is required")
        if not title:
            row_errors.append(f"Row {i}: title is required")
        if not credits_str:
            row_errors.append(f"Row {i}: credits is required")
        else:
            try:
                credits = int(credits_str)
                if credits < 0:
                    row_errors.append(f"Row {i}: credits must be non-negative")
            except ValueError:
                row_errors.append(f"Row {i}: credits must be an integer")

        if row_errors:
            errors.extend(row_errors)
        else:
            valid_rows.append({
                "department_code": dept,
                "course_number": number,
                "title": title,
                "credits": int(credits_str),
            })

    return valid_rows, errors


@router.post("/import/courses", response_model=Union[ImportPreview, ImportResult])
async def import_courses(
    file: UploadFile = File(...),
    preview: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    rows = _read_csv(contents)
    valid_rows, errors = _validate_course_rows(rows)

    if preview:
        return ImportPreview(
            rows=valid_rows,
            errors=errors,
            valid_count=len(valid_rows),
        )

    if errors:
        raise HTTPException(status_code=400, detail=errors)

    created = 0
    import_errors: list[str] = []

    for row in valid_rows:
        try:
            course = Course(
                department_code=row["department_code"],
                course_number=row["course_number"],
                title=row["title"],
                credits=row["credits"],
            )
            db.add(course)
            created += 1
        except Exception as exc:
            import_errors.append(
                f"Error importing course {row['department_code']} {row['course_number']}: {str(exc)}"
            )

    db.commit()
    return ImportResult(created=created, errors=import_errors)


# ---------------------------------------------------------------------------
# POST /import/schedule  (XLSX)
# ---------------------------------------------------------------------------
@router.post("/import/schedule", response_model=Union[ScheduleImportPreview, ImportResult])
async def import_schedule(
    file: UploadFile = File(...),
    term_id: int = Query(...),
    preview: bool = Query(default=True),
    instructor_mappings: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    valid_rows, errors, suggested_term = read_xlsx_schedule(contents)

    if preview:
        # Collect unique instructor names and find matches
        unique_names = list(dict.fromkeys(
            row["instructor_name"] for row in valid_rows if row.get("instructor_name")
        ))
        existing_instructors = db.query(Instructor).all()
        matches = find_instructor_matches(unique_names, existing_instructors)

        return ScheduleImportPreview(
            rows=valid_rows,
            errors=errors,
            valid_count=len(valid_rows),
            suggested_term=suggested_term,
            instructor_matches=matches,
        )

    if errors:
        raise HTTPException(status_code=400, detail=errors)

    # Validate term exists
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail=f"Term {term_id} not found")

    # Parse instructor mappings from JSON
    # Format: { "Instructor Name": instructor_id_or_null }
    mappings: dict = {}
    if instructor_mappings:
        try:
            mappings = json.loads(instructor_mappings)
        except json.JSONDecodeError:
            pass

    # Load time blocks for matching
    time_blocks = db.query(TimeBlock).all()

    created = 0
    updated = 0
    import_errors: list[str] = []

    for row in valid_rows:
        try:
            # --- Course: find or create ---
            course = (
                db.query(Course)
                .filter(
                    Course.department_code == row["department_code"],
                    Course.course_number == row["course_number"],
                )
                .first()
            )
            if not course:
                course = Course(
                    department_code=row["department_code"],
                    course_number=row["course_number"],
                    title=row["title"],
                    credits=3,
                )
                db.add(course)
                db.flush()

            # --- Instructor: use mapping or find/create ---
            instructor = None
            if row.get("instructor_name"):
                name = row["instructor_name"]
                mapped_id = mappings.get(name)

                if mapped_id is not None:
                    # User mapped this name to an existing instructor
                    instructor = db.query(Instructor).filter(
                        Instructor.id == int(mapped_id)
                    ).first()
                else:
                    # Try exact match, then create
                    instructor = (
                        db.query(Instructor)
                        .filter(Instructor.name == name)
                        .first()
                    )
                    if not instructor:
                        name_parts = name.lower().split()
                        email_slug = ".".join(name_parts)
                        placeholder_email = f"{email_slug}@uwrf.edu"
                        existing_email = (
                            db.query(Instructor)
                            .filter(Instructor.email == placeholder_email)
                            .first()
                        )
                        if existing_email:
                            placeholder_email = f"{email_slug}.import@uwrf.edu"
                        instructor = Instructor(
                            name=name,
                            email=placeholder_email,
                            department=row["department_code"],
                            modality_constraint=ModalityConstraint.any,
                            max_credits=12,
                        )
                        db.add(instructor)
                        db.flush()

            # --- Building & Room: find or create ---
            room = None
            if row.get("building_name") and row.get("room_number"):
                building = (
                    db.query(Building)
                    .filter(Building.name == row["building_name"])
                    .first()
                )
                if not building:
                    abbr = "".join(
                        w[0].upper() for w in row["building_name"].split() if w
                    )
                    building = Building(
                        name=row["building_name"], abbreviation=abbr
                    )
                    db.add(building)
                    db.flush()
                room = (
                    db.query(Room)
                    .filter(
                        Room.building_id == building.id,
                        Room.room_number == row["room_number"],
                    )
                    .first()
                )
                if not room:
                    room = Room(
                        building_id=building.id,
                        room_number=row["room_number"],
                        capacity=30,
                    )
                    db.add(room)
                    db.flush()

            # --- Modality ---
            has_schedule = row.get("days") is not None
            modality_raw = row["modality"]
            if modality_raw in ("online_sync", "online_async"):
                modality_val = Modality(modality_raw)
            elif modality_raw == "online":
                modality_val = Modality.online_sync if has_schedule else Modality.online_async
            else:
                modality_val = Modality.in_person
            is_online = modality_val in (Modality.online_sync, Modality.online_async)

            # --- Session ---
            from app.models.section import Session as SessionEnum
            session_raw = row.get("session", "regular")
            try:
                session_val = SessionEnum(session_raw)
            except ValueError:
                session_val = SessionEnum.regular

            # --- Section: find or create, update if exists ---
            existing_section = (
                db.query(Section)
                .filter(
                    Section.course_id == course.id,
                    Section.term_id == term_id,
                    Section.section_number == row["section_number"],
                )
                .first()
            )
            is_update = False
            if existing_section:
                # Update existing section with latest import data
                existing_section.modality = modality_val
                existing_section.session = session_val
                existing_section.instructor_id = instructor.id if instructor else existing_section.instructor_id
                if has_schedule or is_online:
                    existing_section.status = SectionStatus.scheduled
                section = existing_section
                is_update = True
            else:
                section = Section(
                    course_id=course.id,
                    term_id=term_id,
                    section_number=row["section_number"],
                    enrollment_cap=30,
                    modality=modality_val,
                    session=session_val,
                    status=SectionStatus.scheduled if (has_schedule or is_online) else SectionStatus.unscheduled,
                    instructor_id=instructor.id if instructor else None,
                )
                db.add(section)
            db.flush()

            # --- Meeting: create if days/times exist (update if duplicate) ---
            if has_schedule and row.get("start_time") and row.get("end_time"):
                days_json = json.dumps(row["days"])
                start = dt_time.fromisoformat(row["start_time"])
                end = dt_time.fromisoformat(row["end_time"])
                tb_id = match_time_block(row["days"], start, end, time_blocks)

                # Check for existing meeting with same time/days
                existing_meeting = (
                    db.query(Meeting)
                    .filter(
                        Meeting.section_id == section.id,
                        Meeting.days_of_week == days_json,
                        Meeting.start_time == start,
                        Meeting.end_time == end,
                    )
                    .first()
                )
                if existing_meeting:
                    # Update existing meeting
                    existing_meeting.time_block_id = tb_id
                    existing_meeting.room_id = room.id if room else existing_meeting.room_id
                    existing_meeting.instructor_id = instructor.id if instructor else existing_meeting.instructor_id
                else:
                    meeting = Meeting(
                        section_id=section.id,
                        days_of_week=days_json,
                        start_time=start,
                        end_time=end,
                        time_block_id=tb_id,
                        room_id=room.id if room else None,
                        instructor_id=instructor.id if instructor else None,
                    )
                    db.add(meeting)

            if is_update:
                updated += 1
            else:
                created += 1
        except Exception as exc:
            import_errors.append(
                f"Error importing {row.get('department_code', '?')} "
                f"{row.get('course_number', '?')}-{row.get('section_number', '?')}: {str(exc)}"
            )

    db.commit()
    return ImportResult(created=created, updated=updated, errors=import_errors)


# ---------------------------------------------------------------------------
# GET /terms/{term_id}/export/csv
# ---------------------------------------------------------------------------
@router.get("/terms/{term_id}/export/csv")
def export_csv(term_id: int, db: Session = Depends(get_db)):
    try:
        csv_content = export_term_csv(db, term_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=schedule_term_{term_id}.csv"
        },
    )


# ---------------------------------------------------------------------------
# GET /terms/{term_id}/export/print
# ---------------------------------------------------------------------------
@router.get("/terms/{term_id}/export/print")
def export_print(
    term_id: int,
    view: str = Query(default="master", pattern="^(room|instructor|master)$"),
    db: Session = Depends(get_db),
):
    try:
        html_content = export_print_html(db, term_id, view)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return HTMLResponse(content=html_content)
