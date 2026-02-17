from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.instructor import Instructor, InstructorAvailability
from app.models.meeting import Meeting
from app.schemas.schemas import (
    BatchDeleteRequest,
    InstructorAvailabilityCreate,
    InstructorAvailabilityRead,
    InstructorCreate,
    InstructorRead,
    InstructorUpdate,
)

router = APIRouter()


@router.get("", response_model=list[InstructorRead])
def list_instructors(db: Session = Depends(get_db)):
    return db.query(Instructor).all()


@router.post("", response_model=InstructorRead, status_code=201)
def create_instructor(payload: InstructorCreate, db: Session = Depends(get_db)):
    instructor = Instructor(
        name=payload.name,
        email=payload.email,
        department=payload.department,
        modality_constraint=payload.modality_constraint,
        max_credits=payload.max_credits,
        is_active=payload.is_active,
    )
    db.add(instructor)
    db.commit()
    db.refresh(instructor)
    return instructor


@router.get("/{instructor_id}", response_model=InstructorRead)
def get_instructor(instructor_id: int, db: Session = Depends(get_db)):
    instructor = (
        db.query(Instructor).filter(Instructor.id == instructor_id).first()
    )
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


@router.put("/{instructor_id}", response_model=InstructorRead)
def update_instructor(
    instructor_id: int, payload: InstructorUpdate, db: Session = Depends(get_db)
):
    instructor = (
        db.query(Instructor).filter(Instructor.id == instructor_id).first()
    )
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(instructor, field, value)

    db.commit()
    db.refresh(instructor)
    return instructor


@router.post("/batch-delete", status_code=204)
def batch_delete_instructors(payload: BatchDeleteRequest, db: Session = Depends(get_db)):
    # Nullify instructor references on meetings before deleting
    db.query(Meeting).filter(Meeting.instructor_id.in_(payload.ids)).update(
        {Meeting.instructor_id: None}, synchronize_session=False
    )
    # Delete availability records
    db.query(InstructorAvailability).filter(
        InstructorAvailability.instructor_id.in_(payload.ids)
    ).delete(synchronize_session=False)
    db.query(Instructor).filter(Instructor.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()


@router.delete("/{instructor_id}", status_code=204)
def delete_instructor(instructor_id: int, db: Session = Depends(get_db)):
    instructor = (
        db.query(Instructor).filter(Instructor.id == instructor_id).first()
    )
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # Nullify instructor references on meetings before deleting
    db.query(Meeting).filter(Meeting.instructor_id == instructor_id).update(
        {Meeting.instructor_id: None}, synchronize_session=False
    )
    # Delete availability records
    db.query(InstructorAvailability).filter(
        InstructorAvailability.instructor_id == instructor_id
    ).delete(synchronize_session=False)
    db.delete(instructor)
    db.commit()


# --- Instructor Availability ---


@router.get(
    "/{instructor_id}/availability",
    response_model=list[InstructorAvailabilityRead],
)
def get_instructor_availability(
    instructor_id: int,
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    instructor = (
        db.query(Instructor).filter(Instructor.id == instructor_id).first()
    )
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    availabilities = (
        db.query(InstructorAvailability)
        .filter(
            InstructorAvailability.instructor_id == instructor_id,
            InstructorAvailability.term_id == term_id,
        )
        .all()
    )
    return availabilities


@router.put(
    "/{instructor_id}/availability",
    response_model=list[InstructorAvailabilityRead],
)
def replace_instructor_availability(
    instructor_id: int,
    payload: list[InstructorAvailabilityCreate],
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    instructor = (
        db.query(Instructor).filter(Instructor.id == instructor_id).first()
    )
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # Delete all existing availability for this instructor + term
    db.query(InstructorAvailability).filter(
        InstructorAvailability.instructor_id == instructor_id,
        InstructorAvailability.term_id == term_id,
    ).delete()

    # Create new availability entries
    new_items = []
    for item in payload:
        avail = InstructorAvailability(
            instructor_id=instructor_id,
            term_id=term_id,
            day_of_week=item.day_of_week,
            start_time=item.start_time,
            end_time=item.end_time,
            type=item.type,
        )
        db.add(avail)
        new_items.append(avail)

    db.commit()
    for a in new_items:
        db.refresh(a)
    return new_items
