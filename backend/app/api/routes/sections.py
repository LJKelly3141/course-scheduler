from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.section import Section
from app.schemas.schemas import (
    SectionCreate,
    SectionReadWithCourse,
    SectionUpdate,
)

router = APIRouter()


@router.get("", response_model=list[SectionReadWithCourse])
def list_sections(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    sections = (
        db.query(Section)
        .options(joinedload(Section.course), joinedload(Section.instructor))
        .filter(Section.term_id == term_id)
        .all()
    )
    return sections


@router.post("", response_model=SectionReadWithCourse, status_code=201)
def create_section(payload: SectionCreate, db: Session = Depends(get_db)):
    section = Section(
        course_id=payload.course_id,
        term_id=payload.term_id,
        section_number=payload.section_number,
        enrollment_cap=payload.enrollment_cap,
        modality=payload.modality,
        instructor_id=payload.instructor_id,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    # Re-query with eager load for course and instructor in response
    section = (
        db.query(Section)
        .options(joinedload(Section.course), joinedload(Section.instructor))
        .filter(Section.id == section.id)
        .first()
    )
    return section


@router.get("/{section_id}", response_model=SectionReadWithCourse)
def get_section(section_id: int, db: Session = Depends(get_db)):
    section = (
        db.query(Section)
        .options(joinedload(Section.course), joinedload(Section.instructor))
        .filter(Section.id == section_id)
        .first()
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.put("/{section_id}", response_model=SectionReadWithCourse)
def update_section(
    section_id: int, payload: SectionUpdate, db: Session = Depends(get_db)
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(section, field, value)

    db.commit()
    # Re-query with eager load for course and instructor in response
    section = (
        db.query(Section)
        .options(joinedload(Section.course), joinedload(Section.instructor))
        .filter(Section.id == section_id)
        .first()
    )
    return section


@router.delete("/{section_id}", status_code=204)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    db.delete(section)
    db.commit()
