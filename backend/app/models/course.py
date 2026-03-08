from __future__ import annotations

from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_code: Mapped[str] = mapped_column(String(10))
    course_number: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    credits: Mapped[int] = mapped_column(Integer, default=3)
    counts_toward_load: Mapped[bool] = mapped_column(Boolean, default=True)

    sections = relationship("Section", back_populates="course", cascade="all, delete-orphan")
    prerequisite_links = relationship(
        "CoursePrerequisite",
        foreign_keys="CoursePrerequisite.course_id",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    required_by_links = relationship(
        "CoursePrerequisite",
        foreign_keys="CoursePrerequisite.prerequisite_id",
        back_populates="prerequisite",
        cascade="all, delete-orphan",
    )
    rotation_entries = relationship(
        "CourseRotation",
        back_populates="course",
        cascade="all, delete-orphan",
    )
