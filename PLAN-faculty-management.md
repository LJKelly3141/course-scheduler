# Plan: Faculty Management Features

## Overview

Expand the Instructors module into a comprehensive Faculty Management system for department chairs. Organized into 5 independent phases, ordered by priority. Each phase is self-contained — it delivers value on its own and does not require later phases to be useful.

### Design Decisions

- **No eval scores.** Teaching evaluations are stored as uploaded documents (PDFs from the provost's office). The chair does not re-enter numeric data.
- **Academic year boundary is configurable** via app settings (default: July = month 7). Stored as `academic_year_start_month`.
- **Sensitive data:** This system stores personnel records (reviews, tenure decisions, pay rates, emergency contacts). Security measures are addressed per-phase as sensitive features are introduced.
- **`instructor_type` vs `rank`:** Both kept — `instructor_type` is employment category (faculty/ias/adjunct/nias) for contract/budget purposes. `rank` is academic rank (professor/associate/etc.) for P&T tracking. No overlap.

---

## Phase 1: Foundation — Academic Years, Contact Info, Adjunct Notes & Multi-Term Workload

**Priority:** Highest — these features directly improve the scheduling workflow and provide immediate daily value.

**Dependencies:** None. Builds on existing instructor model.

### 1A. Academic Years

**Goal:** Formalize academic years as a first-class concept. UWRF's academic year runs Jul 1 - Jun 30. Every term belongs to an academic year.

#### Data Model

New table: `academic_years`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| label | str(9), unique | e.g., "2025-2026" |
| start_date | date | e.g., 2025-07-01 |
| end_date | date | e.g., 2026-06-30 |
| is_current | bool, default false | Convenience flag, at most one row is true |

Add FK to existing `terms` table:

| Column | Type | Notes |
|--------|------|-------|
| academic_year_id | int FK, nullable | → academic_years.id |

Add app setting:

| Key | Default | Notes |
|-----|---------|-------|
| `academic_year_start_month` | `7` | Month (1-12) when the academic year begins |

#### Backend

- **Model:** `backend/app/models/academic_year.py`
- **Migration:** `alembic revision --autogenerate -m "add_academic_years"`
- **Schema:** `AcademicYearCreate`, `AcademicYearRead`
- **Utility function:** `get_or_create_academic_year(db, date) -> AcademicYear` — given a date, computes which academic year it falls in (using the configured start month), creates the row if it doesn't exist, and returns it.
- **Auto-linking:** When a term is created or updated, automatically set its `academic_year_id` based on the term's `start_date`.
- **Routes:**
  - `GET /academic-years` — list all (newest first)
  - `POST /academic-years` — create (manual override)
  - `GET /academic-years/{id}` — get with associated terms
  - `GET /academic-years/current` — get the current academic year
- **Update `TermRead` schema** to include `academic_year` (nested read)

#### Frontend

- **Terms page:** Show which academic year each term belongs to. Auto-assigned but editable if needed.
- **Dashboard:** Display current academic year prominently.
- **Settings page:** "Academic Year Start Month" setting (dropdown, months 1-12, default July).

#### Steps

1. Add app setting for start month
2. Create academic year model + migration
3. Add FK to terms table
4. Create utility function for auto-computation
5. Add API routes
6. Update term creation to auto-link
7. Update Terms page and Dashboard UI
8. Add start month setting to Settings page

---

### 1B. Full Contact Information

**Goal:** Keep comprehensive contact details for every instructor — faculty, adjunct, IAS, NIAS alike.

#### Data Model

Add columns to existing `instructors` table:

| Column | Type | Notes |
|--------|------|-------|
| first_name | str(50), nullable | Split from `name` for sorting/display |
| last_name | str(50), nullable | Split from `name` for sorting/display |
| phone | str(20), nullable | Office or primary phone |
| cell_phone | str(20), nullable | Mobile/cell |
| office_location | str(50), nullable | e.g., "NH 301B" |
| mailbox_location | str(50), nullable | e.g., "NH 3rd floor mailroom" |
| hire_date | date, nullable | Original hire date |
| title | str(100), nullable | e.g., "Associate Professor", "Lecturer" |
| rank | enum, nullable | `professor`, `associate_professor`, `assistant_professor`, `lecturer`, `visiting`, `emeritus` |
| tenure_status | enum, nullable | `tenured`, `tenure_track`, `non_tenure`, `not_applicable` |
| fte | float, nullable | 1.0 = full-time, 0.5 = half, etc. |
| notes | text, nullable | General standing notes |
| emergency_contact_name | str(100), nullable | |
| emergency_contact_phone | str(20), nullable | |

#### Name Migration Strategy

`first_name` and `last_name` become the source of truth. Migration will:
1. Add the new columns
2. Parse existing `name` values: "First Last" → first_name="First", last_name="Last"
3. Keep `name` as a read-only computed display field (populated on save from first/last)
4. Update `_split_name()` in workload service to use the new fields directly

#### Backend

- **Migration:** `alembic revision --autogenerate -m "add_instructor_contact_fields"` with data migration for name parsing
- **Schema updates:** Add all new fields to `InstructorBase`, `InstructorCreate`, `InstructorUpdate`, `InstructorRead`
- **Enum additions** in `instructor.py`: `InstructorRank`, `TenureStatus`
- No new endpoints — existing CRUD handles everything

#### Frontend

- **Instructor form (add/edit):** Reorganize into sections:
  - **Name:** first_name, last_name (auto-populates `name` display)
  - **Contact:** email, phone, cell_phone, office_location, mailbox_location
  - **Position:** title, rank, instructor_type, tenure_status, fte, hire_date, max_credits, modality_constraint
  - **Emergency Contact:** name, phone
  - **Notes:** general notes textarea
- **Instructors table:** Add columns for phone, office, rank (toggleable)
- **Instructor detail view:** Contact card header showing full info

#### Steps

1. Add enums + columns to instructor model
2. Generate migration with name-parsing data migration
3. Update schemas
4. Update workload service to use first_name/last_name
5. Redesign instructor add/edit form with sections
6. Add toggleable columns to instructors table

---

### 1C. Adjunct/IAS Term Notes

**Goal:** Track per-term administrative details for adjuncts and IAS — contract status, pay, hiring pipeline.

#### Data Model

New table: `instructor_term_notes`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| term_id | int FK | → terms.id |
| contract_status | enum, nullable | `not_started`, `pending_approval`, `offered`, `accepted`, `declined`, `active`, `completed` |
| pay_rate | str(50), nullable | Free text: "$3,200/course", "0.5 FTE", "$950/credit" |
| credits_contracted | float, nullable | Number of credits contracted this term |
| hiring_notes | text, nullable | "Needs dean approval", "Returning from industry" |
| performance_notes | text, nullable | Chair's notes on performance this term |

New model: `backend/app/models/instructor_term_note.py`

#### Backend

- **Migration:** `alembic revision --autogenerate -m "add_instructor_term_notes"`
- **Schema:** `InstructorTermNoteCreate`, `InstructorTermNoteRead`, `InstructorTermNoteUpdate`
- **Routes** (in `instructors.py`):
  - `GET /instructors/{id}/term-notes?term_id=` — get term notes
  - `PUT /instructors/{id}/term-notes?term_id=` — upsert
- **Workload export:** Include contract status for adjuncts

#### Frontend

- **Instructor detail:** Contract status dropdown, pay rate, credits contracted, hiring notes, performance notes. Scoped to selected term.
- **Instructors table:** "Contract Status" badge for selected term (green=active, yellow=offered, red=declined, gray=not started).
- **Workload report:** Contract status badge next to adjunct names.

#### Steps

1. Create model + migration
2. Add schemas + API routes
3. Build Contract section UI
4. Add contract status badge to instructors table
5. Include in workload report

---

### 1D. Multi-Term Workload View

**Goal:** See an instructor's workload across fall/spring/summer side-by-side for annual load balancing. Uses the academic year model from 1A to group terms.

#### Data Model

No new tables — aggregates existing sections, meetings, and load_adjustments across terms within an academic year.

#### Backend

- **Service:** `compute_multi_term_workload(db, instructor_id, academic_year_id)` in `workload.py` — queries all terms in the academic year, reuses existing workload computation per term, aggregates.
- **Endpoint:** `GET /instructors/{id}/workload-history?academic_year_id=`
- **Response:**
  ```json
  {
    "instructor": { "id": 1, "name": "...", "max_credits": 12, "fte": 1.0 },
    "academic_year": { "id": 2, "label": "2025-2026" },
    "terms": [
      {
        "term_id": 1, "term_name": "Fall 2025",
        "teaching_credits": 9, "equivalent_credits": 12,
        "sch": 270, "section_count": 3,
        "sections": [...], "adjustments": [...]
      }
    ],
    "annual_totals": {
      "teaching_credits": 24, "equivalent_credits": 27, "sch": 720,
      "expected_credits": 24
    }
  }
  ```

#### Frontend

- **Dialog:** `InstructorWorkloadHistoryDialog` — terms as columns, rows for sections/credits/adjustments/totals. Color-code overloaded terms.
- **Academic year selector:** Dropdown of academic years (default: current).
- **Access:** Button on instructor detail page (Workload tab) or from the instructors table.
- **Analytics page:** "Annual Workload" toggle on existing workload view.

#### Steps

1. Add multi-term workload service function
2. Add API endpoint
3. Build dialog component
4. Wire into Instructors page and Analytics page

---

### 1E. Instructor Detail Page

**Goal:** With contact info, term notes, and multi-term workload, the current flat table with inline availability grid is too limited. Create a proper detail page.

This is the UI shell that all Phase 1 features display within. Built once, expanded in later phases.

#### Frontend

Navigate to `/instructors/:id` when clicking an instructor name.

```
┌──────────────────────────────────────────────────┐
│  ← Back to Instructors                           │
│                                                  │
│  Dr. Jane Smith                                  │
│  Associate Professor · Tenured · FTE 1.0         │
│  NH 301B · ext. 3847 · jane.smith@uwrf.edu       │
│                                                  │
│  ┌──────────────────────────────────────────┐     │
│  │ Profile │ Schedule │ Workload │          │     │
│  ├──────────────────────────────────────────┤     │
│  │                                          │     │
│  │  (tab content)                           │     │
│  │                                          │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

**Phase 1 tabs (3 tabs):**

| Tab | Contains |
|-----|----------|
| **Profile** | Contact info form, position details (rank, tenure status, FTE, hire date), emergency contact, general notes |
| **Schedule** | Availability grid (existing, moved here) |
| **Workload** | Current term load (existing workload data) + contract/adjunct notes + "Annual Workload" button opens multi-term dialog |

**Instructors table updates:**
- Click instructor name → navigates to detail page
- New columns (toggleable): Phone, Office, Rank, Contract Status badge
- Filter chips: All | Faculty | Adjunct | IAS | Overloaded

#### Steps

1. Create `InstructorDetailPage.tsx` with tab layout
2. Build `ProfileTab.tsx` — contact form
3. Build `ScheduleTab.tsx` — move availability grid here
4. Build `WorkloadTab.tsx` — term workload + contract notes + annual workload button
5. Add route `/instructors/:id` to `App.tsx`
6. Update `InstructorsPage.tsx` — name links to detail page, add columns/filters

---

### Phase 1 Summary

| Sub-feature | New Tables | New Endpoints | Effort |
|-------------|-----------|---------------|--------|
| Academic Years | 1 | 4 | Small-Medium |
| Contact Info | 0 (columns) | 0 (existing CRUD) | Small |
| Adjunct Term Notes | 1 | 2 | Small |
| Multi-Term Workload | 0 | 1 | Medium |
| Detail Page | 0 | 0 | Medium (UI) |
| **Total** | **2** | **7** | **Medium** |

### Phase 1 Files to Create

| File | Purpose |
|------|---------|
| `backend/app/models/academic_year.py` | AcademicYear model |
| `backend/app/models/instructor_term_note.py` | Per-term adjunct/IAS notes |
| `backend/app/api/routes/academic_years.py` | Academic year routes |
| `frontend/src/pages/InstructorDetailPage.tsx` | Detail page with tabs |
| `frontend/src/components/faculty/ProfileTab.tsx` | Contact + position info |
| `frontend/src/components/faculty/ScheduleTab.tsx` | Availability grid |
| `frontend/src/components/faculty/WorkloadTab.tsx` | Workload + contract notes + annual view |
| `frontend/src/components/faculty/WorkloadHistoryDialog.tsx` | Multi-term workload comparison |

### Phase 1 Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models/__init__.py` | Import new models |
| `backend/app/models/instructor.py` | Add contact fields, rank/tenure enums, FTE |
| `backend/app/models/term.py` | Add `academic_year_id` FK |
| `backend/app/schemas/schemas.py` | Add new schemas, expand Instructor schemas, update TermRead |
| `backend/app/api/routes/instructors.py` | Add term-notes, workload-history endpoints |
| `backend/app/api/routes/terms.py` | Auto-link terms to academic years on create/update |
| `backend/app/api/routes/settings.py` | Academic year start month setting |
| `backend/app/services/workload.py` | Add multi-term workload, integrate FTE |
| `backend/app/main.py` | Register academic_years route |
| `frontend/src/api/types.ts` | TypeScript types for new models |
| `frontend/src/App.tsx` | Add route for `/instructors/:id` |
| `frontend/src/pages/InstructorsPage.tsx` | Link names to detail page, add columns/filters |
| `frontend/src/pages/DashboardPage.tsx` | Academic year display |
| `frontend/src/pages/TermsPage.tsx` | Show academic year per term |
| `frontend/src/pages/SettingsPage.tsx` | Academic year start month setting |
| `frontend/src/pages/AnalyticsPage.tsx` | Annual workload toggle |

---

## Phase 2: Security Hardening

**Priority:** High — should be implemented before or alongside features that introduce sensitive personnel data (Phases 3-5). Even with just contact info and pay rates from Phase 1, basic protection is warranted.

**Dependencies:** None technically. Can be built at any time.

### 2A. App-Level PIN

- Simple lock screen on app launch
- PIN stored as salted hash in app settings
- No user accounts — single PIN to open the app
- "Set PIN" / "Change PIN" / "Remove PIN" in Settings page
- Electron: lock screen before loading main UI

### 2B. Export Separation

- Personnel data (evaluations, reviews, P&T, contract info) is NEVER included in standard schedule exports (HTML, CSV)
- Separate "Personnel Report" export: `GET /instructors/{id}/personnel-report` generates formatted HTML with contact info, review history, eval log, P&T timeline
- For printing for dean meetings or tenure committees

### 2C. Automated Backups

- On each app launch, create timestamped copy of `scheduler.db` + `attachments/` directory (if it exists)
- Store in `~/.course-scheduler/backups/`
- Configurable retention (default: keep last 30 days)
- Settings page: backup directory, retention days, "Backup Now" button

### 2D. Database Encryption (Future)

- SQLCipher for encrypting `scheduler.db` at rest
- Protects against laptop theft
- Requires PIN to derive encryption key
- Larger effort — may warrant its own phase

### Phase 2 Summary

| Sub-feature | Effort |
|-------------|--------|
| App-Level PIN | Small-Medium |
| Export Separation | Small |
| Automated Backups | Medium |
| **Total** | **Medium** |

### Phase 2 Files to Create

| File | Purpose |
|------|---------|
| `backend/app/services/backup.py` | Backup service (copy DB + attachments) |
| `backend/app/services/personnel_export.py` | Personnel report HTML generation |
| `frontend/src/components/layout/LockScreen.tsx` | PIN entry screen |

### Phase 2 Files to Modify

| File | Changes |
|------|---------|
| `backend/app/api/routes/settings.py` | PIN hash endpoints, backup settings |
| `backend/app/api/routes/faculty_records.py` | Personnel report endpoint (create file if not yet exists) |
| `backend/app/main.py` | Startup backup trigger |
| `electron/main.cjs` | Lock screen before main window |
| `frontend/src/App.tsx` | Lock screen gate |
| `frontend/src/pages/SettingsPage.tsx` | PIN management, backup settings |

---

## Phase 3: Teaching Evaluations & Preferences

**Priority:** High — teaching evaluations directly inform adjunct renewal and section assignment decisions. Preferences reduce back-and-forth when building the schedule.

**Dependencies:** None required. Works with or without Phases 1-2. (If Phase 1 is done, evaluations display in the Workload tab and preferences display in a new Preferences tab on the detail page. If Phase 1 is not done, these work as standalone features accessible from the instructors table.)

### 3A. Teaching Evaluations (Document-Based)

**Goal:** Store teaching evaluation records with uploaded documents. No numeric scores — just a log linking instructor + term + course to the eval PDFs from the provost's office, with optional chair notes. This directly affects scheduling: poor evals mean the chair won't renew an adjunct or will reassign a course.

#### Data Model

New table: `teaching_evaluations`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| term_id | int FK | → terms.id |
| course_id | int FK, nullable | → courses.id |
| section_id | int FK, nullable | → sections.id |
| evaluation_type | enum | `student`, `peer`, `chair_observation` |
| chair_notes | text, nullable | Chair's brief notes about this eval |

New table: `attachments`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| filename | str(255) | Original filename as uploaded |
| stored_filename | str(255) | Hash-based filename on disk |
| mime_type | str(100), nullable | e.g., "application/pdf" |
| file_size | int, nullable | Bytes |
| uploaded_at | datetime | |
| parent_type | str(50) | `teaching_evaluation` (extensible to `annual_review`, `pt_milestone` in Phase 5) |
| parent_id | int | ID of the parent record |
| description | text, nullable | Optional label, e.g., "Student eval summary" |

**Storage location:** `~/.course-scheduler/attachments/` (outside the app bundle, persists across updates). Configurable via app setting `attachments_directory`.

#### Backend

- **Models:** `backend/app/models/teaching_evaluation.py`, `backend/app/models/attachment.py`
- **Migration:** `alembic revision --autogenerate -m "add_teaching_evaluations"`
- **Schemas:** `TeachingEvaluationCreate`, `TeachingEvaluationRead`, `AttachmentRead`
- **Service:** `backend/app/services/attachment_storage.py` — save file to disk with hash name, retrieve, delete (removes file + DB record)
- **Routes** (`backend/app/api/routes/faculty_records.py`):
  - `GET /instructors/{id}/evaluations?term_id=` — list, optionally filtered by term
  - `POST /instructors/{id}/evaluations` — create eval record
  - `DELETE /instructors/{id}/evaluations/{eval_id}` — delete (cascades attachments)
  - `POST /attachments` — upload file (multipart form: parent_type, parent_id, description)
  - `GET /attachments/{id}` — download file
  - `DELETE /attachments/{id}` — delete file + DB record

#### Frontend

- **Evaluations UI:** Table by term showing course, eval type, attached files, chair notes. "Add Evaluation" lets you pick term + course + type, then upload PDF(s). Click a file to download/open.
- **If Phase 1 done:** Evaluations appear as a section within the Workload tab or a new Personnel tab.
- **If Phase 1 not done:** Evaluations accessible via an "Evaluations" action button on the instructors table, opening a dialog.
- **Reusable component:** `FileUpload.tsx` — drag-and-drop file upload with progress, file list with download/delete.

#### Steps

1. Create teaching evaluation + attachment models
2. Generate migration
3. Add schemas
4. Create attachment storage service
5. Create routes
6. Build FileUpload component
7. Build Evaluations UI
8. Wire into instructor detail page (or dialog if Phase 1 not done)

---

### 3B. Teaching Preferences

**Goal:** Record which courses each instructor wants to teach, with preference ranks. Directly used during schedule building.

#### Data Model

New table: `teaching_preferences`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| course_id | int FK | → courses.id |
| term_id | int FK, nullable | → terms.id (null = standing preference) |
| preference | enum | `preferred`, `willing`, `unwilling` |
| rank | int, nullable | 1 = top choice, within `preferred` |
| notes | text, nullable | "Only if morning section" |

New model: `backend/app/models/teaching_preference.py`

#### Backend

- **Migration:** `alembic revision --autogenerate -m "add_teaching_preferences"`
- **Schema:** `TeachingPreferenceCreate`, `TeachingPreferenceRead`
- **Routes:**
  - `GET /instructors/{id}/preferences?term_id=` — list
  - `PUT /instructors/{id}/preferences?term_id=` — bulk replace
  - `GET /courses/{id}/interested-instructors?term_id=` — reverse lookup

#### Frontend

- **Preferences UI:** Lists department courses with dropdown (preferred/willing/unwilling/—). Drag-to-reorder for ranking preferred courses.
- **If Phase 1 done:** New "Preferences" tab on instructor detail page.
- **If Phase 1 not done:** Accessible via "Preferences" action button on instructors table, opening a dialog.
- **Schedule page integration:** Badge on instructor dropdown when assigning a section — green star for preferred, red X for unwilling.
- **Courses page:** Column or tooltip showing instructor interest count.

#### Steps

1. Create model + migration
2. Add schemas + API routes
3. Build Preferences UI with drag-to-rank
4. Add preference badges to meeting/section assignment
5. Add interest count to courses page

---

### Phase 3 Summary

| Sub-feature | New Tables | New Endpoints | Effort |
|-------------|-----------|---------------|--------|
| Teaching Evaluations | 2 (evals + attachments) | 6 | Medium |
| Teaching Preferences | 1 | 3 | Medium |
| **Total** | **3** | **9** | **Medium** |

### Phase 3 Files to Create

| File | Purpose |
|------|---------|
| `backend/app/models/teaching_evaluation.py` | TeachingEvaluation model + enums |
| `backend/app/models/attachment.py` | Attachment model (polymorphic file storage) |
| `backend/app/models/teaching_preference.py` | Teaching preference model |
| `backend/app/api/routes/faculty_records.py` | Routes for evaluations + attachments (create if not exists from Phase 2) |
| `backend/app/services/attachment_storage.py` | File save/retrieve/delete service |
| `frontend/src/components/faculty/FileUpload.tsx` | Reusable file upload/download component |
| `frontend/src/components/faculty/EvaluationsSection.tsx` | Teaching evaluations list + upload |
| `frontend/src/components/faculty/PreferencesTab.tsx` | Course preference editor |

### Phase 3 Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models/__init__.py` | Import new models |
| `backend/app/schemas/schemas.py` | Add eval, attachment, preference schemas |
| `backend/app/main.py` | Register faculty_records route (if not already) |
| `frontend/src/api/types.ts` | TypeScript types |
| `frontend/src/pages/InstructorDetailPage.tsx` | Add Preferences tab, Evaluations section (if Phase 1 done) |
| `frontend/src/pages/InstructorsPage.tsx` | Add action buttons (if Phase 1 not done) |
| `frontend/src/components/schedule/MeetingDialog.tsx` | Preference indicators on instructor dropdown |
| `frontend/src/pages/CoursesPage.tsx` | Instructor interest count |

---

## Phase 4: Annual Reviews & P&T Tracking

**Priority:** Medium — operates on a longer cycle (yearly, not per-term) and doesn't directly feed into day-to-day scheduling. But essential for the chair's annual responsibilities.

**Dependencies:** Requires Phase 1 (academic years) for the `academic_year_id` FK on reviews and milestones. Reuses the `attachments` table and file storage service from Phase 3.

### 4A. Annual Reviews

**Goal:** Track annual faculty reviews with ratings, goals, and chair comments.

#### Data Model

Add columns to `instructors` table (if not already added):

| Column | Type | Notes |
|--------|------|-------|
| tenure_start_year | int, nullable | Year the tenure clock started |
| tenure_decision_year | int, nullable | Year tenure decision is expected |
| promotion_target_rank | enum, nullable | Next rank they're working toward |
| promotion_target_year | int, nullable | Expected year for promotion |
| research_focus | text, nullable | Brief description of research area |

New table: `annual_reviews`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| academic_year_id | int FK | → academic_years.id |
| review_date | date, nullable | When the review was conducted |
| overall_rating | enum, nullable | `exceeds_expectations`, `meets_expectations`, `needs_improvement`, `unsatisfactory` |
| teaching_rating | enum, nullable | Same scale |
| scholarship_rating | enum, nullable | Same scale |
| service_rating | enum, nullable | Same scale |
| goals_from_last_year | text, nullable | What they committed to last year |
| goals_met_notes | text, nullable | Chair's assessment of goal completion |
| goals_for_next_year | text, nullable | New goals set during this review |
| strengths | text, nullable | |
| areas_for_improvement | text, nullable | |
| committee_service | text, nullable | Committees served on this year |
| chair_comments | text, nullable | General chair notes |

Reviews can have attachments (reuses `attachments` table from Phase 3 with `parent_type = 'annual_review'`).

#### Backend

- **Model:** `backend/app/models/annual_review.py`
- **Migration:** `alembic revision --autogenerate -m "add_annual_reviews"`
- **Schemas:** `AnnualReviewCreate`, `AnnualReviewRead`, `AnnualReviewUpdate`
- **Routes** (add to `faculty_records.py`):
  - `GET /instructors/{id}/reviews` — list all (newest first)
  - `POST /instructors/{id}/reviews` — create
  - `PUT /instructors/{id}/reviews/{review_id}` — update
  - `DELETE /instructors/{id}/reviews/{review_id}` — delete (cascades attachments)

#### Frontend

- **Reviews UI:** Chronological list by academic year. Each review shows ratings as colored badges. Expandable to show goals, strengths, chair comments. "Add Review" opens a form with academic year dropdown.
- **Appears in a new "Personnel" tab** on the instructor detail page.

---

### 4B. Promotion & Tenure Milestones

**Goal:** Track P&T milestones — third-year review, tenure application, post-tenure review, etc. — with due dates, status, and outcomes.

#### Data Model

New table: `pt_milestones`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| academic_year_id | int FK, nullable | → academic_years.id |
| milestone_type | enum | `third_year_review`, `tenure_application`, `tenure_decision`, `promotion_application`, `promotion_decision`, `post_tenure_review`, `other` |
| due_date | date, nullable | When this milestone is due |
| completed_date | date, nullable | When completed |
| status | enum | `upcoming`, `in_progress`, `completed`, `deferred` |
| outcome | enum, nullable | `approved`, `denied`, `conditional`, `withdrawn`, `pending` |
| notes | text, nullable | Details, conditions, committee feedback |

Milestones can have attachments (reuses `attachments` table with `parent_type = 'pt_milestone'`).

#### Backend

- **Model:** `backend/app/models/pt_milestone.py`
- **Migration:** `alembic revision --autogenerate -m "add_pt_milestones"`
- **Schemas:** `PTMilestoneCreate`, `PTMilestoneRead`, `PTMilestoneUpdate`
- **Routes** (add to `faculty_records.py`):
  - `GET /instructors/{id}/milestones` — list
  - `POST /instructors/{id}/milestones` — create
  - `PUT /instructors/{id}/milestones/{milestone_id}` — update
  - `DELETE /instructors/{id}/milestones/{milestone_id}` — delete (cascades attachments)
  - `GET /faculty-records/upcoming-milestones?months=6` — all upcoming milestones across all instructors

#### Frontend

- **P&T Timeline:** Table or visual timeline of milestones. Color-coded: upcoming=blue, in progress=yellow, completed=green, overdue=red. Attached documents.
- **Dashboard:** "Upcoming P&T Milestones" card with countdown.
- **Instructors table:** Optional "Next Milestone" column.

---

### Phase 4 Summary

| Sub-feature | New Tables | New Endpoints | Effort |
|-------------|-----------|---------------|--------|
| Annual Reviews | 1 | 4 | Medium |
| P&T Milestones | 1 | 5 | Medium |
| Instructor fields | 0 (columns) | 0 | Small |
| **Total** | **2** | **9** | **Medium-Large** |

### Phase 4 Files to Create

| File | Purpose |
|------|---------|
| `backend/app/models/annual_review.py` | AnnualReview model + rating enums |
| `backend/app/models/pt_milestone.py` | PTMilestone model + milestone/status/outcome enums |
| `frontend/src/components/faculty/PersonnelTab.tsx` | Reviews + P&T timeline |
| `frontend/src/components/faculty/ReviewForm.tsx` | Annual review add/edit form |
| `frontend/src/components/faculty/PTTimeline.tsx` | P&T milestone timeline |

### Phase 4 Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models/__init__.py` | Import new models |
| `backend/app/models/instructor.py` | Add tenure clock + promotion fields (if not already) |
| `backend/app/schemas/schemas.py` | Add review, milestone schemas |
| `backend/app/api/routes/faculty_records.py` | Add review + milestone endpoints |
| `frontend/src/api/types.ts` | TypeScript types |
| `frontend/src/pages/InstructorDetailPage.tsx` | Add Personnel tab |
| `frontend/src/pages/DashboardPage.tsx` | Upcoming milestones card |
| `frontend/src/pages/InstructorsPage.tsx` | Next Milestone column |

---

## Phase 5: Leave Tracking & Office Hours

**Priority:** Lower — useful for completeness but not blocking daily work. Build when needed.

**Dependencies:** None required. If Phase 1 is done, these features integrate into the existing detail page tabs.

### 5A. Sabbatical / Leave Tracking

**Goal:** Track sabbaticals, medical leave, reduced appointments. Affects scheduling and workload — an instructor on leave shouldn't appear in scheduling suggestions.

#### Data Model

New table: `instructor_leaves`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| term_id | int FK | → terms.id |
| leave_type | enum | `sabbatical`, `medical`, `fmla`, `administrative`, `unpaid`, `phased_retirement`, `course_release`, `other` |
| credit_reduction | float | Credits reduced (full sabbatical = max_credits) |
| description | text, nullable | |
| is_full_leave | bool | If true, exclude from scheduling entirely |

New model: `backend/app/models/instructor_leave.py`

#### Backend

- **Migration:** `alembic revision --autogenerate -m "add_instructor_leaves"`
- **Schema:** `InstructorLeaveCreate`, `InstructorLeaveRead`
- **Routes:**
  - `GET /instructors/{id}/leaves?term_id=` — list
  - `POST /instructors/{id}/leaves` — create
  - `PUT /instructors/{id}/leaves/{leave_id}` — update
  - `DELETE /instructors/{id}/leaves/{leave_id}` — delete
- **Workload:** Subtract `credit_reduction` from expected load
- **Conflict engine:** Soft warning if instructor on full leave is assigned a section
- **Suggestion engine:** Exclude full-leave instructors

#### Frontend

- **Instructor detail:** Leave records per term with add/edit/delete. Displayed in Workload tab.
- **Instructors table:** "On Sabbatical" / "On Leave" badge for selected term.
- **Meeting assignment:** Warning when assigning instructor on leave.

#### Steps

1. Create model + migration
2. Add schemas + API routes
3. Build Leave section UI
4. Add leave badges to table
5. Integrate with workload + conflict engine

---

### 5B. Office Hours Tracking

**Goal:** Know when faculty hold office hours for coverage and coordination.

#### Data Model

New table: `office_hours`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| instructor_id | int FK | → instructors.id |
| term_id | int FK | → terms.id |
| day_of_week | str | M, T, W, Th, F |
| start_time | time | |
| end_time | time | |
| location | str(50), nullable | "NH 215" or "Zoom" |
| notes | text, nullable | "By appointment Fridays" |

New model: `backend/app/models/office_hours.py`

#### Backend

- **Migration:** `alembic revision --autogenerate -m "add_office_hours"`
- **Schema:** `OfficeHoursCreate`, `OfficeHoursRead`
- **Routes:**
  - `GET /instructors/{id}/office-hours?term_id=` — list
  - `PUT /instructors/{id}/office-hours?term_id=` — bulk replace

#### Frontend

- **Instructor detail:** Office hours editor alongside the availability grid in the Schedule tab.
- **Instructor schedule dialog:** Office hours alongside teaching schedule.
- **HTML export:** Include on instructor schedule cards.

#### Steps

1. Create model + migration
2. Add schemas + API routes
3. Build Office Hours editor UI
4. Show in instructor schedule dialog
5. Include in export

---

### Phase 5 Summary

| Sub-feature | New Tables | New Endpoints | Effort |
|-------------|-----------|---------------|--------|
| Leave Tracking | 1 | 4 | Medium |
| Office Hours | 1 | 2 | Small |
| **Total** | **2** | **6** | **Medium** |

### Phase 5 Files to Create

| File | Purpose |
|------|---------|
| `backend/app/models/instructor_leave.py` | Leave tracking model |
| `backend/app/models/office_hours.py` | Office hours model |

### Phase 5 Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models/__init__.py` | Import new models |
| `backend/app/schemas/schemas.py` | Add leave, office hours schemas |
| `backend/app/api/routes/instructors.py` | Add leaves, office-hours endpoints |
| `backend/app/services/workload.py` | Integrate leaves into workload calculation |
| `backend/app/services/soft_constraints.py` | Leave-related soft warnings |
| `frontend/src/api/types.ts` | TypeScript types |
| `frontend/src/components/faculty/WorkloadTab.tsx` | Add leave section |
| `frontend/src/components/faculty/ScheduleTab.tsx` | Add office hours editor |
| `frontend/src/pages/InstructorsPage.tsx` | Leave badges, "On Leave" filter chip |
| `frontend/src/components/schedule/MeetingDialog.tsx` | Leave warning on instructor dropdown |

---

## Phase Overview

| Phase | What You Get | Effort | Depends On |
|-------|-------------|--------|------------|
| **1** | Academic years, contact info, adjunct notes, multi-term workload, instructor detail page | Medium | Nothing |
| **2** | App PIN lock, export separation, automated backups | Medium | Nothing |
| **3** | Teaching evaluations with file uploads, teaching preferences with schedule integration | Medium | Nothing (standalone) |
| **4** | Annual reviews, P&T milestone tracking with dashboard alerts | Medium-Large | Requires 1 (academic years), reuses 3 (attachments) |
| **5** | Leave tracking with scheduling integration, office hours | Medium | Nothing (standalone) |

### Recommended Sequence

**1 → 2 → 3 → 4 → 5**

Phases 1, 2, 3, and 5 can each be built independently. Phase 4 should wait for Phase 1 (academic years) and Phase 3 (attachment system).

---

## Tab Evolution Across Phases

The instructor detail page starts simple and grows:

| After Phase | Tabs |
|-------------|------|
| Phase 1 | Profile, Schedule, Workload |
| Phase 3 | Profile, Schedule, Workload, Preferences |
| Phase 4 | Profile, Schedule, Workload, Preferences, Personnel |
| Phase 5 | Profile, Schedule, Workload (+ leave), Preferences, Personnel |
