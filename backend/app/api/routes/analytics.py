"""
Analytics endpoints for enrollment trends, forecasts, and time slot analysis.
"""
from __future__ import annotations

from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.enrollment_record import EnrollmentRecord
from app.models.section import Section

router = APIRouter()


def _get_term_course_ids(db: Session, term_id: int) -> set:
    """Get course_ids that have sections in the given term."""
    section_course_ids = (
        db.query(Section.course_id)
        .filter(Section.term_id == term_id)
        .distinct()
        .all()
    )
    return {row[0] for row in section_course_ids}


# ---------------------------------------------------------------------------
# GET /analytics/enrollment-trends
# ---------------------------------------------------------------------------
@router.get("/analytics/enrollment-trends")
def enrollment_trends(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"courses": []}

    # Get courses
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    # Get enrollment records for these courses
    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    # Group by course, then academic_year + semester
    grouped: dict = defaultdict(lambda: defaultdict(list))
    for r in records:
        grouped[r.course_id][(r.academic_year, r.semester)].append(r)

    result = []
    for course_id in sorted(course_ids):
        course = course_map.get(course_id)
        if not course:
            continue

        data_points = []
        for (ay, sem), recs in sorted(grouped.get(course_id, {}).items()):
            total_enrolled = sum(r.enrollment_total for r in recs)
            total_cap = sum(r.enrollment_cap for r in recs)
            num_sections = len(recs)
            fill_rate = round(total_enrolled / total_cap, 2) if total_cap > 0 else 0

            data_points.append({
                "academic_year": ay,
                "semester": sem,
                "total_enrolled": total_enrolled,
                "total_cap": total_cap,
                "num_sections": num_sections,
                "fill_rate": fill_rate,
            })

        result.append({
            "course_id": course_id,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "title": course.title,
            "data_points": data_points,
        })

    return {"courses": result}


# ---------------------------------------------------------------------------
# GET /analytics/enrollment-forecast
# ---------------------------------------------------------------------------
def _compute_forecast(data_points: list, target_semester: str) -> dict:
    """Compute enrollment forecast from historical data points.

    Uses weighted moving average of same-semester values with trend adjustment.
    """
    # Filter to same semester type
    same_sem = [dp for dp in data_points if dp["semester"] == target_semester]
    same_sem.sort(key=lambda x: x["academic_year"])

    if not same_sem:
        return {
            "forecast_enrollment": 0,
            "forecast_sections": 0,
            "avg_section_size": 0,
            "trend": "unknown",
            "confidence": "none",
            "history": [],
        }

    enrollments = [dp["total_enrolled"] for dp in same_sem]
    section_counts = [dp["num_sections"] for dp in same_sem]

    # Confidence based on number of data points
    n = len(enrollments)
    if n >= 5:
        confidence = "high"
    elif n >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    # Weighted moving average (most recent gets highest weight)
    if n >= 3:
        weights = [0.5, 0.3, 0.2]
        recent = enrollments[-3:]
        wma = sum(w * v for w, v in zip(weights, reversed(recent)))
    elif n >= 2:
        weights = [0.6, 0.4]
        recent = enrollments[-2:]
        wma = sum(w * v for w, v in zip(weights, reversed(recent)))
    else:
        wma = enrollments[-1]

    # Linear trend (slope) over all same-semester points
    if n >= 2:
        x_vals = list(range(n))
        x_mean = sum(x_vals) / n
        y_mean = sum(enrollments) / n
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, enrollments))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        slope = numerator / denominator if denominator else 0

        # Apply half the trend as adjustment
        forecast = wma + slope * 0.5
    else:
        slope = 0
        forecast = wma

    forecast = max(0, round(forecast))

    # Determine trend direction
    if n >= 2 and abs(slope) > 2:
        trend = "growing" if slope > 0 else "declining"
    else:
        trend = "stable"

    # Estimate sections based on average section size
    avg_section_size = round(sum(enrollments) / sum(section_counts)) if sum(section_counts) > 0 else 30
    forecast_sections = max(1, round(forecast / avg_section_size)) if avg_section_size > 0 else 1

    return {
        "forecast_enrollment": forecast,
        "forecast_sections": forecast_sections,
        "avg_section_size": avg_section_size,
        "trend": trend,
        "confidence": confidence,
        "history": list(reversed(enrollments)),  # most recent first
    }


@router.get("/analytics/enrollment-forecast")
def enrollment_forecast(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    from app.models.term import Term

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        return {"forecasts": []}

    # Determine target semester from term type
    term_type = term.type
    if term_type in ("fall",):
        target_semester = "Fall"
    elif term_type in ("spring",):
        target_semester = "Spring"
    elif term_type in ("summer",):
        target_semester = "Summer"
    else:
        target_semester = "Fall"

    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"forecasts": []}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    # Group by course, then academic_year + semester
    grouped: dict = defaultdict(lambda: defaultdict(list))
    for r in records:
        grouped[r.course_id][(r.academic_year, r.semester)].append(r)

    # Build aggregated data points per course
    course_points: dict = defaultdict(list)
    for course_id, year_data in grouped.items():
        for (ay, sem), recs in sorted(year_data.items()):
            total_enrolled = sum(r.enrollment_total for r in recs)
            total_cap = sum(r.enrollment_cap for r in recs)
            num_sections = len(recs)
            course_points[course_id].append({
                "academic_year": ay,
                "semester": sem,
                "total_enrolled": total_enrolled,
                "total_cap": total_cap,
                "num_sections": num_sections,
            })

    forecasts = []
    for course_id in sorted(course_ids):
        course = course_map.get(course_id)
        if not course:
            continue

        forecast = _compute_forecast(course_points.get(course_id, []), target_semester)
        forecasts.append({
            "course_id": course_id,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "title": course.title,
            **forecast,
        })

    return {"forecasts": forecasts}


# ---------------------------------------------------------------------------
# GET /analytics/time-slots
# ---------------------------------------------------------------------------
@router.get("/analytics/time-slots")
def time_slot_analysis(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"time_slots": []}

    records = (
        db.query(EnrollmentRecord)
        .filter(
            EnrollmentRecord.course_id.in_(course_ids),
            EnrollmentRecord.meeting_pattern.isnot(None),
            EnrollmentRecord.start_time.isnot(None),
            EnrollmentRecord.end_time.isnot(None),
        )
        .all()
    )

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    # Group by (pattern, start, end)
    slot_data: dict = defaultdict(list)
    for r in records:
        key = (r.meeting_pattern, r.start_time, r.end_time)
        slot_data[key].append(r)

    result = []
    for (pattern, start, end), recs in slot_data.items():
        total_enrolled = sum(r.enrollment_total for r in recs)
        total_cap = sum(r.enrollment_cap for r in recs)
        avg_fill = round(total_enrolled / total_cap, 2) if total_cap > 0 else 0

        # Unique courses using this slot
        course_labels = sorted(set(
            f"{course_map[r.course_id].department_code} {course_map[r.course_id].course_number}"
            for r in recs if r.course_id in course_map
        ))

        result.append({
            "pattern": pattern,
            "start_time": start,
            "end_time": end,
            "usage_count": len(recs),
            "avg_fill_rate": avg_fill,
            "courses": course_labels,
        })

    # Sort by usage count descending
    result.sort(key=lambda x: -x["usage_count"])

    return {"time_slots": result}


# ---------------------------------------------------------------------------
# Helpers for time-slot parsing
# ---------------------------------------------------------------------------
def _parse_pattern_days(pattern: str) -> list:
    """Parse meeting pattern like 'M W F' or 'T TH' into day codes."""
    tokens = pattern.upper().split()
    days: list = []
    for t in tokens:
        if t == "TH":
            days.append("Th")
        elif t in ("M", "T", "W", "F", "S", "U"):
            days.append(t if t != "T" else "T")
            if t == "T":
                days[-1] = "T"
        elif len(t) > 1:
            # Handle combined like "MWF"
            i = 0
            while i < len(t):
                if i + 1 < len(t) and t[i:i + 2] == "TH":
                    days.append("Th")
                    i += 2
                elif t[i] in "MTWFSU":
                    days.append(t[i])
                    i += 1
                else:
                    i += 1
    return days


def _time_str_to_minutes(time_str: str) -> int:
    """Convert time string to minutes since midnight.

    Handles '09:30:00', '09:30', '9:30 AM', '1:00 PM' etc.
    """
    s = time_str.strip().upper()
    is_pm = "PM" in s
    is_am = "AM" in s
    s = s.replace("AM", "").replace("PM", "").strip()
    parts = s.split(":")
    try:
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return 0

    if is_pm and hour != 12:
        hour += 12
    elif is_am and hour == 12:
        hour = 0

    return hour * 60 + minute


def _classify_pattern(pattern: str) -> str:
    """Classify a meeting pattern as 'MWF' or 'TTh' type."""
    days = _parse_pattern_days(pattern)
    has_mwf = any(d in ("M", "W", "F") for d in days)
    has_tth = any(d in ("T", "Th") for d in days)
    if has_mwf and not has_tth:
        return "MWF"
    if has_tth and not has_mwf:
        return "TTh"
    if has_mwf:
        return "MWF"
    return "TTh"


# ---------------------------------------------------------------------------
# GET /analytics/summary
# ---------------------------------------------------------------------------
FULL_SECTION_SIZE = 35


@router.get("/analytics/summary")
def analytics_summary(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {}

    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    if not records:
        return {}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    academic_years = sorted(set(r.academic_year for r in records))
    num_years = len(academic_years)

    # ---- Card 1: Headcount, SCH, SCH per FTE ----
    total_headcount = sum(r.enrollment_total for r in records)
    avg_annual_headcount = round(total_headcount / num_years) if num_years else 0

    # SCH = sum(enrollment_total * credits)
    total_sch = sum(
        r.enrollment_total * (r.credits or 3)
        for r in records
    )
    avg_annual_sch = round(total_sch / num_years) if num_years else 0

    # FTE = sum(credits per section) / 12
    total_instructor_credits = sum(r.credits or 3 for r in records)
    total_fte = total_instructor_credits / 12.0 if total_instructor_credits else 1
    sch_per_fte = round(total_sch / total_fte, 1) if total_fte > 0 else 0
    avg_annual_fte = round(total_fte / num_years, 1) if num_years else 0

    # ---- Card 2: Fill rate by course level (35 = full section) ----
    level_data: dict = defaultdict(lambda: {"enrolled": 0, "sections": 0})
    for r in records:
        crs = course_map.get(r.course_id)
        if crs:
            try:
                level = (int(crs.course_number[:1]) * 100)
            except (ValueError, IndexError):
                level = 0
            level_data[level]["enrolled"] += r.enrollment_total
            level_data[level]["sections"] += 1

    fill_by_level: list = []
    for level in sorted(level_data.keys()):
        d = level_data[level]
        capacity = d["sections"] * FULL_SECTION_SIZE
        rate = round(d["enrolled"] / capacity, 3) if capacity else 0
        fill_by_level.append({
            "level": level,
            "fill_rate": rate,
            "enrolled": d["enrolled"],
            "sections": d["sections"],
        })

    # ---- Cards 3 & 4: Top / bottom MWF and TTh slots ----
    mwf_slots: dict = defaultdict(int)
    tth_slots: dict = defaultdict(int)
    for r in records:
        if not r.meeting_pattern or not r.start_time or not r.end_time:
            continue
        ptype = _classify_pattern(r.meeting_pattern)
        label = f"{r.start_time} - {r.end_time}"
        if ptype == "MWF":
            mwf_slots[label] += 1
        else:
            tth_slots[label] += 1

    def _top_bottom(slots: dict) -> dict:
        if not slots:
            return {"top_slot": "N/A", "top_count": 0,
                    "bottom_slot": "N/A", "bottom_count": 0}
        sorted_slots = sorted(slots.items(), key=lambda x: -x[1])
        return {
            "top_slot": sorted_slots[0][0],
            "top_count": sorted_slots[0][1],
            "bottom_slot": sorted_slots[-1][0],
            "bottom_count": sorted_slots[-1][1],
        }

    return {
        "avg_annual_headcount": avg_annual_headcount,
        "avg_annual_sch": avg_annual_sch,
        "sch_per_fte": sch_per_fte,
        "avg_annual_fte": avg_annual_fte,
        "num_years": num_years,
        "fill_by_level": fill_by_level,
        "mwf": _top_bottom(mwf_slots),
        "tth": _top_bottom(tth_slots),
    }


# ---------------------------------------------------------------------------
# GET /analytics/heatmap
# ---------------------------------------------------------------------------
@router.get("/analytics/heatmap")
def time_heatmap(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Return avg enrollment per section in a timetable grid (day x 30-min slot)."""
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"cells": [], "max_value": 0}

    records = (
        db.query(EnrollmentRecord)
        .filter(
            EnrollmentRecord.course_id.in_(course_ids),
            EnrollmentRecord.meeting_pattern.isnot(None),
            EnrollmentRecord.start_time.isnot(None),
            EnrollmentRecord.end_time.isnot(None),
        )
        .all()
    )

    # Track total enrollment and section count per (day, 30-min slot)
    grid_enrolled: dict = defaultdict(int)
    grid_sections: dict = defaultdict(int)
    for r in records:
        days = _parse_pattern_days(r.meeting_pattern)
        start_min = _time_str_to_minutes(r.start_time)
        end_min = _time_str_to_minutes(r.end_time)
        if start_min >= end_min:
            continue

        for day in days:
            slot = (start_min // 30) * 30
            while slot < end_min:
                grid_enrolled[(day, slot)] += r.enrollment_total
                grid_sections[(day, slot)] += 1
                slot += 30

    cells = []
    for key in grid_sections:
        day, minutes = key
        hour = minutes // 60
        minute = minutes % 60
        sections = grid_sections[key]
        enrolled = grid_enrolled[key]
        avg = round(enrolled / sections, 1) if sections > 0 else 0
        cells.append({
            "day": day,
            "hour": hour,
            "minute": minute,
            "avg_enrollment": avg,
            "sections": sections,
            "total_enrolled": enrolled,
        })

    max_value = max((c["avg_enrollment"] for c in cells), default=0)

    return {"cells": cells, "max_value": max_value}


# ---------------------------------------------------------------------------
# GET /analytics/modality-breakdown
# ---------------------------------------------------------------------------
@router.get("/analytics/modality-breakdown")
def modality_breakdown(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"modalities": [], "modality_names": []}

    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    # Group by academic_year and modality
    year_modality: dict = defaultdict(lambda: defaultdict(int))
    all_modalities: set = set()
    for r in records:
        mode = r.modality or "Unknown"
        year_modality[r.academic_year][mode] += r.enrollment_total
        all_modalities.add(mode)

    modality_names = sorted(all_modalities)
    result = []
    for ay in sorted(year_modality.keys()):
        row: dict = {"academic_year": ay}
        for m in modality_names:
            row[m] = year_modality[ay].get(m, 0)
        result.append(row)

    return {"modalities": result, "modality_names": modality_names}
