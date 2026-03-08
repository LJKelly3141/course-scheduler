from __future__ import annotations

import difflib
import json
from datetime import time
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.building import Building
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section
from app.models.term import Term


def _format_time(t: Optional[time]) -> str:
    """Format a time object to 'h:MM AM' style."""
    if t is None:
        return ""
    hour = t.hour
    minute = t.minute
    ampm = "AM" if hour < 12 else "PM"
    if hour == 0:
        hour = 12
    elif hour > 12:
        hour -= 12
    return f"{hour}:{minute:02d} {ampm}"


def _format_days(days: Optional[List[str]]) -> str:
    """Format a list of day codes into a string like 'MWF'."""
    if not days:
        return ""
    return "".join(days)


def _sort_days(days: List[str]) -> List[str]:
    """Sort days in standard order."""
    order = {"M": 0, "T": 1, "W": 2, "Th": 3, "F": 4, "S": 5, "U": 6}
    return sorted(days, key=lambda d: order.get(d, 99))


def _fuzzy_match(a: str, b: str, threshold: float = 0.85) -> bool:
    """Case-insensitive fuzzy name match."""
    if not a or not b:
        return a.strip().lower() == b.strip().lower()
    return difflib.SequenceMatcher(
        None, a.strip().lower(), b.strip().lower()
    ).ratio() >= threshold


def _build_building_lookup(db: Session) -> Dict[str, str]:
    """Build mapping from building full name (lowered) to abbreviation."""
    buildings = db.query(Building).all()
    lookup: Dict[str, str] = {}
    for b in buildings:
        lookup[b.name.lower()] = b.abbreviation
    return lookup


def _resolve_xlsx_room(
    building_name: Optional[str],
    room_number: Optional[str],
    building_lookup: Dict[str, str],
) -> str:
    """Convert XLSX building name + room number into 'ABBR room_number' format."""
    if not building_name or not room_number:
        return ""
    abbr = building_lookup.get(building_name.lower(), building_name)
    return f"{abbr} {room_number}"


def _db_meeting_info(section: Section) -> List[dict]:
    """Extract meeting info dicts from a DB section."""
    results = []
    for m in section.meetings:
        days_raw = m.days_of_week
        days = json.loads(days_raw) if days_raw else []
        room_str = ""
        if m.room and m.room.building:
            room_str = f"{m.room.building.abbreviation} {m.room.room_number}"
        elif m.room:
            room_str = m.room.room_number

        instructor_name = ""
        if m.instructor:
            instructor_name = m.instructor.name
        elif section.instructor:
            instructor_name = section.instructor.name

        results.append({
            "days": _sort_days(days),
            "start_time": m.start_time,
            "end_time": m.end_time,
            "room": room_str,
            "instructor": instructor_name,
        })
    return results


def _xlsx_section_info(
    rows: List[dict],
    building_lookup: Dict[str, str],
) -> List[dict]:
    """Extract meeting info dicts from parsed XLSX rows for one section."""
    results = []
    for row in rows:
        days = row.get("days") or []
        if isinstance(days, str):
            try:
                days = json.loads(days)
            except (json.JSONDecodeError, TypeError):
                days = []

        start_str = row.get("start_time")
        end_str = row.get("end_time")
        start_t = None
        end_t = None
        if start_str and start_str != "None":
            try:
                start_t = time.fromisoformat(start_str)
            except ValueError:
                pass
        if end_str and end_str != "None":
            try:
                end_t = time.fromisoformat(end_str)
            except ValueError:
                pass

        room_str = _resolve_xlsx_room(
            row.get("building_name"),
            row.get("room_number"),
            building_lookup,
        )

        results.append({
            "days": _sort_days(days),
            "start_time": start_t,
            "end_time": end_t,
            "room": room_str,
            "instructor": row.get("instructor_name") or "",
        })
    return results


def _format_meeting_summary(meetings: List[dict]) -> str:
    """Format a list of meeting dicts into a human-readable string."""
    parts = []
    for m in meetings:
        day_str = _format_days(m["days"])
        time_str = ""
        if m["start_time"] and m["end_time"]:
            time_str = f" {_format_time(m['start_time'])} - {_format_time(m['end_time'])}"
        room_str = f", {m['room']}" if m["room"] else ""
        instructor_str = f", {m['instructor']}" if m["instructor"] else ""
        parts.append(f"{day_str}{time_str}{room_str}{instructor_str}")
    return "; ".join(parts) if parts else "No meetings"


def _has_schedule(m: dict) -> bool:
    """Return True if a meeting dict has actual schedule data (not TBA)."""
    return bool(m["days"]) or bool(m["start_time"])


def _extract_structured_fields(meetings: List[dict]) -> dict:
    """Extract separate time, room, instructor strings from meeting dicts."""
    time_parts = []
    rooms = set()
    instructors = set()
    for m in meetings:
        day_str = _format_days(m["days"])
        if m["start_time"] and m["end_time"]:
            time_parts.append(
                f"{day_str} {_format_time(m['start_time'])} - {_format_time(m['end_time'])}"
            )
        elif day_str:
            time_parts.append(day_str)
        if m["room"]:
            rooms.add(m["room"])
        if m["instructor"]:
            instructors.add(m["instructor"])
    return {
        "time": "; ".join(time_parts),
        "room": ", ".join(sorted(rooms)),
        "instructor": ", ".join(sorted(instructors)),
    }


def _compare_time_and_days(
    db_meetings: List[dict],
    xlsx_meetings: List[dict],
) -> Optional[Tuple[str, str]]:
    """Compare days+time across meetings. Returns (registrar_val, dept_val) if different."""
    def _time_key(m: dict) -> str:
        days = _format_days(m["days"])
        start = _format_time(m["start_time"]) if m["start_time"] else ""
        end = _format_time(m["end_time"]) if m["end_time"] else ""
        if start and end:
            return f"{days} {start} - {end}"
        return days

    # Filter out TBA/empty meetings before comparing
    db_scheduled = [m for m in db_meetings if _has_schedule(m)]
    xlsx_scheduled = [m for m in xlsx_meetings if _has_schedule(m)]

    db_keys = sorted([_time_key(m) for m in db_scheduled])
    xlsx_keys = sorted([_time_key(m) for m in xlsx_scheduled])

    # Both empty (TBA) = no difference
    if not db_keys and not xlsx_keys:
        return None

    if db_keys != xlsx_keys:
        return "; ".join(xlsx_keys) or "TBA", "; ".join(db_keys) or "TBA"
    return None


def _compare_rooms(
    db_meetings: List[dict],
    xlsx_meetings: List[dict],
) -> Optional[Tuple[str, str]]:
    """Compare rooms across meetings."""
    db_rooms = sorted(set(m["room"] for m in db_meetings if m["room"]))
    xlsx_rooms = sorted(set(m["room"] for m in xlsx_meetings if m["room"]))

    # Both empty = no difference (TBA/online sections)
    if not db_rooms and not xlsx_rooms:
        return None

    if db_rooms != xlsx_rooms:
        return (
            ", ".join(xlsx_rooms) or "TBA",
            ", ".join(db_rooms) or "TBA",
        )
    return None


def _compare_instructors(
    db_meetings: List[dict],
    xlsx_meetings: List[dict],
    section_instructor: str,
) -> Optional[Tuple[str, str]]:
    """Compare instructor names using fuzzy matching."""
    # Get unique instructor names from each side
    db_names = set()
    for m in db_meetings:
        if m["instructor"]:
            db_names.add(m["instructor"])
    if not db_names and section_instructor:
        db_names.add(section_instructor)

    xlsx_names = set()
    for m in xlsx_meetings:
        if m["instructor"]:
            xlsx_names.add(m["instructor"])

    # If both empty, no diff
    if not db_names and not xlsx_names:
        return None

    # Check if all names fuzzy-match
    for db_name in db_names:
        matched = any(_fuzzy_match(db_name, xn) for xn in xlsx_names)
        if not matched:
            return (
                ", ".join(sorted(xlsx_names)) or "TBD",
                ", ".join(sorted(db_names)) or "TBD",
            )

    for xlsx_name in xlsx_names:
        matched = any(_fuzzy_match(xlsx_name, dn) for dn in db_names)
        if not matched:
            return (
                ", ".join(sorted(xlsx_names)) or "TBD",
                ", ".join(sorted(db_names)) or "TBD",
            )

    return None


def compare_schedule(
    db: Session,
    term_id: int,
    xlsx_rows: List[dict],
) -> dict:
    """Compare XLSX registrar schedule against the department's DB schedule.

    Returns a dict matching CompareResult schema.
    """
    # Load term
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")

    # Load all sections for this term with eager-loaded relationships
    sections = (
        db.query(Section)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
            joinedload(Section.meetings).joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Section.meetings).joinedload(Meeting.instructor),
        )
        .all()
    )

    # Build DB lookup: (dept, course_num, section_num) -> Section
    db_lookup: Dict[Tuple[str, str, str], Section] = {}
    for sec in sections:
        key = (
            sec.course.department_code.upper(),
            sec.course.course_number.strip(),
            sec.section_number.strip(),
        )
        db_lookup[key] = sec

    # Build XLSX lookup: (dept, course_num, section_num) -> [rows]
    xlsx_lookup: Dict[Tuple[str, str, str], List[dict]] = {}
    for row in xlsx_rows:
        key = (
            (row.get("department_code") or "").upper(),
            (row.get("course_number") or "").strip(),
            (row.get("section_number") or "").strip(),
        )
        xlsx_lookup.setdefault(key, []).append(row)

    building_lookup = _build_building_lookup(db)

    changed = []
    new_sections = []
    removed = []
    unchanged_count = 0

    all_keys = set(db_lookup.keys()) | set(xlsx_lookup.keys())

    for key in sorted(all_keys):
        dept, course_num, section_num = key
        in_db = key in db_lookup
        in_xlsx = key in xlsx_lookup

        if in_db and in_xlsx:
            # Compare fields
            sec = db_lookup[key]
            xlsx_rows_for_key = xlsx_lookup[key]

            db_meetings = _db_meeting_info(sec)
            xlsx_meetings = _xlsx_section_info(xlsx_rows_for_key, building_lookup)

            diffs = []

            # Time+Days
            time_diff = _compare_time_and_days(db_meetings, xlsx_meetings)
            if time_diff:
                diffs.append({
                    "field": "Time",
                    "registrar_value": time_diff[0],
                    "department_value": time_diff[1],
                })

            # Room
            room_diff = _compare_rooms(db_meetings, xlsx_meetings)
            if room_diff:
                diffs.append({
                    "field": "Room",
                    "registrar_value": room_diff[0],
                    "department_value": room_diff[1],
                })

            # Instructor
            section_instructor = sec.instructor.name if sec.instructor else ""
            instructor_diff = _compare_instructors(
                db_meetings, xlsx_meetings, section_instructor
            )
            if instructor_diff:
                diffs.append({
                    "field": "Instructor",
                    "registrar_value": instructor_diff[0],
                    "department_value": instructor_diff[1],
                })

            # Modality
            xlsx_modality = xlsx_rows_for_key[0].get("modality", "in_person")
            db_modality = sec.modality.value if sec.modality else "in_person"
            if xlsx_modality != db_modality:
                diffs.append({
                    "field": "Modality",
                    "registrar_value": xlsx_modality.replace("_", " ").title(),
                    "department_value": db_modality.replace("_", " ").title(),
                })

            # Enrollment cap
            xlsx_first = xlsx_rows_for_key[0]
            if xlsx_first.get("enrollment_cap") is not None:
                try:
                    xlsx_cap = int(xlsx_first["enrollment_cap"])
                    if xlsx_cap != sec.enrollment_cap:
                        diffs.append({
                            "field": "Enrollment Cap",
                            "registrar_value": str(xlsx_cap),
                            "department_value": str(sec.enrollment_cap),
                        })
                except (ValueError, TypeError):
                    pass

            crn = xlsx_rows_for_key[0].get("crn")

            if diffs:
                changed.append({
                    "crn": crn,
                    "department_code": dept,
                    "course_number": course_num,
                    "section_number": section_num,
                    "title": sec.course.title,
                    "diffs": diffs,
                })
            else:
                unchanged_count += 1

        elif in_db and not in_xlsx:
            # Section in department schedule but not in registrar = new section
            sec = db_lookup[key]
            db_meetings = _db_meeting_info(sec)
            summary = _format_meeting_summary(db_meetings)
            modality_str = ""
            if sec.modality and sec.modality.value != "in_person":
                modality_str = sec.modality.value.replace("_", " ").title()
                summary += f" ({modality_str})"
            fields = _extract_structured_fields(db_meetings)

            new_sections.append({
                "department_code": dept,
                "course_number": course_num,
                "section_number": section_num,
                "title": sec.course.title,
                "details": summary,
                "time": fields["time"],
                "room": fields["room"],
                "instructor": fields["instructor"],
                "modality": modality_str,
            })

        elif in_xlsx and not in_db:
            # Section in registrar but not in department = removed
            xlsx_rows_for_key = xlsx_lookup[key]
            crn = xlsx_rows_for_key[0].get("crn")
            title = xlsx_rows_for_key[0].get("title", "")
            xlsx_modality = xlsx_rows_for_key[0].get("modality", "in_person")
            xlsx_meetings = _xlsx_section_info(xlsx_rows_for_key, building_lookup)
            summary = _format_meeting_summary(xlsx_meetings)
            fields = _extract_structured_fields(xlsx_meetings)
            modality_str = ""
            if xlsx_modality != "in_person":
                modality_str = xlsx_modality.replace("_", " ").title()

            removed.append({
                "crn": crn,
                "department_code": dept,
                "course_number": course_num,
                "section_number": section_num,
                "title": title,
                "details": summary,
                "time": fields["time"],
                "room": fields["room"],
                "instructor": fields["instructor"],
                "modality": modality_str,
            })

    # Second pass: auto-match new/removed with same (dept, course_number)
    # when there is exactly one on each side (section number changed).
    new_by_course: Dict[Tuple[str, str], List[int]] = {}
    for i, ns in enumerate(new_sections):
        ck = (ns["department_code"], ns["course_number"])
        new_by_course.setdefault(ck, []).append(i)

    rem_by_course: Dict[Tuple[str, str], List[int]] = {}
    for i, rs in enumerate(removed):
        ck = (rs["department_code"], rs["course_number"])
        rem_by_course.setdefault(ck, []).append(i)

    matched_new_indices = set()
    matched_rem_indices = set()

    for course_key in set(new_by_course.keys()) & set(rem_by_course.keys()):
        n_idxs = new_by_course[course_key]
        r_idxs = rem_by_course[course_key]
        if len(n_idxs) == 1 and len(r_idxs) == 1:
            ni = n_idxs[0]
            ri = r_idxs[0]
            ns = new_sections[ni]
            rs = removed[ri]

            # Rebuild comparison using the DB section and XLSX rows
            db_key = (ns["department_code"], ns["course_number"], ns["section_number"])
            xlsx_key = (rs["department_code"], rs["course_number"], rs["section_number"])
            sec = db_lookup.get(db_key)
            xlsx_rows_for_key = xlsx_lookup.get(xlsx_key, [])

            diffs = []

            # Section number
            if rs["section_number"] != ns["section_number"]:
                diffs.append({
                    "field": "Section",
                    "registrar_value": rs["section_number"],
                    "department_value": ns["section_number"],
                })

            if sec and xlsx_rows_for_key:
                db_meetings = _db_meeting_info(sec)
                xlsx_meetings = _xlsx_section_info(xlsx_rows_for_key, building_lookup)

                time_diff = _compare_time_and_days(db_meetings, xlsx_meetings)
                if time_diff:
                    diffs.append({
                        "field": "Time",
                        "registrar_value": time_diff[0],
                        "department_value": time_diff[1],
                    })

                room_diff = _compare_rooms(db_meetings, xlsx_meetings)
                if room_diff:
                    diffs.append({
                        "field": "Room",
                        "registrar_value": room_diff[0],
                        "department_value": room_diff[1],
                    })

                section_instructor = sec.instructor.name if sec.instructor else ""
                instructor_diff = _compare_instructors(
                    db_meetings, xlsx_meetings, section_instructor
                )
                if instructor_diff:
                    diffs.append({
                        "field": "Instructor",
                        "registrar_value": instructor_diff[0],
                        "department_value": instructor_diff[1],
                    })

                xlsx_modality = xlsx_rows_for_key[0].get("modality", "in_person")
                db_modality = sec.modality.value if sec.modality else "in_person"
                if xlsx_modality != db_modality:
                    diffs.append({
                        "field": "Modality",
                        "registrar_value": xlsx_modality.replace("_", " ").title(),
                        "department_value": db_modality.replace("_", " ").title(),
                    })

                xlsx_first = xlsx_rows_for_key[0]
                if xlsx_first.get("enrollment_cap") is not None:
                    try:
                        xlsx_cap = int(xlsx_first["enrollment_cap"])
                        if xlsx_cap != sec.enrollment_cap:
                            diffs.append({
                                "field": "Enrollment Cap",
                                "registrar_value": str(xlsx_cap),
                                "department_value": str(sec.enrollment_cap),
                            })
                    except (ValueError, TypeError):
                        pass

            crn = rs.get("crn")

            if diffs:
                changed.append({
                    "crn": crn,
                    "department_code": ns["department_code"],
                    "course_number": ns["course_number"],
                    "section_number": ns["section_number"],
                    "title": ns["title"] or rs["title"],
                    "diffs": diffs,
                })
                matched_new_indices.add(ni)
                matched_rem_indices.add(ri)

    new_sections = [s for i, s in enumerate(new_sections) if i not in matched_new_indices]
    removed = [s for i, s in enumerate(removed) if i not in matched_rem_indices]

    return {
        "term_name": term.name,
        "changed": changed,
        "new_sections": new_sections,
        "removed": removed,
        "unchanged_count": unchanged_count,
    }
