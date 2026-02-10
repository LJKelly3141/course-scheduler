# UWRF Course Scheduler

A web application for scheduling university courses at UWRF (University of Wisconsin - River Falls). Department schedulers can assign instructors, rooms, and time slots to course sections while automatically detecting conflicts and enforcing scheduling constraints.

## Features

- **Schedule Grid**: Visual Mon-Fri grid with time block rows. View by room, instructor, or course level.
- **Conflict Detection**: Automatic detection of room double-bookings, instructor conflicts, section overlaps, capacity violations, and modality mismatches.
- **Soft Warnings**: Advisory warnings for credit overloads, preferred-avoid times, room waste, and consecutive teaching blocks.
- **Suggestion Engine**: Find available rooms and open time blocks based on current schedule.
- **CSV Import/Export**: Import rooms, instructors, and courses from CSV. Export the full schedule.
- **Printable Views**: Print-optimized room schedules, instructor schedules, and master grids.
- **Term Management**: Draft, validate, and finalize term schedules.
- **Role-Based Auth**: Admin and instructor roles with JWT authentication.

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Python, FastAPI, SQLAlchemy 2.0, Alembic, SQLite |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Query |
| Auth     | JWT via python-jose, bcrypt password hashing |

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
pip install bcrypt==4.0.1       # required for passlib compat

alembic upgrade head            # create database tables
python -m app.seed              # load sample data

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

### Default Login

| Role       | Email                     | Password  |
|------------|---------------------------|-----------|
| Admin      | admin@uwrf.edu            | admin123  |
| Instructor | alice.johnson@uwrf.edu    | password  |

## Data Model

```
Term
  └── Section (belongs to Course + Term)
        └── Meeting (time slot assignment)
              ├── Room (in a Building)
              ├── Instructor
              └── TimeBlock (standard MWF/TTh/Evening slot)
```

**Standard Time Blocks**:
- MWF: 50-minute blocks from 8:00 AM to 4:50 PM
- TTh: 75-minute blocks from 8:00 AM to 4:45 PM
- Evening: 170-minute blocks Mon-Thu starting at 6:00 PM

**Day Codes**: `M` (Monday), `T` (Tuesday), `W` (Wednesday), `Th` (Thursday), `F` (Friday)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/auth/login` | Login, returns JWT |
| GET    | `/api/auth/me` | Current user info |
| CRUD   | `/api/terms` | Term management |
| GET    | `/api/terms/:id/validate` | Validate term schedule |
| POST   | `/api/terms/:id/finalize` | Finalize term |
| CRUD   | `/api/buildings` | Building management |
| CRUD   | `/api/rooms` | Room management |
| CRUD   | `/api/instructors` | Instructor management |
| GET/PUT | `/api/instructors/:id/availability` | Instructor availability |
| CRUD   | `/api/courses` | Course management |
| CRUD   | `/api/sections` | Section management |
| GET    | `/api/terms/:id/meetings` | List meetings for term |
| POST   | `/api/terms/:id/meetings` | Create meeting (with conflict check) |
| PUT    | `/api/meetings/:id` | Update meeting |
| DELETE | `/api/meetings/:id` | Delete meeting |
| GET    | `/api/timeblocks` | List standard time blocks |
| GET    | `/api/suggestions/rooms` | Available rooms for a time slot |
| GET    | `/api/suggestions/timeblocks` | Available time blocks |
| POST   | `/api/import/:type` | Import CSV (rooms, instructors, courses) |
| GET    | `/api/terms/:id/export/csv` | Export schedule as CSV |
| GET    | `/api/terms/:id/export/print` | Printable HTML schedule |

## Conflict Types

### Hard Conflicts (block finalization)
- **Room conflict**: Two meetings in the same room at overlapping times
- **Instructor conflict**: Same instructor scheduled for overlapping meetings
- **Section conflict**: Same section has overlapping meetings
- **Room capacity**: Section enrollment cap exceeds room capacity
- **Instructor modality mismatch**: e.g., online-only instructor assigned to in-person section
- **Instructor unavailability**: Meeting during instructor's unavailable time
- **Time validity**: Invalid day codes or end time before start time

### Soft Warnings (advisory)
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
    seed.py                     # Sample data seeder
    models/                     # SQLAlchemy ORM models
    schemas/                    # Pydantic v2 schemas
    api/routes/                 # Route handlers
    services/                   # Business logic
      conflict_engine.py        # Hard conflict detection
      soft_constraints.py       # Soft warning detection
      suggestion_engine.py      # Available room/time queries
      term_validation.py        # Term validate + finalize
      export.py                 # CSV and printable HTML export
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
    api/client.ts               # API fetch wrapper
    api/types.ts                # TypeScript interfaces
    hooks/                      # useAuth, useTerm
```

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest -v
```
