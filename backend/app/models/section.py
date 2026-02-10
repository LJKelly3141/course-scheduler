import enum
from sqlalchemy import String, Integer, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Modality(str, enum.Enum):
    in_person = "in_person"
    online = "online"
    hybrid = "hybrid"


class SectionStatus(str, enum.Enum):
    unscheduled = "unscheduled"
    scheduled = "scheduled"
    confirmed = "confirmed"


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id"))
    section_number: Mapped[str] = mapped_column(String(10))
    enrollment_cap: Mapped[int] = mapped_column(Integer, default=30)
    modality: Mapped[Modality] = mapped_column(Enum(Modality), default=Modality.in_person)
    status: Mapped[SectionStatus] = mapped_column(
        Enum(SectionStatus), default=SectionStatus.unscheduled
    )

    course = relationship("Course", back_populates="sections")
    term = relationship("Term", back_populates="sections")
    meetings = relationship("Meeting", back_populates="section", cascade="all, delete-orphan")
