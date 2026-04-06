# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Course Scheduler for UWRF (University of Wisconsin - River Falls). A full-stack web application for scheduling department courses across terms with conflict detection, validation, and printable exports. Also packaged as an Electron desktop app for macOS.

## Architecture

- **Backend**: Python / FastAPI / SQLAlchemy 2.0 / Alembic / SQLite
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS v4 / @tanstack/react-query
- **Desktop**: Electron (spawns PyInstaller backend binary, loads built frontend from extraResources)

### Data Model

```
Term (draft | final)
  └── Section (belongs to Course + Term; unscheduled | scheduled)
        └── Meeting (time slot assignment)
              ├── Room (in a Building)
              ├── Instructor
              └── TimeBlock (standard MWF/TTh/Evening slot)
```

### Service Layer (`backend/app/services/`)

Stateless functions that take `db: Session` + args. Key interaction pattern:

- **conflict_engine**: `check_meeting_conflicts()` for inline validation on create/update; `detect_hard_conflicts()` for full-term scan
- **soft_constraints**: `detect_soft_warnings()` for advisory warnings (credit overload, room waste, consecutive blocks)
- **term_validation**: Orchestrator that combines conflict_engine + soft_constraints; `finalize_term()` blocks if hard conflicts exist
- **suggestion_engine**: Finds available rooms/timeblocks given constraints
- **export**: CSV and printable HTML generation
- **xlsx_schedule_parser**: XLSX import with day-token parsing and fuzzy instructor matching

### Frontend Architecture

- React Router v7 with nested routes under `AppLayout` (provides `selectedTerm` via outlet context)
- `@tanstack/react-query` for server state (30s staleTime); mutations invalidate `["meetings"]` and `["validation"]` queries
- `@dnd-kit/core` for drag-and-drop rescheduling on the schedule grid
- Path alias: `@/` maps to `src/` (configured in tsconfig and vite)

### Directory Notes

- **`docs/`**: GitHub Pages directory — contains the landing page and documentation site. Do NOT use for general project files or internal docs.
- **`docs/superpowers/`**: Design specs and implementation plans generated during development sessions.

### Key API Patterns

- **Inline conflict validation**: Creating/updating a meeting checks conflicts before persisting; returns `MeetingCreateResponse` with both the meeting and any detected conflicts
- **Import preview/commit**: Import endpoints accept `preview=true` (validate only, no DB changes) or `preview=false` (persist)
- **Eager loading**: Meeting queries use `joinedload()` chains to prevent N+1 queries in conflict detection loops

## Common Commands

### Backend
```bash
cd backend
source venv/bin/activate
pip install -e ".[dev]"
pip install bcrypt==4.0.1                         # pin for passlib compatibility
alembic upgrade head                              # apply migrations
alembic revision --autogenerate -m "description"  # generate migration from model changes
python -m app.seed                                # seed database with sample data
uvicorn app.main:app --reload --port 8000         # dev server

# Tests
pytest                                            # all tests
pytest tests/test_conflicts.py                    # single file
pytest tests/test_conflicts.py::test_room_conflict_mwf  # single test
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # starts on http://localhost:5173 (proxies /api to :8000)
npx tsc --noEmit     # type check (less strict than build)
npm run build        # production build (runs tsc -b first, which is stricter)
```

### Electron
```bash
# From project root
npm run build:frontend && npm run build:backend && electron-builder
```

## Data Safety Rules

- **NEVER auto-seed sample/fake data on startup.** Only seed infrastructure (time blocks) when the table is empty. The user's database contains real scheduling data imported from XLSX files — treat it as irreplaceable.
- **NEVER drop, truncate, or overwrite database tables** without explicit user confirmation.
- Before changing startup, migration, or seed logic: verify it cannot destroy existing user data.

## Key Conventions

- **Day codes**: Use `"M"`, `"T"`, `"W"`, `"Th"`, `"F"` (NOT `"R"` for Thursday). Days stored as JSON arrays: `["T","Th"]`.
- **Python 3.9 compat**: Use `from __future__ import annotations` in all files. Use `Union[]` for runtime-evaluated type hints (e.g., FastAPI `response_model`). The `X | Y` syntax only works in annotations, not runtime expressions.
- **API prefix**: All backend routes are under `/api/`. The frontend Vite dev server proxies `/api` to `localhost:8000`.
- **No auth**: The app has no authentication — it's a single-user desktop app for a department chair.
- **Conflict engine**: Hard conflicts block finalization; soft warnings are advisory. Both returned by `GET /api/terms/:id/validate`.
- **CORS**: Configured for `localhost:5173`, `app://.` (Electron), and `file://` (production Electron builds).
- **Tests**: Use in-memory SQLite with `seed_data` fixture that creates a complete test dataset.
