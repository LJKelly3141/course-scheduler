from __future__ import annotations

import enum
from typing import Optional
from sqlalchemy import Integer, String, ForeignKey, Enum, UniqueConstraint, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class YearParity(str, enum.Enum):
    every_year = "every_year"
    even_years = "even_years"
    odd_years = "odd_years"


class RotationSemester(str, enum.Enum):
    fall = "fall"
    spring = "spring"
    summer = "summer"
    winter = "winter"


class CourseRotation(Base):
    """Defines the planned offering pattern for a course.

    Each row means: "This course should be offered in [semester] of [year_parity] years."
    A course can have multiple rows (e.g., offered both Fall and Spring every year).
    """
    __tablename__ = "course_rotations"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "semester", "year_parity", "modality",
            name="uq_course_rotation_modality",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE")
    )
    semester: Mapped[RotationSemester] = mapped_column(Enum(RotationSemester))
    year_parity: Mapped[YearParity] = mapped_column(
        Enum(YearParity), default=YearParity.every_year
    )
    num_sections: Mapped[int] = mapped_column(Integer, default=1)
    enrollment_cap: Mapped[int] = mapped_column(Integer, default=30)
    modality: Mapped[str] = mapped_column(String(20), default="in_person")
    time_block_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("time_blocks.id", ondelete="SET NULL"), nullable=True
    )
    days_of_week: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    start_time = mapped_column(Time, nullable=True)
    end_time = mapped_column(Time, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    course = relationship("Course", back_populates="rotation_entries")
    time_block = relationship("TimeBlock")
