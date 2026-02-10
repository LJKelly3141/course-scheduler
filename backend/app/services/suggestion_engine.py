"""
Suggestion engine for the UWRF Course Scheduler.

Provides queries to find available rooms and time blocks that don't have
scheduling conflicts for a given time slot or instructor/section.
"""
from __future__ import annotations

import json
from datetime import time

from sqlalchemy.orm import Session, joinedload

from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section
from app.models.time_block import TimeBlock


def _parse_days(days_json: str) -> set[str]:
    """Parse a JSON string of day codes into a set."""
    try:
        days = json.loads(days_json)
        if isinstance(days, list):
            return set(days)
    except (json.JSONDecodeError, TypeError):
        pass
    return set()


def _times_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    """Return True if two time ranges overlap."""
    return start_a < end_b and start_b < end_a


def get_available_rooms(
    db: Session,
    term_id: int,
    days_json: str,
    start_time: time,
    end_time: time,
    min_capacity: int = 0,
) -> list[Room]:
    """
    Find rooms not booked at the given time slot in the given term.

    Args:
        db: SQLAlchemy session.
        term_id: The term to check.
        days_json: JSON string of days, e.g. '["M","W","F"]'.
        start_time: Proposed start time.
        end_time: Proposed end time.
        min_capacity: Minimum room capacity (default 0).

    Returns:
        List of Room objects that are available.
    """
    requested_days = _parse_days(days_json)

    # Get all rooms meeting the minimum capacity
    all_rooms = (
        db.query(Room)
        .options(joinedload(Room.building))
        .filter(Room.capacity >= min_capacity)
        .all()
    )

    # Get all meetings in this term that have a room assigned
    booked_meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .filter(Meeting.room_id.isnot(None))
        .all()
    )

    # Find rooms that are busy during the requested time
    busy_room_ids: set[int] = set()
    for m in booked_meetings:
        meeting_days = _parse_days(m.days_of_week)
        shared_days = requested_days & meeting_days
        if shared_days and _times_overlap(start_time, end_time,
                                          m.start_time, m.end_time):
            busy_room_ids.add(m.room_id)

    # Return rooms that are not busy
    return [r for r in all_rooms if r.id not in busy_room_ids]


def get_available_timeblocks(
    db: Session,
    term_id: int,
    section_id: int | None = None,
    instructor_id: int | None = None,
) -> list[TimeBlock]:
    """
    Find time blocks where neither the instructor nor the section has conflicts.

    If section_id is provided, exclude time blocks that would create a section overlap.
    If instructor_id is provided, exclude time blocks that would create an
    instructor conflict.

    Args:
        db: SQLAlchemy session.
        term_id: The term to check.
        section_id: Optional section to check for overlap.
        instructor_id: Optional instructor to check for conflicts.

    Returns:
        List of available TimeBlock objects.
    """
    all_blocks = db.query(TimeBlock).all()

    # Get existing meetings that could conflict
    existing_meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .all()
    )

    available_blocks: list[TimeBlock] = []

    for block in all_blocks:
        block_days = _parse_days(block.days_of_week)
        is_available = True

        for m in existing_meetings:
            meeting_days = _parse_days(m.days_of_week)
            shared_days = block_days & meeting_days

            if not shared_days:
                continue

            if not _times_overlap(block.start_time, block.end_time,
                                  m.start_time, m.end_time):
                continue

            # Time overlap exists on shared days - check if it conflicts
            # with the section or instructor
            if section_id is not None and m.section_id == section_id:
                is_available = False
                break

            if instructor_id is not None and m.instructor_id == instructor_id:
                is_available = False
                break

        if is_available:
            available_blocks.append(block)

    return available_blocks
