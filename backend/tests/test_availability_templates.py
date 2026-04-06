"""Tests for instructor availability template endpoints."""

from __future__ import annotations

from datetime import date, time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.instructor import Instructor
from app.models.term import Term, TermStatus, TermType


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def instructor(db: Session) -> Instructor:
    inst = Instructor(
        name="Smith, Jane",
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@uwrf.edu",
        department="Accounting",
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
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
    db.commit()
    db.refresh(term)
    return term


def test_create_and_get_fall_template(db, instructor):
    from app.models.availability_template import InstructorAvailabilityTemplate
    from app.models.instructor import AvailabilityType

    template = InstructorAvailabilityTemplate(
        instructor_id=instructor.id,
        term_type="fall",
        day_of_week="T",
        start_time=time(9, 0),
        end_time=time(10, 0),
        type=AvailabilityType.unavailable,
    )
    db.add(template)
    db.commit()

    results = (
        db.query(InstructorAvailabilityTemplate)
        .filter_by(instructor_id=instructor.id, term_type="fall")
        .all()
    )
    assert len(results) == 1
    assert results[0].day_of_week == "T"
    assert results[0].type == AvailabilityType.unavailable


def test_summer_winter_boolean_fields(db, instructor):
    assert instructor.available_summer is True
    assert instructor.available_winter is True

    instructor.available_summer = False
    db.commit()
    db.refresh(instructor)
    assert instructor.available_summer is False


def test_apply_template_to_term(db, instructor, fall_term):
    from app.models.availability_template import InstructorAvailabilityTemplate
    from app.models.instructor import AvailabilityType, InstructorAvailability

    template = InstructorAvailabilityTemplate(
        instructor_id=instructor.id,
        term_type="fall",
        day_of_week="M",
        start_time=time(14, 0),
        end_time=time(15, 0),
        type=AvailabilityType.prefer_avoid,
    )
    db.add(template)
    db.commit()

    templates = (
        db.query(InstructorAvailabilityTemplate)
        .filter_by(instructor_id=instructor.id, term_type="fall")
        .all()
    )
    for t in templates:
        avail = InstructorAvailability(
            instructor_id=instructor.id,
            term_id=fall_term.id,
            day_of_week=t.day_of_week,
            start_time=t.start_time,
            end_time=t.end_time,
            type=t.type,
        )
        db.add(avail)
    db.commit()

    results = (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor.id, term_id=fall_term.id)
        .all()
    )
    assert len(results) == 1
    assert results[0].day_of_week == "M"
    assert results[0].type == AvailabilityType.prefer_avoid
