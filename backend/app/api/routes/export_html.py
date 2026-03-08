from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.html_export import (
    render_export_html,
    save_to_directory,
    push_to_github,
    generate_instructor_schedules,
)

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
