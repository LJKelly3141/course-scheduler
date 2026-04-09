"""
Reassignment rotation: CRUD for recurring load reassignment templates + apply/import.
"""
from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.course_rotation import YearParity, RotationSemester
from app.models.instructor import Instructor
from app.models.load_adjustment import LoadAdjustment
from app.models.release_rotation import ReleaseRotation
from app.models.term import Term

router = APIRouter()

TYPE_LABELS = {"faculty": "Faculty", "ias": "IAS", "adjunct": "Adjunct", "nias": "NIAS"}
TYPE_ORDER = ["faculty", "ias", "nias", "adjunct"]


# ── Schemas ──

class ReleaseRotationCreate(BaseModel):
    instructor_id: int
    semester: str
    year_parity: str = "every_year"
    description: str
    equivalent_credits: float = 3.0
    adjustment_type: str = "admin_release"


class ReleaseRotationUpdate(BaseModel):
    semester: Optional[str] = None
    year_parity: Optional[str] = None
    description: Optional[str] = None
    equivalent_credits: Optional[float] = None
    adjustment_type: Optional[str] = None


class ApplyRequest(BaseModel):
    term_id: int


# ── Helpers ──

def _serialize(entry: ReleaseRotation) -> dict:
    inst = entry.instructor
    return {
        "id": entry.id,
        "instructor_id": entry.instructor_id,
        "instructor_name": inst.name if inst else None,
        "instructor_last_name": (inst.last_name or "") if inst else "",
        "instructor_first_name": (inst.first_name or "") if inst else "",
        "instructor_type": (inst.instructor_type or "") if inst else "",
        "semester": entry.semester.value if hasattr(entry.semester, "value") else str(entry.semester),
        "year_parity": entry.year_parity.value if hasattr(entry.year_parity, "value") else str(entry.year_parity),
        "description": entry.description,
        "equivalent_credits": entry.equivalent_credits,
        "adjustment_type": entry.adjustment_type,
    }


# ── CRUD ──

@router.get("")
def list_entries(
    semester: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ReleaseRotation)
        .options(joinedload(ReleaseRotation.instructor))
    )
    if semester:
        query = query.filter(ReleaseRotation.semester == semester)
    entries = query.order_by(ReleaseRotation.instructor_id, ReleaseRotation.semester).all()
    return [_serialize(e) for e in entries]


@router.post("", status_code=201)
def create_entry(body: ReleaseRotationCreate, db: Session = Depends(get_db)):
    inst = db.query(Instructor).filter(Instructor.id == body.instructor_id).first()
    if not inst:
        raise HTTPException(404, "Instructor not found")

    try:
        sem = RotationSemester(body.semester)
    except ValueError:
        raise HTTPException(400, f"Invalid semester: {body.semester}")
    try:
        parity = YearParity(body.year_parity)
    except ValueError:
        raise HTTPException(400, f"Invalid year_parity: {body.year_parity}")

    entry = ReleaseRotation(
        instructor_id=body.instructor_id,
        semester=sem,
        year_parity=parity,
        description=body.description,
        equivalent_credits=body.equivalent_credits,
        adjustment_type=body.adjustment_type,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.instructor  # trigger lazy load
    return _serialize(entry)


@router.put("/{entry_id}")
def update_entry(entry_id: int, body: ReleaseRotationUpdate, db: Session = Depends(get_db)):
    entry = db.query(ReleaseRotation).filter(ReleaseRotation.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")

    if body.semester is not None:
        try:
            entry.semester = RotationSemester(body.semester)
        except ValueError:
            raise HTTPException(400, f"Invalid semester: {body.semester}")
    if body.year_parity is not None:
        try:
            entry.year_parity = YearParity(body.year_parity)
        except ValueError:
            raise HTTPException(400, f"Invalid year_parity: {body.year_parity}")
    if body.description is not None:
        entry.description = body.description
    if body.equivalent_credits is not None:
        entry.equivalent_credits = body.equivalent_credits
    if body.adjustment_type is not None:
        entry.adjustment_type = body.adjustment_type

    db.commit()
    db.refresh(entry)
    return _serialize(entry)


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(ReleaseRotation).filter(ReleaseRotation.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.post("/batch", status_code=201)
def batch_set(entries: List[ReleaseRotationCreate], db: Session = Depends(get_db)):
    """Replace entries for the given instructor_ids, scoped to the semesters being imported."""
    instructor_ids = {e.instructor_id for e in entries}
    semesters = set()
    for e in entries:
        try:
            semesters.add(RotationSemester(e.semester))
        except ValueError:
            pass

    # Validate instructors exist
    instructors = db.query(Instructor).filter(Instructor.id.in_(instructor_ids)).all()
    inst_map = {i.id: i for i in instructors}
    for iid in instructor_ids:
        if iid not in inst_map:
            raise HTTPException(404, f"Instructor {iid} not found")

    # Delete existing entries only for the affected instructors AND semesters
    db.query(ReleaseRotation).filter(
        ReleaseRotation.instructor_id.in_(instructor_ids),
        ReleaseRotation.semester.in_(semesters),
    ).delete(synchronize_session="fetch")

    created = []
    for e in entries:
        try:
            sem = RotationSemester(e.semester)
        except ValueError:
            raise HTTPException(400, f"Invalid semester: {e.semester}")
        try:
            parity = YearParity(e.year_parity)
        except ValueError:
            raise HTTPException(400, f"Invalid year_parity: {e.year_parity}")

        entry = ReleaseRotation(
            instructor_id=e.instructor_id,
            semester=sem,
            year_parity=parity,
            description=e.description,
            equivalent_credits=e.equivalent_credits,
            adjustment_type=e.adjustment_type,
        )
        db.add(entry)
        created.append(entry)

    db.commit()
    for e in created:
        db.refresh(e)
    return [_serialize(e) for e in created]


# ── Apply to Term ──

@router.post("/apply")
def apply_to_term(body: ApplyRequest, db: Session = Depends(get_db)):
    """Create LoadAdjustment records in the target term from matching templates."""
    term = db.query(Term).filter(Term.id == body.term_id).first()
    if not term:
        raise HTTPException(404, "Term not found")
    if term.status == "final":
        raise HTTPException(400, "Cannot modify a finalized term")

    sem_map = {"fall": "fall", "spring": "spring", "summer": "summer", "winter": "winter"}
    term_semester = sem_map.get(term.type, "fall")
    year = term.start_date.year if hasattr(term.start_date, "year") else int(str(term.start_date)[:4])
    is_even = year % 2 == 0

    # Find matching rotation entries
    matching = (
        db.query(ReleaseRotation)
        .filter(ReleaseRotation.semester == term_semester)
        .all()
    )

    applicable = []
    for entry in matching:
        if entry.year_parity == YearParity.every_year:
            applicable.append(entry)
        elif entry.year_parity == YearParity.even_years and is_even:
            applicable.append(entry)
        elif entry.year_parity == YearParity.odd_years and not is_even:
            applicable.append(entry)

    # Load existing adjustments for dedup
    existing = (
        db.query(LoadAdjustment)
        .filter(LoadAdjustment.term_id == term.id)
        .all()
    )
    existing_set = {
        (a.instructor_id, a.description, a.adjustment_type.value if hasattr(a.adjustment_type, "value") else str(a.adjustment_type), a.equivalent_credits)
        for a in existing
    }

    created = []
    skipped = 0
    for entry in applicable:
        dedup_key = (entry.instructor_id, entry.description, entry.adjustment_type, entry.equivalent_credits)
        if dedup_key in existing_set:
            skipped += 1
            continue

        adj = LoadAdjustment(
            instructor_id=entry.instructor_id,
            term_id=term.id,
            description=entry.description,
            equivalent_credits=entry.equivalent_credits,
            adjustment_type=entry.adjustment_type,
        )
        db.add(adj)
        existing_set.add(dedup_key)

        # Get instructor name for response
        inst = db.query(Instructor).filter(Instructor.id == entry.instructor_id).first()
        inst_name = f"{inst.last_name}, {inst.first_name}" if inst and inst.last_name else (inst.name if inst else "Unknown")

        created.append({
            "instructor_name": inst_name,
            "description": entry.description,
            "equivalent_credits": entry.equivalent_credits,
            "adjustment_type": entry.adjustment_type,
        })

    db.commit()

    return {
        "term_id": term.id,
        "term_name": term.name,
        "entries_matched": len(applicable),
        "adjustments_created": len(created),
        "skipped_duplicates": skipped,
        "details": created,
    }


# ── Import from Term ──

@router.get("/from-term/{term_id}")
def extract_from_term(term_id: int, db: Session = Depends(get_db)):
    """Extract existing LoadAdjustments from a term as proposed rotation entries."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(404, "Term not found")

    sem_map = {"fall": "fall", "spring": "spring", "summer": "summer", "winter": "winter"}
    term_semester = sem_map.get(term.type, "fall")

    adjustments = (
        db.query(LoadAdjustment)
        .filter(LoadAdjustment.term_id == term_id)
        .all()
    )

    # Group by (instructor_id, description, equivalent_credits, adjustment_type)
    groups: dict[tuple, dict] = {}
    instructor_ids = set()
    for adj in adjustments:
        adj_type = adj.adjustment_type.value if hasattr(adj.adjustment_type, "value") else str(adj.adjustment_type)
        key = (adj.instructor_id, adj.description, adj.equivalent_credits, adj_type)
        if key not in groups:
            groups[key] = {
                "instructor_id": adj.instructor_id,
                "description": adj.description,
                "equivalent_credits": adj.equivalent_credits,
                "adjustment_type": adj_type,
            }
            instructor_ids.add(adj.instructor_id)

    # Fetch instructor names
    inst_map = {}
    if instructor_ids:
        for inst in db.query(Instructor).filter(Instructor.id.in_(instructor_ids)).all():
            inst_map[inst.id] = inst

    entries = []
    for data in groups.values():
        inst = inst_map.get(data["instructor_id"])
        entries.append({
            "instructor_id": data["instructor_id"],
            "instructor_name": inst.name if inst else "Unknown",
            "instructor_last_name": (inst.last_name or "") if inst else "",
            "instructor_first_name": (inst.first_name or "") if inst else "",
            "semester": term_semester,
            "year_parity": "every_year",
            "description": data["description"],
            "equivalent_credits": data["equivalent_credits"],
            "adjustment_type": data["adjustment_type"],
        })

    entries.sort(key=lambda e: (e["instructor_last_name"], e["instructor_first_name"]))

    return {
        "term_id": term.id,
        "term_name": term.name,
        "semester": term_semester,
        "entries": entries,
    }
