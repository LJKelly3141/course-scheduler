# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Course Scheduler for UWRF (University of Wisconsin - River Falls). A full-stack web application for scheduling department courses across terms with conflict detection, validation, and printable exports.

## Architecture

- **Backend**: Python / FastAPI / SQLAlchemy 2.0 / Alembic / SQLite
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS v4 / @tanstack/react-query

## Project Structure

```
backend/
  app/
    main.py              # FastAPI app, CORS config, router registration
    database.py          # Engine, SessionLocal, get_db dependency
    seed.py              # Seed time blocks + sample data
    models/              # SQLAlchemy ORM models (Term, Building, Room, Instructor, Course, Section, Meeting, TimeBlock, User)
    schemas/             # Pydantic v2 request/response schemas
    api/routes/          # API route handlers (one file per entity + auth, import/export, suggestions)
    services/            # Business logic (conflict_engine, soft_constraints, suggestion_engine, term_validation, export)
  tests/                 # pytest tests
  alembic/               # Database migrations
frontend/
  src/
    pages/               # Route-level page components
    components/          # Reusable UI components (schedule/, conflicts/, meetings/, layout/)
    api/                 # API client + TypeScript types
    hooks/               # Custom React hooks (useAuth, useTerm)
    lib/                 # Utilities (cn, color helpers, time formatting)
```

## Common Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
pip install bcrypt==4.0.1   # pin for passlib compatibility
alembic upgrade head        # apply migrations
python -m app.seed          # seed database
uvicorn app.main:app --reload --port 8000
pytest                      # run tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173 (proxies /api to :8000)
npx tsc --noEmit            # type check
npm run build               # production build
```

## Key Conventions

- **Day codes**: Use `"M"`, `"T"`, `"W"`, `"Th"`, `"F"` (NOT `"R"` for Thursday). Days stored as JSON arrays: `["T","Th"]`.
- **Python 3.9 compat**: Use `from __future__ import annotations` in all files. Use `Union[]` for runtime-evaluated type hints (e.g., `response_model`).
- **API prefix**: All backend routes are under `/api/`. The frontend Vite dev server proxies `/api` to `localhost:8000`.
- **Auth**: JWT tokens via `python-jose`. Default admin: `admin@uwrf.edu` / `admin123`.
- **Conflict engine**: Hard conflicts block finalization; soft warnings are advisory. Both returned by `GET /api/terms/:id/validate`.

## Default Login Credentials (Seed Data)

- Admin: `admin@uwrf.edu` / `admin123`
- Instructor: `alice.johnson@uwrf.edu` / `password`
