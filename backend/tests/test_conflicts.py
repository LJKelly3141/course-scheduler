"""
Tests for the conflict detection engine.

Uses an in-memory SQLite database with seeded test data. Covers:
- Room conflict detection
- Instructor conflict detection
- Section overlap detection
- Room capacity check
- Instructor modality mismatch
- No false positives (non-overlapping meetings should not conflict)
"""

import json
from datetime import date, time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.building import Building
from app.models.course import Course
from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
    ModalityConstraint,
)
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Modality, Section, SectionStatus
from app.models.term import Term, TermStatus, TermType
from app.models.time_block import BlockPattern, TimeBlock
from app.services.conflict_engine import check_meeting_conflicts, detect_hard_conflicts


@pytest.fixture
def db():
    """Create an in-memory SQLite database with all tables and return a session."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()


@pytest.fixture
def seed_data(db: Session):
    """
    Seed the database with basic test data.

    Creates:
    - 1 term (Fall 2025)
    - 1 building (South Hall)
    - 2 rooms (SH 101 cap 30, SH 202 cap 50)
    - 2 instructors (Alice - any, Bob - online_only)
    - 2 courses (CS 101 3cr, CS 201 3cr)
    - 4 sections in the term
    - 1 standard MWF time block (8:00-8:50)
    - 1 standard TTh time block (9:30-10:45)
    """
    term = Term(
        id=1, name="Fall 2025", type=TermType.fall,
        start_date=date(2025, 9, 1), end_date=date(2025, 12, 15),
        status=TermStatus.draft,
    )
    db.add(term)

    building = Building(id=1, name="South Hall", abbreviation="SH")
    db.add(building)

    room1 = Room(id=1, building_id=1, room_number="101", capacity=30)
    room2 = Room(id=2, building_id=1, room_number="202", capacity=50)
    db.add_all([room1, room2])

    alice = Instructor(
        id=1, name="Alice Smith", email="alice@uwrf.edu",
        department="CS", modality_constraint=ModalityConstraint.any,
        max_credits=12, is_active=True,
    )
    bob = Instructor(
        id=2, name="Bob Jones", email="bob@uwrf.edu",
        department="CS", modality_constraint=ModalityConstraint.online_only,
        max_credits=12, is_active=True,
    )
    db.add_all([alice, bob])

    cs101 = Course(id=1, department_code="CS", course_number="101", title="Intro CS", credits=3)
    cs201 = Course(id=2, department_code="CS", course_number="201", title="Data Structures", credits=3)
    db.add_all([cs101, cs201])

    sec1 = Section(
        id=1, course_id=1, term_id=1, section_number="001",
        enrollment_cap=30, modality=Modality.in_person,
        status=SectionStatus.scheduled,
    )
    sec2 = Section(
        id=2, course_id=1, term_id=1, section_number="002",
        enrollment_cap=30, modality=Modality.in_person,
        status=SectionStatus.scheduled,
    )
    sec3 = Section(
        id=3, course_id=2, term_id=1, section_number="001",
        enrollment_cap=25, modality=Modality.in_person,
        status=SectionStatus.scheduled,
    )
    sec4 = Section(
        id=4, course_id=2, term_id=1, section_number="002",
        enrollment_cap=60, modality=Modality.in_person,
        status=SectionStatus.scheduled,
    )
    db.add_all([sec1, sec2, sec3, sec4])

    tb_mwf = TimeBlock(
        id=1, pattern=BlockPattern.mwf,
        days_of_week=json.dumps(["M", "W", "F"]),
        start_time=time(8, 0), end_time=time(8, 50),
        label="MWF 8:00-8:50",
    )
    tb_tth = TimeBlock(
        id=2, pattern=BlockPattern.tth,
        days_of_week=json.dumps(["T", "Th"]),
        start_time=time(9, 30), end_time=time(10, 45),
        label="TTh 9:30-10:45",
    )
    db.add_all([tb_mwf, tb_tth])

    db.commit()

    return {
        "term": term,
        "building": building,
        "rooms": [room1, room2],
        "instructors": [alice, bob],
        "courses": [cs101, cs201],
        "sections": [sec1, sec2, sec3, sec4],
        "time_blocks": [tb_mwf, tb_tth],
    }


class TestRoomConflict:
    """Tests for room double-booking detection."""

    def test_room_conflict_same_room_same_time(self, db: Session, seed_data):
        """Two meetings in the same room at the same time on the same days."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1, time_block_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=None, time_block_id=1,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 1
        assert 1 in room_conflicts[0].meeting_ids
        assert 2 in room_conflicts[0].meeting_ids

    def test_room_conflict_partial_day_overlap(self, db: Session, seed_data):
        """Two meetings sharing some days in the same room with overlapping times."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        # Shares Wednesday only
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["W"]),
            start_time=time(8, 30), end_time=time(9, 20),
            room_id=1, instructor_id=None,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 1

    def test_no_room_conflict_different_rooms(self, db: Session, seed_data):
        """Two meetings at the same time but in different rooms should not conflict."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=2, instructor_id=None,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 0

    def test_no_room_conflict_different_days(self, db: Session, seed_data):
        """Same room, same time, but different days should not conflict."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["T", "Th"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=None,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 0

    def test_no_room_conflict_adjacent_times(self, db: Session, seed_data):
        """Same room, same days, but adjacent times (not overlapping) should not conflict."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        # Starts exactly when the first ends - no overlap
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 50), end_time=time(9, 40),
            room_id=1, instructor_id=None,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 0


class TestInstructorConflict:
    """Tests for instructor double-booking detection."""

    def test_instructor_conflict_same_time(self, db: Session, seed_data):
        """Same instructor, overlapping time, shared days."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=2, instructor_id=1,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        instructor_conflicts = [c for c in conflicts if c.type == "instructor_conflict"]
        assert len(instructor_conflicts) == 1
        assert 1 in instructor_conflicts[0].meeting_ids
        assert 2 in instructor_conflicts[0].meeting_ids

    def test_no_instructor_conflict_different_instructors(self, db: Session, seed_data):
        """Different instructors at the same time should not conflict."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=2, instructor_id=2,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        instructor_conflicts = [c for c in conflicts if c.type == "instructor_conflict"]
        assert len(instructor_conflicts) == 0

    def test_no_instructor_conflict_different_times(self, db: Session, seed_data):
        """Same instructor at different (non-overlapping) times should not conflict."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(9, 0), end_time=time(9, 50),
            room_id=2, instructor_id=1,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        instructor_conflicts = [c for c in conflicts if c.type == "instructor_conflict"]
        assert len(instructor_conflicts) == 0


class TestSectionOverlap:
    """Tests for section self-overlap detection."""

    def test_section_overlap(self, db: Session, seed_data):
        """Same section with two overlapping meetings."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 30), end_time=time(9, 20),
            room_id=2, instructor_id=None,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        section_conflicts = [c for c in conflicts if c.type == "section_conflict"]
        assert len(section_conflicts) == 1

    def test_no_section_overlap_non_overlapping(self, db: Session, seed_data):
        """Same section with non-overlapping meetings (e.g., lecture + lab at different times)."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        m2 = Meeting(
            id=2, section_id=1, days_of_week=json.dumps(["T"]),
            start_time=time(14, 0), end_time=time(15, 50),
            room_id=1, instructor_id=1,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        section_conflicts = [c for c in conflicts if c.type == "section_conflict"]
        assert len(section_conflicts) == 0


class TestRoomCapacity:
    """Tests for room capacity hard constraint."""

    def test_room_capacity_exceeded(self, db: Session, seed_data):
        """Section enrollment cap exceeds room capacity."""
        # sec4 has enrollment_cap=60, room1 has capacity=30
        m1 = Meeting(
            id=1, section_id=4, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        cap_conflicts = [c for c in conflicts if c.type == "room_capacity"]
        assert len(cap_conflicts) == 1
        assert "capacity" in cap_conflicts[0].description.lower()

    def test_room_capacity_sufficient(self, db: Session, seed_data):
        """Section enrollment cap within room capacity should not conflict."""
        # sec3 has enrollment_cap=25, room1 has capacity=30
        m1 = Meeting(
            id=1, section_id=3, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        cap_conflicts = [c for c in conflicts if c.type == "room_capacity"]
        assert len(cap_conflicts) == 0

    def test_room_capacity_exact_match(self, db: Session, seed_data):
        """Section enrollment cap equals room capacity - no hard conflict (soft warning only)."""
        # sec1 has enrollment_cap=30, room1 has capacity=30
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        cap_conflicts = [c for c in conflicts if c.type == "room_capacity"]
        assert len(cap_conflicts) == 0


class TestInstructorModalityMismatch:
    """Tests for instructor modality constraint violations."""

    def test_online_only_instructor_in_person_section(self, db: Session, seed_data):
        """Online-only instructor assigned to in-person section."""
        # Bob (id=2) is online_only, sec1 is in_person
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=2,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        modality_conflicts = [c for c in conflicts if c.type == "instructor_modality_mismatch"]
        assert len(modality_conflicts) == 1
        assert "online-only" in modality_conflicts[0].description.lower()

    def test_mwf_only_instructor_on_tth(self, db: Session, seed_data):
        """MWF-only instructor assigned to a TTh meeting."""
        # Change Alice to mwf_only for this test
        alice = db.query(Instructor).filter(Instructor.id == 1).first()
        alice.modality_constraint = ModalityConstraint.mwf_only
        db.commit()

        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["T", "Th"]),
            start_time=time(9, 30), end_time=time(10, 45),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        modality_conflicts = [c for c in conflicts if c.type == "instructor_modality_mismatch"]
        assert len(modality_conflicts) == 1
        assert "mwf-only" in modality_conflicts[0].description.lower()

    def test_tth_only_instructor_on_mwf(self, db: Session, seed_data):
        """TTh-only instructor assigned to a MWF meeting."""
        alice = db.query(Instructor).filter(Instructor.id == 1).first()
        alice.modality_constraint = ModalityConstraint.tth_only
        db.commit()

        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        modality_conflicts = [c for c in conflicts if c.type == "instructor_modality_mismatch"]
        assert len(modality_conflicts) == 1
        assert "tth-only" in modality_conflicts[0].description.lower()

    def test_any_constraint_no_mismatch(self, db: Session, seed_data):
        """Instructor with 'any' modality constraint should never get a mismatch."""
        # Alice (id=1) has modality_constraint=any
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["T", "Th"]),
            start_time=time(9, 30), end_time=time(10, 45),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        modality_conflicts = [c for c in conflicts if c.type == "instructor_modality_mismatch"]
        assert len(modality_conflicts) == 0


class TestInstructorUnavailability:
    """Tests for instructor unavailability hard constraint."""

    def test_meeting_during_unavailable_time(self, db: Session, seed_data):
        """Meeting placed during instructor's unavailable time block."""
        unavail = InstructorAvailability(
            id=1, instructor_id=1, term_id=1,
            day_of_week="M",
            start_time=time(7, 0), end_time=time(9, 0),
            type=AvailabilityType.unavailable,
        )
        db.add(unavail)

        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        unavail_conflicts = [c for c in conflicts if c.type == "instructor_unavailability"]
        assert len(unavail_conflicts) == 1
        assert "unavailable" in unavail_conflicts[0].description.lower()

    def test_meeting_outside_unavailable_time(self, db: Session, seed_data):
        """Meeting outside the unavailable window should not conflict."""
        unavail = InstructorAvailability(
            id=1, instructor_id=1, term_id=1,
            day_of_week="M",
            start_time=time(12, 0), end_time=time(14, 0),
            type=AvailabilityType.unavailable,
        )
        db.add(unavail)

        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        unavail_conflicts = [c for c in conflicts if c.type == "instructor_unavailability"]
        assert len(unavail_conflicts) == 0

    def test_prefer_avoid_not_hard_conflict(self, db: Session, seed_data):
        """Prefer-avoid time should NOT generate a hard conflict."""
        prefer_avoid = InstructorAvailability(
            id=1, instructor_id=1, term_id=1,
            day_of_week="M",
            start_time=time(7, 0), end_time=time(9, 0),
            type=AvailabilityType.prefer_avoid,
        )
        db.add(prefer_avoid)

        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        unavail_conflicts = [c for c in conflicts if c.type == "instructor_unavailability"]
        assert len(unavail_conflicts) == 0


class TestTimeValidity:
    """Tests for time validity checks."""

    def test_end_before_start(self, db: Session, seed_data):
        """end_time before start_time should be flagged."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(9, 0), end_time=time(8, 0),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        time_conflicts = [c for c in conflicts if c.type == "time_validity"]
        assert len(time_conflicts) >= 1
        assert any("end_time" in c.description for c in time_conflicts)

    def test_invalid_day_codes(self, db: Session, seed_data):
        """Invalid day codes should be flagged."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "X", "Z"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        time_conflicts = [c for c in conflicts if c.type == "time_validity"]
        assert len(time_conflicts) >= 1
        assert any("invalid" in c.description.lower() for c in time_conflicts)


class TestNoFalsePositives:
    """Ensure that non-conflicting scenarios produce no conflicts."""

    def test_no_conflicts_clean_schedule(self, db: Session, seed_data):
        """A well-separated schedule should have no hard conflicts."""
        # Meeting 1: MWF 8-8:50, room 1, instructor 1, section 1
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1, time_block_id=1,
        )
        # Meeting 2: TTh 9:30-10:45, room 2, instructor 1, section 3
        m2 = Meeting(
            id=2, section_id=3, days_of_week=json.dumps(["T", "Th"]),
            start_time=time(9, 30), end_time=time(10, 45),
            room_id=2, instructor_id=1, time_block_id=2,
        )
        db.add_all([m1, m2])
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        assert len(conflicts) == 0

    def test_empty_term_no_conflicts(self, db: Session, seed_data):
        """A term with no meetings should have no conflicts."""
        conflicts = detect_hard_conflicts(db, term_id=1)
        assert len(conflicts) == 0

    def test_no_conflict_online_section_no_room(self, db: Session, seed_data):
        """Online section with no room should not flag room capacity."""
        # Create an online section
        online_sec = Section(
            id=10, course_id=1, term_id=1, section_number="099",
            enrollment_cap=100, modality=Modality.online_sync,
            status=SectionStatus.scheduled,
        )
        db.add(online_sec)

        m1 = Meeting(
            id=1, section_id=10, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=None, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        conflicts = detect_hard_conflicts(db, term_id=1)
        cap_conflicts = [c for c in conflicts if c.type == "room_capacity"]
        assert len(cap_conflicts) == 0


class TestCheckMeetingConflicts:
    """Tests for the single-meeting conflict checker (used during create/update)."""

    def test_check_new_meeting_with_existing_conflict(self, db: Session, seed_data):
        """Check a new meeting that would conflict with an existing one."""
        # Existing meeting
        m_existing = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m_existing)
        db.commit()

        # New meeting (not yet persisted) - same room, same time
        new_meeting = Meeting(
            section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=None,
        )

        conflicts = check_meeting_conflicts(db, new_meeting, term_id=1)
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 1

    def test_check_meeting_excludes_self(self, db: Session, seed_data):
        """When updating, the meeting should not conflict with itself."""
        m1 = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m1)
        db.commit()

        # Check meeting 1 against the term, excluding itself
        conflicts = check_meeting_conflicts(
            db, m1, term_id=1, exclude_meeting_id=1,
        )
        room_conflicts = [c for c in conflicts if c.type == "room_conflict"]
        assert len(room_conflicts) == 0

    def test_check_meeting_no_conflict(self, db: Session, seed_data):
        """A meeting that does not conflict should return empty list."""
        m_existing = Meeting(
            id=1, section_id=1, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(8, 0), end_time=time(8, 50),
            room_id=1, instructor_id=1,
        )
        db.add(m_existing)
        db.commit()

        # New meeting at a different time
        new_meeting = Meeting(
            section_id=2, days_of_week=json.dumps(["M", "W", "F"]),
            start_time=time(10, 0), end_time=time(10, 50),
            room_id=1, instructor_id=None,
        )

        conflicts = check_meeting_conflicts(db, new_meeting, term_id=1)
        assert len(conflicts) == 0
