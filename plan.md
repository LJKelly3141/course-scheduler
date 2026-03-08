# Plan: Summer Sessions (A/B/C/D) with Duration-Based Dates

## Context & Key Design Decisions

### Current State
- `Section.session` is an enum: `regular`, `session_a`, `session_b` — only shown for fall/spring
- Sessions are "labels" only — no dates, no duration, no separate model
- Sections have no `start_date`/`end_date` — only Terms do

### Design Approach
**New `TermSession` model** (a table, not the existing enum) stores per-term session start dates. The existing `Section.session` enum is expanded to include `session_c` and `session_d`. Sections gain `duration_weeks`, `start_date`, and `end_date` columns. Dates are computed server-side when session + duration are set.

### End Date Rule
Looking at the examples:
- Session A (Tue 2026-05-26) + 3 weeks → Fri 2026-06-12 (17 days = 2 weeks + 3 days)
- Session A + 6 weeks → Fri 2026-07-03 (38 days = 5 weeks + 3 days)
- Session A + 9 weeks → Fri 2026-07-24 (59 days = 8 weeks + 3 days)
- Session A + 13 weeks → Fri 2026-08-21 (87 days = 12 weeks + 3 days)

Pattern: **end_date = session_start + (N-1) weeks, then advance to the next Friday (or same day if already Friday)**.

Verification with Session B (Mon 2026-06-15):
- +3w: 06-15 + 14d = 06-29 (Mon) → next Fri = 07-03 ✓
- +9w: 06-15 + 56d = 08-10 (Mon) → next Fri = 08-14 ✓

Session C (Mon 2026-07-06):
- +3w: 07-06 + 14d = 07-20 (Mon) → next Fri = 07-24 ✓
- +6w: 07-06 + 35d = 08-10 (Mon) → next Fri = 08-14 ✓

Session D (Mon 2026-07-27):
- +3w: 07-27 + 14d = 08-10 (Mon) → next Fri = 08-14 ✓

**Rule: `end_date = session_start + (duration_weeks - 1) * 7 days`, then advance to next Friday (inclusive).**

---

## Changes

### Phase 1: Backend Model & Migration

#### 1a. New `TermSession` model (`backend/app/models/term_session.py`)
```
term_sessions table:
  id (PK)
  term_id (FK → terms.id)
  name (String: "A", "B", "C", "D")
  start_date (Date)
  notes (String, nullable)
  UNIQUE(term_id, name)
```

#### 1b. Modify Section model (`backend/app/models/section.py`)
- Expand `Session` enum: add `session_c`, `session_d`
- Add columns: `duration_weeks` (Integer, nullable), `start_date` (Date, nullable), `end_date` (Date, nullable)

#### 1c. Register in `models/__init__.py`
- Import and export `TermSession`

#### 1d. Alembic migration
- Create `term_sessions` table
- Add `session_c`, `session_d` to the `session` enum (SQLite: handled via CHECK constraint recreation)
- Add `duration_weeks`, `start_date`, `end_date` columns to `sections`

### Phase 2: Backend Schemas & API

#### 2a. Schemas (`backend/app/schemas/schemas.py`)
- `TermSessionRead`: id, term_id, name, start_date, notes
- `TermSessionCreate`: name, start_date, notes (optional)
- `TermSessionUpdate`: start_date, notes (optional)
- Update `SectionCreate` / `SectionUpdate` / `SectionRead`: add `duration_weeks`, `start_date`, `end_date`
- Add `TermRead` field: `sessions` list of `TermSessionRead` (optional, populated for summer terms)

#### 2b. Date computation helper (`backend/app/services/session_dates.py`)
Pure function:
```python
def compute_session_end_date(session_start: date, duration_weeks: int) -> date:
    """end = session_start + (duration_weeks - 1) * 7, then advance to next Friday."""
```

#### 2c. Term sessions API routes (`backend/app/api/routes/terms.py`)
- `GET /terms/{id}/sessions` → list TermSession for a term
- `PUT /terms/{id}/sessions` → bulk upsert all 4 sessions (takes list of {name, start_date, notes?})
- Auto-create 4 sessions (A/B/C/D with null start_dates) when a Summer term is created

#### 2d. Section route changes (`backend/app/api/routes/sections.py`)
- On create/update: if `session` is A/B/C/D and `duration_weeks` is set:
  - Look up `TermSession` for that term+session name
  - Compute `start_date` and `end_date`
  - Store all three on the section
- If `session` is cleared (set to `regular`) or `duration_weeks` is cleared:
  - Set `start_date`, `end_date`, `duration_weeks` to NULL
- Validation: if session is A/B/C/D, require `duration_weeks > 0`

#### 2e. Seed data (`backend/app/seed.py`)
- Add `seed_summer_term()` that creates a Summer 2026 term with sessions:
  - A: 2026-05-26, B: 2026-06-15, C: 2026-07-06, D: 2026-07-27

### Phase 3: Frontend Types & API

#### 3a. Types (`frontend/src/api/types.ts`)
- Add `TermSession` interface: `{ id, term_id, name, start_date, notes }`
- Add to `Section`: `duration_weeks`, `start_date`, `end_date`
- Add to `Term`: optional `sessions` array

### Phase 4: Frontend UI

#### 4a. TermsPage — Session Date Editor
- When a summer term row is expanded or edited, show a "Sessions" sub-section
- 4 rows: A/B/C/D each with a date picker for start_date
- Uses `PUT /terms/{id}/sessions` to save

#### 4b. MeetingDialog — Session + Duration picker (for summer terms)
- When `termType === "summer"`:
  - Show Session dropdown: A / B / C / D (instead of Regular/A/B)
  - Show Duration (weeks) number input
  - Show computed start_date and end_date as read-only text
- When session or duration changes, compute dates client-side for preview
- On save, send session + duration_weeks to the section update API

#### 4c. CoursesPage — Section display
- In the section list row, show "Session X — N weeks" and date range for summer sections
- In the section create form, add session + duration fields for summer terms

#### 4d. MeetingDetailDialog — Display session info
- Show Session, Duration, and Date Range when they exist

### Phase 5: Backward Compatibility & Validation

- Non-summer terms: session field continues to work as before (regular/A/B for fall/spring)
- Summer terms: session dropdown shows A/B/C/D (no "Regular" option)
- Clearing session on a summer section resets to "regular" and nulls dates
- Import/export: add session_c, session_d to the session enum handling
- Term copy: copy TermSessions when copying a summer term

### Files Changed (Summary)

**New files:**
- `backend/app/models/term_session.py`
- `backend/app/services/session_dates.py`
- `backend/alembic/versions/XXXX_add_summer_sessions.py` (auto-generated)

**Modified backend:**
- `backend/app/models/__init__.py` — add TermSession import
- `backend/app/models/section.py` — expand Session enum, add columns
- `backend/app/models/term.py` — add sessions relationship
- `backend/app/schemas/schemas.py` — new schemas, expand section schemas
- `backend/app/api/routes/terms.py` — session CRUD endpoints, auto-create on summer term creation
- `backend/app/api/routes/sections.py` — date computation on create/update
- `backend/app/api/routes/import_export.py` — handle session_c, session_d
- `backend/app/seed.py` — add summer term + sessions seed

**Modified frontend:**
- `frontend/src/api/types.ts` — add TermSession, expand Section/Term
- `frontend/src/pages/TermsPage.tsx` — session date editor for summer terms
- `frontend/src/components/meetings/MeetingDialog.tsx` — session+duration for summer
- `frontend/src/pages/CoursesPage.tsx` — display session info, add section form updates
- `frontend/src/components/schedule/MeetingDetailDialog.tsx` — display session/dates

### Verification
After implementation:
1. `cd backend && source venv/bin/activate && alembic upgrade head` — migration applies
2. `cd frontend && npm run build` — zero errors
3. Creating a section with Session A + 9 weeks on Summer 2026 → end date 2026-07-24
4. Clearing session returns section to regular behavior
5. Summer terms have exactly 4 sessions (A/B/C/D)
