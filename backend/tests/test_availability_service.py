"""Tests for availability_service — apply_templates_to_term()."""

from __future__ import annotations

import json
from datetime import date, time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
)
from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.term import Term, TermStatus, TermType
from app.models.time_block import BlockPattern, TimeBlock
from app.services.availability_service import apply_templates_to_term


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def instructor_a(db: Session) -> Instructor:
    inst = Instructor(
        name="Smith, Jane",
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@uwrf.edu",
        department="Accounting",
        available_summer=True,
        available_winter=True,
    )
    db.add(inst)
    db.flush()
    return inst


@pytest.fixture
def instructor_b(db: Session) -> Instructor:
    inst = Instructor(
        name="Doe, John",
        first_name="John",
        last_name="Doe",
        email="john.doe@uwrf.edu",
        department="Accounting",
        available_summer=False,
        available_winter=False,
    )
    db.add(inst)
    db.flush()
    return inst


@pytest.fixture
def fall_term(db: Session) -> Term:
    term = Term(
        name="Fall 2026",
        type=TermType.fall,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 12, 15),
        status=TermStatus.draft,
    )
    db.add(term)
    db.flush()
    return term


@pytest.fixture
def spring_term(db: Session) -> Term:
    term = Term(
        name="Spring 2027",
        type=TermType.spring,
        start_date=date(2027, 1, 20),
        end_date=date(2027, 5, 15),
        status=TermStatus.draft,
    )
    db.add(term)
    db.flush()
    return term


@pytest.fixture
def summer_term(db: Session) -> Term:
    term = Term(
        name="Summer 2027",
        type=TermType.summer,
        start_date=date(2027, 6, 1),
        end_date=date(2027, 8, 15),
        status=TermStatus.draft,
    )
    db.add(term)
    db.flush()
    return term


@pytest.fixture
def winter_term(db: Session) -> Term:
    term = Term(
        name="Winter 2027",
        type=TermType.winter,
        start_date=date(2027, 1, 2),
        end_date=date(2027, 1, 18),
        status=TermStatus.draft,
    )
    db.add(term)
    db.flush()
    return term


@pytest.fixture
def time_blocks(db: Session) -> list:
    """Create a small set of time blocks for summer/winter expansion tests."""
    blocks = [
        TimeBlock(
            pattern=BlockPattern.mwf,
            days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(9, 0),
            end_time=time(9, 50),
            label="MWF 9:00-9:50",
        ),
        TimeBlock(
            pattern=BlockPattern.tth,
            days_of_week=json.dumps(["T", "Th"]),
            start_time=time(9, 30),
            end_time=time(10, 45),
            label="TTh 9:30-10:45",
        ),
    ]
    db.add_all(blocks)
    db.flush()
    return blocks


@pytest.fixture
def instructor(db: Session) -> Instructor:
    """A generic instructor for tests that only need one."""
    inst = Instructor(
        name="Test, Instructor",
        first_name="Instructor",
        last_name="Test",
        email="test.instructor@uwrf.edu",
        department="Accounting",
        available_summer=True,
        available_winter=True,
    )
    db.add(inst)
    db.flush()
    return inst


def test_apply_fall_templates_to_fall_term(db, instructor_a, fall_term):
    """Fall templates should be copied to a fall term."""

    # Create fall templates for instructor_a
    t1 = InstructorAvailabilityTemplate(
        instructor_id=instructor_a.id,
        term_type="fall",
        day_of_week="M",
        start_time=time(8, 0),
        end_time=time(9, 0),
        type=AvailabilityType.unavailable,
    )
    t2 = InstructorAvailabilityTemplate(
        instructor_id=instructor_a.id,
        term_type="fall",
        day_of_week="T",
        start_time=time(14, 0),
        end_time=time(15, 0),
        type=AvailabilityType.prefer_avoid,
    )
    db.add_all([t1, t2])
    db.flush()

    count = apply_templates_to_term(db, fall_term)
    assert count == 2

    records = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_a.id, term_id=fall_term.id)
        .all()
    )
    assert len(records) == 2
    days = {r.day_of_week for r in records}
    assert days == {"M", "T"}


def test_spring_templates_not_applied_to_fall_term(db, instructor_a, fall_term):
    """Spring templates should NOT be copied when applying to a fall term."""

    # Create spring-only template
    t1 = InstructorAvailabilityTemplate(
        instructor_id=instructor_a.id,
        term_type="spring",
        day_of_week="W",
        start_time=time(10, 0),
        end_time=time(11, 0),
        type=AvailabilityType.unavailable,
    )
    db.add(t1)
    db.flush()

    count = apply_templates_to_term(db, fall_term)
    assert count == 0

    records = (
        db.query(InstructorAvailability)
        .filter_by(term_id=fall_term.id)
        .all()
    )
    assert len(records) == 0


def test_summer_unavailable_creates_blanket_blocks(
    db, instructor_b, summer_term, time_blocks
):
    """Instructor with available_summer=False gets unavailable records for all time block day slots."""

    count = apply_templates_to_term(db, summer_term)

    # MWF block expands to 3 days, TTh block expands to 2 days = 5 total
    assert count == 5

    records = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_b.id, term_id=summer_term.id)
        .all()
    )
    assert len(records) == 5
    assert all(r.type == AvailabilityType.unavailable for r in records)
    days = sorted([r.day_of_week for r in records])
    assert days == ["F", "M", "T", "Th", "W"]


def test_summer_available_instructor_gets_no_records(
    db, instructor_a, summer_term, time_blocks
):
    """Instructor with available_summer=True gets no records."""

    count = apply_templates_to_term(db, summer_term)
    assert count == 0

    records = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_a.id, term_id=summer_term.id)
        .all()
    )
    assert len(records) == 0


def test_winter_unavailable_creates_blanket_blocks(
    db, instructor_b, winter_term, time_blocks
):
    """Instructor with available_winter=False gets unavailable records for all time block day slots."""

    count = apply_templates_to_term(db, winter_term)

    # Same expansion: MWF=3 + TTh=2 = 5
    assert count == 5

    records = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_b.id, term_id=winter_term.id)
        .all()
    )
    assert len(records) == 5
    assert all(r.type == AvailabilityType.unavailable for r in records)


def test_no_templates_means_no_records(db, instructor_a, fall_term):
    """An instructor with no templates for the term type gets no availability records."""

    count = apply_templates_to_term(db, fall_term)
    assert count == 0

    records = (
        db.query(InstructorAvailability)
        .filter_by(term_id=fall_term.id)
        .all()
    )
    assert len(records) == 0


def test_multiple_instructors(db, instructor_a, instructor_b, spring_term):
    """Templates are applied for ALL instructors with matching term_type templates."""

    # Spring templates for instructor_a
    t1 = InstructorAvailabilityTemplate(
        instructor_id=instructor_a.id,
        term_type="spring",
        day_of_week="M",
        start_time=time(8, 0),
        end_time=time(9, 0),
        type=AvailabilityType.unavailable,
    )
    # Spring templates for instructor_b
    t2 = InstructorAvailabilityTemplate(
        instructor_id=instructor_b.id,
        term_type="spring",
        day_of_week="Th",
        start_time=time(13, 0),
        end_time=time(14, 0),
        type=AvailabilityType.prefer_avoid,
    )
    t3 = InstructorAvailabilityTemplate(
        instructor_id=instructor_b.id,
        term_type="spring",
        day_of_week="F",
        start_time=time(10, 0),
        end_time=time(11, 0),
        type=AvailabilityType.unavailable,
    )
    db.add_all([t1, t2, t3])
    db.flush()

    count = apply_templates_to_term(db, spring_term)
    assert count == 3

    records_a = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_a.id, term_id=spring_term.id)
        .all()
    )
    assert len(records_a) == 1

    records_b = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_b.id, term_id=spring_term.id)
        .all()
    )
    assert len(records_b) == 2


def test_apply_is_idempotent(db, instructor, time_blocks):
    """Calling apply_templates_to_term twice returns 0 the second time (no duplicates)."""
    db.add(InstructorAvailabilityTemplate(
        instructor_id=instructor.id, term_type="fall",
        day_of_week="T", start_time=time(9, 30), end_time=time(10, 45),
        type=AvailabilityType.unavailable,
    ))
    db.flush()

    term = Term(name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.flush()

    count1 = apply_templates_to_term(db, term)
    count2 = apply_templates_to_term(db, term)
    assert count1 == 1
    assert count2 == 0  # idempotent — no new records

    records = db.query(InstructorAvailability).filter_by(
        instructor_id=instructor.id, term_id=term.id).all()
    assert len(records) == 1  # no duplicates
