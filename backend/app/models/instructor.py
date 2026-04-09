from __future__ import annotations

import enum
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Date, Enum, ForeignKey, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class ModalityConstraint(str, enum.Enum):
    any = "any"
    online_only = "online_only"
    mwf_only = "mwf_only"
    tth_only = "tth_only"


class AvailabilityType(str, enum.Enum):
    unavailable = "unavailable"
    prefer_avoid = "prefer_avoid"


class InstructorType(str, enum.Enum):
    faculty = "faculty"
    ias = "ias"
    adjunct = "adjunct"
    nias = "nias"


class AcademicRank(str, enum.Enum):
    professor = "professor"
    associate_professor = "associate_professor"
    assistant_professor = "assistant_professor"
    senior_lecturer = "senior_lecturer"
    lecturer = "lecturer"
    adjunct_instructor = "adjunct_instructor"


class TenureStatus(str, enum.Enum):
    tenured = "tenured"
    tenure_track = "tenure_track"
    non_tenure = "non_tenure"


class Instructor(Base):
    __tablename__ = "instructors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    office_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[str] = mapped_column(String(50))
    modality_constraint: Mapped[ModalityConstraint] = mapped_column(
        Enum(ModalityConstraint), default=ModalityConstraint.any
    )
    max_credits: Mapped[int] = mapped_column(Integer, default=12)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    instructor_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rank: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    tenure_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    hire_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    available_summer: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    available_winter: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    availabilities = relationship("InstructorAvailability", back_populates="instructor")
    meetings = relationship("Meeting", back_populates="instructor")
    load_adjustments = relationship("LoadAdjustment", back_populates="instructor")
    release_rotation_entries = relationship("ReleaseRotation", back_populates="instructor", cascade="all, delete-orphan")
    notes = relationship("InstructorNote", back_populates="instructor", cascade="all, delete-orphan")


class InstructorAvailability(Base):
    __tablename__ = "instructor_availabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id"))
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id"))
    day_of_week: Mapped[str] = mapped_column(String(3))
    start_time: Mapped[str] = mapped_column(Time)
    end_time: Mapped[str] = mapped_column(Time)
    type: Mapped[AvailabilityType] = mapped_column(Enum(AvailabilityType))

    instructor = relationship("Instructor", back_populates="availabilities")
    term = relationship("Term", back_populates="instructor_availabilities")
