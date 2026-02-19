"""
Hard conflict detection engine for the UWRF Course Scheduler.

Detects scheduling conflicts that must be resolved before a term can be finalized:
room double-bookings, instructor double-bookings, section overlaps, time validity,
room capacity overflows, instructor modality mismatches, and instructor unavailability.
"""
from __future__ import annotations

import json
from datetime import time
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
    ModalityConstraint,
)
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Modality, Section
from app.schemas.schemas import ConflictItem


VALID_DAYS = {"M", "T", "W", "Th", "F", "S", "U"}

MWF_DAYS = {"M", "W", "F"}
TTH_DAYS = {"T", "Th"}


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
    """Return True if two time ranges overlap: startA < endB AND startB < endA."""
    return start_a < end_b and start_b < end_a


def _meetings_overlap(meeting_a: Meeting, meeting_b: Meeting) -> bool:
    """Return True if two meetings share at least one day and overlap in time."""
    # Meetings with TBD times cannot overlap
    if not meeting_a.days_of_week or not meeting_b.days_of_week:
        return False
    if not meeting_a.start_time or not meeting_a.end_time:
        return False
    if not meeting_b.start_time or not meeting_b.end_time:
        return False
    days_a = _parse_days(meeting_a.days_of_week)
    days_b = _parse_days(meeting_b.days_of_week)
    shared_days = days_a & days_b
    if not shared_days:
        return False
    return _times_overlap(meeting_a.start_time, meeting_a.end_time,
                          meeting_b.start_time, meeting_b.end_time)


def _get_term_meetings(db: Session, term_id: int) -> list[Meeting]:
    """Fetch all meetings for sections in the given term, eager-loading relationships."""
    return (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Meeting.section).joinedload(Section.course),
            joinedload(Meeting.room),
            joinedload(Meeting.instructor).joinedload(Instructor.availabilities),
        )
        .all()
    )


def detect_hard_conflicts(db: Session, term_id: int) -> list[ConflictItem]:
    """
    Detect all hard conflicts for meetings in a term.

    Returns a list of ConflictItem objects with severity="hard".
    """
    meetings = _get_term_meetings(db, term_id)
    conflicts: list[ConflictItem] = []

    # --- Time validity checks ---
    for m in meetings:
        # Skip TBD meetings (no time/days assigned)
        if not m.days_of_week or not m.start_time or not m.end_time:
            continue
        if m.end_time <= m.start_time:
            conflicts.append(ConflictItem(
                type="time_validity",
                severity="hard",
                description=(
                    f"Meeting {m.id}: end_time ({m.end_time}) must be after "
                    f"start_time ({m.start_time})."
                ),
                meeting_ids=[m.id],
            ))

        days = _parse_days(m.days_of_week)
        invalid = days - VALID_DAYS
        if invalid:
            conflicts.append(ConflictItem(
                type="time_validity",
                severity="hard",
                description=(
                    f"Meeting {m.id}: invalid day code(s) {sorted(invalid)}. "
                    f"Valid codes: {sorted(VALID_DAYS)}."
                ),
                meeting_ids=[m.id],
            ))
        if not days:
            conflicts.append(ConflictItem(
                type="time_validity",
                severity="hard",
                description=f"Meeting {m.id}: no valid days of week specified.",
                meeting_ids=[m.id],
            ))

    # --- Pairwise overlap checks ---
    for i in range(len(meetings)):
        for j in range(i + 1, len(meetings)):
            a = meetings[i]
            b = meetings[j]
            if not _meetings_overlap(a, b):
                continue

            # Room conflict: same room, both in-person rooms assigned
            if (a.room_id is not None and b.room_id is not None
                    and a.room_id == b.room_id):
                conflicts.append(ConflictItem(
                    type="room_conflict",
                    severity="hard",
                    description=(
                        f"Room conflict: meetings {a.id} and {b.id} overlap "
                        f"in room {a.room.room_number if a.room else a.room_id}."
                    ),
                    meeting_ids=[a.id, b.id],
                ))

            # Instructor conflict: same instructor
            if (a.instructor_id is not None and b.instructor_id is not None
                    and a.instructor_id == b.instructor_id):
                conflicts.append(ConflictItem(
                    type="instructor_conflict",
                    severity="hard",
                    description=(
                        f"Instructor conflict: meetings {a.id} and {b.id} overlap "
                        f"for instructor "
                        f"{a.instructor.name if a.instructor else a.instructor_id}."
                    ),
                    meeting_ids=[a.id, b.id],
                ))

            # Section conflict: same section has overlapping meetings
            if a.section_id == b.section_id:
                conflicts.append(ConflictItem(
                    type="section_conflict",
                    severity="hard",
                    description=(
                        f"Section conflict: section {a.section_id} has overlapping "
                        f"meetings {a.id} and {b.id}."
                    ),
                    meeting_ids=[a.id, b.id],
                ))

    # --- Room capacity checks ---
    for m in meetings:
        if m.room_id is not None and m.room is not None and m.section is not None:
            section_modality = m.section.modality
            if section_modality not in (Modality.online_sync, Modality.online_async):
                if m.section.enrollment_cap > m.room.capacity:
                    conflicts.append(ConflictItem(
                        type="room_capacity",
                        severity="hard",
                        description=(
                            f"Room capacity exceeded: meeting {m.id} in room "
                            f"{m.room.room_number} (capacity {m.room.capacity}) "
                            f"but section enrollment cap is "
                            f"{m.section.enrollment_cap}."
                        ),
                        meeting_ids=[m.id],
                    ))

    # --- Instructor modality mismatch checks ---
    for m in meetings:
        if m.instructor_id is None or m.instructor is None:
            continue
        if m.section is None:
            continue

        constraint = m.instructor.modality_constraint
        section_modality = m.section.modality
        meeting_days = _parse_days(m.days_of_week)

        # online_only instructor assigned to in-person or hybrid section
        if constraint == ModalityConstraint.online_only:
            if section_modality not in (Modality.online_sync, Modality.online_async):
                conflicts.append(ConflictItem(
                    type="instructor_modality_mismatch",
                    severity="hard",
                    description=(
                        f"Instructor modality mismatch: {m.instructor.name} is "
                        f"online-only but assigned to {section_modality.value} "
                        f"section (meeting {m.id})."
                    ),
                    meeting_ids=[m.id],
                ))

        # mwf_only instructor assigned to a TTh meeting
        if constraint == ModalityConstraint.mwf_only:
            if meeting_days and not meeting_days.issubset(MWF_DAYS):
                conflicts.append(ConflictItem(
                    type="instructor_modality_mismatch",
                    severity="hard",
                    description=(
                        f"Instructor modality mismatch: {m.instructor.name} is "
                        f"MWF-only but meeting {m.id} includes non-MWF days "
                        f"{sorted(meeting_days - MWF_DAYS)}."
                    ),
                    meeting_ids=[m.id],
                ))

        # tth_only instructor assigned to a MWF meeting
        if constraint == ModalityConstraint.tth_only:
            if meeting_days and not meeting_days.issubset(TTH_DAYS):
                conflicts.append(ConflictItem(
                    type="instructor_modality_mismatch",
                    severity="hard",
                    description=(
                        f"Instructor modality mismatch: {m.instructor.name} is "
                        f"TTh-only but meeting {m.id} includes non-TTh days "
                        f"{sorted(meeting_days - TTH_DAYS)}."
                    ),
                    meeting_ids=[m.id],
                ))

    # --- Instructor unavailability checks ---
    for m in meetings:
        if m.instructor_id is None or m.instructor is None:
            continue

        meeting_days = _parse_days(m.days_of_week)

        # Query unavailable blocks for this instructor in this term
        unavail_blocks = (
            db.query(InstructorAvailability)
            .filter(
                InstructorAvailability.instructor_id == m.instructor_id,
                InstructorAvailability.term_id == term_id,
                InstructorAvailability.type == AvailabilityType.unavailable,
            )
            .all()
        )

        for block in unavail_blocks:
            if block.day_of_week in meeting_days:
                if _times_overlap(m.start_time, m.end_time,
                                  block.start_time, block.end_time):
                    conflicts.append(ConflictItem(
                        type="instructor_unavailability",
                        severity="hard",
                        description=(
                            f"Instructor unavailability: {m.instructor.name} is "
                            f"unavailable on {block.day_of_week} "
                            f"{block.start_time}-{block.end_time}, conflicting "
                            f"with meeting {m.id}."
                        ),
                        meeting_ids=[m.id],
                    ))

    return conflicts


def check_meeting_conflicts(
    db: Session,
    meeting: Meeting,
    term_id: int,
    exclude_meeting_id: Optional[int] = None,
) -> list[ConflictItem]:
    """
    Check a single meeting against all other meetings in the term.

    Useful for inline validation when creating or updating a meeting.
    The meeting object should have its attributes set (section_id, room_id,
    instructor_id, days_of_week, start_time, end_time) but does not need to
    be persisted yet.

    Args:
        db: SQLAlchemy session.
        meeting: The meeting to validate.
        term_id: The term to check against.
        exclude_meeting_id: If updating, exclude this meeting's own ID from checks.

    Returns:
        List of ConflictItem for hard conflicts found.
    """
    conflicts: list[ConflictItem] = []
    meeting_id = meeting.id if meeting.id else 0

    # TBD meetings (no time/days) cannot have time-based conflicts
    if not meeting.days_of_week or not meeting.start_time or not meeting.end_time:
        return conflicts

    # --- Time validity ---
    if meeting.end_time <= meeting.start_time:
        conflicts.append(ConflictItem(
            type="time_validity",
            severity="hard",
            description=(
                f"end_time ({meeting.end_time}) must be after "
                f"start_time ({meeting.start_time})."
            ),
            meeting_ids=[meeting_id],
        ))

    meeting_days = _parse_days(meeting.days_of_week)
    invalid = meeting_days - VALID_DAYS
    if invalid:
        conflicts.append(ConflictItem(
            type="time_validity",
            severity="hard",
            description=(
                f"Invalid day code(s) {sorted(invalid)}. "
                f"Valid codes: {sorted(VALID_DAYS)}."
            ),
            meeting_ids=[meeting_id],
        ))
    if not meeting_days:
        conflicts.append(ConflictItem(
            type="time_validity",
            severity="hard",
            description="No valid days of week specified.",
            meeting_ids=[meeting_id],
        ))

    # Fetch other meetings in the term
    other_meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Meeting.section),
            joinedload(Meeting.room),
            joinedload(Meeting.instructor),
        )
        .all()
    )

    for other in other_meetings:
        if exclude_meeting_id is not None and other.id == exclude_meeting_id:
            continue
        if meeting.id is not None and other.id == meeting.id:
            continue

        if not _meetings_overlap(meeting, other):
            continue

        # Room conflict
        if (meeting.room_id is not None and other.room_id is not None
                and meeting.room_id == other.room_id):
            conflicts.append(ConflictItem(
                type="room_conflict",
                severity="hard",
                description=(
                    f"Room conflict with meeting {other.id} in room "
                    f"{other.room.room_number if other.room else other.room_id}."
                ),
                meeting_ids=[meeting_id, other.id],
            ))

        # Instructor conflict
        if (meeting.instructor_id is not None and other.instructor_id is not None
                and meeting.instructor_id == other.instructor_id):
            conflicts.append(ConflictItem(
                type="instructor_conflict",
                severity="hard",
                description=(
                    f"Instructor conflict with meeting {other.id} for "
                    f"{other.instructor.name if other.instructor else other.instructor_id}."
                ),
                meeting_ids=[meeting_id, other.id],
            ))

        # Section conflict
        if meeting.section_id == other.section_id:
            conflicts.append(ConflictItem(
                type="section_conflict",
                severity="hard",
                description=(
                    f"Section conflict: overlaps with meeting {other.id} "
                    f"in the same section."
                ),
                meeting_ids=[meeting_id, other.id],
            ))

    # --- Room capacity check ---
    if meeting.room_id is not None:
        room = db.query(Room).filter(Room.id == meeting.room_id).first()
        section = db.query(Section).filter(Section.id == meeting.section_id).first()
        if room and section:
            if section.modality not in (Modality.online_sync, Modality.online_async):
                if section.enrollment_cap > room.capacity:
                    conflicts.append(ConflictItem(
                        type="room_capacity",
                        severity="hard",
                        description=(
                            f"Room capacity exceeded: room {room.room_number} "
                            f"(capacity {room.capacity}) but section enrollment "
                            f"cap is {section.enrollment_cap}."
                        ),
                        meeting_ids=[meeting_id],
                    ))

    # --- Instructor modality mismatch ---
    if meeting.instructor_id is not None:
        instructor = db.query(Instructor).filter(
            Instructor.id == meeting.instructor_id
        ).first()
        section = db.query(Section).filter(
            Section.id == meeting.section_id
        ).first()

        if instructor and section:
            constraint = instructor.modality_constraint

            if constraint == ModalityConstraint.online_only:
                if section.modality not in (Modality.online_sync, Modality.online_async):
                    conflicts.append(ConflictItem(
                        type="instructor_modality_mismatch",
                        severity="hard",
                        description=(
                            f"Instructor {instructor.name} is online-only but "
                            f"assigned to {section.modality.value} section."
                        ),
                        meeting_ids=[meeting_id],
                    ))

            if constraint == ModalityConstraint.mwf_only:
                if meeting_days and not meeting_days.issubset(MWF_DAYS):
                    conflicts.append(ConflictItem(
                        type="instructor_modality_mismatch",
                        severity="hard",
                        description=(
                            f"Instructor {instructor.name} is MWF-only but "
                            f"meeting includes non-MWF days "
                            f"{sorted(meeting_days - MWF_DAYS)}."
                        ),
                        meeting_ids=[meeting_id],
                    ))

            if constraint == ModalityConstraint.tth_only:
                if meeting_days and not meeting_days.issubset(TTH_DAYS):
                    conflicts.append(ConflictItem(
                        type="instructor_modality_mismatch",
                        severity="hard",
                        description=(
                            f"Instructor {instructor.name} is TTh-only but "
                            f"meeting includes non-TTh days "
                            f"{sorted(meeting_days - TTH_DAYS)}."
                        ),
                        meeting_ids=[meeting_id],
                    ))

    # --- Instructor unavailability ---
    if meeting.instructor_id is not None:
        instructor = db.query(Instructor).filter(
            Instructor.id == meeting.instructor_id
        ).first()

        if instructor:
            unavail_blocks = (
                db.query(InstructorAvailability)
                .filter(
                    InstructorAvailability.instructor_id == meeting.instructor_id,
                    InstructorAvailability.term_id == term_id,
                    InstructorAvailability.type == AvailabilityType.unavailable,
                )
                .all()
            )

            for block in unavail_blocks:
                if block.day_of_week in meeting_days:
                    if _times_overlap(meeting.start_time, meeting.end_time,
                                      block.start_time, block.end_time):
                        conflicts.append(ConflictItem(
                            type="instructor_unavailability",
                            severity="hard",
                            description=(
                                f"Instructor {instructor.name} is unavailable on "
                                f"{block.day_of_week} "
                                f"{block.start_time}-{block.end_time}."
                            ),
                            meeting_ids=[meeting_id],
                        ))

    return conflicts
