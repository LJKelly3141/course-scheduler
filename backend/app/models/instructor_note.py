from __future__ import annotations

from typing import Optional
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class InstructorNote(Base):
    __tablename__ = "instructor_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id", ondelete="CASCADE"))
    term_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("terms.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str] = mapped_column(String(30), default="general")
    content: Mapped[str] = mapped_column(Text, default="")

    instructor = relationship("Instructor", back_populates="notes")
    term = relationship("Term")
