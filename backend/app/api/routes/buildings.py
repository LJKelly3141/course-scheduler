from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.building import Building
from app.schemas.schemas import BuildingCreate, BuildingRead, BuildingUpdate

router = APIRouter()


@router.get("/", response_model=list[BuildingRead])
def list_buildings(db: Session = Depends(get_db)):
    return db.query(Building).all()


@router.post("/", response_model=BuildingRead, status_code=201)
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

    db.delete(building)
    db.commit()
