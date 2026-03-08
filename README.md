# UWRF Course Scheduler

A desktop application for scheduling university courses at UWRF (University of Wisconsin - River Falls). Built for department chairs to assign instructors, rooms, and time slots to course sections while automatically detecting conflicts and enforcing scheduling constraints.

## Features

- **Schedule Grid** — Visual Mon–Fri grid with drag-and-drop. View by Room, Instructor, or Course Level with multi-select filters.
- **Conflict Detection** — Automatic detection of room double-bookings, instructor conflicts, section overlaps, capacity violations, modality mismatches, and instructor unavailability.
- **Soft Warnings** — Advisory warnings for credit overloads, preferred-avoid times, room waste, consecutive teaching blocks, and non-standard time blocks.
- **XLSX/CSV Import** — Five import types: Rooms, Instructors, Courses, Schedule (with column mapping and fuzzy instructor matching), and Enrollment History (multi-year).
- **Four Export Options** — Download XLSX, Download HTML, Save to Local Directory, and Push to GitHub Pages.
- **Term Management** — Draft/final lifecycle, copy term, summer sessions with dates and head counts.
- **Academic Years** — Auto-assignment based on configurable start month, multi-term grouping.
- **Instructor Management** — Contact info, academic rank, tenure status, availability grid, modality constraints, max credits, categorized notes, and a detail page with Profile/Schedule/Workload tabs.
- **Course Management** — Department catalog with sections, modality (In Person/Online Sync/Online Async/Hybrid), enrollment caps, and counts-toward-load flag.
- **Analytics** — Four tabs: Overview (KPIs, forecasts), Course Detail (enrollment analysis), Schedule Ops (room/time utilization), Workload (instructor loads).
- **Suggestion Engine** — Find available rooms and open time blocks based on current schedule.
- **Undo/Redo** — Global undo/redo for all mutations.
- **Dark Mode** — System, Light, and Dark theme toggle.
- **Database Backup** — Download a portable SQLite backup from Settings.
- **In-App Help** — Searchable help page with documentation for every feature, plus contextual tooltips.

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Python 3.9, FastAPI, SQLAlchemy 2.0, Alembic, SQLite |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Query |
| Desktop  | Electron (macOS DMG) |

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

pip install -e ".[dev]"
alembic upgrade head            # create/update database tables
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The dev server proxies `/api` requests to the backend.

### Electron Desktop Build

```bash
# From project root
npm run build:app    # builds frontend + backend + DMG
```

This creates a macOS DMG in `dist-electron/`.

## Data Model

```
AcademicYear
  └── Term (draft | final)
        ├── TermSession (summer sessions)
        └── Section (belongs to Course + Term)
              └── Meeting (time slot assignment)
                    ├── Room (in a Building)
                    ├── Instructor
                    └── TimeBlock (standard MWF/TTh/Evening slot)
```

**Standard Time Blocks**:
- MWF: 50-minute blocks from 8:00 AM to 4:50 PM
- TTh: 75-minute blocks from 8:00 AM to 4:45 PM
- Evening: 170-minute blocks Mon–Thu starting at 6:00 PM

**Day Codes**: `M` (Monday), `T` (Tuesday), `W` (Wednesday), `Th` (Thursday), `F` (Friday)

## Conflict Types

### Hard Conflicts (block finalization)
- **Room conflict** — Two meetings in the same room at overlapping times
- **Instructor conflict** — Same instructor scheduled for overlapping meetings
- **Section conflict** — Same section has overlapping meetings
- **Room capacity** — Section enrollment cap exceeds room capacity
- **Instructor modality mismatch** — e.g., online-only instructor assigned to in-person section
- **Instructor unavailability** — Meeting during instructor's unavailable time
- **Time validity** — Invalid day codes or end time before start time

### Soft Warnings (advisory, dismissible)
- Credit overload (instructor at or above max credits)
- Preferred-avoid time conflict
- Room capacity waste (>20% oversized) or tight fit (exact match)
- Non-standard time block
- Consecutive teaching blocks (>3 in a row)

## Project Structure

```
backend/
  app/
    main.py                     # FastAPI application
    database.py                 # Database engine and session
    models/                     # SQLAlchemy ORM models
    schemas/                    # Pydantic v2 schemas
    api/routes/                 # Route handlers
    services/                   # Business logic
      conflict_engine.py        # Hard conflict detection
      soft_constraints.py       # Soft warning detection
      suggestion_engine.py      # Available room/time queries
      term_validation.py        # Term validate + finalize
      export.py                 # XLSX and printable HTML export
      xlsx_schedule_parser.py   # XLSX import with day-token parsing
      workload.py               # Instructor workload calculations
  tests/                        # pytest test suite
  alembic/                      # Database migrations
frontend/
  src/
    pages/                      # Page components
    components/
      schedule/ScheduleGrid.tsx # Main schedule grid
      conflicts/ConflictSidebar.tsx
      meetings/MeetingDialog.tsx
      layout/AppLayout.tsx
      ui/                       # Radix UI + Tailwind components
    api/client.ts               # API fetch wrapper
    api/types.ts                # TypeScript interfaces
    help/                       # In-app documentation (markdown)
    hooks/                      # React hooks
electron/
  main.cjs                      # Electron main process
```

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest -v
```
