"""
Suggestion query endpoints for available rooms and time blocks.
"""
from __future__ import annotations

from datetime import time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import RoomReadWithBuilding, TimeBlockRead
from app.services.suggestion_engine import get_available_rooms, get_available_timeblocks

router = APIRouter()


@router.get("/rooms", response_model=list[RoomReadWithBuilding])
def suggest_rooms(
    term_id: int = Query(..., description="Term ID to check availability for"),
    days: str = Query(..., description='JSON string of days, e.g. \'["M","W","F"]\''),
    start_time: time = Query(..., description="Start time (HH:MM:SS or HH:MM)"),
    end_time: time = Query(..., description="End time (HH:MM:SS or HH:MM)"),
    min_capacity: int = Query(0, description="Minimum room capacity"),
    db: Session = Depends(get_db),
):
    """
    Get rooms that are available at the given time slot.

    Returns rooms not booked during the specified days and time range
    in the given term, with capacity >= min_capacity.
    """
    rooms = get_available_rooms(
        db=db,
        term_id=term_id,
        days_json=days,
        start_time=start_time,
        end_time=end_time,
        min_capacity=min_capacity,
    )
    return rooms


@router.get("/timeblocks", response_model=list[TimeBlockRead])
def suggest_timeblocks(
    term_id: int = Query(..., description="Term ID to check availability for"),
    section_id: Optional[int] = Query(None, description="Section ID to avoid overlaps for"),
    instructor_id: Optional[int] = Query(None, description="Instructor ID to avoid conflicts for"),
    db: Session = Depends(get_db),
):
    """
    Get time blocks that don't conflict with the given section or instructor.

    Returns standard time blocks where neither the section nor the instructor
    already has a meeting scheduled.
    """
    blocks = get_available_timeblocks(
        db=db,
        term_id=term_id,
        section_id=section_id,
        instructor_id=instructor_id,
    )
    return blocks
