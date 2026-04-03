"""Tests for ICS calendar export."""
from __future__ import annotations

import json
from datetime import date, time

import pytest
from icalendar import Calendar
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.building import Building
from app.models.course import Course
from app.models.instructor import Instructor
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Modality, Section, SectionStatus
from app.models.term import Term, TermStatus, TermType
from app.services.ics_export import generate_ics_for_instructor, generate_ics_for_instructors


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()


@pytest.fixture
def seed_data(db: Session):
    """Seed: 1 term, 1 building, 1 room, 2 instructors, 2 courses, 2 sections with meetings."""
    term = Term(
        id=1, name="Fall 2025", type=TermType.fall, status=TermStatus.draft,
        start_date=date(2025, 8, 25), end_date=date(2025, 12, 12),
    )
    db.add(term)

    bldg = Building(id=1, name="Science Building", abbreviation="SCI")
    db.add(bldg)
    room = Room(id=1, room_number="101", capacity=30, building_id=1)
    db.add(room)

    alice = Instructor(
        id=1, name="Alice Smith", first_name="Alice", last_name="Smith",
        email="alice@uwrf.edu", department="CS", is_active=True,
        instructor_type="faculty",
    )
    bob = Instructor(
        id=2, name="Bob Jones", first_name="Bob", last_name="Jones",
        email="bob@uwrf.edu", department="CS", is_active=True,
        instructor_type="adjunct",
    )
    db.add_all([alice, bob])

    cs101 = Course(id=1, department_code="CS", course_number="101", title="Intro to CS", credits=3)
    cs201 = Course(id=2, department_code="CS", course_number="201", title="Data Structures", credits=3)
    db.add_all([cs101, cs201])

    sec1 = Section(
        id=1, course_id=1, term_id=1, section_number="01",
        enrollment_cap=30, modality=Modality.in_person, status=SectionStatus.scheduled,
    )
    sec2 = Section(
        id=2, course_id=2, term_id=1, section_number="01",
        enrollment_cap=30, modality=Modality.in_person, status=SectionStatus.scheduled,
    )
    db.add_all([sec1, sec2])
    db.flush()

    m1 = Meeting(
        id=1, section_id=1, instructor_id=1, room_id=1,
        days_of_week=json.dumps(["M", "W", "F"]),
        start_time=time(9, 0), end_time=time(9, 50),
    )
    m2 = Meeting(
        id=2, section_id=2, instructor_id=2, room_id=1,
        days_of_week=json.dumps(["T", "Th"]),
        start_time=time(10, 0), end_time=time(11, 15),
    )
    db.add_all([m1, m2])
    db.commit()
    return {"term": term, "alice": alice, "bob": bob}


def test_single_instructor_ics(db, seed_data):
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=1)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    assert len(events) == 1
    ev = events[0]
    assert "CS 101-01" in str(ev.get("SUMMARY"))
    assert "SCI 101" in str(ev.get("LOCATION"))
    rrule = ev.get("RRULE")
    byday = rrule.get("BYDAY")
    assert set(byday) == {"MO", "WE", "FR"}


def test_single_instructor_first_occurrence(db, seed_data):
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=1)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    ev = events[0]
    dtstart = ev.get("DTSTART").dt
    assert dtstart.month == 8
    assert dtstart.day == 25
    assert dtstart.hour == 9
    assert dtstart.minute == 0


def test_tth_first_occurrence(db, seed_data):
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=2)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    ev = events[0]
    dtstart = ev.get("DTSTART").dt
    assert dtstart.month == 8
    assert dtstart.day == 26
    assert dtstart.hour == 10


def test_bulk_instructors(db, seed_data):
    cal_bytes = generate_ics_for_instructors(db, term_id=1, instructor_ids=[1, 2])
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    assert len(events) == 2


def test_no_meetings_returns_empty_calendar(db, seed_data):
    inst = Instructor(
        id=99, name="No Classes", first_name="No", last_name="Classes",
        email="none@uwrf.edu", department="CS", is_active=True,
    )
    db.add(inst)
    db.commit()
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=99)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    assert len(events) == 0


def test_uid_stability(db, seed_data):
    cal1 = Calendar.from_ical(generate_ics_for_instructor(db, term_id=1, instructor_id=1))
    cal2 = Calendar.from_ical(generate_ics_for_instructor(db, term_id=1, instructor_id=1))
    uid1 = [c.get("UID") for c in cal1.walk() if c.name == "VEVENT"][0]
    uid2 = [c.get("UID") for c in cal2.walk() if c.name == "VEVENT"][0]
    assert uid1 == uid2
