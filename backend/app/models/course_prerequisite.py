from __future__ import annotations

from typing import Optional
from sqlalchemy import Integer, ForeignKey, Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class CoursePrerequisite(Base):
    __tablename__ = "course_prerequisites"
    __table_args__ = (
        UniqueConstraint("course_id", "prerequisite_id", name="uq_course_prereq"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE")
    )
    prerequisite_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE")
    )
    is_corequisite: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    course = relationship("Course", foreign_keys=[course_id], back_populates="prerequisite_links")
    prerequisite = relationship("Course", foreign_keys=[prerequisite_id], back_populates="required_by_links")
