from sqlalchemy import ForeignKey, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    room_number: Mapped[str] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer)

    building = relationship("Building", back_populates="rooms")
    meetings = relationship("Meeting", back_populates="room")
