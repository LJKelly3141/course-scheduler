"""
Soft constraint detection for the UWRF Course Scheduler.

Detects warnings that do not block finalization but indicate suboptimal scheduling:
credit overloads, preferred-avoid times, room capacity waste, non-standard blocks,
and consecutive teaching runs.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import time

from sqlalchemy.orm import Session, joinedload

from app.models.course import Course
from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
)
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Modality, Section
from app.models.time_block import TimeBlock
from app.schemas.schemas import ConflictItem


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


def detect_soft_warnings(db: Session, term_id: int) -> list[ConflictItem]:
    """
    Detect soft constraint violations for a term.

    Returns a list of ConflictItem objects with severity="soft".
    """
    warnings: list[ConflictItem] = []

    # Fetch all meetings for the term with relationships
    meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Meeting.section).joinedload(Section.course),
            joinedload(Meeting.room),
            joinedload(Meeting.instructor),
            joinedload(Meeting.time_block),
        )
        .all()
    )

    # --- Credit overload check ---
    # Group meetings by instructor, sum credits from their sections' courses.
    # Also include online async sections assigned directly to instructors
    # (which have no meetings).
    instructor_meeting_ids: dict[int, list[int]] = defaultdict(list)
    instructor_objects: dict[int, Instructor] = {}

    for m in meetings:
        if m.instructor_id is None:
            continue
        if m.instructor is not None:
            instructor_objects[m.instructor_id] = m.instructor

    # Gather unique section-instructor pairs from meetings
    instructor_sections: dict[int, set[int]] = defaultdict(set)
    for m in meetings:
        if m.instructor_id is not None and m.section_id is not None:
            instructor_meeting_ids[m.instructor_id].append(m.id)
            instructor_sections[m.instructor_id].add(m.section_id)

    # Also include sections assigned directly to instructors (online async)
    direct_sections = (
        db.query(Section)
        .options(joinedload(Section.course))
        .filter(
            Section.term_id == term_id,
            Section.instructor_id.isnot(None),
        )
        .all()
    )
    for s in direct_sections:
        if s.instructor_id is not None:
            instructor_sections[s.instructor_id].add(s.id)
            # Load instructor object if not already known from meetings
            if s.instructor_id not in instructor_objects:
                inst = db.query(Instructor).filter(Instructor.id == s.instructor_id).first()
                if inst:
                    instructor_objects[s.instructor_id] = inst

    for instructor_id, section_ids in instructor_sections.items():
        total_credits = 0
        for section_id in section_ids:
            section = db.query(Section).options(
                joinedload(Section.course)
            ).filter(Section.id == section_id).first()
            if section and section.course:
                total_credits += section.course.credits

        instructor = instructor_objects.get(instructor_id)
        if instructor and total_credits >= instructor.max_credits:
            warnings.append(ConflictItem(
                type="credit_overload",
                severity="soft",
                description=(
                    f"Credit overload: {instructor.name} is assigned "
                    f"{total_credits} credits (max: {instructor.max_credits})."
                ),
                meeting_ids=instructor_meeting_ids.get(instructor_id, []),
            ))

    # --- Prefer-avoid time check ---
    for m in meetings:
        if m.instructor_id is None:
            continue
        if not m.days_of_week or not m.start_time or not m.end_time:
            continue

        meeting_days = _parse_days(m.days_of_week)

        prefer_avoid_blocks = (
            db.query(InstructorAvailability)
            .filter(
                InstructorAvailability.instructor_id == m.instructor_id,
                InstructorAvailability.term_id == term_id,
                InstructorAvailability.type == AvailabilityType.prefer_avoid,
            )
            .all()
        )

        for block in prefer_avoid_blocks:
            if block.day_of_week in meeting_days:
                if _times_overlap(m.start_time, m.end_time,
                                  block.start_time, block.end_time):
                    instructor = m.instructor
                    name = instructor.name if instructor else f"Instructor {m.instructor_id}"
                    warnings.append(ConflictItem(
                        type="prefer_avoid_time",
                        severity="soft",
                        description=(
                            f"Prefer-avoid time: {name} prefers to avoid "
                            f"{block.day_of_week} {block.start_time}-{block.end_time}, "
                            f"but meeting {m.id} is scheduled then."
                        ),
                        meeting_ids=[m.id],
                    ))

    # --- Room capacity fit check ---
    for m in meetings:
        if m.room_id is None or m.room is None or m.section is None:
            continue
        if m.section.modality in (Modality.online_sync, Modality.online_async):
            continue

        cap = m.section.enrollment_cap
        room_cap = m.room.capacity

        # Wasted space: room capacity is more than 20% above enrollment cap
        if room_cap > cap * 1.2:
            warnings.append(ConflictItem(
                type="room_capacity_waste",
                severity="soft",
                description=(
                    f"Wasted room space: meeting {m.id} in room "
                    f"{m.room.room_number} (capacity {room_cap}) for "
                    f"section with enrollment cap {cap}. "
                    f"Room is {room_cap - cap} seats over need."
                ),
                meeting_ids=[m.id],
            ))

        # Tight fit: room capacity exactly equals enrollment cap (no buffer)
        if room_cap == cap:
            warnings.append(ConflictItem(
                type="room_capacity_tight",
                severity="soft",
                description=(
                    f"Tight room fit: meeting {m.id} in room "
                    f"{m.room.room_number} (capacity {room_cap}) exactly "
                    f"matches section enrollment cap {cap}. No buffer."
                ),
                meeting_ids=[m.id],
            ))

    # --- TBD checks ---
    # Flag meetings where room, time, or instructor is TBD (null) but should
    # be assigned based on section modality.
    for m in meetings:
        section = m.section
        if section is None:
            continue
        is_online = section.modality in (Modality.online_sync, Modality.online_async)
        is_async = section.modality == Modality.online_async
        course = section.course
        course_label = (
            f"{course.department_code} {course.course_number}-{section.section_number}"
            if course else f"Section {section.id}"
        )

        # Instructor TBD — always a warning regardless of modality
        if m.instructor_id is None:
            warnings.append(ConflictItem(
                type="instructor_tbd",
                severity="soft",
                description=f"Instructor TBD: {course_label} has no instructor assigned.",
                meeting_ids=[m.id],
            ))

        # Room TBD — only warn for in-person sections (online needs no room)
        if m.room_id is None and not is_online:
            warnings.append(ConflictItem(
                type="room_tbd",
                severity="soft",
                description=f"Room TBD: {course_label} has no room assigned.",
                meeting_ids=[m.id],
            ))

        # Time TBD — warn unless async online (which has no meeting time)
        if (not m.days_of_week or not m.start_time or not m.end_time) and not is_async:
            warnings.append(ConflictItem(
                type="time_tbd",
                severity="soft",
                description=f"Meeting time TBD: {course_label} has no time assigned.",
                meeting_ids=[m.id],
            ))

    # --- Non-standard block check ---
    for m in meetings:
        # Skip meetings with no time (already flagged as TBD above)
        if not m.days_of_week or not m.start_time or not m.end_time:
            continue
        if m.time_block_id is None:
            warnings.append(ConflictItem(
                type="non_standard_block",
                severity="soft",
                description=(
                    f"Non-standard time block: meeting {m.id} uses a custom "
                    f"time not linked to a standard time block."
                ),
                meeting_ids=[m.id],
            ))

    # --- Consecutive teaching check ---
    # Group meetings by instructor and day, then check for >3 consecutive
    # time blocks with no break
    instructor_day_meetings: dict[tuple[int, str], list[Meeting]] = defaultdict(list)

    for m in meetings:
        if m.instructor_id is None:
            continue
        if not m.days_of_week or not m.start_time or not m.end_time:
            continue
        meeting_days = _parse_days(m.days_of_week)
        for day in meeting_days:
            instructor_day_meetings[(m.instructor_id, day)].append(m)

    for (instructor_id, day), day_meetings in instructor_day_meetings.items():
        if len(day_meetings) <= 3:
            continue

        # Sort by start_time
        sorted_meetings = sorted(day_meetings, key=lambda x: x.start_time)

        # Check for consecutive runs: meetings are consecutive if one ends
        # and the next starts at the same time or within a short gap (no break)
        consecutive_run: list[Meeting] = [sorted_meetings[0]]

        for i in range(1, len(sorted_meetings)):
            prev = sorted_meetings[i - 1]
            curr = sorted_meetings[i]
            # Consecutive if the previous meeting ends at or after the current starts
            # (allowing for back-to-back with no gap)
            if curr.start_time <= prev.end_time:
                consecutive_run.append(curr)
            else:
                # Gap found - check if previous run was too long
                if len(consecutive_run) > 3:
                    instructor = instructor_objects.get(instructor_id)
                    name = instructor.name if instructor else f"Instructor {instructor_id}"
                    warnings.append(ConflictItem(
                        type="consecutive_teaching",
                        severity="soft",
                        description=(
                            f"Consecutive teaching: {name} teaches "
                            f"{len(consecutive_run)} consecutive blocks on "
                            f"{day} with no break."
                        ),
                        meeting_ids=[m.id for m in consecutive_run],
                    ))
                consecutive_run = [curr]

        # Check final run
        if len(consecutive_run) > 3:
            instructor = instructor_objects.get(instructor_id)
            name = instructor.name if instructor else f"Instructor {instructor_id}"
            warnings.append(ConflictItem(
                type="consecutive_teaching",
                severity="soft",
                description=(
                    f"Consecutive teaching: {name} teaches "
                    f"{len(consecutive_run)} consecutive blocks on "
                    f"{day} with no break."
                ),
                meeting_ids=[m.id for m in consecutive_run],
            ))

    return warnings
