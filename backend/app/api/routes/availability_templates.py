from __future__ import annotations

from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.availability_template import InstructorAvailabilityTemplate
from app.models.instructor import AvailabilityType, Instructor, InstructorAvailability
from app.models.term import Term
from app.schemas.schemas import (
    AvailabilityTemplateCreate,
    AvailabilityTemplateRead,
)

router = APIRouter()


@router.get(
    "/{instructor_id}/availability-templates",
    response_model=list[AvailabilityTemplateRead],
)
def get_templates(
    instructor_id: int,
    term_type: Union[str, None] = Query(default=None),
    db: Session = Depends(get_db),
):
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")
    query = db.query(InstructorAvailabilityTemplate).filter_by(
        instructor_id=instructor_id
    )
    if term_type:
        query = query.filter_by(term_type=term_type)
    return query.all()


@router.put(
    "/{instructor_id}/availability-templates/{term_type}",
    response_model=list[AvailabilityTemplateRead],
)
def replace_templates(
    instructor_id: int,
    term_type: str,
    slots: list[AvailabilityTemplateCreate],
    db: Session = Depends(get_db),
):
    if term_type not in ("fall", "spring"):
        raise HTTPException(400, "term_type must be 'fall' or 'spring'")
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")

    db.query(InstructorAvailabilityTemplate).filter_by(
        instructor_id=instructor_id, term_type=term_type
    ).delete()

    new_templates = []
    for slot in slots:
        template = InstructorAvailabilityTemplate(
            instructor_id=instructor_id,
            term_type=term_type,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            type=AvailabilityType(slot.type),
        )
        db.add(template)
        new_templates.append(template)
    db.commit()
    for t in new_templates:
        db.refresh(t)
    return new_templates


@router.post(
    "/{instructor_id}/availability-templates/{term_type}/apply/{term_id}",
    response_model=list,
)
def apply_template_to_term(
    instructor_id: int,
    term_type: str,
    term_id: int,
    db: Session = Depends(get_db),
):
    instructor = db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(404, "Instructor not found")
    term = db.get(Term, term_id)
    if not term:
        raise HTTPException(404, "Term not found")

    templates = (
        db.query(InstructorAvailabilityTemplate)
        .filter_by(instructor_id=instructor_id, term_type=term_type)
        .all()
    )

    db.query(InstructorAvailability).filter_by(
        instructor_id=instructor_id, term_id=term_id
    ).delete()

    created = []
    for t in templates:
        avail = InstructorAvailability(
            instructor_id=instructor_id,
            term_id=term_id,
            day_of_week=t.day_of_week,
            start_time=t.start_time,
            end_time=t.end_time,
            type=t.type,
        )
        db.add(avail)
        created.append(avail)
    db.commit()
    return [{"id": a.id, "day_of_week": a.day_of_week} for a in created]
