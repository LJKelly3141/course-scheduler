"""Compute instructor workload summaries for a given term."""
from __future__ import annotations

import json
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.course import Course
from app.models.instructor import Instructor
from app.models.load_adjustment import LoadAdjustment
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section
from app.models.time_block import TimeBlock


def _split_name(name: str) -> tuple:
    """Best-effort split into (last_name, first_name)."""
    parts = name.rsplit(" ", 1)
    if len(parts) == 2:
        return parts[1], parts[0]  # "First Last" -> (Last, First)
    return name, ""


def _schedule_info(meeting: Meeting) -> str:
    """Build a human-readable schedule string for a meeting."""
    parts = []
    if meeting.days_of_week:
        try:
            days = json.loads(meeting.days_of_week)
            parts.append("".join(days))
        except (json.JSONDecodeError, TypeError):
            parts.append(str(meeting.days_of_week))

    if meeting.start_time and meeting.end_time:
        start = str(meeting.start_time)[:5]
        end = str(meeting.end_time)[:5]
        parts.append(f"{start}-{end}")

    if meeting.room:
        bldg = meeting.room.building.abbreviation if meeting.room.building else ""
        parts.append(f"{bldg} {meeting.room.room_number}".strip())

    return " | ".join(parts) if parts else "TBD"


def compute_instructor_workload(db: Session, term_id: int) -> dict:
    """Compute per-instructor workload for a term.

    Returns a dict matching the WorkloadResponse schema.
    """
    # Load all sections for the term with their courses and instructors
    sections = (
        db.query(Section)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.meetings).joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Section.meetings).joinedload(Meeting.instructor),
            joinedload(Section.meetings).joinedload(Meeting.time_block),
        )
        .all()
    )

    # Load all adjustments for the term
    adjustments = (
        db.query(LoadAdjustment)
        .filter(LoadAdjustment.term_id == term_id)
        .all()
    )

    # Map instructors -> sections  (from both section.instructor_id and meeting.instructor_id)
    instructor_sections: dict = defaultdict(list)
    unassigned_sections = []

    for section in sections:
        # Determine the instructor for this section
        # Priority: meeting instructor > section instructor
        instructor_id = section.instructor_id
        meeting_instructor = None

        # Check meetings for instructor assignment
        for mtg in section.meetings:
            if mtg.instructor_id:
                instructor_id = mtg.instructor_id
                meeting_instructor = mtg.instructor
                break

        course = section.course
        if not course:
            continue

        actual_credits = course.credits
        equiv_credits = section.equivalent_credits if section.equivalent_credits is not None else actual_credits
        sch = section.enrollment_cap * actual_credits

        # Build schedule info from meetings
        schedule_parts = []
        for mtg in section.meetings:
            schedule_parts.append(_schedule_info(mtg))
        schedule_info = "; ".join(schedule_parts) if schedule_parts else "No meetings"

        row = {
            "section_id": section.id,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "section_number": section.section_number,
            "title": course.title,
            "actual_credits": actual_credits,
            "equivalent_credits": equiv_credits,
            "enrollment_cap": section.enrollment_cap,
            "sch": sch,
            "modality": section.modality.value if hasattr(section.modality, 'value') else str(section.modality),
            "instruction_type": section.instruction_type.value if section.instruction_type else "LEC",
            "schedule_info": schedule_info,
            "status": section.status.value if hasattr(section.status, 'value') else str(section.status),
            "counts_toward_load": course.counts_toward_load,
        }

        if instructor_id:
            instructor_sections[instructor_id].append(row)
        else:
            unassigned_sections.append(row)

    # Build adjustment map
    adj_by_instructor: dict = defaultdict(list)
    for adj in adjustments:
        adj_by_instructor[adj.instructor_id].append({
            "id": adj.id,
            "description": adj.description,
            "equivalent_credits": adj.equivalent_credits,
            "adjustment_type": adj.adjustment_type.value if hasattr(adj.adjustment_type, 'value') else str(adj.adjustment_type),
        })

    # Get all instructor IDs that have sections or adjustments
    all_instructor_ids = set(instructor_sections.keys()) | set(adj_by_instructor.keys())

    # Load instructor records
    instructors = (
        db.query(Instructor)
        .filter(Instructor.id.in_(all_instructor_ids))
        .all()
    ) if all_instructor_ids else []

    instructor_map = {i.id: i for i in instructors}

    # Build workload entries
    workload_list = []
    total_instructors = 0
    total_teaching_credits_all = 0
    total_sch_all = 0
    overloaded_count = 0

    for inst_id in sorted(all_instructor_ids):
        inst = instructor_map.get(inst_id)
        if not inst:
            continue

        total_instructors += 1
        last_name, first_name = _split_name(inst.name)
        sect_rows = instructor_sections.get(inst_id, [])
        adj_rows = adj_by_instructor.get(inst_id, [])

        # Compute totals
        teaching_credits = sum(
            r["actual_credits"] for r in sect_rows if r["counts_toward_load"]
        )
        teaching_equiv = sum(
            r["equivalent_credits"] for r in sect_rows if r["counts_toward_load"]
        )
        adj_equiv = sum(a["equivalent_credits"] for a in adj_rows)
        total_equiv = teaching_equiv + adj_equiv
        total_sch = sum(r["sch"] for r in sect_rows)
        is_overloaded = total_equiv > inst.max_credits

        total_teaching_credits_all += teaching_credits
        total_sch_all += total_sch
        if is_overloaded:
            overloaded_count += 1

        workload_list.append({
            "instructor_id": inst.id,
            "name": inst.name,
            "last_name": last_name,
            "first_name": first_name,
            "instructor_type": inst.instructor_type,
            "department": inst.department,
            "max_credits": inst.max_credits,
            "section_count": len(sect_rows),
            "sections": sect_rows,
            "adjustments": adj_rows,
            "total_teaching_credits": teaching_credits,
            "total_equivalent_credits": total_equiv,
            "total_sch": total_sch,
            "is_overloaded": is_overloaded,
        })

    # Sort by last name
    workload_list.sort(key=lambda w: w["last_name"].lower())

    return {
        "instructors": workload_list,
        "unassigned_sections": unassigned_sections,
        "term_totals": {
            "total_instructors": total_instructors,
            "total_teaching_credits": total_teaching_credits_all,
            "total_sch": total_sch_all,
            "overloaded_count": overloaded_count,
        },
    }
