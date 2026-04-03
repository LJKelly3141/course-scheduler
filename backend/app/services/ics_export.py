"""ICS calendar export for instructor schedules."""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from typing import List, Optional

import pytz
from icalendar import Calendar, Event
from sqlalchemy.orm import Session, joinedload

from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section
from app.models.term import Term

TIMEZONE = pytz.timezone("America/Chicago")

DAY_MAP = {
    "M":  ("MO", 0),
    "T":  ("TU", 1),
    "W":  ("WE", 2),
    "Th": ("TH", 3),
    "F":  ("FR", 4),
    "S":  ("SA", 5),
    "U":  ("SU", 6),
}


def _first_occurrence(term_start: date, days: list) -> date:
    target_weekdays = []
    for d in days:
        entry = DAY_MAP.get(d)
        if entry:
            target_weekdays.append(entry[1])
    if not target_weekdays:
        return term_start

    best = None
    for wd in target_weekdays:
        delta = (wd - term_start.weekday()) % 7
        candidate = term_start + timedelta(days=delta)
        if best is None or candidate < best:
            best = candidate
    return best or term_start


def _parse_days(days_of_week):
    if not days_of_week:
        return []
    try:
        parsed = json.loads(days_of_week)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _build_calendar() -> Calendar:
    cal = Calendar()
    cal.add("prodid", "-//UWRF Course Scheduler//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-timezone", "America/Chicago")
    return cal


def _meeting_to_event(meeting, section, term):
    days = _parse_days(meeting.days_of_week)
    if not days or not meeting.start_time or not meeting.end_time:
        return None

    byday = []
    for d in days:
        entry = DAY_MAP.get(d)
        if entry:
            byday.append(entry[0])
    if not byday:
        return None

    course = section.course
    if not course:
        return None

    first_day = _first_occurrence(term.start_date, days)
    dt_start = TIMEZONE.localize(datetime.combine(first_day, meeting.start_time))
    dt_end = TIMEZONE.localize(datetime.combine(first_day, meeting.end_time))
    until = TIMEZONE.localize(datetime.combine(term.end_date, time(23, 59, 59)))

    location = ""
    if meeting.room:
        room = meeting.room
        bldg = room.building
        if bldg:
            location = f"{bldg.abbreviation} {room.room_number} ({bldg.name})"
        else:
            location = room.room_number

    summary = f"{course.department_code} {course.course_number}-{section.section_number} {course.title}"
    modality_label = (section.modality or "in_person").replace("_", " ").title()
    description = f"Section {section.section_number} | {modality_label} | Cap: {section.enrollment_cap} | {course.credits} credits"

    event = Event()
    event.add("summary", summary)
    event.add("dtstart", dt_start)
    event.add("dtend", dt_end)
    event.add("rrule", {"freq": "weekly", "byday": byday, "until": until})
    event.add("location", location)
    event.add("description", description)
    event.add("uid", f"meeting-{meeting.id}@coursescheduler")

    return event


def _get_instructor_meetings(db, term_id, instructor_id):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")

    meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(
            Section.term_id == term_id,
            Meeting.instructor_id == instructor_id,
            Meeting.start_time.isnot(None),
            Meeting.end_time.isnot(None),
            Section.modality.in_(["in_person", "hybrid", "online_sync"]),
        )
        .options(
            joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Meeting.section).joinedload(Section.course),
        )
        .all()
    )
    return term, [(m, m.section) for m in meetings]


def generate_ics_for_instructor(db, term_id, instructor_id):
    term, meeting_pairs = _get_instructor_meetings(db, term_id, instructor_id)
    cal = _build_calendar()
    for meeting, section in meeting_pairs:
        event = _meeting_to_event(meeting, section, term)
        if event:
            cal.add_component(event)
    return cal.to_ical()


def generate_ics_for_instructors(db, term_id, instructor_ids):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")
    cal = _build_calendar()
    for inst_id in instructor_ids:
        _, meeting_pairs = _get_instructor_meetings(db, term_id, inst_id)
        for meeting, section in meeting_pairs:
            event = _meeting_to_event(meeting, section, term)
            if event:
                cal.add_component(event)
    return cal.to_ical()
