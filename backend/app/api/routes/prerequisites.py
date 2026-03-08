"""
Prerequisites CRUD, graph, and warnings endpoints.
"""
from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.course_prerequisite import CoursePrerequisite
from app.models.section import Section
from app.models.term import Term

router = APIRouter()


# ── Schemas ──

class PrerequisiteCreate(BaseModel):
    prerequisite_id: int
    is_corequisite: bool = False
    notes: Optional[str] = None


class PrerequisiteRead(BaseModel):
    id: int
    course_id: int
    prerequisite_id: int
    is_corequisite: bool
    notes: Optional[str]
    prerequisite_dept: str
    prerequisite_number: str
    prerequisite_title: str

    class Config:
        from_attributes = True


# ── CRUD ──

@router.get("/courses/{course_id}/prerequisites")
def list_prerequisites(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")

    links = (
        db.query(CoursePrerequisite)
        .filter(CoursePrerequisite.course_id == course_id)
        .all()
    )
    result = []
    for link in links:
        prereq = db.query(Course).filter(Course.id == link.prerequisite_id).first()
        if prereq:
            result.append({
                "id": link.id,
                "course_id": link.course_id,
                "prerequisite_id": link.prerequisite_id,
                "is_corequisite": link.is_corequisite,
                "notes": link.notes,
                "prerequisite_dept": prereq.department_code,
                "prerequisite_number": prereq.course_number,
                "prerequisite_title": prereq.title,
            })
    return result


@router.post("/courses/{course_id}/prerequisites", status_code=201)
def add_prerequisite(
    course_id: int,
    body: PrerequisiteCreate,
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")

    prereq = db.query(Course).filter(Course.id == body.prerequisite_id).first()
    if not prereq:
        raise HTTPException(404, "Prerequisite course not found")

    if course_id == body.prerequisite_id:
        raise HTTPException(400, "A course cannot be its own prerequisite")

    # Check for duplicate
    existing = (
        db.query(CoursePrerequisite)
        .filter(
            CoursePrerequisite.course_id == course_id,
            CoursePrerequisite.prerequisite_id == body.prerequisite_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "This prerequisite already exists")

    # Cycle detection via DFS
    if _would_create_cycle(db, course_id, body.prerequisite_id):
        raise HTTPException(
            400,
            f"Adding this prerequisite would create a cycle: "
            f"{prereq.department_code} {prereq.course_number} already depends on "
            f"{course.department_code} {course.course_number}"
        )

    link = CoursePrerequisite(
        course_id=course_id,
        prerequisite_id=body.prerequisite_id,
        is_corequisite=body.is_corequisite,
        notes=body.notes,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return {
        "id": link.id,
        "course_id": link.course_id,
        "prerequisite_id": link.prerequisite_id,
        "is_corequisite": link.is_corequisite,
        "notes": link.notes,
        "prerequisite_dept": prereq.department_code,
        "prerequisite_number": prereq.course_number,
        "prerequisite_title": prereq.title,
    }


@router.delete("/courses/{course_id}/prerequisites/{prereq_link_id}")
def remove_prerequisite(
    course_id: int,
    prereq_link_id: int,
    db: Session = Depends(get_db),
):
    link = (
        db.query(CoursePrerequisite)
        .filter(
            CoursePrerequisite.id == prereq_link_id,
            CoursePrerequisite.course_id == course_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(404, "Prerequisite link not found")
    db.delete(link)
    db.commit()
    return {"ok": True}


# ── Graph ──

@router.get("/prerequisites/graph")
def prerequisites_graph(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return the full prerequisite DAG as nodes + edges for visualization."""
    all_links = db.query(CoursePrerequisite).all()
    if not all_links:
        return {"nodes": [], "edges": []}

    # Collect all involved course IDs
    course_ids = set()
    for link in all_links:
        course_ids.add(link.course_id)
        course_ids.add(link.prerequisite_id)

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    if department:
        dept_ids = {c.id for c in courses if c.department_code == department}
        # Include a course if it or any of its prereqs is in the department
        relevant_ids = set()
        for link in all_links:
            if link.course_id in dept_ids or link.prerequisite_id in dept_ids:
                relevant_ids.add(link.course_id)
                relevant_ids.add(link.prerequisite_id)
        courses = [c for c in courses if c.id in relevant_ids]
        course_ids = {c.id for c in courses}

    course_map = {c.id: c for c in courses}

    nodes = [
        {
            "id": str(c.id),
            "department_code": c.department_code,
            "course_number": c.course_number,
            "title": c.title,
            "credits": c.credits,
        }
        for c in courses
    ]

    edges = [
        {
            "id": f"e{link.id}",
            "source": str(link.prerequisite_id),
            "target": str(link.course_id),
            "is_corequisite": link.is_corequisite,
        }
        for link in all_links
        if link.course_id in course_ids and link.prerequisite_id in course_ids
    ]

    return {"nodes": nodes, "edges": edges}


# ── Warnings ──

@router.get("/prerequisites/warnings")
def prerequisites_warnings(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Check if any courses scheduled in this term have prerequisites
    that are NOT offered in the same or a prior term.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(404, "Term not found")

    # Get courses scheduled in this term
    term_course_ids = set(
        row[0]
        for row in db.query(Section.course_id)
        .filter(Section.term_id == term_id)
        .distinct()
        .all()
    )

    if not term_course_ids:
        return {"warnings": []}

    # Get all prior terms (by start_date)
    prior_terms = (
        db.query(Term)
        .filter(Term.start_date < term.start_date)
        .all()
    )
    prior_term_ids = {t.id for t in prior_terms}

    # Courses offered in prior terms
    prior_course_ids = set(
        row[0]
        for row in db.query(Section.course_id)
        .filter(Section.term_id.in_(prior_term_ids))
        .distinct()
        .all()
    ) if prior_term_ids else set()

    # Also include courses in the same term (for corequisites)
    available_ids = prior_course_ids | term_course_ids

    # Check prerequisites
    links = (
        db.query(CoursePrerequisite)
        .filter(CoursePrerequisite.course_id.in_(term_course_ids))
        .all()
    )

    warnings = []
    course_cache: dict[int, Course] = {}

    def get_course(cid: int) -> Course:
        if cid not in course_cache:
            course_cache[cid] = db.query(Course).filter(Course.id == cid).first()
        return course_cache[cid]

    for link in links:
        if link.is_corequisite:
            # Corequisite must be in the same term
            if link.prerequisite_id not in term_course_ids:
                course = get_course(link.course_id)
                prereq = get_course(link.prerequisite_id)
                if course and prereq:
                    warnings.append({
                        "course_id": link.course_id,
                        "course_label": f"{course.department_code} {course.course_number}",
                        "prerequisite_id": link.prerequisite_id,
                        "prerequisite_label": f"{prereq.department_code} {prereq.course_number}",
                        "type": "corequisite_missing",
                        "message": (
                            f"{course.department_code} {course.course_number} requires "
                            f"{prereq.department_code} {prereq.course_number} as a corequisite, "
                            f"but it is not offered in this term."
                        ),
                    })
        else:
            # Prerequisite must be in a prior or same term
            if link.prerequisite_id not in available_ids:
                course = get_course(link.course_id)
                prereq = get_course(link.prerequisite_id)
                if course and prereq:
                    warnings.append({
                        "course_id": link.course_id,
                        "course_label": f"{course.department_code} {course.course_number}",
                        "prerequisite_id": link.prerequisite_id,
                        "prerequisite_label": f"{prereq.department_code} {prereq.course_number}",
                        "type": "prerequisite_missing",
                        "message": (
                            f"{course.department_code} {course.course_number} requires "
                            f"{prereq.department_code} {prereq.course_number}, "
                            f"but it has not been offered in any prior term."
                        ),
                    })

    return {"warnings": warnings}


# ── Helpers ──

def _would_create_cycle(db: Session, course_id: int, new_prereq_id: int) -> bool:
    """Check if adding new_prereq_id as a prerequisite of course_id would create a cycle."""
    # DFS from new_prereq_id's prerequisites to see if we can reach course_id
    visited: set[int] = set()
    stack = [new_prereq_id]

    while stack:
        current = stack.pop()
        if current == course_id:
            return True
        if current in visited:
            continue
        visited.add(current)

        # Get prerequisites of current
        links = (
            db.query(CoursePrerequisite.prerequisite_id)
            .filter(CoursePrerequisite.course_id == current)
            .all()
        )
        for (prereq_id,) in links:
            stack.append(prereq_id)

    return False
