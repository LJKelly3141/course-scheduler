from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    terms, buildings, rooms, instructors, courses, sections,
    meetings, time_blocks, auth, import_export, suggestions,
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
    ],
    allow_origin_regex=r"^(file://.*|http://localhost:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
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


@app.on_event("startup")
def on_startup():
    """Create tables and seed data on first launch."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ensured.")
    except Exception:
        logger.exception("Failed to create database tables")
        return

    # Run Alembic stamp so future migrations know the current state
    try:
        from alembic.config import Config
        from alembic import command

        alembic_cfg = Config()
        alembic_dir = os.path.join(os.path.dirname(__file__), "..", "alembic")
        alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")

        if os.path.isdir(alembic_dir) and os.path.isfile(alembic_ini):
            alembic_cfg = Config(alembic_ini)
            alembic_cfg.set_main_option(
                "sqlalchemy.url", str(engine.url)
            )
            command.upgrade(alembic_cfg, "head")
            logger.info("Alembic migrations applied.")
    except Exception:
        logger.exception("Alembic migration failed (non-fatal)")

    # Seed data if database is empty
    try:
        from app.models.user import User
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                logger.info("Empty database detected, seeding data...")
                from app.seed import seed_time_blocks, seed_sample_data, seed_sections_and_meetings, seed_users
                seed_time_blocks(db)
                seed_sample_data(db)
                seed_sections_and_meetings(db)
                seed_users(db)
                logger.info("Seed complete.")
            else:
                logger.info("Database already has data, skipping seed.")
        finally:
            db.close()
    except Exception:
        logger.exception("Seeding failed (non-fatal)")


@app.get("/api/health")
def health():
    return {"status": "ok"}
