"""Seed the database with standard time blocks and sample data."""
import json
from datetime import time, date
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal
from app.models import Base, TimeBlock, Building, Room, Instructor, Course, Term, TermSession
from app.models.section import Section, Modality, SectionStatus
from app.models.meeting import Meeting
from app.models.time_block import BlockPattern
from app.models.instructor import ModalityConstraint

STANDARD_TIME_BLOCKS = [
    # MWF blocks
    (BlockPattern.mwf, ["M", "W", "F"], time(8, 0), time(8, 50), "MWF 8:00-8:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(9, 0), time(9, 50), "MWF 9:00-9:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(10, 0), time(10, 50), "MWF 10:00-10:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(11, 0), time(11, 50), "MWF 11:00-11:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(12, 0), time(12, 50), "MWF 12:00-12:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(13, 0), time(13, 50), "MWF 1:00-1:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(14, 0), time(14, 50), "MWF 2:00-2:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(15, 0), time(15, 50), "MWF 3:00-3:50"),
    (BlockPattern.mwf, ["M", "W", "F"], time(16, 0), time(16, 50), "MWF 4:00-4:50"),
    # TTh blocks
    (BlockPattern.tth, ["T", "Th"], time(8, 0), time(9, 15), "TTh 8:00-9:15"),
    (BlockPattern.tth, ["T", "Th"], time(9, 30), time(10, 45), "TTh 9:30-10:45"),
    (BlockPattern.tth, ["T", "Th"], time(11, 0), time(12, 15), "TTh 11:00-12:15"),
    (BlockPattern.tth, ["T", "Th"], time(12, 30), time(13, 45), "TTh 12:30-1:45"),
    (BlockPattern.tth, ["T", "Th"], time(14, 0), time(15, 15), "TTh 2:00-3:15"),
    (BlockPattern.tth, ["T", "Th"], time(15, 30), time(16, 45), "TTh 3:30-4:45"),
    # Evening blocks
    (BlockPattern.evening, ["M"], time(18, 0), time(20, 50), "Mon Evening 6:00-8:50"),
    (BlockPattern.evening, ["T"], time(18, 0), time(20, 50), "Tue Evening 6:00-8:50"),
    (BlockPattern.evening, ["W"], time(18, 0), time(20, 50), "Wed Evening 6:00-8:50"),
    (BlockPattern.evening, ["Th"], time(18, 0), time(20, 50), "Thu Evening 6:00-8:50"),
]


def seed_time_blocks(db: Session):
    if db.query(TimeBlock).count() > 0:
        print("Time blocks already seeded, skipping.")
        return
    for pattern, days, start, end, label in STANDARD_TIME_BLOCKS:
        db.add(TimeBlock(
            pattern=pattern,
            days_of_week=json.dumps(days),
            start_time=start,
            end_time=end,
            label=label,
        ))
    db.commit()
    print(f"Seeded {len(STANDARD_TIME_BLOCKS)} time blocks.")


def seed_sample_data(db: Session):
    if db.query(Building).count() > 0:
        print("Sample data already seeded, skipping.")
        return

    # Buildings
    nh = Building(name="North Hall", abbreviation="NH")
    sh = Building(name="South Hall", abbreviation="SH")
    db.add_all([nh, sh])
    db.flush()

    # Rooms
    rooms = [
        Room(building_id=nh.id, room_number="101", capacity=30),
        Room(building_id=nh.id, room_number="102", capacity=35),
        Room(building_id=nh.id, room_number="103", capacity=25),
        Room(building_id=nh.id, room_number="110", capacity=50),
        Room(building_id=nh.id, room_number="201", capacity=30),
        Room(building_id=nh.id, room_number="202", capacity=40),
        Room(building_id=nh.id, room_number="210", capacity=60),
        Room(building_id=nh.id, room_number="301", capacity=20),
        Room(building_id=sh.id, room_number="101", capacity=35),
        Room(building_id=sh.id, room_number="102", capacity=30),
        Room(building_id=sh.id, room_number="103", capacity=45),
        Room(building_id=sh.id, room_number="201", capacity=25),
        Room(building_id=sh.id, room_number="202", capacity=30),
        Room(building_id=sh.id, room_number="210", capacity=55),
        Room(building_id=sh.id, room_number="301", capacity=20),
    ]
    db.add_all(rooms)
    db.flush()

    # Instructors
    instructors = [
        Instructor(name="Alice Johnson", email="alice.johnson@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Bob Smith", email="bob.smith@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Carol Davis", email="carol.davis@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.mwf_only, max_credits=12),
        Instructor(name="David Wilson", email="david.wilson@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.tth_only, max_credits=9),
        Instructor(name="Emily Brown", email="emily.brown@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Frank Miller", email="frank.miller@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Grace Lee", email="grace.lee@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.online_only, max_credits=12),
        Instructor(name="Henry Taylor", email="henry.taylor@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=15),
        Instructor(name="Irene Anderson", email="irene.anderson@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="James Thomas", email="james.thomas@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Karen White", email="karen.white@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=12),
        Instructor(name="Larry Harris", email="larry.harris@uwrf.edu", department="CIS", modality_constraint=ModalityConstraint.any, max_credits=6),
    ]
    db.add_all(instructors)
    db.flush()

    # Courses
    courses = [
        Course(department_code="CIS", course_number="101", title="Intro to Computing", credits=3),
        Course(department_code="CIS", course_number="110", title="Programming Fundamentals", credits=3),
        Course(department_code="CIS", course_number="120", title="Web Technologies", credits=3),
        Course(department_code="CIS", course_number="200", title="Data Structures", credits=3),
        Course(department_code="CIS", course_number="210", title="Computer Architecture", credits=3),
        Course(department_code="CIS", course_number="255", title="Web Development", credits=3),
        Course(department_code="CIS", course_number="300", title="Database Systems", credits=3),
        Course(department_code="CIS", course_number="310", title="Operating Systems", credits=3),
        Course(department_code="CIS", course_number="320", title="Software Engineering", credits=3),
        Course(department_code="CIS", course_number="340", title="Computer Networks", credits=3),
        Course(department_code="CIS", course_number="350", title="Algorithms", credits=3),
        Course(department_code="CIS", course_number="360", title="Cybersecurity Fundamentals", credits=3),
        Course(department_code="CIS", course_number="400", title="Senior Project I", credits=3),
        Course(department_code="CIS", course_number="410", title="Senior Project II", credits=3),
        Course(department_code="CIS", course_number="420", title="Cloud Computing", credits=3),
        Course(department_code="CIS", course_number="450", title="Machine Learning", credits=3),
        Course(department_code="CIS", course_number="600", title="Advanced Databases", credits=3),
        Course(department_code="CIS", course_number="650", title="Advanced Algorithms", credits=3),
        Course(department_code="CIS", course_number="700", title="Thesis Research", credits=3),
        Course(department_code="CIS", course_number="710", title="Graduate Seminar", credits=1),
    ]
    db.add_all(courses)
    db.flush()

    # Term
    term = Term(
        name="Fall 2025",
        type="fall",
        start_date=date(2025, 9, 2),
        end_date=date(2025, 12, 19),
        status="draft",
    )
    db.add(term)
    db.flush()

    db.commit()
    print("Seeded sample buildings, rooms, instructors, courses, and term.")


def seed_sections_and_meetings(db: Session):
    """Seed sections and meetings with some intentional conflicts for testing."""
    if db.query(Section).count() > 0:
        print("Sections already seeded, skipping.")
        return

    term = db.query(Term).first()
    if not term:
        print("No term found, skipping sections.")
        return

    courses = {c.course_number: c for c in db.query(Course).all()}
    instructors = {i.name.split()[0].lower(): i for i in db.query(Instructor).all()}
    rooms = db.query(Room).all()
    time_blocks = {tb.label: tb for tb in db.query(TimeBlock).all()}

    # Helper to get room by building abbreviation + number
    room_map = {}
    for r in rooms:
        bldg = db.query(Building).filter(Building.id == r.building_id).first()
        if bldg:
            room_map[f"{bldg.abbreviation} {r.room_number}"] = r

    # Create sections
    section_data = [
        ("101", "01", 30, "in_person"), ("101", "02", 30, "in_person"),
        ("101", "03", 30, "online_sync"),
        ("110", "01", 35, "in_person"), ("110", "02", 35, "in_person"),
        ("120", "01", 30, "in_person"),
        ("200", "01", 30, "in_person"), ("200", "02", 30, "in_person"),
        ("210", "01", 25, "in_person"),
        ("255", "01", 30, "in_person"), ("255", "02", 30, "online_sync"),
        ("300", "01", 25, "in_person"),
        ("310", "01", 25, "in_person"),
        ("320", "01", 30, "in_person"),
        ("340", "01", 25, "in_person"),
        ("350", "01", 25, "in_person"),
        ("360", "01", 30, "in_person"),
        ("400", "01", 20, "in_person"),
        ("410", "01", 20, "in_person"),
        ("420", "01", 25, "in_person"),
        ("450", "01", 25, "in_person"),
        ("600", "01", 15, "in_person"),
        ("650", "01", 15, "in_person"),
        ("700", "01", 10, "in_person"),
        ("710", "01", 20, "in_person"),
        # Extra sections for scheduling
        ("300", "02", 25, "in_person"),
        ("320", "02", 25, "online_async"),
        ("360", "02", 30, "in_person"),
        ("120", "02", 30, "hybrid"),
        ("450", "02", 20, "online_async"),
    ]

    sections = {}
    for course_num, sec_num, cap, modality in section_data:
        course = courses.get(course_num)
        if not course:
            continue
        s = Section(
            course_id=course.id,
            term_id=term.id,
            section_number=sec_num,
            enrollment_cap=cap,
            modality=modality,
            status="unscheduled",
        )
        db.add(s)
        db.flush()
        sections[f"{course_num}-{sec_num}"] = s

    # Create meetings with some intentional conflicts
    def make_meeting(sec_key, tb_label, room_key, instr_key):
        sec = sections.get(sec_key)
        tb = time_blocks.get(tb_label)
        room = room_map.get(room_key) if room_key else None
        instr = instructors.get(instr_key) if instr_key else None
        if not sec or not tb:
            return
        m = Meeting(
            section_id=sec.id,
            days_of_week=tb.days_of_week,
            start_time=tb.start_time,
            end_time=tb.end_time,
            time_block_id=tb.id,
            room_id=room.id if room else None,
            instructor_id=instr.id if instr else None,
        )
        db.add(m)
        sec.status = "scheduled"

    # Normal meetings (no conflicts)
    make_meeting("101-01", "MWF 8:00-8:50", "NH 110", "alice")
    make_meeting("101-02", "MWF 9:00-9:50", "NH 110", "alice")
    make_meeting("101-03", "MWF 10:00-10:50", None, "grace")  # online
    make_meeting("110-01", "TTh 8:00-9:15", "NH 102", "bob")
    make_meeting("110-02", "TTh 9:30-10:45", "NH 102", "bob")
    make_meeting("120-01", "MWF 11:00-11:50", "SH 101", "carol")
    make_meeting("200-01", "MWF 1:00-1:50", "NH 201", "emily")
    make_meeting("200-02", "TTh 11:00-12:15", "NH 201", "david")
    make_meeting("210-01", "TTh 2:00-3:15", "SH 201", "frank")
    make_meeting("255-01", "MWF 2:00-2:50", "SH 102", "henry")
    make_meeting("255-02", "TTh 8:00-9:15", None, "grace")  # online
    make_meeting("300-01", "MWF 10:00-10:50", "NH 301", "irene")
    make_meeting("310-01", "TTh 9:30-10:45", "SH 201", "james")
    make_meeting("320-01", "MWF 3:00-3:50", "NH 201", "karen")
    make_meeting("340-01", "TTh 11:00-12:15", "SH 103", "frank")
    make_meeting("350-01", "MWF 11:00-11:50", "NH 103", "emily")
    make_meeting("360-01", "TTh 2:00-3:15", "NH 102", "henry")
    make_meeting("400-01", "MWF 9:00-9:50", "NH 301", "irene")
    make_meeting("410-01", "TTh 12:30-1:45", "NH 301", "james")
    make_meeting("420-01", "Mon Evening 6:00-8:50", "SH 103", "henry")
    make_meeting("450-01", "TTh 3:30-4:45", "SH 201", "alice")
    make_meeting("600-01", "Wed Evening 6:00-8:50", "NH 301", "irene")
    make_meeting("650-01", "MWF 4:00-4:50", "NH 103", "karen")
    make_meeting("700-01", "Thu Evening 6:00-8:50", "NH 301", "james")
    make_meeting("710-01", "MWF 12:00-12:50", "SH 102", "bob")

    # INTENTIONAL CONFLICTS for testing:

    # 1. Room conflict: 300-02 in same room & time as 300-01
    make_meeting("300-02", "MWF 10:00-10:50", "NH 301", "larry")

    # 2. Instructor conflict: 360-02 puts Henry at TTh 2:00 (he already has 360-01 there)
    make_meeting("360-02", "TTh 2:00-3:15", "SH 301", "henry")

    # 3. Room capacity issue: 120-02 in a small room (NH 301, cap 20, but section cap 30)
    make_meeting("120-02", "MWF 2:00-2:50", "NH 301", "carol")

    db.commit()
    print(f"Seeded {len(sections)} sections and meetings (including intentional conflicts).")


def seed_summer_term(db: Session):
    """Seed a Summer 2026 term with 4 sessions."""
    existing = db.query(Term).filter(Term.name == "Summer 2026").first()
    if existing:
        print("Summer 2026 term already exists, skipping.")
        return
    term = Term(
        name="Summer 2026",
        type="summer",
        start_date=date(2026, 5, 26),
        end_date=date(2026, 8, 21),
        status="draft",
    )
    db.add(term)
    db.flush()
    sessions = [
        TermSession(term_id=term.id, name="A", start_date=date(2026, 5, 26)),
        TermSession(term_id=term.id, name="B", start_date=date(2026, 6, 15)),
        TermSession(term_id=term.id, name="C", start_date=date(2026, 7, 6)),
        TermSession(term_id=term.id, name="D", start_date=date(2026, 7, 27)),
    ]
    db.add_all(sessions)
    db.commit()
    print("Seeded Summer 2026 term with 4 sessions.")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_time_blocks(db)
        seed_sample_data(db)
        seed_sections_and_meetings(db)
        seed_summer_term(db)
        print("Seeding complete!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
