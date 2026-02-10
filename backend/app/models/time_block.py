import enum
from sqlalchemy import String, Enum, Time
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class BlockPattern(str, enum.Enum):
    mwf = "mwf"
    tth = "tth"
    evening = "evening"


class TimeBlock(Base):
    __tablename__ = "time_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    pattern: Mapped[BlockPattern] = mapped_column(Enum(BlockPattern))
    days_of_week: Mapped[str] = mapped_column(String(20))  # JSON string e.g. '["M","W","F"]'
    start_time: Mapped[str] = mapped_column(Time)
    end_time: Mapped[str] = mapped_column(Time)
    label: Mapped[str] = mapped_column(String(50))
