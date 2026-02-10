from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_code: Mapped[str] = mapped_column(String(10))
    course_number: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    credits: Mapped[int] = mapped_column(Integer, default=3)

    sections = relationship("Section", back_populates="course")
