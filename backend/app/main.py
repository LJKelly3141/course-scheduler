from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.isfile(_env_path):
    load_dotenv(_env_path, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    academic_years, terms, buildings, rooms, instructors, courses, sections,
    meetings, time_blocks, import_export, suggestions,
    settings, export_html, analytics, load_adjustments, prerequisites, rotation,
)
from app.database import engine, SessionLocal
from app.models import Base

logger = logging.getLogger(__name__)

app = FastAPI(title="UWRF Course Scheduler", version="0.1.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8000",
        "app://.",              # Electron custom protocol
        "null",                 # file:// origin (Electron production)
    ],
    allow_origin_regex=r"^(file://.*|http://localhost:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(academic_years.router, prefix="/api/academic-years", tags=["academic-years"])
app.include_router(terms.router, prefix="/api/terms", tags=["terms"])
app.include_router(buildings.router, prefix="/api/buildings", tags=["buildings"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(instructors.router, prefix="/api/instructors", tags=["instructors"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(sections.router, prefix="/api/sections", tags=["sections"])
app.include_router(meetings.router, prefix="/api", tags=["meetings"])
app.include_router(time_blocks.router, prefix="/api/timeblocks", tags=["timeblocks"])
app.include_router(import_export.router, prefix="/api", tags=["import-export"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["suggestions"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(export_html.router, prefix="/api", tags=["export-html"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(load_adjustments.router, prefix="/api/load-adjustments", tags=["load-adjustments"])
app.include_router(prerequisites.router, prefix="/api", tags=["prerequisites"])
app.include_router(rotation.router, prefix="/api/rotation", tags=["rotation"])


def _ensure_schema_current():
    """Add missing columns to existing tables.

    Base.metadata.create_all() creates NEW tables but never ALTERs existing
    ones.  This function bridges the gap for databases created before certain
    columns/tables were added to the models.
    """
    import sqlalchemy as sa

    try:
        with engine.connect() as conn:
            # ── sections table patches ──
            result = conn.execute(sa.text("PRAGMA table_info(sections)"))
            section_cols = {row[1] for row in result}

            for col, col_type in [
                ("instructor_id", "INTEGER REFERENCES instructors(id)"),
                ("session", "VARCHAR(10) NOT NULL DEFAULT 'regular'"),
                ("duration_weeks", "INTEGER"),
                ("start_date", "DATE"),
                ("end_date", "DATE"),
            ]:
                if col not in section_cols:
                    conn.execute(
                        sa.text(f"ALTER TABLE sections ADD COLUMN {col} {col_type}")
                    )
                    logger.info("Added missing column sections.%s", col)

            for col, col_type in [
                ("equivalent_credits", "INTEGER"),
                ("lecture_hours", "REAL"),
                ("special_course_fee", "REAL"),
                ("instruction_type", "VARCHAR(3)"),
                ("notes", "TEXT"),
            ]:
                if col not in section_cols:
                    conn.execute(
                        sa.text(f"ALTER TABLE sections ADD COLUMN {col} {col_type}")
                    )
                    logger.info("Added missing column sections.%s", col)

            # ── instructors table patches ──
            result = conn.execute(sa.text("PRAGMA table_info(instructors)"))
            instructor_cols = {row[1] for row in result}

            for col, col_type in [
                ("instructor_type", "VARCHAR(20)"),
                ("first_name", "VARCHAR(50)"),
                ("last_name", "VARCHAR(50)"),
                ("phone", "VARCHAR(30)"),
                ("office_location", "VARCHAR(100)"),
                ("rank", "VARCHAR(30)"),
                ("tenure_status", "VARCHAR(20)"),
                ("hire_date", "DATE"),
            ]:
                if col not in instructor_cols:
                    conn.execute(
                        sa.text(f"ALTER TABLE instructors ADD COLUMN {col} {col_type}")
                    )
                    logger.info("Added missing column instructors.%s", col)

            # Data migration: split existing name into first_name/last_name
            if "first_name" not in instructor_cols:
                rows = conn.execute(sa.text(
                    "SELECT id, name FROM instructors WHERE first_name IS NULL AND name IS NOT NULL"
                )).fetchall()
                for row in rows:
                    parts = row[1].rsplit(" ", 1)
                    if len(parts) == 2:
                        first, last = parts
                    else:
                        first, last = row[1], ""
                    conn.execute(sa.text(
                        "UPDATE instructors SET first_name = :first, last_name = :last WHERE id = :id"
                    ), {"first": first, "last": last, "id": row[0]})
                if rows:
                    logger.info("Migrated %d instructor names to first_name/last_name", len(rows))

            # ── courses table patches ──
            result = conn.execute(sa.text("PRAGMA table_info(courses)"))
            course_cols = {row[1] for row in result}

            if "counts_toward_load" not in course_cols:
                conn.execute(
                    sa.text("ALTER TABLE courses ADD COLUMN counts_toward_load BOOLEAN NOT NULL DEFAULT 1")
                )
                logger.info("Added missing column courses.counts_toward_load")

            # ── terms table patches ──
            result = conn.execute(sa.text("PRAGMA table_info(terms)"))
            term_cols = {row[1] for row in result}

            if "academic_year_id" not in term_cols:
                conn.execute(
                    sa.text("ALTER TABLE terms ADD COLUMN academic_year_id INTEGER REFERENCES academic_years(id)")
                )
                logger.info("Added missing column terms.academic_year_id")

            # ── term_sessions table patches ──
            result = conn.execute(sa.text("PRAGMA table_info(term_sessions)"))
            ts_cols = {row[1] for row in result}

            for col, col_type in [
                ("end_date", "DATE"),
                ("head_count_days", "INTEGER"),
                ("head_count_date", "DATE"),
            ]:
                if col not in ts_cols:
                    conn.execute(
                        sa.text(f"ALTER TABLE term_sessions ADD COLUMN {col} {col_type}")
                    )
                    logger.info("Added missing column term_sessions.%s", col)

            # sections.term_session_id
            if "term_session_id" not in section_cols:
                conn.execute(
                    sa.text("ALTER TABLE sections ADD COLUMN term_session_id INTEGER REFERENCES term_sessions(id) ON DELETE SET NULL")
                )
                logger.info("Added missing column sections.term_session_id")

                # Data migration: map old session enum to term_session_id
                session_map = {
                    "session_a": "A", "session_b": "B",
                    "session_c": "C", "session_d": "D",
                }
                for enum_val, name in session_map.items():
                    conn.execute(sa.text("""
                        UPDATE sections
                        SET term_session_id = (
                            SELECT ts.id FROM term_sessions ts
                            WHERE ts.term_id = sections.term_id AND ts.name = :name
                        )
                        WHERE sections.session = :enum_val
                          AND sections.term_session_id IS NULL
                    """), {"name": name, "enum_val": enum_val})
                logger.info("Migrated session enum values to term_session_id")

            # ── course_rotations table patches ──
            try:
                result = conn.execute(sa.text("PRAGMA table_info(course_rotations)"))
                rotation_cols = {row[1] for row in result}

                for col, col_type in [
                    ("time_block_id", "INTEGER REFERENCES time_blocks(id) ON DELETE SET NULL"),
                    ("days_of_week", "VARCHAR(50)"),
                    ("start_time", "TIME"),
                    ("end_time", "TIME"),
                    ("instructor_id", "INTEGER REFERENCES instructors(id) ON DELETE SET NULL"),
                    ("room_id", "INTEGER REFERENCES rooms(id) ON DELETE SET NULL"),
                    ("session", "VARCHAR(20)"),
                ]:
                    if col not in rotation_cols:
                        conn.execute(
                            sa.text(f"ALTER TABLE course_rotations ADD COLUMN {col} {col_type}")
                        )
                        logger.info("Added missing column course_rotations.%s", col)

                # Drop unique constraints that block multiple offering groups
                result = conn.execute(sa.text(
                    "SELECT sql FROM sqlite_master "
                    "WHERE type='table' AND name='course_rotations'"
                ))
                ddl_row = result.fetchone()
                if ddl_row and "UNIQUE" in (ddl_row[0] or ""):
                    # Re-read columns after any ADD COLUMN above
                    result = conn.execute(sa.text("PRAGMA table_info(course_rotations)"))
                    current_cols = {row[1] for row in result}

                    logger.info("Dropping unique constraint from course_rotations via table rebuild")
                    conn.execute(sa.text(
                        "CREATE TABLE course_rotations_new ("
                        "  id INTEGER NOT NULL PRIMARY KEY,"
                        "  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,"
                        "  semester VARCHAR(6) NOT NULL,"
                        "  year_parity VARCHAR(10) NOT NULL,"
                        "  num_sections INTEGER NOT NULL,"
                        "  enrollment_cap INTEGER NOT NULL,"
                        "  modality VARCHAR(20) NOT NULL,"
                        "  notes VARCHAR(200),"
                        "  time_block_id INTEGER REFERENCES time_blocks(id) ON DELETE SET NULL,"
                        "  days_of_week VARCHAR(50),"
                        "  start_time TIME,"
                        "  end_time TIME,"
                        "  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,"
                        "  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,"
                        "  session VARCHAR(20)"
                        ")"
                    ))
                    # Build column list based on what actually exists
                    all_cols = [
                        "id", "course_id", "semester", "year_parity", "num_sections",
                        "enrollment_cap", "modality", "notes", "time_block_id",
                        "days_of_week", "start_time", "end_time",
                        "instructor_id", "room_id", "session",
                    ]
                    copy_cols = [c for c in all_cols if c in current_cols]
                    # For new columns not in old table, use NULL
                    select_parts = []
                    for c in all_cols:
                        if c in current_cols:
                            select_parts.append(c)
                        else:
                            select_parts.append(f"NULL as {c}")
                    conn.execute(sa.text(
                        f"INSERT INTO course_rotations_new ({', '.join(all_cols)}) "
                        f"SELECT {', '.join(select_parts)} FROM course_rotations"
                    ))
                    conn.execute(sa.text("DROP TABLE course_rotations"))
                    conn.execute(sa.text(
                        "ALTER TABLE course_rotations_new RENAME TO course_rotations"
                    ))
                    logger.info("Rebuilt course_rotations without unique constraint")
            except Exception:
                pass  # Table may not exist yet

            conn.commit()
    except Exception:
        logger.exception("Schema patch failed (non-fatal)")


@app.on_event("startup")
def on_startup():
    """Create tables and seed data on first launch."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ensured.")
    except Exception:
        logger.exception("Failed to create database tables")
        return

    # Patch any missing columns on existing tables (create_all doesn't ALTER)
    _ensure_schema_current()

    # Alembic: stamp or upgrade
    try:
        from alembic.config import Config
        from alembic import command
        import sqlalchemy as sa

        alembic_dir = os.path.join(os.path.dirname(__file__), "..", "alembic")
        alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")

        if os.path.isdir(alembic_dir) and os.path.isfile(alembic_ini):
            alembic_cfg = Config(alembic_ini)
            alembic_cfg.set_main_option(
                "sqlalchemy.url", str(engine.url)
            )

            # Check if this DB has an Alembic version stamp
            has_stamp = False
            try:
                with engine.connect() as conn:
                    result = conn.execute(
                        sa.text("SELECT version_num FROM alembic_version LIMIT 1")
                    )
                    has_stamp = result.fetchone() is not None
            except Exception:
                pass

            if has_stamp:
                command.upgrade(alembic_cfg, "head")
            else:
                # DB was created by create_all (no migration history).
                # Schema is current, just stamp at head.
                command.stamp(alembic_cfg, "head")

            logger.info("Alembic migrations applied.")
    except Exception:
        logger.exception("Alembic migration failed (non-fatal)")

    # Seed standard time blocks if missing (required infrastructure).
    # Never auto-seed sample data (buildings, rooms, instructors, courses)
    # — that would overwrite user-imported data.
    try:
        from app.models.time_block import TimeBlock
        db = SessionLocal()
        try:
            if db.query(TimeBlock).count() == 0:
                logger.info("No time blocks found, seeding standard time blocks...")
                from app.seed import seed_time_blocks
                seed_time_blocks(db)
                logger.info("Time blocks seeded.")
            else:
                logger.info("Time blocks present, skipping seed.")
        finally:
            db.close()
    except Exception:
        logger.exception("Seeding failed (non-fatal)")


@app.get("/api/health")
def health():
    return {"status": "ok"}
