from __future__ import annotations

import enum
from sqlalchemy import String, Integer, Float, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class AdjustmentType(str, enum.Enum):
    research_release = "research_release"
    admin_release = "admin_release"
    course_release = "course_release"
    adhoc = "adhoc"
    overload = "overload"
    other = "other"


class LoadAdjustment(Base):
    __tablename__ = "load_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id"))
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String(200))
    equivalent_credits: Mapped[float] = mapped_column(Float, default=0.0)
    adjustment_type: Mapped[AdjustmentType] = mapped_column(
        Enum(AdjustmentType), default=AdjustmentType.other
    )

    instructor = relationship("Instructor", back_populates="load_adjustments")
    term = relationship("Term")
