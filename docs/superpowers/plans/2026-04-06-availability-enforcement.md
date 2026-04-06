# Availability Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect instructor availability templates to the conflict engine so that creating a term auto-populates per-term availability, prefer-avoid slots produce soft warnings, and the MeetingDialog shows inline warnings when assigning instructors to conflicting slots.

**Architecture:** New `availability_service.py` handles template-to-term copying. The conflict engine and soft constraints already check `unavailable` (hard) and `prefer_avoid` (soft) — no changes needed there. The MeetingDialog gains a client-side availability check via a new API endpoint. A new `disable_availability_warnings` setting controls inline warnings only (not term validation).

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React/TypeScript/@tanstack/react-query (frontend)

---

## Existing Infrastructure (No Changes Needed)

The following already work and just need per-term `InstructorAvailability` records to exist:

- **Hard conflicts** for `unavailable` slots: `backend/app/services/conflict_engine.py:246-278`
- **Soft warnings** for `prefer_avoid` slots: `backend/app/services/soft_constraints.py:178-212`
- **Per-instructor apply endpoint**: `backend/app/api/routes/availability_templates.py:78-118` (used by Instructor Hub, not by term creation)

---

### Task 1: Create `availability_service.py` — Auto-Apply Templates to Term

**Files:**
- Create: `backend/app/services/availability_service.py`
- Test: `backend/tests/test_availability_service.py`

- [ ] **Step 1: Write the test file with failing tests**

```python
"""Tests for availability_service — auto-applying templates to terms."""

from __future__ import annotations

import json
from datetime import date, time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
)
from app.models.term import Term, TermStatus, TermType
from app.models.time_block import BlockPattern, TimeBlock


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def time_blocks(db: Session):
    """Seed all standard time blocks so summer/winter blanket coverage works."""
    blocks = [
        TimeBlock(id=1, pattern=BlockPattern.mwf,
                  days_of_week=json.dumps(["M", "W", "F"]),
                  start_time=time(8, 0), end_time=time(8, 50),
                  label="MWF 8:00-8:50"),
        TimeBlock(id=2, pattern=BlockPattern.tth,
                  days_of_week=json.dumps(["T", "Th"]),
                  start_time=time(9, 30), end_time=time(10, 45),
                  label="TTh 9:30-10:45"),
    ]
    db.add_all(blocks)
    db.commit()
    return blocks


@pytest.fixture
def instructor(db: Session) -> Instructor:
    inst = Instructor(
        id=1, name="Smith, Jane", first_name="Jane", last_name="Smith",
        email="jane.smith@uwrf.edu", department="Accounting",
        available_summer=True, available_winter=True,
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


def test_apply_fall_templates_to_fall_term(db, instructor, time_blocks):
    """Fall templates should be copied to a fall term."""
    from app.services.availability_service import apply_templates_to_term

    # Create a fall template: unavailable Tuesdays 9:30-10:45
    db.add(InstructorAvailabilityTemplate(
        instructor_id=instructor.id, term_type="fall",
        day_of_week="T", start_time=time(9, 30), end_time=time(10, 45),
        type=AvailabilityType.unavailable,
    ))
    db.commit()

    term = Term(id=1, name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 1

    records = db.query(InstructorAvailability).filter_by(
        instructor_id=instructor.id, term_id=term.id).all()
    assert len(records) == 1
    assert records[0].day_of_week == "T"
    assert records[0].type == AvailabilityType.unavailable


def test_spring_templates_not_applied_to_fall_term(db, instructor, time_blocks):
    """Spring templates should NOT be copied to a fall term."""
    from app.services.availability_service import apply_templates_to_term

    db.add(InstructorAvailabilityTemplate(
        instructor_id=instructor.id, term_type="spring",
        day_of_week="M", start_time=time(8, 0), end_time=time(8, 50),
        type=AvailabilityType.prefer_avoid,
    ))
    db.commit()

    term = Term(id=1, name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 0


def test_summer_unavailable_creates_blanket_blocks(db, time_blocks):
    """An instructor with available_summer=False gets unavailable records for all time blocks."""
    from app.services.availability_service import apply_templates_to_term

    inst = Instructor(
        id=2, name="Doe, John", email="john.doe@uwrf.edu",
        department="Accounting", available_summer=False,
    )
    db.add(inst)
    db.commit()

    term = Term(id=1, name="Summer 2026", type=TermType.summer,
                start_date=date(2026, 6, 1), end_date=date(2026, 8, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    # Each time block expands to its days: MWF block -> 3 days, TTh block -> 2 days = 5
    assert count == 5

    records = db.query(InstructorAvailability).filter_by(
        instructor_id=inst.id, term_id=term.id).all()
    assert all(r.type == AvailabilityType.unavailable for r in records)


def test_summer_available_instructor_gets_no_records(db, instructor, time_blocks):
    """An instructor with available_summer=True gets no records for a summer term."""
    from app.services.availability_service import apply_templates_to_term

    assert instructor.available_summer is True
    term = Term(id=1, name="Summer 2026", type=TermType.summer,
                start_date=date(2026, 6, 1), end_date=date(2026, 8, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 0


def test_winter_unavailable_creates_blanket_blocks(db, time_blocks):
    """An instructor with available_winter=False gets unavailable records for all time blocks."""
    from app.services.availability_service import apply_templates_to_term

    inst = Instructor(
        id=3, name="Winter, Nope", email="nope@uwrf.edu",
        department="Accounting", available_winter=False,
    )
    db.add(inst)
    db.commit()

    term = Term(id=1, name="Winter 2027", type=TermType.winter,
                start_date=date(2027, 1, 5), end_date=date(2027, 1, 25),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 5


def test_no_templates_means_no_records(db, instructor, time_blocks):
    """An instructor with no templates gets no per-term records (fully available)."""
    from app.services.availability_service import apply_templates_to_term

    term = Term(id=1, name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 0


def test_multiple_instructors(db, time_blocks):
    """Templates are applied for ALL instructors, not just one."""
    from app.services.availability_service import apply_templates_to_term

    inst1 = Instructor(id=10, name="A", email="a@uwrf.edu", department="Accounting")
    inst2 = Instructor(id=11, name="B", email="b@uwrf.edu", department="Accounting")
    db.add_all([inst1, inst2])
    db.commit()

    db.add(InstructorAvailabilityTemplate(
        instructor_id=inst1.id, term_type="fall",
        day_of_week="M", start_time=time(8, 0), end_time=time(8, 50),
        type=AvailabilityType.unavailable,
    ))
    db.add(InstructorAvailabilityTemplate(
        instructor_id=inst2.id, term_type="fall",
        day_of_week="W", start_time=time(8, 0), end_time=time(8, 50),
        type=AvailabilityType.prefer_avoid,
    ))
    db.commit()

    term = Term(id=1, name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count = apply_templates_to_term(db, term)
    assert count == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_availability_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.availability_service'`

- [ ] **Step 3: Write the service implementation**

Create `backend/app/services/availability_service.py`:

```python
"""Service for applying instructor availability templates to terms."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.instructor import (
    AvailabilityType,
    Instructor,
    InstructorAvailability,
)
from app.models.term import Term, TermType
from app.models.time_block import TimeBlock


def apply_templates_to_term(db: Session, term: Term) -> int:
    """Copy availability templates to per-term records for all instructors.

    For fall/spring terms: copies matching InstructorAvailabilityTemplate rows.
    For summer/winter terms: if instructor.available_summer/winter is False,
    creates unavailable records covering all time block slots for all days.

    Returns the number of availability records created.
    """
    instructors = db.query(Instructor).all()
    created = 0

    if term.type in (TermType.fall, TermType.spring):
        created = _apply_fall_spring(db, term, instructors)
    elif term.type == TermType.summer:
        created = _apply_seasonal(db, term, instructors, "available_summer")
    elif term.type == TermType.winter:
        created = _apply_seasonal(db, term, instructors, "available_winter")

    return created


def _apply_fall_spring(
    db: Session, term: Term, instructors: list[Instructor]
) -> int:
    """Copy fall/spring templates for all instructors into per-term records."""
    term_type_str = term.type.value  # "fall" or "spring"
    templates = (
        db.query(InstructorAvailabilityTemplate)
        .filter_by(term_type=term_type_str)
        .all()
    )

    created = 0
    for t in templates:
        db.add(InstructorAvailability(
            instructor_id=t.instructor_id,
            term_id=term.id,
            day_of_week=t.day_of_week,
            start_time=t.start_time,
            end_time=t.end_time,
            type=t.type,
        ))
        created += 1

    if created:
        db.flush()
    return created


def _apply_seasonal(
    db: Session,
    term: Term,
    instructors: list[Instructor],
    flag_attr: str,
) -> int:
    """For summer/winter: create blanket unavailable blocks for opted-out instructors."""
    time_blocks = db.query(TimeBlock).all()
    created = 0

    for instructor in instructors:
        if getattr(instructor, flag_attr):
            # Instructor IS available — no records needed
            continue

        # Instructor is NOT available — block all time slots on all days
        for block in time_blocks:
            days = json.loads(block.days_of_week)
            for day in days:
                db.add(InstructorAvailability(
                    instructor_id=instructor.id,
                    term_id=term.id,
                    day_of_week=day,
                    start_time=block.start_time,
                    end_time=block.end_time,
                    type=AvailabilityType.unavailable,
                ))
                created += 1

    if created:
        db.flush()
    return created
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_availability_service.py -v`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/availability_service.py backend/tests/test_availability_service.py
git commit -m "feat: add availability_service for auto-applying templates to terms"
```

---

### Task 2: Wire Auto-Apply into Term Creation Endpoint

**Files:**
- Modify: `backend/app/api/routes/terms.py:69-84`
- Test: `backend/tests/test_availability_service.py` (add integration test)

- [ ] **Step 1: Write a test that verifies term creation triggers auto-apply**

Add to `backend/tests/test_availability_service.py`:

```python
def test_apply_does_not_duplicate_on_second_call(db, instructor, time_blocks):
    """Calling apply_templates_to_term twice should create duplicate records
    (the caller is responsible for only calling once on term creation)."""
    from app.services.availability_service import apply_templates_to_term

    db.add(InstructorAvailabilityTemplate(
        instructor_id=instructor.id, term_type="fall",
        day_of_week="T", start_time=time(9, 30), end_time=time(10, 45),
        type=AvailabilityType.unavailable,
    ))
    db.commit()

    term = Term(id=1, name="Fall 2026", type=TermType.fall,
                start_date=date(2026, 9, 1), end_date=date(2026, 12, 15),
                status=TermStatus.draft)
    db.add(term)
    db.commit()

    count1 = apply_templates_to_term(db, term)
    count2 = apply_templates_to_term(db, term)
    assert count1 == 1
    assert count2 == 1  # creates another copy (no dedup)

    records = db.query(InstructorAvailability).filter_by(
        instructor_id=instructor.id, term_id=term.id).all()
    assert len(records) == 2  # two copies
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_availability_service.py::test_apply_does_not_duplicate_on_second_call -v`
Expected: PASS (this test verifies idempotency awareness, should pass with existing implementation)

- [ ] **Step 3: Modify term creation endpoint to call auto-apply**

In `backend/app/api/routes/terms.py`, add the import and call after `db.flush()`:

At the top of the file, add import:
```python
from app.services.availability_service import apply_templates_to_term
```

In the `create_term` function (line 69-84), add the call after `_auto_create_sessions` and before `db.commit()`:

```python
@router.post("", response_model=TermRead, status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = Term(
        name=payload.name,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(term)
    db.flush()
    auto_link_term_to_academic_year(db, term)
    if payload.type == "summer":
        _auto_create_sessions(db, term)
    apply_templates_to_term(db, term)
    db.commit()
    db.refresh(term)
    return term
```

- [ ] **Step 4: Run all availability tests to verify they still pass**

Run: `cd backend && python -m pytest tests/test_availability_service.py tests/test_availability_templates.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/terms.py backend/tests/test_availability_service.py
git commit -m "feat: auto-apply availability templates when creating a new term"
```

---

### Task 3: Add `disable_availability_warnings` Setting

**Files:**
- Modify: `backend/app/api/routes/settings.py:19-25`
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add the new key to KNOWN_KEYS in the settings route**

In `backend/app/api/routes/settings.py`, add to the `KNOWN_KEYS` dict (line 19-25):

```python
KNOWN_KEYS = {
    "export_directory": "",
    "github_repo_url": "",
    "github_pages_url": "",
    "department_name": "",
    "academic_year_start_month": "7",
    "disable_availability_warnings": "false",
}
```

- [ ] **Step 2: Run backend tests to verify nothing breaks**

Run: `cd backend && python -m pytest -v`
Expected: All existing tests PASS

- [ ] **Step 3: Add the toggle to the SettingsPage frontend**

In `frontend/src/pages/SettingsPage.tsx`, add a new "Scheduling" section after the "General" section (after line 426, before the "Academic Year" section).

Add to the `form` state initializer (line 318-323):
```typescript
const [form, setForm] = useState<Record<string, string>>({
    department_name: "",
    export_directory: "",
    github_pages_url: "",
    academic_year_start_month: "7",
    disable_availability_warnings: "false",
  });
```

Add the new section JSX after the General section's closing `</section>` tag (after line 426):

```tsx
      {/* Scheduling */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Scheduling
        </h3>

        <div className="flex items-center gap-3">
          <input
            id="settings-disable-avail-warnings"
            type="checkbox"
            checked={form.disable_availability_warnings === "true"}
            onChange={(e) =>
              setForm({
                ...form,
                disable_availability_warnings: e.target.checked ? "true" : "false",
              })
            }
          />
          <label htmlFor="settings-disable-avail-warnings" className="text-sm font-medium">
            Disable inline availability warnings
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Turn off warnings when assigning instructors to time slots that conflict with their availability preferences.
          Hard and soft conflicts in term validation are always checked regardless of this setting.
        </p>

        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </section>
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/settings.py frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add disable_availability_warnings setting with UI toggle"
```

---

### Task 4: Add Availability Check API Endpoint for MeetingDialog

**Files:**
- Create: `backend/app/api/routes/instructor_availability.py` (new route for per-term availability lookup)
- Modify: `backend/app/api/routes/__init__.py` or `backend/app/main.py` (register new router if needed)

The MeetingDialog needs to check an instructor's availability for a given term. Rather than fetching all availability records up front, we add a targeted endpoint.

- [ ] **Step 1: Check how routes are registered**

Look at `backend/app/main.py` to see how routers are included, so we know where to register.

- [ ] **Step 2: Create the endpoint**

The existing `availability_templates.py` router is under `/api/instructors`. We can add the per-term availability query there. But it's cleaner to use a separate query: `GET /api/instructors/{id}/availability?term_id={term_id}`.

Check if this endpoint already exists. If not, add it to the existing instructors route file or `availability_templates.py`.

Add to `backend/app/api/routes/availability_templates.py` at the bottom:

```python
from app.schemas.schemas import InstructorAvailabilityRead


@router.get(
    "/{instructor_id}/availability",
    response_model=list[InstructorAvailabilityRead],
)
def get_instructor_availability(
    instructor_id: int,
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get per-term availability records for an instructor."""
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")
    return (
        db.query(InstructorAvailability)
        .filter_by(instructor_id=instructor_id, term_id=term_id)
        .all()
    )
```

- [ ] **Step 3: Verify backend starts and endpoint works**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routes/availability_templates.py
git commit -m "feat: add GET /instructors/{id}/availability endpoint for per-term lookup"
```

---

### Task 5: Add Inline Availability Warning to MeetingDialog

**Files:**
- Modify: `frontend/src/components/meetings/MeetingDialog.tsx`

This is the core frontend change. When the user selects an instructor and a time slot, we check the instructor's per-term availability and show a warning banner if there's a conflict.

- [ ] **Step 1: Add the availability query and warning logic**

In `frontend/src/components/meetings/MeetingDialog.tsx`:

Add imports at the top:
```typescript
import { useQuery } from "@tanstack/react-query";
import type { InstructorAvailability } from "../../api/types";
```

After the existing state declarations (around line 47), add the availability query and warning computation:

```typescript
  // Fetch settings to check if warnings are disabled
  const { data: settingsList } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ key: string; value: string }[]>("/settings"),
  });
  const warningsDisabled = settingsList?.find(
    (s) => s.key === "disable_availability_warnings"
  )?.value === "true";

  // Fetch per-term availability for the selected instructor
  const { data: availability } = useQuery({
    queryKey: ["instructor-availability", instructorId, termId],
    queryFn: () =>
      api.get<InstructorAvailability[]>(
        `/instructors/${instructorId}/availability?term_id=${termId}`
      ),
    enabled: !!instructorId && !warningsDisabled,
  });

  // Compute availability warnings
  const availabilityWarnings = useMemo(() => {
    if (!availability || !daysOfWeek.length || !startTime || !endTime) return [];
    const warnings: string[] = [];
    const instructor = instructors.find((i) => i.id === instructorId);
    const name = instructor?.name ?? "Instructor";

    for (const block of availability) {
      if (!daysOfWeek.includes(block.day_of_week)) continue;
      // Check time overlap: meeting [startTime, endTime) vs block [block.start_time, block.end_time)
      const mStart = startTime;
      const mEnd = endTime;
      const bStart = block.start_time.slice(0, 5); // "HH:MM"
      const bEnd = block.end_time.slice(0, 5);
      if (mStart < bEnd && mEnd > bStart) {
        if (block.type === "unavailable") {
          warnings.push(
            `${name} is unavailable ${block.day_of_week} ${bStart}\u2013${bEnd}`
          );
        } else if (block.type === "prefer_avoid") {
          warnings.push(
            `${name} prefers to avoid ${block.day_of_week} ${bStart}\u2013${bEnd}`
          );
        }
      }
    }
    return warnings;
  }, [availability, daysOfWeek, startTime, endTime, instructorId, instructors]);
```

Then add the warning display in the JSX, right after the Meeting Instructor `<StyledSelect>` (after line 404, before the closing `</>`):

```tsx
              {availabilityWarnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2 space-y-1">
                  {availabilityWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                  ))}
                </div>
              )}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/meetings/MeetingDialog.tsx
git commit -m "feat: show inline availability warnings in MeetingDialog"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test (if dev servers are running)**

1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Start frontend: `cd frontend && npm run dev`
3. Create a new fall term — verify instructor availability records are auto-created
4. Open MeetingDialog, select an instructor with unavailable/prefer-avoid blocks, pick a conflicting time — verify warning appears
5. Go to Settings, toggle "Disable inline availability warnings", go back and verify warning no longer appears
6. Run term validation — verify hard/soft conflicts still appear regardless of the setting

- [ ] **Step 5: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end availability enforcement testing"
```
