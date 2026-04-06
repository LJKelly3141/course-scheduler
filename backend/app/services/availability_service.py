"""Service for auto-applying instructor availability templates to terms."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
)
from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.term import Term, TermType
from app.models.time_block import TimeBlock


def apply_templates_to_term(db: Session, term: Term) -> int:
    """Copy availability templates into concrete InstructorAvailability records
    for *term*.

    - **fall / spring**: query templates whose ``term_type`` matches, copy each
      into an ``InstructorAvailability`` row for the term.
    - **summer**: for each instructor where ``available_summer is False``, create
      ``unavailable`` records covering every time-block day slot.  Instructors
      with ``available_summer=True`` get nothing.
    - **winter**: same as summer but checks ``available_winter``.

    Returns the number of records created.  Calls ``db.flush()`` (not commit)
    so the caller controls the transaction.
    """
    # Idempotency guard: skip if per-term records already exist
    existing = (
        db.query(InstructorAvailability)
        .filter(InstructorAvailability.term_id == term.id)
        .first()
    )
    if existing:
        return 0

    if term.type in (TermType.fall, TermType.spring):
        count = _apply_regular_templates(db, term)
    elif term.type == TermType.summer:
        count = _apply_seasonal_blanket(db, term, season="summer")
    else:  # winter
        count = _apply_seasonal_blanket(db, term, season="winter")

    db.flush()
    return count


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _apply_regular_templates(db: Session, term: Term) -> int:
    """Copy matching templates for fall/spring terms."""
    templates: list[InstructorAvailabilityTemplate] = (
        db.query(InstructorAvailabilityTemplate)
        .filter(InstructorAvailabilityTemplate.term_type == term.type.value)
        .all()
    )

    count = 0
    for t in templates:
        avail = InstructorAvailability(
            instructor_id=t.instructor_id,
            term_id=term.id,
            day_of_week=t.day_of_week,
            start_time=t.start_time,
            end_time=t.end_time,
            type=t.type,
        )
        db.add(avail)
        count += 1

    return count


def _apply_seasonal_blanket(db: Session, term: Term, season: str) -> int:
    """Create blanket unavailable records for instructors who opted out of
    the given season (summer or winter).

    Each TimeBlock's ``days_of_week`` JSON is expanded into individual day
    records so that conflict detection works per-day.
    """
    if season == "summer":
        unavailable_instructors: list[Instructor] = (
            db.query(Instructor)
            .filter(Instructor.available_summer.is_(False))
            .all()
        )
    else:
        unavailable_instructors = (
            db.query(Instructor)
            .filter(Instructor.available_winter.is_(False))
            .all()
        )

    if not unavailable_instructors:
        return 0

    time_blocks: list[TimeBlock] = db.query(TimeBlock).all()
    if not time_blocks:
        return 0

    # Parse time block days once, outside the instructor loop
    block_days: dict[int, list[str]] = {}
    for block in time_blocks:
        try:
            days = json.loads(block.days_of_week)
            if isinstance(days, list):
                block_days[block.id] = days
        except (json.JSONDecodeError, TypeError):
            block_days[block.id] = []

    count = 0
    for instructor in unavailable_instructors:
        for block in time_blocks:
            for day in block_days.get(block.id, []):
                avail = InstructorAvailability(
                    instructor_id=instructor.id,
                    term_id=term.id,
                    day_of_week=day,
                    start_time=block.start_time,
                    end_time=block.end_time,
                    type=AvailabilityType.unavailable,
                )
                db.add(avail)
                count += 1

    return count
