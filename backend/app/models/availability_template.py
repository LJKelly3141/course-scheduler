from __future__ import annotations

from typing import Optional
from sqlalchemy import String, ForeignKey, Time, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.instructor import AvailabilityType


class InstructorAvailabilityTemplate(Base):
    __tablename__ = "instructor_availability_templates"
    __table_args__ = (
        UniqueConstraint(
            "instructor_id", "term_type", "day_of_week", "start_time",
            name="uq_template_slot",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id", ondelete="CASCADE"))
    term_type: Mapped[str] = mapped_column(String(10))
    day_of_week: Mapped[str] = mapped_column(String(3))
    start_time: Mapped[str] = mapped_column(Time)
    end_time: Mapped[str] = mapped_column(Time)
    type: Mapped[AvailabilityType] = mapped_column(Enum(AvailabilityType))

    instructor = relationship("Instructor", backref="availability_templates")
