from __future__ import annotations

import enum
from typing import Optional
from sqlalchemy import String, Date, Enum, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class TermType(str, enum.Enum):
    fall = "fall"
    spring = "spring"
    summer = "summer"
    winter = "winter"


class TermStatus(str, enum.Enum):
    draft = "draft"
    final = "final"


class Term(Base):
    __tablename__ = "terms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[TermType] = mapped_column(Enum(TermType))
    start_date: Mapped[str] = mapped_column(Date)
    end_date: Mapped[str] = mapped_column(Date)
    status: Mapped[TermStatus] = mapped_column(Enum(TermStatus), default=TermStatus.draft)
    academic_year_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("academic_years.id"), nullable=True
    )

    academic_year = relationship("AcademicYear", back_populates="terms")
    sections = relationship("Section", back_populates="term", cascade="all, delete-orphan")
    sessions = relationship("TermSession", back_populates="term", cascade="all, delete-orphan")
    instructor_availabilities = relationship("InstructorAvailability", back_populates="term", cascade="all, delete-orphan")
    dismissed_warnings = relationship("DismissedWarning", cascade="all, delete-orphan", passive_deletes=True)
