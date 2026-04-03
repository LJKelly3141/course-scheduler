# ICS Calendar Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate ICS calendar files for instructor teaching schedules, importable into Outlook as recurring events.

**Architecture:** New `ics_export.py` service generates VCALENDAR data using the `icalendar` library. Two new routes in `export_html.py` serve single-instructor and bulk ICS files. Frontend adds download buttons to the existing `InstructorScheduleDialog`.

**Tech Stack:** Python `icalendar` library, `pytz` for timezone, existing FastAPI/SQLAlchemy backend, React/TypeScript frontend.

---

### Task 1: Install icalendar dependency

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/pyproject.toml`
- Modify: `backend/course_scheduler.spec`

- [ ] **Step 1: Add icalendar to requirements.txt**

Add after the last line of `backend/requirements.txt`:

```
icalendar>=5.0.0
pytz>=2023.3
```

- [ ] **Step 2: Add icalendar to pyproject.toml**

In `backend/pyproject.toml`, add to the `dependencies` list after the `requests` line:

```toml
    "icalendar>=5.0.0",
    "pytz>=2023.3",
```

- [ ] **Step 3: Add hidden imports to PyInstaller spec**

In `backend/course_scheduler.spec`, add to the `hiddenimports` list after `'requests'` (around line 52):

```python
        'icalendar',
        'pytz',
```

- [ ] **Step 4: Install the dependency**

Run:
```bash
cd backend && source venv/bin/activate && pip install icalendar pytz
```
Expected: Successfully installed icalendar and pytz

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/pyproject.toml backend/course_scheduler.spec
git commit -m "Add icalendar and pytz dependencies for ICS export"
```

---

### Task 2: Write ICS generation service with tests (TDD)

**Files:**
- Create: `backend/app/services/ics_export.py`
- Create: `backend/tests/test_ics_export.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_ics_export.py`:

```python
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

    # Alice teaches CS101 MWF 9:00-9:50
    m1 = Meeting(
        id=1, section_id=1, instructor_id=1, room_id=1,
        days_of_week=json.dumps(["M", "W", "F"]),
        start_time=time(9, 0), end_time=time(9, 50),
    )
    # Bob teaches CS201 TTh 10:00-11:15
    m2 = Meeting(
        id=2, section_id=2, instructor_id=2, room_id=1,
        days_of_week=json.dumps(["T", "Th"]),
        start_time=time(10, 0), end_time=time(11, 15),
    )
    db.add_all([m1, m2])
    db.commit()
    return {"term": term, "alice": alice, "bob": bob}


def test_single_instructor_ics(db, seed_data):
    """Alice's ICS should have one VEVENT for her MWF class."""
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=1)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    assert len(events) == 1
    ev = events[0]
    assert "CS 101-01" in str(ev.get("SUMMARY"))
    assert "SCI 101" in str(ev.get("LOCATION"))
    # RRULE should have MO,WE,FR
    rrule = ev.get("RRULE")
    byday = rrule.get("BYDAY")
    assert set(byday) == {"MO", "WE", "FR"}


def test_single_instructor_first_occurrence(db, seed_data):
    """DTSTART should be the first matching weekday on or after term start (2025-08-25 is Monday)."""
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=1)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    ev = events[0]
    dtstart = ev.get("DTSTART").dt
    # 2025-08-25 is a Monday, MWF class -> first day is Monday Aug 25
    assert dtstart.month == 8
    assert dtstart.day == 25
    assert dtstart.hour == 9
    assert dtstart.minute == 0


def test_tth_first_occurrence(db, seed_data):
    """Bob's TTh class: term starts Mon Aug 25, first TTh day is Tue Aug 26."""
    cal_bytes = generate_ics_for_instructor(db, term_id=1, instructor_id=2)
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    ev = events[0]
    dtstart = ev.get("DTSTART").dt
    # 2025-08-25 is Monday, first Tuesday is Aug 26
    assert dtstart.month == 8
    assert dtstart.day == 26
    assert dtstart.hour == 10


def test_bulk_instructors(db, seed_data):
    """Bulk ICS for both instructors should have 2 VEVENTs."""
    cal_bytes = generate_ics_for_instructors(db, term_id=1, instructor_ids=[1, 2])
    cal = Calendar.from_ical(cal_bytes)
    events = [c for c in cal.walk() if c.name == "VEVENT"]
    assert len(events) == 2


def test_no_meetings_returns_empty_calendar(db, seed_data):
    """Instructor with no meetings should return a valid but empty calendar."""
    # Create instructor with no meetings
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
    """UID should be stable across calls (based on meeting ID)."""
    cal1 = Calendar.from_ical(generate_ics_for_instructor(db, term_id=1, instructor_id=1))
    cal2 = Calendar.from_ical(generate_ics_for_instructor(db, term_id=1, instructor_id=1))
    uid1 = [c.get("UID") for c in cal1.walk() if c.name == "VEVENT"][0]
    uid2 = [c.get("UID") for c in cal2.walk() if c.name == "VEVENT"][0]
    assert uid1 == uid2
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_ics_export.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ics_export'`

- [ ] **Step 3: Implement the ICS generation service**

Create `backend/app/services/ics_export.py`:

```python
"""ICS calendar export for instructor schedules."""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from typing import List, Optional

import pytz
from icalendar import Calendar, Event, vRecur
from sqlalchemy.orm import Session, joinedload

from app.models.instructor import Instructor
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section
from app.models.term import Term

TIMEZONE = pytz.timezone("America/Chicago")

# App day codes -> (RRULE BYDAY value, Python weekday int for date calculation)
DAY_MAP = {
    "M":  ("MO", 0),
    "T":  ("TU", 1),
    "W":  ("WE", 2),
    "Th": ("TH", 3),
    "F":  ("FR", 4),
    "S":  ("SA", 5),
    "U":  ("SU", 6),
}


def _first_occurrence(term_start: date, days: list[str]) -> date:
    """Find the earliest weekday in `days` on or after `term_start`."""
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


def _parse_days(days_of_week: Optional[str]) -> list[str]:
    """Parse days_of_week JSON string into list of day codes."""
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


def _meeting_to_event(
    meeting: Meeting,
    section: Section,
    term: Term,
) -> Optional[Event]:
    """Convert a meeting into a recurring VEVENT, or None if data is incomplete."""
    days = _parse_days(meeting.days_of_week)
    if not days or not meeting.start_time or not meeting.end_time:
        return None

    # Map day codes to RRULE BYDAY values
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

    # Calculate first occurrence
    first_day = _first_occurrence(term.start_date, days)

    # Build datetime with timezone
    dt_start = TIMEZONE.localize(datetime.combine(first_day, meeting.start_time))
    dt_end = TIMEZONE.localize(datetime.combine(first_day, meeting.end_time))

    # RRULE UNTIL as end-of-day on term end date
    until = TIMEZONE.localize(datetime.combine(term.end_date, time(23, 59, 59)))

    # Location
    location = ""
    if meeting.room:
        room = meeting.room
        bldg = room.building
        if bldg:
            location = f"{bldg.abbreviation} {room.room_number} ({bldg.name})"
        else:
            location = room.room_number

    # Summary
    summary = f"{course.department_code} {course.course_number}-{section.section_number} {course.title}"

    # Description
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


def _get_instructor_meetings(
    db: Session, term_id: int, instructor_id: int
) -> tuple[Term, list[tuple[Meeting, Section]]]:
    """Fetch term and all qualifying meetings for an instructor."""
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


def generate_ics_for_instructor(
    db: Session, term_id: int, instructor_id: int
) -> bytes:
    """Generate ICS bytes for a single instructor's schedule."""
    term, meeting_pairs = _get_instructor_meetings(db, term_id, instructor_id)
    cal = _build_calendar()

    for meeting, section in meeting_pairs:
        event = _meeting_to_event(meeting, section, term)
        if event:
            cal.add_component(event)

    return cal.to_ical()


def generate_ics_for_instructors(
    db: Session, term_id: int, instructor_ids: List[int]
) -> bytes:
    """Generate a single ICS file with events for multiple instructors."""
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_ics_export.py -v
```
Expected: 6 passed

- [ ] **Step 5: Run all tests to verify no regressions**

Run:
```bash
cd backend && source venv/bin/activate && pytest -v
```
Expected: All pass (78 existing + 6 new)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ics_export.py backend/tests/test_ics_export.py
git commit -m "Add ICS generation service with tests"
```

---

### Task 3: Add ICS export routes

**Files:**
- Modify: `backend/app/api/routes/export_html.py`
- Modify: `backend/course_scheduler.spec` (add service hidden import)

- [ ] **Step 1: Add routes to export_html.py**

Add these imports at the top of `backend/app/api/routes/export_html.py`, after the existing imports:

```python
from starlette.responses import Response
from app.services.ics_export import generate_ics_for_instructor, generate_ics_for_instructors
from app.models.instructor import Instructor
```

Add these two routes at the end of the file:

```python
@router.get("/terms/{term_id}/export/ics/{instructor_id}")
def download_instructor_ics(
    term_id: int,
    instructor_id: int,
    db: Session = Depends(get_db),
):
    """Download ICS calendar file for a single instructor's schedule."""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    try:
        ics_bytes = generate_ics_for_instructor(db, term_id, instructor_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    last = instructor.last_name or "Instructor"
    first = instructor.first_name or ""
    filename = f"{last}-{first}-schedule.ics".replace(" ", "-")

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/terms/{term_id}/export/ics")
def download_bulk_ics(
    term_id: int,
    instructor_ids: str = Query(..., description="Comma-separated instructor IDs"),
    db: Session = Depends(get_db),
):
    """Download a single ICS file with events for multiple instructors."""
    try:
        ids = [int(x.strip()) for x in instructor_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid instructor IDs")
    if not ids:
        raise HTTPException(status_code=400, detail="No instructor IDs provided")
    try:
        ics_bytes = generate_ics_for_instructors(db, term_id, ids)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="schedules.ics"'},
    )
```

- [ ] **Step 2: Add ics_export to PyInstaller hidden imports**

In `backend/course_scheduler.spec`, add after `'app.services.workload_export'` (around line 108):

```python
        'app.services.ics_export',
```

- [ ] **Step 3: Run all backend tests**

Run:
```bash
cd backend && source venv/bin/activate && pytest -v
```
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routes/export_html.py backend/course_scheduler.spec
git commit -m "Add ICS export API routes for single and bulk download"
```

---

### Task 4: Add frontend calendar download buttons

**Files:**
- Modify: `frontend/src/components/schedule/InstructorScheduleDialog.tsx`

- [ ] **Step 1: Add the CalendarDays import and download helper**

At the top of `frontend/src/components/schedule/InstructorScheduleDialog.tsx`, add the lucide import:

```typescript
import { CalendarDays } from "lucide-react";
```

And add the API base helper and download function inside the component, after the existing `emailAll` function:

```typescript
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function downloadIcs(instructorId: number, name: string) {
    setDownloadingId(instructorId);
    try {
      const res = await api.getRaw(`/terms/${termId}/export/ics/${instructorId}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\s+/g, "-")}-schedule.ics`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadFeedback(`Downloaded ${name}'s calendar`);
    } catch (e: unknown) {
      setDownloadFeedback(`Download failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setDownloadingId(null);
      setTimeout(() => setDownloadFeedback(null), 3000);
    }
  }

  async function downloadAllIcs() {
    if (idsToFetch.length === 0) return;
    setDownloadingAll(true);
    try {
      const res = await api.getRaw(`/terms/${termId}/export/ics?instructor_ids=${idsToFetch.join(",")}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "schedules.ics";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadFeedback(`Downloaded ${idsToFetch.length} calendar(s)`);
    } catch (e: unknown) {
      setDownloadFeedback(`Download failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setDownloadingAll(false);
      setTimeout(() => setDownloadFeedback(null), 3000);
    }
  }
```

- [ ] **Step 2: Add per-instructor calendar button**

In the per-instructor action buttons section (after the email button, around the `</div>` that closes `ml-auto flex gap-1`), add:

```tsx
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const s = schedules.find((s) => s.instructor_id === inst.id);
                          if (s) downloadIcs(inst.id, s.instructor_name);
                        }}
                        className="p-1 rounded hover:bg-accent-foreground/10"
                        title="Download calendar (.ics)"
                        disabled={downloadingId === inst.id}
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
```

- [ ] **Step 3: Add bulk download button in footer**

In the `DialogFooter`, add the "Download All Calendars" button between "Copy All Selected" and "Email All Selected":

```tsx
            <Button
              variant="outline"
              onClick={downloadAllIcs}
              disabled={schedules.length === 0 || downloadingAll}
            >
              {downloadingAll ? "Downloading..." : "Download All Calendars"}
            </Button>
```

- [ ] **Step 4: Add download feedback display**

In the footer feedback area, add alongside the existing `copyFeedback`:

```tsx
            {downloadFeedback && (
              <span className="text-sm text-emerald-600 font-medium">
                {downloadFeedback}
              </span>
            )}
```

- [ ] **Step 5: Run TypeScript type check**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/schedule/InstructorScheduleDialog.tsx
git commit -m "Add ICS calendar download buttons to Email Schedules dialog"
```

---

### Task 5: Build, test, and push

**Files:** None — build and verification only.

- [ ] **Step 1: Run all backend tests**

Run:
```bash
cd backend && source venv/bin/activate && pytest -v
```
Expected: All pass

- [ ] **Step 2: Run frontend type check**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Build DMG**

Run:
```bash
cd /Users/logankelly/Sync/UWRF/course-scheduler && npm run build:app
```
Expected: DMG built at `dist-electron/Course Scheduler-1.0.0-arm64.dmg`

- [ ] **Step 4: Push**

```bash
git push
```
