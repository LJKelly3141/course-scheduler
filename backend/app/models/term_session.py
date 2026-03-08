from __future__ import annotations

from typing import Optional
from sqlalchemy import String, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class TermSession(Base):
    __tablename__ = "term_sessions"
    __table_args__ = (UniqueConstraint("term_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(20))  # e.g. "1-3", "1-13*", "4-9"
    start_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    head_count_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    head_count_date: Mapped[Optional[str]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    term = relationship("Term", back_populates="sessions")
    sections = relationship("Section", back_populates="term_session")
