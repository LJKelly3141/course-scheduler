# Instructor Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered instructor list page and detail page with a unified Instructor Hub — master-detail layout, guided onboarding wizard, term-type availability templates, and live workload preview with XLSX export.

**Architecture:** Single-route master-detail page at `/instructors`. Left roster panel with search/filter, right detail panel with 4 tabs (Profile, Availability, Workload, Notes). New backend model for availability templates keyed by term type. Three new Instructor fields (emergency_contact, available_summer, available_winter).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, React 18, TypeScript, Tailwind CSS v4, @tanstack/react-query, Vite

**Design Spec:** `docs/superpowers/specs/2026-04-05-instructor-hub-design.md`

---

## File Structure

### Backend — New Files
- `backend/app/models/availability_template.py` — InstructorAvailabilityTemplate ORM model
- `backend/app/api/routes/availability_templates.py` — Template CRUD endpoints
- `backend/alembic/versions/xxxx_add_instructor_hub_fields.py` — Migration (auto-generated)
- `backend/tests/test_availability_templates.py` — Template endpoint tests

### Backend — Modified Files
- `backend/app/models/instructor.py` — Add emergency_contact, available_summer, available_winter fields
- `backend/app/models/__init__.py` — Export InstructorAvailabilityTemplate
- `backend/app/schemas/schemas.py` — Add new fields to instructor schemas, add template schemas
- `backend/app/api/routes/instructors.py` — No changes needed (schemas handle new fields)
- `backend/app/main.py` — Add _ensure_schema_current() patches for new columns + table

### Frontend — New Files
- `frontend/src/pages/InstructorHub.tsx` — Main hub page (master-detail container)
- `frontend/src/components/instructors/InstructorRoster.tsx` — Left panel roster
- `frontend/src/components/instructors/InstructorDetail.tsx` — Right panel tab container
- `frontend/src/components/instructors/ProfileTab.tsx` — Profile editing form
- `frontend/src/components/instructors/AvailabilityTab.tsx` — Term-type availability
- `frontend/src/components/instructors/AvailabilityGrid.tsx` — Reusable grid (extracted from existing)
- `frontend/src/components/instructors/TermTypeToggle.tsx` — Summer/Winter yes/no toggle
- `frontend/src/components/instructors/WorkloadTab.tsx` — KPI cards, sections, adjustments
- `frontend/src/components/instructors/NotesTab.tsx` — Notes with category filtering
- `frontend/src/components/instructors/NewInstructorWizard.tsx` — 3-step onboarding modal

### Frontend — Modified Files
- `frontend/src/api/types.ts` — Add new fields to Instructor interface, add template types
- `frontend/src/App.tsx` — Replace routes, remove InstructorDetailPage import

### Frontend — Removed After Migration
- `frontend/src/pages/InstructorsPage.tsx` — Replaced by InstructorHub
- `frontend/src/pages/InstructorDetailPage.tsx` — Absorbed into InstructorDetail tabs

---

## Task 1: Backend — Add New Instructor Fields

**Files:**
- Modify: `backend/app/models/instructor.py:44-68`
- Modify: `backend/app/schemas/schemas.py:110-147`
- Modify: `backend/app/main.py:103-138`
- Modify: `frontend/src/api/types.ts:46-62`

- [ ] **Step 1: Add fields to Instructor model**

In `backend/app/models/instructor.py`, add three new columns to the `Instructor` class after line 63 (`hire_date`):

```python
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    available_summer: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    available_winter: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
```

- [ ] **Step 2: Add fields to schemas**

In `backend/app/schemas/schemas.py`, add to `InstructorBase` (after line 124, `hire_date`):

```python
    emergency_contact: Optional[str] = None
    available_summer: bool = True
    available_winter: bool = True
```

Add to `InstructorUpdate` (after line 143, `hire_date`):

```python
    emergency_contact: Optional[str] = None
    available_summer: Optional[bool] = None
    available_winter: Optional[bool] = None
```

- [ ] **Step 3: Add _ensure_schema_current() patches**

In `backend/app/main.py`, in the instructors table patches section (after line 121), add:

```python
            for col, col_type in [
                ("emergency_contact", "VARCHAR(30)"),
                ("available_summer", "BOOLEAN DEFAULT 1"),
                ("available_winter", "BOOLEAN DEFAULT 1"),
            ]:
                if col not in instructor_cols:
                    conn.execute(
                        sa.text(f"ALTER TABLE instructors ADD COLUMN {col} {col_type}")
                    )
                    logger.info("Added missing column instructors.%s", col)
```

- [ ] **Step 4: Generate Alembic migration**

```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "add instructor emergency_contact and seasonal availability"
```

- [ ] **Step 5: Update frontend types**

In `frontend/src/api/types.ts`, add to `Instructor` interface (after line 61, `hire_date`):

```typescript
  emergency_contact: string | null;
  available_summer: boolean;
  available_winter: boolean;
```

- [ ] **Step 6: Verify backend starts and migration applies**

```bash
cd backend
source venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Hit `http://localhost:8000/api/instructors` — verify response includes new fields with defaults.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/instructor.py backend/app/schemas/schemas.py backend/app/main.py backend/alembic/versions/ frontend/src/api/types.ts
git commit -m "feat: add emergency_contact and seasonal availability fields to Instructor"
```

---

## Task 2: Backend — Availability Template Model & Endpoints

**Files:**
- Create: `backend/app/models/availability_template.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/schemas.py`
- Create: `backend/app/api/routes/availability_templates.py`
- Modify: `backend/app/main.py` (router registration + schema patch)

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_availability_templates.py`:

```python
"""Tests for instructor availability template endpoints."""

from __future__ import annotations

from datetime import time

import pytest
from fastapi.testclient import TestClient
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
        term_type=TermType.fall,
        year=2026,
        status=TermStatus.draft,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


def test_create_and_get_fall_template(db, instructor):
    """PUT replaces all template slots for a term type, GET retrieves them."""
    from app.models.availability_template import InstructorAvailabilityTemplate
    from app.models.instructor import AvailabilityType

    # Create template entries
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
    """Summer/winter availability is a boolean on the instructor model."""
    assert instructor.available_summer is True
    assert instructor.available_winter is True

    instructor.available_summer = False
    db.commit()
    db.refresh(instructor)
    assert instructor.available_summer is False


def test_apply_template_to_term(db, instructor, fall_term):
    """Applying a template copies template rows into per-term availability."""
    from app.models.availability_template import InstructorAvailabilityTemplate
    from app.models.instructor import AvailabilityType, InstructorAvailability

    # Create template
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

    # Simulate apply: copy template rows to InstructorAvailability for term
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && source venv/bin/activate
pytest tests/test_availability_templates.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.availability_template'`

- [ ] **Step 3: Create the model**

Create `backend/app/models/availability_template.py`:

```python
from __future__ import annotations

from typing import Optional
from sqlalchemy import String, ForeignKey, Time, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.instructor import AvailabilityType


class InstructorAvailabilityTemplate(Base):
    __tablename__ = "instructor_availability_templates"
    __table_args__ = (
        UniqueConstraint(
            "instructor_id", "term_type", "day_of_week", "start_time",
            name="uq_template_slot",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id", ondelete="CASCADE"))
    term_type: Mapped[str] = mapped_column(String(10))  # "fall" or "spring"
    day_of_week: Mapped[str] = mapped_column(String(3))  # M, T, W, Th, F
    start_time: Mapped[str] = mapped_column(Time)
    end_time: Mapped[str] = mapped_column(Time)
    type: Mapped[AvailabilityType] = mapped_column(Enum(AvailabilityType))

    instructor = relationship("Instructor", backref="availability_templates")
```

- [ ] **Step 4: Export from models __init__**

In `backend/app/models/__init__.py`, add import (after line 7):

```python
from app.models.availability_template import InstructorAvailabilityTemplate
```

Add to `__all__` list:

```python
    "InstructorAvailabilityTemplate",
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && source venv/bin/activate
pytest tests/test_availability_templates.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Add schemas**

In `backend/app/schemas/schemas.py`, after the `InstructorAvailabilityRead` class (line 187), add:

```python

# --- Availability Templates ---
class AvailabilityTemplateCreate(BaseModel):
    day_of_week: str
    start_time: time
    end_time: time
    type: str

class AvailabilityTemplateRead(BaseModel):
    id: int
    instructor_id: int
    term_type: str
    day_of_week: str
    start_time: time
    end_time: time
    type: str
    model_config = {"from_attributes": True}
```

- [ ] **Step 7: Create API routes**

Create `backend/app/api/routes/availability_templates.py`:

```python
from __future__ import annotations

from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.instructor import AvailabilityType, Instructor, InstructorAvailability
from app.models.term import Term
from app.schemas.schemas import (
    AvailabilityTemplateCreate,
    AvailabilityTemplateRead,
)

router = APIRouter()


@router.get(
    "/{instructor_id}/availability-templates",
    response_model=list[AvailabilityTemplateRead],
)
def get_templates(
    instructor_id: int,
    term_type: Union[str, None] = Query(default=None),
    db: Session = Depends(get_db),
):
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")
    query = db.query(InstructorAvailabilityTemplate).filter_by(
        instructor_id=instructor_id
    )
    if term_type:
        query = query.filter_by(term_type=term_type)
    return query.all()


@router.put(
    "/{instructor_id}/availability-templates/{term_type}",
    response_model=list[AvailabilityTemplateRead],
)
def replace_templates(
    instructor_id: int,
    term_type: str,
    slots: list[AvailabilityTemplateCreate],
    db: Session = Depends(get_db),
):
    if term_type not in ("fall", "spring"):
        raise HTTPException(400, "term_type must be 'fall' or 'spring'")
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")

    # Delete existing templates for this term type
    db.query(InstructorAvailabilityTemplate).filter_by(
        instructor_id=instructor_id, term_type=term_type
    ).delete()

    # Create new templates
    new_templates = []
    for slot in slots:
        template = InstructorAvailabilityTemplate(
            instructor_id=instructor_id,
            term_type=term_type,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            type=AvailabilityType(slot.type),
        )
        db.add(template)
        new_templates.append(template)
    db.commit()
    for t in new_templates:
        db.refresh(t)
    return new_templates


@router.post(
    "/{instructor_id}/availability-templates/{term_type}/apply/{term_id}",
    response_model=list,
)
def apply_template_to_term(
    instructor_id: int,
    term_type: str,
    term_id: int,
    db: Session = Depends(get_db),
):
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")
    term = db.get(Term, term_id)
    if not term:
        raise HTTPException(404, "Term not found")

    templates = (
        db.query(InstructorAvailabilityTemplate)
        .filter_by(instructor_id=instructor_id, term_type=term_type)
        .all()
    )

    # Clear existing availability for this instructor+term
    db.query(InstructorAvailability).filter_by(
        instructor_id=instructor_id, term_id=term_id
    ).delete()

    # Copy templates to per-term availability
    created = []
    for t in templates:
        avail = InstructorAvailability(
            instructor_id=instructor_id,
            term_id=term_id,
            day_of_week=t.day_of_week,
            start_time=t.start_time,
            end_time=t.end_time,
            type=t.type,
        )
        db.add(avail)
        created.append(avail)
    db.commit()
    return [{"id": a.id, "day_of_week": a.day_of_week} for a in created]
```

- [ ] **Step 8: Register router in main.py**

In `backend/app/main.py`, add import and router registration near the other router registrations:

```python
from app.api.routes import availability_templates
```

Register (near line 47 with other router includes):

```python
app.include_router(
    availability_templates.router,
    prefix="/api/instructors",
    tags=["availability-templates"],
)
```

- [ ] **Step 9: Add _ensure_schema_current() patch for templates table**

In `backend/app/main.py`, in `_ensure_schema_current()`, add after the instructors patches:

```python
            # ── instructor_availability_templates table ──
            result = conn.execute(
                sa.text(
                    "SELECT name FROM sqlite_master WHERE type='table' "
                    "AND name='instructor_availability_templates'"
                )
            )
            if not result.fetchone():
                conn.execute(sa.text("""
                    CREATE TABLE instructor_availability_templates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
                        term_type VARCHAR(10) NOT NULL,
                        day_of_week VARCHAR(3) NOT NULL,
                        start_time TIME NOT NULL,
                        end_time TIME NOT NULL,
                        type VARCHAR(20) NOT NULL,
                        UNIQUE(instructor_id, term_type, day_of_week, start_time)
                    )
                """))
                logger.info("Created missing table instructor_availability_templates")
```

- [ ] **Step 10: Generate Alembic migration**

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "add instructor_availability_templates table"
```

- [ ] **Step 11: Run all tests**

```bash
cd backend && source venv/bin/activate
pytest -v
```

Expected: All tests pass including the 3 new template tests.

- [ ] **Step 12: Commit**

```bash
git add backend/app/models/availability_template.py backend/app/models/__init__.py backend/app/schemas/schemas.py backend/app/api/routes/availability_templates.py backend/app/main.py backend/alembic/versions/ backend/tests/test_availability_templates.py
git commit -m "feat: add availability template model and API endpoints"
```

---

## Task 3: Frontend — API Types & Shared Hooks

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/hooks/useInstructorHub.ts`

- [ ] **Step 1: Add template types to types.ts**

In `frontend/src/api/types.ts`, after the `InstructorAvailability` interface (line 80):

```typescript
export interface AvailabilityTemplate {
  id: number;
  instructor_id: number;
  term_type: "fall" | "spring";
  day_of_week: string;
  start_time: string;
  end_time: string;
  type: string;
}
```

- [ ] **Step 2: Create hub hooks**

Create `frontend/src/hooks/useInstructorHub.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Instructor, AvailabilityTemplate, InstructorAvailability, InstructorNote, InstructorWorkload } from "@/api/types";

// ── Instructor list ──
export function useInstructors() {
  return useQuery<Instructor[]>({
    queryKey: ["instructors"],
    queryFn: () => api.get("/instructors"),
  });
}

// ── Single instructor ──
export function useInstructor(id: number | null) {
  return useQuery<Instructor>({
    queryKey: ["instructors", id],
    queryFn: () => api.get(`/instructors/${id}`),
    enabled: id !== null,
  });
}

// ── Mutations ──
export function useCreateInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Instructor>) => api.post<Instructor>("/instructors", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

export function useUpdateInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Instructor> & { id: number }) =>
      api.put<Instructor>(`/instructors/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

export function useDeleteInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/instructors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

// ── Availability (per-term) ──
export function useInstructorAvailability(instructorId: number | null, termId: number | null) {
  return useQuery<InstructorAvailability[]>({
    queryKey: ["instructor-availability", instructorId, termId],
    queryFn: () => api.get(`/instructors/${instructorId}/availability?term_id=${termId}`),
    enabled: instructorId !== null && termId !== null,
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termId,
      slots,
    }: {
      instructorId: number;
      termId: number;
      slots: Array<{ day_of_week: string; start_time: string; end_time: string; type: string }>;
    }) => api.put(`/instructors/${instructorId}/availability?term_id=${termId}`, slots),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-availability"] }),
  });
}

// ── Availability templates ──
export function useAvailabilityTemplates(instructorId: number | null, termType?: string) {
  const params = termType ? `?term_type=${termType}` : "";
  return useQuery<AvailabilityTemplate[]>({
    queryKey: ["availability-templates", instructorId, termType],
    queryFn: () => api.get(`/instructors/${instructorId}/availability-templates${params}`),
    enabled: instructorId !== null,
  });
}

export function useSaveAvailabilityTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termType,
      slots,
    }: {
      instructorId: number;
      termType: string;
      slots: Array<{ day_of_week: string; start_time: string; end_time: string; type: string }>;
    }) =>
      api.put(`/instructors/${instructorId}/availability-templates/${termType}`, slots),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-templates"] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termType,
      termId,
    }: {
      instructorId: number;
      termType: string;
      termId: number;
    }) =>
      api.post(`/instructors/${instructorId}/availability-templates/${termType}/apply/${termId}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-availability"] }),
  });
}

// ── Notes ──
export function useInstructorNotes(instructorId: number | null, termId?: number | null) {
  const params = termId ? `?term_id=${termId}` : "";
  return useQuery<InstructorNote[]>({
    queryKey: ["instructor-notes", instructorId, termId],
    queryFn: () => api.get(`/instructors/${instructorId}/notes${params}`),
    enabled: instructorId !== null,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      ...data
    }: {
      instructorId: number;
      term_id?: number | null;
      category: string;
      content: string;
    }) => api.post(`/instructors/${instructorId}/notes`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ instructorId, noteId }: { instructorId: number; noteId: number }) =>
      api.delete(`/instructors/${instructorId}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-notes"] }),
  });
}

// ── Workload ──
export function useInstructorWorkload(termId: number | null) {
  return useQuery<{ instructors: InstructorWorkload[] }>({
    queryKey: ["instructor-workload", termId],
    queryFn: () => api.get(`/analytics/instructor-workload?term_id=${termId}`),
    enabled: termId !== null,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/hooks/useInstructorHub.ts
git commit -m "feat: add instructor hub API types and React Query hooks"
```

---

## Task 4: Frontend — AvailabilityGrid Component

Extract the reusable availability grid from the existing `InstructorsPage.tsx` AvailabilityEditor.

**Files:**
- Create: `frontend/src/components/instructors/AvailabilityGrid.tsx`

- [ ] **Step 1: Create the extracted grid component**

Create `frontend/src/components/instructors/AvailabilityGrid.tsx`:

```tsx
import { useState, useCallback } from "react";

const DAYS = ["M", "T", "W", "Th", "F"] as const;
const DAY_LABELS: Record<string, string> = { M: "Mon", T: "Tue", W: "Wed", Th: "Thu", F: "Fri" };
const HOURS = Array.from({ length: 10 }, (_, i) => i + 7); // 7 AM to 4 PM

type SlotState = "available" | "unavailable" | "prefer_avoid";

export interface AvailabilitySlot {
  day_of_week: string;
  start_time: string;
  end_time: string;
  type: "unavailable" | "prefer_avoid";
}

interface AvailabilityGridProps {
  slots: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
  readOnly?: boolean;
}

function timeStr(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00:00`;
}

function getSlotState(
  day: string,
  hour: number,
  slots: AvailabilitySlot[]
): SlotState {
  const match = slots.find(
    (s) => s.day_of_week === day && s.start_time === timeStr(hour)
  );
  if (!match) return "available";
  return match.type;
}

const STATE_CYCLE: Record<SlotState, SlotState> = {
  available: "unavailable",
  unavailable: "prefer_avoid",
  prefer_avoid: "available",
};

const STATE_STYLES: Record<SlotState, string> = {
  available: "bg-emerald-800 text-emerald-300 hover:bg-emerald-700",
  unavailable: "bg-red-900 text-red-300 hover:bg-red-800",
  prefer_avoid: "bg-amber-900 text-amber-300 hover:bg-amber-800",
};

const STATE_ICONS: Record<SlotState, string> = {
  available: "✓",
  unavailable: "✗",
  prefer_avoid: "~",
};

export function AvailabilityGrid({ slots, onChange, readOnly }: AvailabilityGridProps) {
  const toggle = useCallback(
    (day: string, hour: number) => {
      if (readOnly) return;
      const current = getSlotState(day, hour, slots);
      const next = STATE_CYCLE[current];

      // Remove existing slot for this day/hour
      const filtered = slots.filter(
        (s) => !(s.day_of_week === day && s.start_time === timeStr(hour))
      );

      if (next !== "available") {
        filtered.push({
          day_of_week: day,
          start_time: timeStr(hour),
          end_time: timeStr(hour + 1),
          type: next,
        });
      }
      onChange(filtered);
    },
    [slots, onChange, readOnly]
  );

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-secondary">
        <span>Click to toggle:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-800 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-900 inline-block" /> Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-900 inline-block" /> Prefer to Avoid
        </span>
      </div>

      {/* Grid */}
      <div
        className="grid border border-border rounded-lg overflow-hidden text-xs"
        style={{ gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`, gap: "1px", background: "var(--color-border)" }}
      >
        {/* Header row */}
        <div className="bg-surface-alt p-2" />
        {DAYS.map((day) => (
          <div key={day} className="bg-surface-alt p-2 text-center font-semibold text-secondary">
            {DAY_LABELS[day]}
          </div>
        ))}

        {/* Time rows */}
        {HOURS.map((hour) => (
          <>
            <div key={`label-${hour}`} className="bg-surface-alt px-2 py-1.5 text-right text-secondary">
              {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
            </div>
            {DAYS.map((day) => {
              const state = getSlotState(day, hour, slots);
              return (
                <button
                  key={`${day}-${hour}`}
                  className={`p-1.5 text-center transition-colors ${STATE_STYLES[state]} ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => toggle(day, hour)}
                  disabled={readOnly}
                  aria-label={`${DAY_LABELS[day]} ${hour}:00 - ${STATE_ICONS[state]}`}
                >
                  {STATE_ICONS[state]}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/AvailabilityGrid.tsx
git commit -m "feat: extract reusable AvailabilityGrid component"
```

---

## Task 5: Frontend — TermTypeToggle Component

**Files:**
- Create: `frontend/src/components/instructors/TermTypeToggle.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/instructors/TermTypeToggle.tsx`:

```tsx
interface TermTypeToggleProps {
  termType: "summer" | "winter";
  available: boolean;
  onChange: (available: boolean) => void;
}

const LABELS = { summer: "Summer", winter: "Winter" };

export function TermTypeToggle({ termType, available, onChange }: TermTypeToggleProps) {
  return (
    <div className="flex flex-col items-center max-w-sm mx-auto py-8">
      <h3 className="text-lg font-semibold text-primary mb-2">
        {LABELS[termType]} Availability
      </h3>
      <p className="text-sm text-secondary mb-6">
        Is this instructor available to teach during {LABELS[termType]} terms?
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 min-w-[140px] rounded-xl p-5 text-center transition-all border-2 ${
            available
              ? "bg-emerald-900/50 border-emerald-500 text-emerald-400"
              : "bg-surface border-border text-secondary hover:border-border-hover"
          }`}
        >
          <div className="text-3xl mb-1">✓</div>
          <div className="font-semibold">Available</div>
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 min-w-[140px] rounded-xl p-5 text-center transition-all border-2 ${
            !available
              ? "bg-red-900/50 border-red-500 text-red-400"
              : "bg-surface border-border text-secondary hover:border-border-hover"
          }`}
        >
          <div className="text-3xl mb-1">✗</div>
          <div className="font-semibold">Not Available</div>
        </button>
      </div>
      <p className="text-xs text-tertiary mt-4">
        This applies as the default for all future {LABELS[termType]} terms. Can be overridden per-term.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/TermTypeToggle.tsx
git commit -m "feat: add TermTypeToggle component for summer/winter availability"
```

---

## Task 6: Frontend — InstructorRoster Component

**Files:**
- Create: `frontend/src/components/instructors/InstructorRoster.tsx`

- [ ] **Step 1: Create the roster component**

Create `frontend/src/components/instructors/InstructorRoster.tsx`:

```tsx
import { useState, useMemo } from "react";
import type { Instructor, InstructorWorkload } from "@/api/types";

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
] as const;

interface InstructorRosterProps {
  instructors: Instructor[];
  workloads: Map<number, InstructorWorkload>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewInstructor: () => void;
  onExportXlsx: () => void;
}

export function InstructorRoster({
  instructors,
  workloads,
  selectedId,
  onSelect,
  onNewInstructor,
  onExportXlsx,
}: InstructorRosterProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = instructors;
    if (typeFilter !== "all") {
      result = result.filter((i) => i.instructor_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.email && i.email.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => {
      const aName = a.last_name || a.name;
      const bName = b.last_name || b.name;
      return aName.localeCompare(bName);
    });
  }, [instructors, search, typeFilter]);

  return (
    <div className="w-[300px] border-r border-border flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-sm text-primary">Instructors</span>
        <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
          {instructors.length}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          placeholder="Search instructors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Type filters */}
      <div className="flex gap-1 px-3 py-2 border-b border-border text-xs">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-2 py-0.5 rounded ${
              typeFilter === f.value
                ? "bg-accent text-white"
                : "text-secondary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((inst) => {
          const wl = workloads.get(inst.id);
          const eqCredits = wl?.total_equivalent_credits ?? 0;
          const isOverloaded = wl?.is_overloaded ?? false;
          const sectionCount = wl?.section_count ?? 0;
          const isSelected = inst.id === selectedId;

          return (
            <button
              key={inst.id}
              onClick={() => onSelect(inst.id)}
              className={`w-full text-left px-4 py-2.5 border-l-[3px] transition-colors ${
                isSelected
                  ? "bg-surface-alt border-l-accent"
                  : "border-l-transparent hover:bg-surface-alt/50"
              }`}
            >
              <div
                className={`text-sm ${
                  isSelected ? "font-semibold text-primary" : inst.is_active ? "text-primary" : "text-tertiary italic"
                }`}
              >
                {inst.last_name ? `${inst.last_name}, ${inst.first_name}` : inst.name}
              </div>
              <div className="text-xs text-secondary mt-0.5">
                {inst.instructor_type
                  ? inst.instructor_type.charAt(0).toUpperCase() + inst.instructor_type.slice(1)
                  : "—"}
                {" · "}
                {!inst.is_active ? (
                  <span>Inactive</span>
                ) : (
                  <>
                    <span className={isOverloaded ? "text-red-400" : "text-emerald-400"}>
                      {eqCredits}/{inst.max_credits} cr
                    </span>
                    {" · "}
                    <span className={sectionCount === 0 ? "text-tertiary" : "text-emerald-400"}>
                      {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                    </span>
                    {isOverloaded && " ⚠"}
                  </>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-tertiary">
            No instructors found
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-border flex flex-col gap-2">
        <button
          onClick={onExportXlsx}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          📥 Export All — XLSX
        </button>
        <button
          onClick={onNewInstructor}
          className="w-full bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          + New Instructor
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/InstructorRoster.tsx
git commit -m "feat: add InstructorRoster component with search, filters, workload display"
```

---

## Task 7: Frontend — ProfileTab Component

**Files:**
- Create: `frontend/src/components/instructors/ProfileTab.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/instructors/ProfileTab.tsx`:

```tsx
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Instructor } from "@/api/types";
import { useUpdateInstructor } from "@/hooks/useInstructorHub";

const TYPE_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
];

const RANK_OPTIONS = [
  { value: "", label: "Select rank" },
  { value: "professor", label: "Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "senior_lecturer", label: "Senior Lecturer" },
  { value: "lecturer", label: "Lecturer" },
  { value: "adjunct_instructor", label: "Adjunct Instructor" },
];

const TENURE_OPTIONS = [
  { value: "", label: "Select status" },
  { value: "tenured", label: "Tenured" },
  { value: "tenure_track", label: "Tenure Track" },
  { value: "non_tenure", label: "Non-Tenure" },
];

const MODALITY_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "online_only", label: "Online Only" },
  { value: "mwf_only", label: "MWF Only" },
  { value: "tth_only", label: "TTh Only" },
];

interface ProfileTabProps {
  instructor: Instructor;
}

export function ProfileTab({ instructor }: ProfileTabProps) {
  const [form, setForm] = useState<Partial<Instructor>>({});
  const updateMutation = useUpdateInstructor();

  // Reset form when instructor changes
  useEffect(() => {
    setForm({
      first_name: instructor.first_name ?? "",
      last_name: instructor.last_name ?? "",
      email: instructor.email,
      phone: instructor.phone ?? "",
      office_location: instructor.office_location ?? "",
      emergency_contact: instructor.emergency_contact ?? "",
      department: instructor.department,
      instructor_type: instructor.instructor_type ?? "",
      rank: instructor.rank ?? "",
      tenure_status: instructor.tenure_status ?? "",
      hire_date: instructor.hire_date ?? "",
      modality_constraint: instructor.modality_constraint,
      max_credits: instructor.max_credits,
      is_active: instructor.is_active,
    });
  }, [instructor.id]);

  const set = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    updateMutation.mutate(
      { id: instructor.id, ...form },
      {
        onSuccess: () => toast.success("Instructor saved"),
        onError: () => toast.error("Failed to save"),
      }
    );
  };

  const handleCancel = () => {
    setForm({
      first_name: instructor.first_name ?? "",
      last_name: instructor.last_name ?? "",
      email: instructor.email,
      phone: instructor.phone ?? "",
      office_location: instructor.office_location ?? "",
      emergency_contact: instructor.emergency_contact ?? "",
      department: instructor.department,
      instructor_type: instructor.instructor_type ?? "",
      rank: instructor.rank ?? "",
      tenure_status: instructor.tenure_status ?? "",
      hire_date: instructor.hire_date ?? "",
      modality_constraint: instructor.modality_constraint,
      max_credits: instructor.max_credits,
      is_active: instructor.is_active,
    });
  };

  const inputClass =
    "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "text-xs text-secondary mb-1 block";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Contact Information */}
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          Contact Information
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name</label>
            <input
              className={inputClass}
              value={form.first_name ?? ""}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input
              className={inputClass}
              value={form.last_name ?? ""}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              className={inputClass}
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Office Location</label>
            <input
              className={inputClass}
              value={form.office_location ?? ""}
              onChange={(e) => set("office_location", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Emergency Contact Number</label>
            <input
              type="tel"
              className={inputClass}
              value={form.emergency_contact ?? ""}
              onChange={(e) => set("emergency_contact", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Employment */}
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          Employment
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Department</label>
            <input
              className={inputClass}
              value={form.department ?? ""}
              onChange={(e) => set("department", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              className={inputClass}
              value={form.instructor_type ?? ""}
              onChange={(e) => set("instructor_type", e.target.value)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Rank</label>
            <select
              className={inputClass}
              value={form.rank ?? ""}
              onChange={(e) => set("rank", e.target.value)}
            >
              {RANK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tenure Status</label>
            <select
              className={inputClass}
              value={form.tenure_status ?? ""}
              onChange={(e) => set("tenure_status", e.target.value)}
            >
              {TENURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Hire Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.hire_date ?? ""}
              onChange={(e) => set("hire_date", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Active</label>
            <div className="flex items-center h-[38px]">
              <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(e) => set("is_active", e.target.checked)}
                  className="rounded"
                />
                Active
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Scheduling Preferences */}
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          Scheduling Preferences
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Modality Constraint</label>
            <select
              className={inputClass}
              value={form.modality_constraint ?? "any"}
              onChange={(e) => set("modality_constraint", e.target.value)}
            >
              {MODALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Max Credits</label>
            <input
              type="number"
              className={inputClass}
              value={form.max_credits ?? 12}
              onChange={(e) => set("max_credits", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <button
          onClick={handleCancel}
          className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface-alt"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/ProfileTab.tsx
git commit -m "feat: add ProfileTab component with contact, employment, scheduling sections"
```

---

## Task 8: Frontend — AvailabilityTab Component

**Files:**
- Create: `frontend/src/components/instructors/AvailabilityTab.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/instructors/AvailabilityTab.tsx`:

```tsx
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Instructor } from "@/api/types";
import { AvailabilityGrid, type AvailabilitySlot } from "./AvailabilityGrid";
import { TermTypeToggle } from "./TermTypeToggle";
import {
  useAvailabilityTemplates,
  useSaveAvailabilityTemplate,
  useUpdateInstructor,
} from "@/hooks/useInstructorHub";

const TERM_TYPES = ["fall", "spring", "summer", "winter"] as const;
const TERM_TYPE_LABELS: Record<string, string> = {
  fall: "Fall",
  spring: "Spring",
  summer: "Summer",
  winter: "Winter",
};

interface AvailabilityTabProps {
  instructor: Instructor;
}

export function AvailabilityTab({ instructor }: AvailabilityTabProps) {
  const [activeTermType, setActiveTermType] = useState<string>("fall");
  const isGridType = activeTermType === "fall" || activeTermType === "spring";

  // Template queries
  const { data: templates = [] } = useAvailabilityTemplates(
    instructor.id,
    isGridType ? activeTermType : undefined
  );
  const saveMutation = useSaveAvailabilityTemplate();
  const updateInstructorMutation = useUpdateInstructor();

  // Local state for grid editing
  const [localSlots, setLocalSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (isGridType) {
      setLocalSlots(
        templates.map((t) => ({
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time,
          type: t.type as "unavailable" | "prefer_avoid",
        }))
      );
    }
  }, [templates, activeTermType]);

  const handleGridChange = useCallback((slots: AvailabilitySlot[]) => {
    setLocalSlots(slots);
  }, []);

  const handleSaveGrid = () => {
    saveMutation.mutate(
      {
        instructorId: instructor.id,
        termType: activeTermType,
        slots: localSlots,
      },
      {
        onSuccess: () => toast.success(`${TERM_TYPE_LABELS[activeTermType]} availability saved`),
        onError: () => toast.error("Failed to save"),
      }
    );
  };

  const handleCopyFallToSpring = () => {
    if (activeTermType !== "spring") return;
    // Fetch fall templates and save as spring
    saveMutation.mutate(
      {
        instructorId: instructor.id,
        termType: "spring",
        slots: localSlots, // will use current local slots after user switches
      },
      {
        onSuccess: () => toast.success("Copied Fall availability to Spring"),
      }
    );
  };

  const handleToggle = (available: boolean) => {
    const field = activeTermType === "summer" ? "available_summer" : "available_winter";
    updateInstructorMutation.mutate(
      { id: instructor.id, [field]: available },
      {
        onSuccess: () =>
          toast.success(
            `${TERM_TYPE_LABELS[activeTermType]} availability ${available ? "enabled" : "disabled"}`
          ),
      }
    );
  };

  const handleSetAllAvailable = () => {
    setLocalSlots([]);
  };

  const handleClearAll = () => {
    // Mark all slots as unavailable
    const DAYS = ["M", "T", "W", "Th", "F"];
    const HOURS = Array.from({ length: 10 }, (_, i) => i + 7);
    const allUnavailable: AvailabilitySlot[] = [];
    for (const day of DAYS) {
      for (const hour of HOURS) {
        allUnavailable.push({
          day_of_week: day,
          start_time: `${hour.toString().padStart(2, "0")}:00:00`,
          end_time: `${(hour + 1).toString().padStart(2, "0")}:00:00`,
          type: "unavailable",
        });
      }
    }
    setLocalSlots(allUnavailable);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Term type tabs */}
      <div className="flex gap-0 border-b border-border mb-5">
        {TERM_TYPES.map((tt) => (
          <button
            key={tt}
            onClick={() => setActiveTermType(tt)}
            className={`px-5 py-2 text-sm transition-colors ${
              activeTermType === tt
                ? "text-accent border-b-2 border-accent font-medium"
                : "text-secondary hover:text-primary"
            }`}
          >
            {TERM_TYPE_LABELS[tt]}
          </button>
        ))}
      </div>

      {isGridType ? (
        <>
          {/* Quick actions */}
          <div className="flex gap-3 items-center mb-3 text-xs">
            <span className="text-secondary">Quick:</span>
            <button
              onClick={handleSetAllAvailable}
              className="text-accent hover:underline"
            >
              Set all available
            </button>
            <button onClick={handleClearAll} className="text-accent hover:underline">
              Clear all
            </button>
            {activeTermType === "spring" && (
              <button
                onClick={handleCopyFallToSpring}
                className="text-accent hover:underline"
              >
                Copy Fall → Spring
              </button>
            )}
          </div>

          <AvailabilityGrid slots={localSlots} onChange={handleGridChange} />

          {/* Save */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() =>
                setLocalSlots(
                  templates.map((t) => ({
                    day_of_week: t.day_of_week,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    type: t.type as "unavailable" | "prefer_avoid",
                  }))
                )
              }
              className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface-alt"
            >
              Undo
            </button>
            <button
              onClick={handleSaveGrid}
              disabled={saveMutation.isPending}
              className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save Availability"}
            </button>
          </div>
        </>
      ) : (
        <TermTypeToggle
          termType={activeTermType as "summer" | "winter"}
          available={
            activeTermType === "summer"
              ? instructor.available_summer
              : instructor.available_winter
          }
          onChange={handleToggle}
        />
      )}

      {/* Status summary */}
      <div className="mt-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          All Term Types
        </h4>
        <div className="grid grid-cols-4 gap-3">
          {TERM_TYPES.map((tt) => (
            <div key={tt} className="bg-surface border border-border rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span
                  className={`text-sm font-medium ${
                    activeTermType === tt ? "text-accent" : "text-secondary"
                  }`}
                >
                  {TERM_TYPE_LABELS[tt]}
                </span>
                {tt === "summer" || tt === "winter" ? (
                  <span
                    className={`text-xs ${
                      (tt === "summer" ? instructor.available_summer : instructor.available_winter)
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {(tt === "summer" ? instructor.available_summer : instructor.available_winter)
                      ? "✓ Available"
                      : "✗ Not available"}
                  </span>
                ) : (
                  <span className="text-xs text-secondary">
                    {templates.length > 0 && activeTermType === tt
                      ? "✓ Set"
                      : "Default"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/AvailabilityTab.tsx
git commit -m "feat: add AvailabilityTab with term-type tabs, grid, and summer/winter toggles"
```

---

## Task 9: Frontend — WorkloadTab Component

**Files:**
- Create: `frontend/src/components/instructors/WorkloadTab.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/instructors/WorkloadTab.tsx`:

```tsx
import type { InstructorWorkload } from "@/api/types";

interface WorkloadTabProps {
  workload: InstructorWorkload | undefined;
  isLoading: boolean;
}

export function WorkloadTab({ workload, isLoading }: WorkloadTabProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-secondary">
        Loading workload...
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="flex-1 flex items-center justify-center text-secondary">
        Select a term to view workload data.
      </div>
    );
  }

  const eqCredits = workload.total_equivalent_credits;
  const maxCredits = workload.max_credits;
  const overAmount = eqCredits - maxCredits;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-secondary uppercase tracking-wide">Sections</div>
          <div className="text-2xl font-bold text-primary mt-1">{workload.section_count}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-secondary uppercase tracking-wide">Teaching Credits</div>
          <div className="text-2xl font-bold text-primary mt-1">
            {workload.total_teaching_credits}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-secondary uppercase tracking-wide">Equivalent Credits</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              workload.is_overloaded ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {eqCredits}
          </div>
          <div className="text-xs text-secondary mt-0.5">of {maxCredits} max</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-secondary uppercase tracking-wide">Student Credit Hours</div>
          <div className="text-2xl font-bold text-primary mt-1">{workload.total_sch}</div>
        </div>
      </div>

      {/* Sections Table */}
      <section className="mb-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          Assigned Sections
        </h4>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2.5 text-secondary font-medium">Course</th>
                <th className="text-left px-3 py-2.5 text-secondary font-medium">Title</th>
                <th className="text-center px-3 py-2.5 text-secondary font-medium">Credits</th>
                <th className="text-center px-3 py-2.5 text-secondary font-medium">Equiv</th>
                <th className="text-center px-3 py-2.5 text-secondary font-medium">Cap</th>
                <th className="text-left px-3 py-2.5 text-secondary font-medium">Schedule</th>
                <th className="text-left px-3 py-2.5 text-secondary font-medium">Modality</th>
              </tr>
            </thead>
            <tbody>
              {workload.sections.map((s, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 text-primary font-medium">
                    {s.department_code} {s.course_number}-{s.section_number}
                  </td>
                  <td className="px-3 py-2.5 text-primary">{s.title}</td>
                  <td className="px-3 py-2.5 text-primary text-center">{s.credits}</td>
                  <td className="px-3 py-2.5 text-primary text-center">
                    {s.equivalent_credits ?? s.credits}
                  </td>
                  <td className="px-3 py-2.5 text-primary text-center">{s.enrollment_cap}</td>
                  <td className="px-3 py-2.5 text-secondary">{s.schedule_display ?? "—"}</td>
                  <td className="px-3 py-2.5 text-secondary">{s.modality ?? "—"}</td>
                </tr>
              ))}
              {workload.sections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-secondary">
                    No sections assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Load Adjustments */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Load Adjustments
          </h4>
        </div>
        {workload.adjustments.length > 0 ? (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 text-secondary font-medium">Description</th>
                  <th className="text-center px-3 py-2.5 text-secondary font-medium">
                    Equiv Credits
                  </th>
                  <th className="text-left px-3 py-2.5 text-secondary font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {workload.adjustments.map((a, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 text-primary">{a.description}</td>
                    <td className="px-3 py-2.5 text-primary text-center">
                      {a.equivalent_credits}
                    </td>
                    <td className="px-3 py-2.5 text-secondary">{a.adjustment_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg px-3 py-4 text-sm text-secondary text-center">
            No load adjustments
          </div>
        )}
      </section>

      {/* Total bar */}
      <div
        className={`p-3 rounded-lg border flex justify-between items-center ${
          workload.is_overloaded
            ? "bg-red-900/20 border-red-800"
            : "bg-blue-900/20 border-blue-800"
        }`}
      >
        <div>
          <span
            className={`text-sm font-medium ${
              workload.is_overloaded ? "text-red-300" : "text-blue-300"
            }`}
          >
            Total Equivalent Credits: {eqCredits} / {maxCredits}
          </span>
          <span className="text-xs text-secondary ml-3">
            ({workload.total_teaching_credits} teaching
            {workload.adjustments.length > 0
              ? ` + ${eqCredits - workload.total_teaching_credits} adjustments`
              : ""}
            )
          </span>
        </div>
        <span
          className={`text-xs font-medium ${
            workload.is_overloaded ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {workload.is_overloaded
            ? `⚠ Overloaded by ${overAmount} credit${overAmount !== 1 ? "s" : ""}`
            : "✓ Within limit"}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/WorkloadTab.tsx
git commit -m "feat: add WorkloadTab with KPI cards, sections table, and total bar"
```

---

## Task 10: Frontend — NotesTab Component

**Files:**
- Create: `frontend/src/components/instructors/NotesTab.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/instructors/NotesTab.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import type { Instructor, InstructorNote } from "@/api/types";
import { useInstructorNotes, useCreateNote, useDeleteNote } from "@/hooks/useInstructorHub";

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-stone-800 text-stone-300" },
  { value: "scheduling", label: "Scheduling", color: "bg-blue-900/60 text-blue-300" },
  { value: "contract", label: "Contract", color: "bg-lime-900/60 text-lime-300" },
  { value: "performance", label: "Performance", color: "bg-orange-900/60 text-orange-300" },
] as const;

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

interface NotesTabProps {
  instructor: Instructor;
  termId: number | null;
  terms: Array<{ id: number; name: string }>;
}

export function NotesTab({ instructor, termId, terms }: NotesTabProps) {
  const [filterCategory, setFilterCategory] = useState("all");
  const [newCategory, setNewCategory] = useState("general");
  const [newTermId, setNewTermId] = useState<number | null>(null);
  const [newContent, setNewContent] = useState("");

  // Fetch notes — no term filter (show all, filter client-side)
  const { data: notes = [] } = useInstructorNotes(instructor.id);
  const createMutation = useCreateNote();
  const deleteMutation = useDeleteNote();

  const filteredNotes = notes
    .filter((n: InstructorNote) => filterCategory === "all" || n.category === filterCategory)
    .sort((a: InstructorNote, b: InstructorNote) => b.id - a.id); // newest first by ID

  const handleAdd = () => {
    if (!newContent.trim()) return;
    createMutation.mutate(
      {
        instructorId: instructor.id,
        term_id: newTermId,
        category: newCategory,
        content: newContent.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Note added");
          setNewContent("");
        },
      }
    );
  };

  const handleDelete = (noteId: number) => {
    deleteMutation.mutate(
      { instructorId: instructor.id, noteId },
      { onSuccess: () => toast.success("Note deleted") }
    );
  };

  const termName = (id: number | null) => {
    if (!id) return "General";
    return terms.find((t) => t.id === id)?.name ?? `Term ${id}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Add note form */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-5">
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-xs text-secondary mb-1 block">Category</label>
            <select
              className="w-full bg-surface-alt border border-border rounded-md px-3 py-1.5 text-sm text-primary"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-secondary mb-1 block">Term (optional)</label>
            <select
              className="w-full bg-surface-alt border border-border rounded-md px-3 py-1.5 text-sm text-primary"
              value={newTermId ?? ""}
              onChange={(e) => setNewTermId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">None — general note</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          placeholder="Add a note..."
          className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-tertiary min-h-[60px] resize-y mb-3"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || createMutation.isPending}
            className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50"
          >
            Save Note
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-1.5 mb-4 text-xs">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-2.5 py-1 rounded ${
            filterCategory === "all"
              ? "bg-surface-alt text-primary"
              : "text-secondary border border-border hover:text-primary"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(c.value)}
            className={`px-2.5 py-1 rounded ${
              filterCategory === c.value
                ? "bg-surface-alt text-primary"
                : "text-secondary border border-border hover:text-primary"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Notes list */}
      <div className="flex flex-col gap-3">
        {filteredNotes.map((note: InstructorNote) => {
          const cat = CATEGORY_MAP[note.category] ?? CATEGORY_MAP.general;
          return (
            <div key={note.id} className="bg-surface border border-border rounded-lg px-4 py-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                  <span className="text-xs text-secondary">{termName(note.term_id)}</span>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-xs text-secondary hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-primary leading-relaxed">{note.content}</p>
            </div>
          );
        })}
        {filteredNotes.length === 0 && (
          <div className="text-center text-sm text-secondary py-8">No notes found</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/NotesTab.tsx
git commit -m "feat: add NotesTab with category filtering, add/delete notes"
```

---

## Task 11: Frontend — InstructorDetail Container

**Files:**
- Create: `frontend/src/components/instructors/InstructorDetail.tsx`

- [ ] **Step 1: Create the tab container component**

Create `frontend/src/components/instructors/InstructorDetail.tsx`:

```tsx
import { useState } from "react";
import type { Instructor, InstructorWorkload, Term } from "@/api/types";
import { ProfileTab } from "./ProfileTab";
import { AvailabilityTab } from "./AvailabilityTab";
import { WorkloadTab } from "./WorkloadTab";
import { NotesTab } from "./NotesTab";
import { useDeleteInstructor } from "@/hooks/useInstructorHub";
import { toast } from "sonner";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "availability", label: "Availability" },
  { key: "workload", label: "Workload" },
  { key: "notes", label: "Notes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface InstructorDetailProps {
  instructor: Instructor;
  workload: InstructorWorkload | undefined;
  workloadLoading: boolean;
  selectedTermId: number | null;
  terms: Term[];
  onDeleted: () => void;
}

export function InstructorDetail({
  instructor,
  workload,
  workloadLoading,
  selectedTermId,
  terms,
  onDeleted,
}: InstructorDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const deleteMutation = useDeleteInstructor();

  const typeLabel = instructor.instructor_type
    ? instructor.instructor_type.charAt(0).toUpperCase() + instructor.instructor_type.slice(1)
    : "";
  const rankLabel = instructor.rank
    ? instructor.rank.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const tenureLabel = instructor.tenure_status
    ? instructor.tenure_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const subtitle = [typeLabel, rankLabel, tenureLabel].filter(Boolean).join(" · ");

  const handleDelete = () => {
    if (!confirm(`Delete ${instructor.name}? This cannot be undone.`)) return;
    deleteMutation.mutate(instructor.id, {
      onSuccess: () => {
        toast.success("Instructor deleted");
        onDeleted();
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">
            {instructor.first_name} {instructor.last_name}
          </h2>
          {subtitle && <p className="text-sm text-secondary mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="text-xs text-red-400 border border-border px-3 py-1.5 rounded-md hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm transition-colors ${
              activeTab === tab.key
                ? "text-accent border-b-2 border-accent font-medium"
                : "text-secondary hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && <ProfileTab instructor={instructor} />}
      {activeTab === "availability" && <AvailabilityTab instructor={instructor} />}
      {activeTab === "workload" && (
        <WorkloadTab workload={workload} isLoading={workloadLoading} />
      )}
      {activeTab === "notes" && (
        <NotesTab
          instructor={instructor}
          termId={selectedTermId}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/InstructorDetail.tsx
git commit -m "feat: add InstructorDetail tab container with header and delete"
```

---

## Task 12: Frontend — NewInstructorWizard Component

**Files:**
- Create: `frontend/src/components/instructors/NewInstructorWizard.tsx`

- [ ] **Step 1: Create the wizard component**

Create `frontend/src/components/instructors/NewInstructorWizard.tsx`:

```tsx
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useCreateInstructor, useSaveAvailabilityTemplate, useUpdateInstructor } from "@/hooks/useInstructorHub";
import { AvailabilityGrid, type AvailabilitySlot } from "./AvailabilityGrid";
import { TermTypeToggle } from "./TermTypeToggle";
import type { Instructor } from "@/api/types";

interface NewInstructorWizardProps {
  onClose: () => void;
  onCreated: (id: number) => void;
}

const MODALITY_CARDS = [
  { value: "any", label: "Any", desc: "No restrictions" },
  { value: "online_only", label: "Online Only", desc: "Remote teaching only" },
  { value: "mwf_only", label: "MWF Only", desc: "Mon/Wed/Fri blocks" },
  { value: "tth_only", label: "TTh Only", desc: "Tue/Thu blocks" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Select type" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
];

const RANK_OPTIONS = [
  { value: "", label: "Select rank" },
  { value: "professor", label: "Professor" },
  { value: "associate_professor", label: "Associate Professor" },
  { value: "assistant_professor", label: "Assistant Professor" },
  { value: "senior_lecturer", label: "Senior Lecturer" },
  { value: "lecturer", label: "Lecturer" },
  { value: "adjunct_instructor", label: "Adjunct Instructor" },
];

const TENURE_OPTIONS = [
  { value: "", label: "Select status" },
  { value: "tenured", label: "Tenured" },
  { value: "tenure_track", label: "Tenure Track" },
  { value: "non_tenure", label: "Non-Tenure" },
];

export function NewInstructorWizard({ onClose, onCreated }: NewInstructorWizardProps) {
  const [step, setStep] = useState(1);
  const createMutation = useCreateInstructor();
  const updateMutation = useUpdateInstructor();
  const saveTemplateMutation = useSaveAvailabilityTemplate();

  // Step 1: Profile
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    emergency_contact: "",
    office_location: "",
    department: "",
    instructor_type: "",
    rank: "",
    tenure_status: "",
    hire_date: "",
    max_credits: 12,
  });

  // Step 2: Scheduling
  const [modality, setModality] = useState("any");
  const [initialNote, setInitialNote] = useState("");

  // Step 3: Availability
  const [availTermType, setAvailTermType] = useState("fall");
  const [fallSlots, setFallSlots] = useState<AvailabilitySlot[]>([]);
  const [springSlots, setSpringSlots] = useState<AvailabilitySlot[]>([]);
  const [availSummer, setAvailSummer] = useState(true);
  const [availWinter, setAvailWinter] = useState(true);

  // Created instructor ID (for saving templates after creation)
  const [createdId, setCreatedId] = useState<number | null>(null);

  const setField = (field: string, value: string | number) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const profileValid =
    profile.first_name.trim() &&
    profile.last_name.trim() &&
    profile.email.trim() &&
    profile.department.trim() &&
    profile.instructor_type;

  const inputClass =
    "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const requiredInputClass =
    "w-full bg-surface border border-accent/50 rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "text-xs text-secondary mb-1 block";

  const saveInstructor = async (): Promise<number> => {
    if (createdId) return createdId;

    const data: Partial<Instructor> = {
      ...profile,
      name: `${profile.last_name}, ${profile.first_name}`,
      modality_constraint: modality,
      is_active: true,
      available_summer: availSummer,
      available_winter: availWinter,
    };
    // Clean up empty strings to null
    for (const key of ["phone", "emergency_contact", "office_location", "rank", "tenure_status", "hire_date"] as const) {
      if (!(data as Record<string, unknown>)[key]) {
        (data as Record<string, unknown>)[key] = null;
      }
    }

    const result = await createMutation.mutateAsync(data);
    setCreatedId(result.id);
    return result.id;
  };

  const saveTemplates = async (instructorId: number) => {
    if (fallSlots.length > 0) {
      await saveTemplateMutation.mutateAsync({
        instructorId,
        termType: "fall",
        slots: fallSlots,
      });
    }
    if (springSlots.length > 0) {
      await saveTemplateMutation.mutateAsync({
        instructorId,
        termType: "spring",
        slots: springSlots,
      });
    }
    // Summer/winter already set via available_summer/available_winter on instructor
  };

  const handleSkipAndSave = async () => {
    try {
      const id = await saveInstructor();
      if (step === 3) {
        await saveTemplates(id);
      }
      toast.success("Instructor created");
      onCreated(id);
    } catch {
      toast.error("Failed to create instructor");
    }
  };

  const handleFinalSave = async () => {
    try {
      const id = await saveInstructor();
      await saveTemplates(id);
      // Update summer/winter if changed
      if (!availSummer || !availWinter) {
        await updateMutation.mutateAsync({
          id,
          available_summer: availSummer,
          available_winter: availWinter,
        });
      }
      toast.success("Instructor created");
      onCreated(id);
    } catch {
      toast.error("Failed to create instructor");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-alt border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Step indicator */}
        <div className="flex justify-center gap-10 py-6 relative">
          <div className="absolute top-[27px] left-[calc(50%-80px)] w-[160px] h-0.5 bg-border" />
          {[
            { n: 1, label: "Profile" },
            { n: 2, label: "Scheduling" },
            { n: 3, label: "Availability" },
          ].map(({ n, label }) => (
            <div key={n} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step > n
                    ? "bg-emerald-600 text-white"
                    : step === n
                      ? "bg-accent text-white"
                      : "bg-surface text-secondary"
                }`}
              >
                {step > n ? "✓" : n}
              </div>
              <span
                className={`text-xs ${
                  step >= n ? "text-accent font-medium" : "text-secondary"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Profile */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={requiredInputClass}
                    value={profile.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={requiredInputClass}
                    value={profile.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    className={requiredInputClass}
                    value={profile.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="name@uwrf.edu"
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="tel"
                    className={inputClass}
                    value={profile.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass}>Emergency Contact</label>
                  <input
                    type="tel"
                    className={inputClass}
                    value={profile.emergency_contact}
                    onChange={(e) => setField("emergency_contact", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass}>Office Location</label>
                  <input
                    className={inputClass}
                    value={profile.office_location}
                    onChange={(e) => setField("office_location", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Department <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={requiredInputClass}
                    value={profile.department}
                    onChange={(e) => setField("department", e.target.value)}
                    placeholder="Enter department"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    className={requiredInputClass}
                    value={profile.instructor_type}
                    onChange={(e) => setField("instructor_type", e.target.value)}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rank</label>
                  <select
                    className={inputClass}
                    value={profile.rank}
                    onChange={(e) => setField("rank", e.target.value)}
                  >
                    {RANK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tenure Status</label>
                  <select
                    className={inputClass}
                    value={profile.tenure_status}
                    onChange={(e) => setField("tenure_status", e.target.value)}
                  >
                    {TENURE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Hire Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={profile.hire_date}
                    onChange={(e) => setField("hire_date", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Max Credits</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={profile.max_credits}
                    onChange={(e) => setField("max_credits", parseInt(e.target.value) || 12)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!profileValid}
                  className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50"
                >
                  Next: Scheduling →
                </button>
              </div>
            </>
          )}

          {/* Step 2: Scheduling */}
          {step === 2 && (
            <>
              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
                Modality Constraint
              </h4>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {MODALITY_CARDS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModality(m.value)}
                    className={`text-left rounded-lg p-3 border-2 transition-all ${
                      modality === m.value
                        ? "bg-accent/10 border-accent"
                        : "bg-surface border-border hover:border-border-hover"
                    }`}
                  >
                    <div className="text-sm text-primary font-medium">{m.label}</div>
                    <div className="text-xs text-secondary mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>

              <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
                Initial Note (optional)
              </h4>
              <textarea
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-tertiary min-h-[80px] resize-y mb-4"
                placeholder="Any scheduling preferences, contract details, or notes to record..."
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
              />

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-6">
                <p className="text-xs text-blue-300">
                  You can set detailed per-day availability in the next step, or skip and add it later.
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleSkipAndSave}
                    className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface"
                  >
                    Skip & Save
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90"
                  >
                    Next: Availability →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Availability */}
          {step === 3 && (
            <>
              <div className="flex gap-0 border-b border-border mb-4">
                {(["fall", "spring", "summer", "winter"] as const).map((tt) => (
                  <button
                    key={tt}
                    onClick={() => setAvailTermType(tt)}
                    className={`px-5 py-2 text-sm ${
                      availTermType === tt
                        ? "text-accent border-b-2 border-accent font-medium"
                        : "text-secondary hover:text-primary"
                    }`}
                  >
                    {tt.charAt(0).toUpperCase() + tt.slice(1)}
                  </button>
                ))}
              </div>

              {(availTermType === "fall" || availTermType === "spring") && (
                <>
                  <div className="flex gap-3 items-center mb-3 text-xs">
                    <span className="text-secondary">Quick:</span>
                    <button
                      onClick={() =>
                        availTermType === "fall"
                          ? setFallSlots([])
                          : setSpringSlots([])
                      }
                      className="text-accent hover:underline"
                    >
                      Set all available
                    </button>
                    {availTermType === "spring" && (
                      <button
                        onClick={() => setSpringSlots([...fallSlots])}
                        className="text-accent hover:underline"
                      >
                        Copy Fall → Spring
                      </button>
                    )}
                  </div>
                  <AvailabilityGrid
                    slots={availTermType === "fall" ? fallSlots : springSlots}
                    onChange={availTermType === "fall" ? setFallSlots : setSpringSlots}
                  />
                </>
              )}

              {(availTermType === "summer" || availTermType === "winter") && (
                <TermTypeToggle
                  termType={availTermType}
                  available={availTermType === "summer" ? availSummer : availWinter}
                  onChange={availTermType === "summer" ? setAvailSummer : setAvailWinter}
                />
              )}

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface"
                >
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleSkipAndSave}
                    className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface"
                  >
                    Skip & Save
                  </button>
                  <button
                    onClick={handleFinalSave}
                    disabled={createMutation.isPending}
                    className="px-4 py-1.5 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Saving..." : "✓ Save Instructor"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/instructors/NewInstructorWizard.tsx
git commit -m "feat: add NewInstructorWizard with 3-step onboarding flow"
```

---

## Task 13: Frontend — InstructorHub Page & Route Wiring

**Files:**
- Create: `frontend/src/pages/InstructorHub.tsx`
- Modify: `frontend/src/App.tsx:10-11, 40-41`

- [ ] **Step 1: Create the hub page**

Create `frontend/src/pages/InstructorHub.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { Term, InstructorWorkload } from "@/api/types";
import { useInstructors, useInstructorWorkload } from "@/hooks/useInstructorHub";
import { InstructorRoster } from "@/components/instructors/InstructorRoster";
import { InstructorDetail } from "@/components/instructors/InstructorDetail";
import { NewInstructorWizard } from "@/components/instructors/NewInstructorWizard";
import { api } from "@/api/client";

export function InstructorHubPage() {
  const { selectedTerm, terms } = useOutletContext<{ selectedTerm: Term | null; terms: Term[] }>();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const { data: instructors = [] } = useInstructors();
  const { data: workloadData, isLoading: workloadLoading } = useInstructorWorkload(
    selectedTerm?.id ?? null
  );

  // Build workload map
  const workloadMap = useMemo(() => {
    const map = new Map<number, InstructorWorkload>();
    if (workloadData?.instructors) {
      for (const w of workloadData.instructors) {
        map.set(w.instructor_id, w);
      }
    }
    return map;
  }, [workloadData]);

  const selectedInstructor = instructors.find((i) => i.id === selectedId) ?? null;
  const selectedWorkload = selectedId ? workloadMap.get(selectedId) : undefined;

  const handleExportXlsx = async () => {
    if (!selectedTerm) return;
    try {
      const resp = await api.getRaw(`/analytics/instructor-workload/export?term_id=${selectedTerm.id}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `load-report-${selectedTerm.name.replace(/\s+/g, "-")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback or error handling
    }
  };

  return (
    <div className="flex h-full">
      <InstructorRoster
        instructors={instructors}
        workloads={workloadMap}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewInstructor={() => setShowWizard(true)}
        onExportXlsx={handleExportXlsx}
      />

      {selectedInstructor ? (
        <InstructorDetail
          instructor={selectedInstructor}
          workload={selectedWorkload}
          workloadLoading={workloadLoading}
          selectedTermId={selectedTerm?.id ?? null}
          terms={terms}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-secondary">
          <div className="text-center">
            <p className="text-lg mb-1">Select an instructor</p>
            <p className="text-sm">Choose from the roster or add a new one</p>
          </div>
        </div>
      )}

      {showWizard && (
        <NewInstructorWizard
          onClose={() => setShowWizard(false)}
          onCreated={(id) => {
            setShowWizard(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx routing**

In `frontend/src/App.tsx`, replace the InstructorsPage and InstructorDetailPage imports and routes:

Replace line 10-11:
```typescript
import { InstructorHubPage } from "./pages/InstructorHub";
```

Replace lines 40-41:
```typescript
              <Route path="/instructors" element={<InstructorHubPage />} />
```

Remove the `InstructorsPage` and `InstructorDetailPage` imports (lines 10-11 originally).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Verify the app loads**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/instructors` — verify the hub layout renders with roster on the left and detail on the right.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/InstructorHub.tsx frontend/src/App.tsx
git commit -m "feat: wire up InstructorHub page and update routing"
```

---

## Task 14: Integration Testing & Polish

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && source venv/bin/activate && pytest -v
```

Expected: All tests pass.

- [ ] **Step 2: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds (stricter `tsc -b` mode).

- [ ] **Step 4: Manual smoke test checklist**

Start both backend and frontend dev servers:

```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Test each feature at `http://localhost:5173/instructors`:

1. Roster loads with instructor list
2. Click an instructor — detail panel shows Profile tab
3. Edit a field, click Save — verify it persists on reload
4. Switch to Availability tab — grid renders, toggle cells
5. Switch between Fall/Spring/Summer/Winter sub-tabs
6. Summer/Winter show yes/no toggle
7. Switch to Workload tab — KPI cards, sections table, total bar
8. Switch to Notes tab — add a note, verify it appears, delete it
9. Click "+ New Instructor" — wizard opens
10. Complete step 1 (profile), step 2 (scheduling), step 3 (availability)
11. Verify new instructor appears in roster after save
12. Search and type filter work in roster
13. "Export All — XLSX" button downloads a file (requires a selected term)

- [ ] **Step 5: Clean up old files**

Delete the old pages that are now replaced:

```bash
rm frontend/src/pages/InstructorsPage.tsx
rm frontend/src/pages/InstructorDetailPage.tsx
```

- [ ] **Step 6: Verify build still succeeds after cleanup**

```bash
cd frontend && npm run build
```

If there are any remaining imports of the old pages elsewhere (sidebar, etc.), update them.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete Instructor Hub — replace scattered pages with unified master-detail UI"
```
