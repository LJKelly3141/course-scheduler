from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.database import get_db
from app.services.html_export import (
    render_export_html,
    save_to_directory,
    push_to_github,
    generate_instructor_schedules,
)
from app.services.ics_export import generate_ics_for_instructor, generate_ics_for_instructors
from app.models.instructor import Instructor

router = APIRouter()


@router.get("/terms/{term_id}/export/html", response_class=HTMLResponse)
def download_html(term_id: int, db: Session = Depends(get_db)):
    try:
        html = render_export_html(db, term_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f"attachment; filename=schedule-{term_id}.html"},
    )


@router.post("/terms/{term_id}/export/html/save")
def save_html(term_id: int, db: Session = Depends(get_db)):
    try:
        filepath = save_to_directory(db, term_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"filepath": filepath}


@router.post("/terms/{term_id}/export/html/github")
def push_html_github(term_id: int, db: Session = Depends(get_db)):
    try:
        result = push_to_github(db, term_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/terms/{term_id}/export/instructor-schedules")
def get_instructor_schedules(
    term_id: int,
    instructor_ids: str = Query(..., description="Comma-separated instructor IDs"),
    db: Session = Depends(get_db),
):
    try:
        ids = [int(x.strip()) for x in instructor_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid instructor IDs")
    if not ids:
        raise HTTPException(status_code=400, detail="No instructor IDs provided")
    try:
        return generate_instructor_schedules(db, term_id, ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/terms/{term_id}/export/ics/{instructor_id}")
def download_instructor_ics(
    term_id: int,
    instructor_id: int,
    db: Session = Depends(get_db),
):
    """Download ICS calendar file for a single instructor's schedule."""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    try:
        ics_bytes = generate_ics_for_instructor(db, term_id, instructor_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    last = instructor.last_name or "Instructor"
    first = instructor.first_name or ""
    filename = f"{last}-{first}-schedule.ics".replace(" ", "-")

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/terms/{term_id}/export/ics")
def download_bulk_ics(
    term_id: int,
    instructor_ids: str = Query(..., description="Comma-separated instructor IDs"),
    db: Session = Depends(get_db),
):
    """Download a single ICS file with events for multiple instructors."""
    try:
        ids = [int(x.strip()) for x in instructor_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid instructor IDs")
    if not ids:
        raise HTTPException(status_code=400, detail="No instructor IDs provided")
    try:
        ics_bytes = generate_ics_for_instructors(db, term_id, ids)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="schedules.ics"'},
    )
