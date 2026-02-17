from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.building import Building
from app.models.meeting import Meeting
from app.models.room import Room
from app.schemas.schemas import BuildingCreate, BuildingRead, BuildingUpdate

router = APIRouter()


@router.get("", response_model=list[BuildingRead])
def list_buildings(db: Session = Depends(get_db)):
    return db.query(Building).all()


@router.post("", response_model=BuildingRead, status_code=201)
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    building = Building(
        name=payload.name,
        abbreviation=payload.abbreviation,
    )
    db.add(building)
    db.commit()
    db.refresh(building)
    return building


@router.get("/{building_id}", response_model=BuildingRead)
def get_building(building_id: int, db: Session = Depends(get_db)):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


@router.put("/{building_id}", response_model=BuildingRead)
def update_building(
    building_id: int, payload: BuildingUpdate, db: Session = Depends(get_db)
):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(building, field, value)

    db.commit()
    db.refresh(building)
    return building


@router.delete("/{building_id}", status_code=204)
def delete_building(building_id: int, db: Session = Depends(get_db)):
    building = db.query(Building).filter(Building.id == building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    # Nullify room references on meetings before cascade-deleting rooms
    room_ids = [r.id for r in db.query(Room.id).filter(Room.building_id == building_id).all()]
    if room_ids:
        db.query(Meeting).filter(Meeting.room_id.in_(room_ids)).update(
            {Meeting.room_id: None}, synchronize_session=False
        )
    db.delete(building)
    db.commit()
