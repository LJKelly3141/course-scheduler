from __future__ import annotations

import csv
import io
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.building import Building
from app.models.room import Room
from app.models.instructor import Instructor, ModalityConstraint
from app.models.course import Course
from app.schemas.schemas import ImportPreview, ImportResult
from app.services.export import export_term_csv, export_print_html

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
