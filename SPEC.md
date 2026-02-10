# SPEC: UWRF Academic Department Scheduling App

## 0) Claude Code Instructions
You are Claude Code acting as a senior full-stack engineer + product-minded architect. Build an MVP scheduling app that can create and validate schedules for instructors, classes, and rooms, preventing conflicts and enforcing department rules "as much as possible." Produce clean, well-tested code, migrations, and a minimal UI.

---

## 1) Problem / Goals
Create a scheduling system for a **single UWRF department** that:
- Schedules **class sections** into **standard time blocks** and assigns **rooms** + **instructors**
- Prevents conflicts:
  - Room double-booking
  - Instructor double-booking
  - Section time conflicts
- Enforces configurable rules (hard constraints must never break; soft constraints produce warnings with scoring)
- Supports **manual scheduling with real-time validation** (no auto-scheduler)

**Non-goals:** full student enrollment optimization, payroll, SIS integration, auto-scheduling algorithm, cross-listed courses.

---

## 2) Decisions (Clarified)

| Topic | Decision |
|---|---|
| Term structure | Semester + quarter terms, single campus |
| Meeting patterns | MWF (50 min), TTh (75 min), evening 1x/week (~170 min), online |
| Time blocks | Fixed standard blocks (see §3 below) |
| Cross-listing | Not supported |
| Instructor constraints | Modality (online-only, MWF-only, TTh-only), 12-credit soft cap |
| Room attributes | Basic: capacity + building |
| Class requirements | Enrollment cap + modality (in-person, online, hybrid) |
| User roles | Admin (full CRUD + scheduling) and Instructor (read-only + availability input) |
| Exports | CSV export + printable schedule views (by room, by instructor, by department) |
| Data import | Start fresh with seed data; CSV import for rooms, instructors, courses |
| Scheduling mode | Manual placement + real-time validation + drag-and-drop + conflict detection |
| Credit loads | Warn at 12 credits, allow admin override |
| Scale | Small department: 1-2 buildings, ~10-20 rooms, ~10-15 instructors, ~30-50 sections/term |
| Tech stack | See §9 |

---

## 3) Standard Time Blocks

### MWF Blocks (50 min class, 10 min break)
| Block | Start | End |
|-------|-------|-----|
| 1 | 8:00 | 8:50 |
| 2 | 9:00 | 9:50 |
| 3 | 10:00 | 10:50 |
| 4 | 11:00 | 11:50 |
| 5 | 12:00 | 12:50 |
| 6 | 1:00 | 1:50 |
| 7 | 2:00 | 2:50 |
| 8 | 3:00 | 3:50 |
| 9 | 4:00 | 4:50 |

### TTh Blocks (75 min class, 15 min break)
| Block | Start | End |
|-------|-------|-----|
| 1 | 8:00 | 9:15 |
| 2 | 9:30 | 10:45 |
| 3 | 11:00 | 12:15 |
| 4 | 12:30 | 1:45 |
| 5 | 2:00 | 3:15 |
| 6 | 3:30 | 4:45 |

### Evening Blocks (one night per week, ~170 min)
| Pattern | Example |
|---------|---------|
| Monday evening | 6:00 – 8:50 PM |
| Tuesday evening | 6:00 – 8:50 PM |
| Wednesday evening | 6:00 – 8:50 PM |
| Thursday evening | 6:00 – 8:50 PM |

> Standard blocks are pre-defined in the system. Admins select a block when scheduling rather than entering arbitrary times. Custom time entry is available as a fallback for non-standard meetings.

---

## 4) Core Entities / Data Model

### Term
- id, name (e.g., "Fall 2025"), type (semester | quarter), start_date, end_date, status (draft | final)

### Building
- id, name, abbreviation (e.g., "North Hall", "NH")

### Room
- id, building_id, room_number, capacity

### Instructor
- id, name, email, department
- modality_constraint: enum (any | online_only | mwf_only | tth_only)
- max_credits: integer (default 12)
- is_active: boolean

### InstructorAvailability
- id, instructor_id, term_id
- day_of_week, start_time, end_time
- type: enum (unavailable | prefer_avoid)

### Course
- id, department_code, course_number, title, credits (default 3)
- e.g., "CIS", "255", "Web Development", 3

### Section
- id, course_id, term_id, section_number
- enrollment_cap, modality: enum (in_person | online | hybrid)
- status: enum (unscheduled | scheduled | confirmed)

### Meeting
- id, section_id
- days_of_week: string[] (e.g., ["M", "W", "F"] or ["T", "Th"])
- start_time, end_time (stored as time, derived from selected block)
- time_block_id: nullable FK to TimeBlock (null if custom time)
- room_id: nullable FK (null if online)
- instructor_id: nullable FK (null if TBD)

### TimeBlock (reference/lookup table)
- id, pattern: enum (mwf | tth | evening)
- days_of_week: string[]
- start_time, end_time
- label (e.g., "MWF 8:00-8:50", "TTh 9:30-10:45", "Mon Evening")

---

## 5) Conflict Rules (Hard Constraints)
These **must not exist** when a term is finalized:

1. **Room conflict:** Two in-person meetings overlap in time on the same day in the same room.
2. **Instructor conflict:** Two meetings overlap in time on the same day for the same instructor.
3. **Section conflict:** Same section has multiple overlapping meetings.
4. **Time validity:** end_time > start_time; meeting days valid for pattern.
5. **Room capacity:** section.enrollment_cap <= room.capacity (for in-person/hybrid sections).
6. **Instructor modality mismatch:** Instructor constrained to online-only assigned to in-person section (or MWF-only instructor assigned to TTh meeting, etc.).

**Overlap definition:** Two meetings conflict if they share at least one day AND `startA < endB AND startB < endA`.

---

## 6) Soft Constraints (Warnings + Scoring)
Implemented as weighted scoring. Configurable per department. Produce warnings but don't block scheduling:

1. **Instructor credit overload:** Warn when instructor's total assigned credits >= max_credits (default 12). Allow admin override.
2. **Instructor availability preference:** Warn when a meeting is placed during an instructor's "prefer_avoid" time.
3. **Room capacity fit:** Warn when room capacity exceeds enrollment_cap by more than 20% (wasted space) or is very close to cap (no buffer).
4. **Standard block preference:** Warn when using custom (non-standard) time blocks.
5. **Instructor schedule spread:** Warn if instructor teaches more than 3 consecutive blocks with no break.

**Instructor unavailability (type=unavailable) is treated as a hard constraint — the system should block assignment, not just warn.**

---

## 7) UI Design

### 7.1) Navigation & Layout
- **Top nav bar:** Term selector (dropdown), main navigation tabs, user role indicator
- **Main tabs:** Dashboard | Schedule | Instructors | Rooms | Courses | Import
- **Responsive:** Mobile-friendly — grid views collapse to list views on small screens; primary target is desktop

### 7.2) Dashboard (Landing Page)
The dashboard is the home screen after selecting a term. Three summary panels:

**Scheduling Progress**
- Donut chart or progress bar: X of Y sections scheduled
- Cards for unscheduled sections, grouped by course (e.g., "CIS 255 — 2 sections unscheduled")
- Quick counts: total conflicts (red badge), total warnings (yellow badge)
- "Validate Term" button

**Instructor Workload**
- Table: Instructor | Credits Assigned | Max Credits | Days Teaching | # Preps
- Row highlighted yellow if credits >= max, red if modality mismatch
- Click instructor name → jumps to instructor schedule view

**Room Utilization**
- Table: Room | Building | Capacity | Blocks Used / Total | Utilization %
- Sort by utilization to find underused or overbooked rooms
- Click room → jumps to room schedule view

### 7.3) Schedule Grid Views
Three switchable views via tabs or toggle, all showing Mon–Fri columns with time blocks as rows:

**By Room**
- Rows = standard time blocks (MWF blocks, TTh blocks, evening)
- Columns = days (Mon–Fri)
- One grid per room; room selector (dropdown or sidebar list) to switch
- Meetings shown as colored blocks in the grid cells

**By Instructor**
- Same grid layout but filtered to one instructor
- Instructor selector to switch
- Shows all meetings assigned to that instructor across rooms

**By Course Level**
- Filter schedule by course level: 100 | 200 | 300 | 400 | 600 | 700 | All
- Shows all meetings for courses at that level on the grid
- Helps visualize distribution of lower vs. upper division vs. graduate courses across time slots

**Color Coding**
Meetings are color-coded by course level (user can see level at a glance):
| Level | Color |
|-------|-------|
| 100 | Blue |
| 200 | Green |
| 300 | Orange |
| 400 | Purple |
| 600 | Teal |
| 700 | Red/Crimson |

Each meeting block displays: course code + section (e.g., "CIS 255-01"), instructor last name, room number. Hover/click for full details.

**Conflict Indicators (inline)**
- Red border/glow on meetings with hard conflicts
- Yellow border on meetings with soft warnings
- Conflict icon badge with count

### 7.4) Conflict & Warning Sidebar
A persistent collapsible panel on the right side of the schedule views:
- Lists all current hard conflicts and soft warnings for the term
- Each item shows: type (room/instructor/section/etc.), description, affected meetings
- Click an item → highlights the affected meetings on the grid and scrolls to them
- Filter by: Hard only | Soft only | All
- Sortable by type or severity
- Badge count shown on the sidebar toggle button even when collapsed

### 7.5) Scheduling Workflow

**Method 1: Form/Dialog (primary)**
- "Add Meeting" button opens a modal dialog
- Fields: Section (dropdown, searchable), Time Block (dropdown, grouped by MWF/TTh/Evening), Room (dropdown, filtered to available), Instructor (dropdown, filtered to available)
- As each field is selected, the other dropdowns re-filter to show only non-conflicting options
- "Custom Time" toggle to enter arbitrary start/end time instead of a standard block
- On save: validate and show any conflicts/warnings inline in the dialog before confirming

**Method 2: Drag & Drop**
- **Place new meetings:** Drag an unscheduled section card from the dashboard (or from a sidebar queue on the schedule page) onto a time slot on the grid. Opens a quick-assign popup to confirm room and instructor.
- **Move existing meetings:** Drag a meeting block on the grid to a different time slot or room. System validates the new position and shows conflicts before confirming.
- Visual feedback during drag: valid drop targets highlighted green, conflicting targets highlighted red.

**Editing & Deleting**
- Click a meeting block → popover with details + "Edit" and "Delete" buttons
- Edit opens the same form/dialog pre-filled
- Delete with confirmation prompt

### 7.6) Suggestion Panels
Integrated into the scheduling form/dialog:
- **Room suggestions:** After selecting a time block and section, show a ranked list of available rooms (sorted by capacity fit). Rooms with conflicts grayed out.
- **Time block suggestions:** After selecting a section and instructor, show which time blocks are open (no conflicts). Blocks with soft warnings shown with yellow indicator.

### 7.7) Data Management Pages

**Instructors Page**
- Table: Name | Email | Department | Modality | Max Credits | Active
- Click row → detail view with availability editor (per term)
- Availability editor: visual week grid where admin/instructor can mark blocks as "unavailable" or "prefer avoid"

**Rooms Page**
- Table: Building | Room # | Capacity
- Inline editing for capacity

**Courses & Sections Page**
- Courses table: Dept Code | Course # | Title | Credits | Level
- Expand course → see sections for selected term
- Add/edit sections: section number, enrollment cap, modality

**CSV Import Page**
- Upload CSV for: Rooms | Instructors | Courses
- Column mapping UI: preview uploaded data, map CSV columns to system fields
- Validation preview: show errors/warnings before importing
- Import button with summary of records created/updated

### 7.8) Export & Print

**CSV Export**
- Button on dashboard or schedule page
- Exports full term schedule as CSV
- Columns: Course Code, Section, Title, Credits, Days, Start Time, End Time, Room, Building, Instructor, Enrollment Cap, Modality

**Printable Views (3 layouts)**

*Room Schedule Grid*
- One page per room
- Header: Building + Room # + Capacity
- Grid: Mon–Fri columns × time block rows
- Each cell shows course code + section + instructor

*Instructor Schedule Card*
- One page per instructor
- Header: Name, Department, Total Credits
- Grid: their weekly teaching schedule
- Footer: list of courses/sections assigned

*Master Department Grid*
- Wall-chart style: all rooms as rows × all time blocks as columns
- Compact view of entire department schedule on one (large) printout
- Color-coded by course level
- Best printed on large paper (tabloid/A3) or as a scrollable PDF

### 7.9) Term Management
- Term list page with status badges (Draft | Final)
- "Validate & Finalize" button:
  - Runs full validation
  - If hard conflicts exist → shows conflict list, blocks finalization
  - If only soft warnings → shows warnings, allows finalization with confirmation
  - On finalize → locks schedule from editing (admin can unlock if needed)

### 7.10) Auth & Roles
- Simple login page (email + password)
- **Admin role:** full access to all features (CRUD, scheduling, import, export, finalize)
- **Instructor role:** same UI, but:
  - Cannot create/edit/delete meetings, sections, courses, rooms
  - Can view all schedule views (dashboard, grids, instructor view)
  - Can edit their own availability preferences for a term
  - Can export/print their own schedule

---

## 8) API Endpoints

### Terms
- `GET /api/terms` — list terms
- `POST /api/terms` — create term
- `GET /api/terms/:id` — term detail
- `PUT /api/terms/:id` — update term
- `GET /api/terms/:id/validate` — validate entire term schedule
- `POST /api/terms/:id/finalize` — attempt to finalize (fails if hard conflicts)

### Scheduling
- `GET /api/terms/:termId/meetings` — all meetings for a term
- `POST /api/terms/:termId/meetings` — create meeting (with validation)
- `PUT /api/meetings/:id` — update meeting
- `DELETE /api/meetings/:id` — remove meeting

### Suggestions
- `GET /api/suggestions/rooms?termId&days&startTime&endTime&minCapacity` — available rooms
- `GET /api/suggestions/timeblocks?termId&sectionId&instructorId` — open time blocks

### Data CRUD
- Standard REST for `/api/buildings`, `/api/rooms`, `/api/instructors`, `/api/courses`, `/api/sections`
- `GET/PUT /api/instructors/:id/availability?termId` — instructor availability for a term

### CSV Import
- `POST /api/import/rooms` — upload CSV of rooms (columns: building, room_number, capacity)
- `POST /api/import/instructors` — upload CSV of instructors (columns: name, email, department, modality_constraint, max_credits)
- `POST /api/import/courses` — upload CSV of courses (columns: department_code, course_number, title, credits)
- All import endpoints accept multipart form data with a CSV file and return a preview/validation response before committing

### Export
- `GET /api/terms/:id/export/csv` — CSV download of full schedule
- `GET /api/terms/:id/export/print?view=room|instructor|master` — printable HTML view

---

## 9) Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | **Python / FastAPI** | Excellent for rapid API development, strong typing with Pydantic, good async support |
| Database | **PostgreSQL** | Robust, handles time/date well, good constraint support |
| ORM | **SQLAlchemy 2.0** + Alembic migrations | Mature, flexible, strong PostgreSQL support |
| Frontend | **React + TypeScript** | Component-based UI, good ecosystem for calendar/grid views |
| UI Library | **Shadcn/ui + Tailwind CSS** | Modern, lightweight, good defaults |
| Schedule Grid | **Custom grid component** or adapted calendar lib | Purpose-built for room/instructor/time views |
| Auth | **Simple session auth** (stub for MVP) | Admin login with hardcoded credentials; instructor read-only view |
| Testing | **pytest** (backend) + **Vitest** (frontend) | Standard tools for each stack |
| Dev DB | **SQLite** for dev, PostgreSQL for production | Simplify local setup |

---

## 10) Acceptance Criteria

### Scheduling & Validation
1. Creating or editing a meeting triggers real-time conflict checks for room, instructor, and section.
2. Hard conflicts are visually highlighted (red borders) and block term finalization.
3. Soft constraint violations show as warnings (yellow borders) with explanations.
4. Validation endpoint returns all conflicts and warnings for a term with clear descriptions.
5. Room and time block suggestion dropdowns filter to only non-conflicting options.

### UI & Interaction
6. Dashboard shows scheduling progress, instructor workload, and room utilization panels.
7. Unscheduled sections appear as dashboard cards grouped by course.
8. Schedule grid views work for Room, Instructor, and Course Level with switchable tabs.
9. Meetings are color-coded by course level (100=blue, 200=green, 300=orange, 400=purple, 600=teal, 700=crimson).
10. Drag-and-drop works for placing new meetings and moving existing ones, with visual conflict feedback.
11. Persistent conflict sidebar lists all issues and links to affected meetings on the grid.
12. Form/dialog for meeting assignment dynamically filters dropdowns as selections are made.
13. Mobile-responsive: grid views degrade to list views on small screens.

### Data & Export
14. CSV import works for rooms, instructors, and courses with column mapping and validation preview.
15. CSV export produces a complete term schedule file.
16. Three printable layouts: per-room grid, per-instructor card, master department grid.
17. Instructor credit totals are tracked with configurable warning threshold.

### Auth
18. Admin role has full CRUD + scheduling access.
19. Instructor role sees the same UI read-only, can edit own availability, and can export/print own schedule.

### Seed Data
20. Seed data demonstrates a realistic small-department schedule with some intentional conflicts for testing.

---

## 11) Deliverables
- Full source code with database migrations
- README with setup instructions, architecture overview, and data model explanation
- Seed data script (sample department with rooms, instructors, courses, sections, and some meetings)
- Test suite for conflict detection engine
- SPEC.md (this file) documenting all decisions

---

## 12) Assumptions & Defaults
- Single department, single campus
- Meetings use weekly day-of-week recurrence within a term (no individual date overrides)
- Online classes have no room assignment
- Instructor "unavailable" times = hard constraint; "prefer_avoid" = soft constraint
- Standard time blocks are the primary scheduling mechanism; custom times are a fallback
- Credits per course: default 3 (configurable per course)
- Max instructor credits: default 12 (configurable per instructor, soft limit with override)
- No student enrollment tracking beyond section enrollment_cap
- No cross-listed courses
- No auto-scheduling — manual placement with validation assistance only

---

END SPEC
