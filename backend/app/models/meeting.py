from sqlalchemy import ForeignKey, String, Time, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.models.base import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"))
    days_of_week: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # JSON string e.g. '["M","W","F"]'
    start_time: Mapped[Optional[str]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[str]] = mapped_column(Time, nullable=True)
    time_block_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("time_blocks.id"), nullable=True
    )
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    instructor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("instructors.id"), nullable=True
    )

    section = relationship("Section", back_populates="meetings")
    time_block = relationship("TimeBlock")
    room = relationship("Room", back_populates="meetings")
    instructor = relationship("Instructor", back_populates="meetings")
