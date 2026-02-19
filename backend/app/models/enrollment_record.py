from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EnrollmentRecord(Base):
    __tablename__ = "enrollment_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("courses.id"), nullable=True
    )
    department_code: Mapped[str] = mapped_column(String(20))
    course_number: Mapped[str] = mapped_column(String(20))
    academic_year: Mapped[str] = mapped_column(String(10))
    semester: Mapped[str] = mapped_column(String(20))
    section_number: Mapped[str] = mapped_column(String(20))
    enrollment_total: Mapped[int] = mapped_column(Integer, default=0)
    enrollment_cap: Mapped[int] = mapped_column(Integer, default=0)
    room_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    modality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    meeting_pattern: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    start_time: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    end_time: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    instructor_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    credits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    course = relationship("Course")
