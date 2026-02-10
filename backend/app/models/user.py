import enum
from sqlalchemy import String, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    instructor = "instructor"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.instructor)
