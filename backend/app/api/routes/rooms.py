from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.room import Room
from app.schemas.schemas import BatchDeleteRequest, RoomCreate, RoomReadWithBuilding, RoomUpdate

router = APIRouter()


@router.get("/", response_model=list[RoomReadWithBuilding])
def list_rooms(
    building_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Room).options(joinedload(Room.building))
    if building_id is not None:
        query = query.filter(Room.building_id == building_id)
    return query.all()


@router.post("/", response_model=RoomReadWithBuilding, status_code=201)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    room = Room(
        building_id=payload.building_id,
        room_number=payload.room_number,
        capacity=payload.capacity,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    # Eager-load building for the response
    db.refresh(room)
    room = (
        db.query(Room)
        .options(joinedload(Room.building))
        .filter(Room.id == room.id)
        .first()
    )
    return room


@router.get("/{room_id}", response_model=RoomReadWithBuilding)
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = (
        db.query(Room)
        .options(joinedload(Room.building))
        .filter(Room.id == room_id)
        .first()
    )
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.put("/{room_id}", response_model=RoomReadWithBuilding)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(room, field, value)

    db.commit()
    # Re-query with eager load for building in response
    room = (
        db.query(Room)
        .options(joinedload(Room.building))
        .filter(Room.id == room_id)
        .first()
    )
    return room


@router.post("/batch-delete", status_code=204)
def batch_delete_rooms(payload: BatchDeleteRequest, db: Session = Depends(get_db)):
    db.query(Room).filter(Room.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()


@router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    db.delete(room)
    db.commit()
