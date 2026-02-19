from __future__ import annotations

import difflib
import json
import re
from datetime import date, datetime, time
from typing import List, Optional, Tuple

from app.services.xlsx_reader import (
    read_xlsx_to_rows,
    read_xlsx_headers,
    match_columns,
    SCHEDULE_ALIASES,
)

# Mapping from XLSX day abbreviations to internal day codes
DAY_TOKENS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
DAY_MAP = {
    "Mo": "M",
    "Tu": "T",
    "We": "W",
    "Th": "Th",
    "Fr": "F",
    "Sa": "S",
    "Su": "U",
}

# Only Course and Section are truly required; others are optional
SCHEDULE_REQUIRED = ["Course", "Section"]


def parse_days(days_str: str) -> List[str]:
    """Parse XLSX day string like 'MoWeFr' into ['M','W','F']."""
    days: List[str] = []
    remaining = days_str.strip()
    while remaining:
        matched = False
        for token in DAY_TOKENS:
            if remaining.startswith(token):
                days.append(DAY_MAP[token])
                remaining = remaining[len(token):]
                matched = True
                break
        if not matched:
            # Skip unknown character
            remaining = remaining[1:]
    return days


def parse_time(time_str: str) -> time:
    """Parse time string like '9:00AM' or '1:50PM' into a time object."""
    cleaned = time_str.strip()
    return datetime.strptime(cleaned, "%I:%M%p").time()


def parse_days_and_times(value: str) -> Tuple[Optional[List[str]], Optional[time], Optional[time]]:
    """Parse 'Days & Times' column like 'MoWeFr 9:00AM - 9:50AM' or 'TBA'.

    Returns (days, start_time, end_time) or (None, None, None) for TBA.
    """
    stripped = value.strip()
    if not stripped or stripped.upper() == "TBA":
        return None, None, None

    # Split into days part and times part on the first space before a digit
    match = re.match(r'^([A-Za-z]+)\s+(.+)$', stripped)
    if not match:
        return None, None, None

    days_part = match.group(1)
    times_part = match.group(2)

    days = parse_days(days_part)
    if not days:
        return None, None, None

    # Split times on ' - '
    time_parts = times_part.split(" - ")
    if len(time_parts) != 2:
        return None, None, None

    try:
        start = parse_time(time_parts[0])
        end = parse_time(time_parts[1])
    except ValueError:
        return None, None, None

    return days, start, end


def parse_course(course_str: str) -> Tuple[str, str, str]:
    """Parse 'ECON 201 - Principles of Microeconomics' into (dept, number, title)."""
    parts = course_str.split(" - ", 1)
    if len(parts) == 2:
        code_part = parts[0].strip()
        title = parts[1].strip()
    else:
        code_part = course_str.strip()
        title = ""

    code_tokens = code_part.split(None, 1)
    if len(code_tokens) == 2:
        return code_tokens[0], code_tokens[1], title
    return code_part, "", title


def parse_section(section_str: str) -> Tuple[str, str]:
    """Parse '01-LEC Regular' into ('01', 'regular').

    Returns (section_number, session) where session is one of:
    'regular', 'session_a', 'session_b'.
    """
    stripped = section_str.strip()
    section_number = stripped.split("-", 1)[0]

    lower = stripped.lower()
    if "session a" in lower:
        session = "session_a"
    elif "session b" in lower:
        session = "session_b"
    else:
        session = "regular"

    return section_number, session


def parse_room(room_str: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse 'South Hall 224' into ('South Hall', '224').

    Returns (None, None) for 'TBA', 'On-Line', or empty.
    """
    stripped = room_str.strip()
    if not stripped or stripped.upper() == "TBA" or stripped.lower() == "on-line":
        return None, None

    # Split on last space: everything before is building, last token is room number
    last_space = stripped.rfind(" ")
    if last_space == -1:
        return stripped, ""

    building_name = stripped[:last_space]
    room_number = stripped[last_space + 1:]
    return building_name, room_number


def detect_modality(room_str: str, has_time: bool = True) -> str:
    """Detect modality from room string."""
    stripped = room_str.strip().lower()
    if stripped == "on-line":
        return "online_sync" if has_time else "online_async"
    return "in_person"


def match_time_block(
    days: List[str],
    start: time,
    end: time,
    time_blocks: list,
) -> Optional[int]:
    """Find a matching TimeBlock id for the given days and times."""
    days_set = set(days)
    for tb in time_blocks:
        tb_days = set(json.loads(tb.days_of_week))
        if tb_days == days_set and tb.start_time == start and tb.end_time == end:
            return tb.id
    return None


def parse_xlsx_row(row_dict: dict, row_num: int) -> Tuple[Optional[dict], List[str]]:
    """Parse a single XLSX row into a structured dict.

    Returns (parsed_dict, errors).
    """
    errors: List[str] = []

    # Course
    course_val = str(row_dict.get("Course") or "").strip()
    if not course_val:
        errors.append(f"Row {row_num}: Course is required")

    # Section
    section_val = str(row_dict.get("Section") or "").strip()
    if not section_val:
        errors.append(f"Row {row_num}: Section is required")

    if errors:
        return None, errors

    dept_code, course_number, title = parse_course(course_val)
    # Use separate Title column if available and parse_course didn't extract one
    title_col = str(row_dict.get("Title") or "").strip()
    if title_col and not title:
        title = title_col
    section_number, session = parse_section(section_val)

    # Days & Times
    days_times_val = str(row_dict.get("Days & Times") or "").strip()
    days, start_time, end_time = parse_days_and_times(days_times_val)

    # Room
    room_val = str(row_dict.get("Room") or "").strip()
    building_name, room_number = parse_room(room_val)
    modality = detect_modality(room_val, has_time=days is not None)

    # Instructor
    instructor_name = str(row_dict.get("Instructor") or "").strip()

    # CRN
    crn = row_dict.get("Class")
    if crn is not None:
        try:
            crn = int(crn)
        except (ValueError, TypeError):
            crn = None

    # Meeting dates (for term suggestion)
    meeting_dates_val = str(row_dict.get("Meeting Dates") or "").strip()
    meeting_start, meeting_end = parse_meeting_dates(meeting_dates_val)

    parsed = {
        "crn": crn,
        "department_code": dept_code,
        "course_number": course_number,
        "title": title,
        "section_number": section_number,
        "session": session,
        "days": days,
        "start_time": start_time.isoformat() if start_time else None,
        "end_time": end_time.isoformat() if end_time else None,
        "building_name": building_name,
        "room_number": room_number,
        "instructor_name": instructor_name or None,
        "modality": modality,
        "_meeting_start": meeting_start,
        "_meeting_end": meeting_end,
    }

    return parsed, []


def parse_meeting_dates(date_str: str) -> Tuple[Optional[date], Optional[date]]:
    """Parse 'Meeting Dates' like '09/02/2026 - 12/15/2026' into (start, end)."""
    stripped = str(date_str or "").strip()
    if not stripped:
        return None, None
    parts = stripped.split(" - ")
    if len(parts) != 2:
        return None, None
    try:
        start = datetime.strptime(parts[0].strip(), "%m/%d/%Y").date()
        end = datetime.strptime(parts[1].strip(), "%m/%d/%Y").date()
        return start, end
    except ValueError:
        return None, None


def suggest_term_from_dates(rows: List[dict]) -> Optional[dict]:
    """Infer a term name and date range from parsed XLSX rows.

    Looks at the 'meeting_start' and 'meeting_end' fields (raw dates stored
    during parsing) and returns a suggested term dict.
    """
    start_dates: List[date] = []
    end_dates: List[date] = []
    for row in rows:
        s = row.get("_meeting_start")
        e = row.get("_meeting_end")
        if isinstance(s, date):
            start_dates.append(s)
        if isinstance(e, date):
            end_dates.append(e)

    if not start_dates or not end_dates:
        return None

    min_start = min(start_dates)
    max_end = max(end_dates)

    # Infer term name and type from start month
    month = min_start.month
    year = min_start.year
    if month in (8, 9):
        name = f"Fall {year}"
        term_type = "fall"
    elif month in (1, 2):
        name = f"Spring {year}"
        term_type = "spring"
    elif month in (5, 6, 7):
        name = f"Summer {year}"
        term_type = "summer"
    elif month in (3, 4):
        name = f"Spring {year}"
        term_type = "spring"
    elif month in (10, 11, 12):
        name = f"Fall {year}"
        term_type = "fall"
    else:
        name = f"Fall {year}"
        term_type = "fall"

    return {
        "name": name,
        "type": term_type,
        "start_date": min_start.isoformat(),
        "end_date": max_end.isoformat(),
    }


def find_instructor_matches(
    names: List[str],
    existing_instructors: list,
) -> List[dict]:
    """Find fuzzy matches between imported names and existing instructors.

    Returns a list of match entries:
    [{ "name": "Lisa Breger", "matches": [{ "id": 5, "name": "L. Breger",
       "email": "...", "score": 0.85 }] }]
    """
    results: List[dict] = []
    for name in names:
        entry: dict = {"name": name, "matches": []}
        name_lower = name.lower()
        for inst in existing_instructors:
            inst_name_lower = inst.name.lower()
            # Exact match
            if name_lower == inst_name_lower:
                entry["matches"].insert(0, {
                    "id": inst.id,
                    "name": inst.name,
                    "email": inst.email,
                    "score": 1.0,
                })
                continue
            # Fuzzy match
            score = difflib.SequenceMatcher(None, name_lower, inst_name_lower).ratio()
            if score >= 0.7:
                entry["matches"].append({
                    "id": inst.id,
                    "name": inst.name,
                    "email": inst.email,
                    "score": round(score, 2),
                })
        # Sort matches by score descending
        entry["matches"].sort(key=lambda m: m["score"], reverse=True)
        results.append(entry)
    return results


def detect_schedule_columns(contents: bytes) -> Tuple[List[str], dict, List[str]]:
    """Detect column mapping for a schedule XLSX file.

    Returns (file_headers, auto_mapping, warnings) where:
      - file_headers: the actual column headers from the file
      - auto_mapping: dict of { actual_header -> canonical_name }
      - warnings: informational messages
    """
    headers, errors = read_xlsx_headers(contents)
    if errors:
        return [], {}, errors
    mapping, warnings, match_errors = match_columns(headers, SCHEDULE_ALIASES)
    return headers, mapping, warnings + match_errors


def read_xlsx_schedule(
    contents: bytes,
    column_mapping_override: Optional[dict] = None,
) -> Tuple[List[dict], List[str], Optional[dict]]:
    """Read an XLSX schedule file and return (valid_rows, errors, suggested_term).

    Uses the generic XLSX reader with smart column detection, then applies
    schedule-specific row parsing. If column_mapping_override is provided,
    it is used instead of auto-detection.
    """
    raw_rows, file_messages = read_xlsx_to_rows(
        contents, SCHEDULE_ALIASES, SCHEDULE_REQUIRED,
        column_mapping_override=column_mapping_override,
    )

    # If the reader returned blocking errors (missing columns), bail out
    blocking = [m for m in file_messages if m.startswith("Missing required")]
    if blocking:
        return [], blocking, None

    # Non-blocking messages (fuzzy match warnings, ignored columns)
    non_blocking = [m for m in file_messages if not m.startswith("Missing required")]

    # Parse each raw row through schedule-specific parsing
    valid_rows: List[dict] = []
    all_errors: List[str] = []

    for row_num, raw_row in enumerate(raw_rows, start=2):
        parsed, errors = parse_xlsx_row(raw_row, row_num)
        if errors:
            all_errors.extend(errors)
        elif parsed:
            valid_rows.append(parsed)

    # Suggest term from meeting dates
    suggested_term = suggest_term_from_dates(valid_rows)

    # Strip internal fields from rows before returning
    clean_rows: List[dict] = []
    for row in valid_rows:
        clean = {k: v for k, v in row.items() if not k.startswith("_")}
        clean_rows.append(clean)

    return clean_rows, all_errors + non_blocking, suggested_term
