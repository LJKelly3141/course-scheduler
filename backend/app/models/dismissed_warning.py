from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DismissedWarning(Base):
    __tablename__ = "dismissed_warnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    term_id: Mapped[int] = mapped_column(Integer, ForeignKey("terms.id", ondelete="CASCADE"), nullable=False)
    warning_key: Mapped[str] = mapped_column(String(255), nullable=False)
