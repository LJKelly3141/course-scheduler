import enum
from sqlalchemy import String, Date, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class TermType(str, enum.Enum):
    fall = "fall"
    spring = "spring"
    summer = "summer"
    winter = "winter"


class TermStatus(str, enum.Enum):
    draft = "draft"
    final = "final"


class Term(Base):
    __tablename__ = "terms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[TermType] = mapped_column(Enum(TermType))
    start_date: Mapped[str] = mapped_column(Date)
    end_date: Mapped[str] = mapped_column(Date)
    status: Mapped[TermStatus] = mapped_column(Enum(TermStatus), default=TermStatus.draft)

    sections = relationship("Section", back_populates="term", cascade="all, delete-orphan")
    instructor_availabilities = relationship("InstructorAvailability", back_populates="term", cascade="all, delete-orphan")
