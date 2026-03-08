from __future__ import annotations

import enum
from typing import Optional
from sqlalchemy import String, Integer, Float, Date, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Modality(str, enum.Enum):
    in_person = "in_person"
    online_sync = "online_sync"
    online_async = "online_async"
    hybrid = "hybrid"


class Session(str, enum.Enum):
    regular = "regular"
    session_a = "session_a"
    session_b = "session_b"
    session_c = "session_c"
    session_d = "session_d"


class SectionStatus(str, enum.Enum):
    unscheduled = "unscheduled"
    scheduled = "scheduled"
    confirmed = "confirmed"


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id"))
    section_number: Mapped[str] = mapped_column(String(10))
    enrollment_cap: Mapped[int] = mapped_column(Integer, default=30)
    modality: Mapped[Modality] = mapped_column(Enum(Modality), default=Modality.in_person)
    session: Mapped[Session] = mapped_column(Enum(Session), default=Session.regular)
    status: Mapped[SectionStatus] = mapped_column(
        Enum(SectionStatus), default=SectionStatus.unscheduled
    )
    instructor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("instructors.id"), nullable=True
    )
    term_session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("term_sessions.id", ondelete="SET NULL"), nullable=True
    )
    duration_weeks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    equivalent_credits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lecture_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    special_course_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    course = relationship("Course", back_populates="sections")
    term = relationship("Term", back_populates="sections")
    instructor = relationship("Instructor")
    term_session = relationship("TermSession", back_populates="sections")
    meetings = relationship("Meeting", back_populates="section", cascade="all, delete-orphan")
