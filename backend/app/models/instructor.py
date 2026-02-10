import enum
from sqlalchemy import String, Integer, Boolean, Enum, ForeignKey, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class ModalityConstraint(str, enum.Enum):
    any = "any"
    online_only = "online_only"
    mwf_only = "mwf_only"
    tth_only = "tth_only"


class AvailabilityType(str, enum.Enum):
    unavailable = "unavailable"
    prefer_avoid = "prefer_avoid"


class Instructor(Base):
    __tablename__ = "instructors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    department: Mapped[str] = mapped_column(String(50))
    modality_constraint: Mapped[ModalityConstraint] = mapped_column(
        Enum(ModalityConstraint), default=ModalityConstraint.any
    )
    max_credits: Mapped[int] = mapped_column(Integer, default=12)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    availabilities = relationship("InstructorAvailability", back_populates="instructor")
    meetings = relationship("Meeting", back_populates="instructor")


class InstructorAvailability(Base):
    __tablename__ = "instructor_availabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("instructors.id"))
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id"))
    day_of_week: Mapped[str] = mapped_column(String(3))
    start_time: Mapped[str] = mapped_column(Time)
    end_time: Mapped[str] = mapped_column(Time)
    type: Mapped[AvailabilityType] = mapped_column(Enum(AvailabilityType))

    instructor = relationship("Instructor", back_populates="availabilities")
    term = relationship("Term", back_populates="instructor_availabilities")
