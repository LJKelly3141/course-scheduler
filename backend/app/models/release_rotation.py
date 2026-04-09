"""Planned recurring load reassignments per instructor/semester."""
from __future__ import annotations

from typing import Optional
from sqlalchemy import Integer, String, Float, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.course_rotation import YearParity, RotationSemester


class ReleaseRotation(Base):
    """Defines a recurring load reassignment pattern for an instructor.

    Each row means: "This instructor should receive [adjustment_type] of
    [equivalent_credits] credits in [semester] of [year_parity] years."
    """
    __tablename__ = "release_rotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("instructors.id", ondelete="CASCADE")
    )
    semester: Mapped[RotationSemester] = mapped_column(Enum(RotationSemester))
    year_parity: Mapped[YearParity] = mapped_column(
        Enum(YearParity), default=YearParity.every_year
    )
    description: Mapped[str] = mapped_column(String(200))
    equivalent_credits: Mapped[float] = mapped_column(Float, default=3.0)
    adjustment_type: Mapped[str] = mapped_column(String(20), default="admin_release")

    instructor = relationship("Instructor", back_populates="release_rotation_entries")
