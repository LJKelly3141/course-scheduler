"""
Analytics endpoints for enrollment trends, forecasts, and time slot analysis.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.enrollment_record import EnrollmentRecord
from app.models.section import Section
from app.models.term import Term
from app.models.academic_year import AcademicYear

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


def _get_term_semester(db: Session, term_id: int) -> str:
    """Get target semester string from a term."""
    from app.models.term import Term
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        return "Fall"
    sem_map = {"fall": "Fall", "spring": "Spring", "summer": "Summer", "winter": "Winter"}
    return sem_map.get(term.type, "Fall")


def _apply_course_filters(
    course_ids: set, department: Optional[str], level: Optional[int], db: Session
) -> set:
    """Filter course_ids by department and/or level."""
    if not department and level is None:
        return course_ids
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    filtered = set()
    for c in courses:
        if department and c.department_code != department:
            continue
        if level is not None:
            try:
                course_level = int(c.course_number[0]) * 100
            except (ValueError, IndexError):
                course_level = 0
            if course_level != level:
                continue
        filtered.add(c.id)
    return filtered


# ---------------------------------------------------------------------------
# GET /analytics/enrollment-trends
# ---------------------------------------------------------------------------
@router.get("/analytics/enrollment-trends")
def enrollment_trends(
    term_id: int = Query(...),
    aggregate: bool = Query(False),
    course_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    course_ids = _apply_course_filters(course_ids, department, level, db)
    if course_id is not None:
        course_ids = course_ids & {course_id}
    if not course_ids:
        if aggregate:
            return {"data_points": []}
        return {"courses": []}

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

    if aggregate:
        # Sum across all courses per (academic_year, semester)
        agg: dict = defaultdict(lambda: {"enrolled": 0, "cap": 0, "sections": 0, "sch": 0})
        for course_id_key, year_data in grouped.items():
            crs = course_map.get(course_id_key)
            credits = crs.credits if crs else 3
            for (ay, sem), recs in year_data.items():
                key = (ay, sem)
                agg[key]["enrolled"] += sum(r.enrollment_total for r in recs)
                agg[key]["cap"] += sum(r.enrollment_cap for r in recs)
                agg[key]["sections"] += len(recs)
                agg[key]["sch"] += sum(r.enrollment_total * (r.credits or credits) for r in recs)

        data_points = []
        for (ay, sem) in sorted(agg.keys()):
            d = agg[(ay, sem)]
            fill_rate = round(d["enrolled"] / d["cap"], 2) if d["cap"] > 0 else 0
            data_points.append({
                "academic_year": ay,
                "semester": sem,
                "total_enrolled": d["enrolled"],
                "total_cap": d["cap"],
                "num_sections": d["sections"],
                "fill_rate": fill_rate,
                "total_sch": d["sch"],
            })
        return {"data_points": data_points}

    result = []
    for cid in sorted(course_ids):
        course = course_map.get(cid)
        if not course:
            continue

        data_points = []
        for (ay, sem), recs in sorted(grouped.get(cid, {}).items()):
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
            "course_id": cid,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "title": course.title,
            "data_points": data_points,
        })

    return {"courses": result}


# ---------------------------------------------------------------------------
# GET /analytics/instructor-workload
# ---------------------------------------------------------------------------
@router.get("/analytics/instructor-workload")
def instructor_workload(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    from app.services.workload import compute_instructor_workload
    return compute_instructor_workload(db, term_id)


# ---------------------------------------------------------------------------
# GET /analytics/instructor-workload/export
# ---------------------------------------------------------------------------
@router.get("/analytics/instructor-workload/export")
def instructor_workload_export(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    from app.services.workload_export import export_workload_xlsx
    from fastapi.responses import StreamingResponse
    import io

    xlsx_bytes, filename = export_workload_xlsx(db, term_id)

    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /analytics/release-report/export-xlsx
# ---------------------------------------------------------------------------
@router.get("/analytics/release-report/export-xlsx")
def release_report_xlsx(
    term_ids: str = Query(..., description="Comma-separated term IDs"),
    db: Session = Depends(get_db),
):
    from app.services.release_report import export_release_report_xlsx
    from fastapi.responses import StreamingResponse
    import io

    ids = [int(t.strip()) for t in term_ids.split(",") if t.strip()]
    xlsx_bytes, filename = export_release_report_xlsx(db, ids)

    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /analytics/release-report/export-html
# ---------------------------------------------------------------------------
@router.get("/analytics/release-report/export-html")
def release_report_html(
    term_ids: str = Query(..., description="Comma-separated term IDs"),
    db: Session = Depends(get_db),
):
    from app.services.release_report import export_release_report_html
    from fastapi.responses import HTMLResponse

    ids = [int(t.strip()) for t in term_ids.split(",") if t.strip()]
    html = export_release_report_html(db, ids)
    return HTMLResponse(content=html)


# ---------------------------------------------------------------------------
# GET /analytics/annual-workload
# ---------------------------------------------------------------------------
@router.get("/analytics/annual-workload")
def annual_workload(
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Aggregate workload across all terms in an academic year."""
    from app.models.term import Term
    from app.services.workload import compute_instructor_workload

    terms = (
        db.query(Term)
        .filter(Term.academic_year_id == academic_year_id)
        .order_by(Term.start_date)
        .all()
    )

    if not terms:
        return {"terms": [], "instructors": {}}

    # Compute workload per term, then merge
    term_summaries = []
    instructor_annual: dict = {}  # instructor_id -> aggregated data

    for term in terms:
        wl = compute_instructor_workload(db, term.id)
        term_summaries.append({
            "term_id": term.id,
            "term_name": term.name,
            "term_type": term.type,
        })

        for inst in wl["instructors"]:
            iid = inst["instructor_id"]
            if iid not in instructor_annual:
                instructor_annual[iid] = {
                    "instructor_id": iid,
                    "name": inst["name"],
                    "last_name": inst["last_name"],
                    "first_name": inst["first_name"],
                    "instructor_type": inst["instructor_type"],
                    "department": inst["department"],
                    "max_credits": inst["max_credits"],
                    "terms": {},
                    "annual_teaching_credits": 0,
                    "annual_equivalent_credits": 0.0,
                    "annual_sch": 0,
                }
            annual = instructor_annual[iid]
            annual["terms"][term.id] = {
                "term_name": term.name,
                "teaching_credits": inst["total_teaching_credits"],
                "equivalent_credits": inst["total_equivalent_credits"],
                "sch": inst["total_sch"],
                "section_count": inst["section_count"],
            }
            annual["annual_teaching_credits"] += inst["total_teaching_credits"]
            annual["annual_equivalent_credits"] += inst["total_equivalent_credits"]
            annual["annual_sch"] += inst["total_sch"]

    # Sort by last name
    instructor_list = sorted(
        instructor_annual.values(),
        key=lambda x: x["last_name"].lower(),
    )

    return {
        "terms": term_summaries,
        "instructors": instructor_list,
    }


# ---------------------------------------------------------------------------
# GET /analytics/enrollment-forecast
# ---------------------------------------------------------------------------
def _compute_forecast(data_points: list, target_semester: str, cohort_avg: Optional[float] = None) -> dict:
    """Compute enrollment forecast from historical data points.

    Uses weighted moving average of same-semester values with trend adjustment.
    """
    same_sem = [dp for dp in data_points if dp["semester"] == target_semester]
    same_sem.sort(key=lambda x: x["academic_year"])

    cohort_fallback = False
    if len(same_sem) < 3 and cohort_avg is not None and cohort_avg > 0:
        cohort_fallback = True

    if not same_sem:
        if cohort_fallback:
            return {
                "forecast_enrollment": round(cohort_avg),
                "forecast_sections": 1,
                "avg_section_size": round(cohort_avg),
                "trend": "unknown",
                "confidence": "low",
                "history": [],
                "p25": round(cohort_avg * 0.8),
                "p75": round(cohort_avg * 1.2),
                "suggested_seats": round(cohort_avg * 1.2),
                "suggested_sections": 1,
                "cohort_fallback": True,
            }
        return {
            "forecast_enrollment": 0,
            "forecast_sections": 0,
            "avg_section_size": 0,
            "trend": "unknown",
            "confidence": "none",
            "history": [],
            "p25": 0,
            "p75": 0,
            "suggested_seats": 0,
            "suggested_sections": 0,
            "cohort_fallback": False,
        }

    enrollments = [dp["total_enrolled"] for dp in same_sem]
    section_counts = [dp["num_sections"] for dp in same_sem]

    n = len(enrollments)
    if n >= 5:
        confidence = "high"
    elif n >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    # Weighted moving average
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

    # Linear trend
    if n >= 2:
        x_vals = list(range(n))
        x_mean = sum(x_vals) / n
        y_mean = sum(enrollments) / n
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, enrollments))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        slope = numerator / denominator if denominator else 0
        forecast = wma + slope * 0.5
    else:
        slope = 0
        forecast = wma

    forecast = max(0, round(forecast))

    if n >= 2 and abs(slope) > 2:
        trend = "growing" if slope > 0 else "declining"
    else:
        trend = "stable"

    avg_section_size = round(sum(enrollments) / sum(section_counts)) if sum(section_counts) > 0 else 30
    forecast_sections = max(1, round(forecast / avg_section_size)) if avg_section_size > 0 else 1

    # Compute p25 and p75 from historical same-semester distribution
    sorted_enrollments = sorted(enrollments)
    if n >= 2:
        p25_idx = max(0, int(n * 0.25) - 1)
        p75_idx = min(n - 1, int(math.ceil(n * 0.75)) - 1)
        p25 = sorted_enrollments[p25_idx]
        p75 = sorted_enrollments[p75_idx]
    else:
        p25 = sorted_enrollments[0]
        p75 = sorted_enrollments[0]

    suggested_seats = p75
    suggested_sections = max(1, math.ceil(p75 / avg_section_size)) if avg_section_size > 0 else 1

    return {
        "forecast_enrollment": forecast,
        "forecast_sections": forecast_sections,
        "avg_section_size": avg_section_size,
        "trend": trend,
        "confidence": confidence,
        "history": list(reversed(enrollments)),
        "p25": p25,
        "p75": p75,
        "suggested_seats": suggested_seats,
        "suggested_sections": suggested_sections,
        "cohort_fallback": cohort_fallback,
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

    grouped: dict = defaultdict(lambda: defaultdict(list))
    for r in records:
        grouped[r.course_id][(r.academic_year, r.semester)].append(r)

    course_points: dict = defaultdict(list)
    for cid, year_data in grouped.items():
        for (ay, sem), recs in sorted(year_data.items()):
            total_enrolled = sum(r.enrollment_total for r in recs)
            total_cap = sum(r.enrollment_cap for r in recs)
            num_sections = len(recs)
            course_points[cid].append({
                "academic_year": ay,
                "semester": sem,
                "total_enrolled": total_enrolled,
                "total_cap": total_cap,
                "num_sections": num_sections,
            })

    # Build cohort averages by dept+level for fallback
    cohort_totals: dict = defaultdict(lambda: {"total": 0, "count": 0})
    for cid, points in course_points.items():
        crs = course_map.get(cid)
        if not crs:
            continue
        try:
            lvl = int(crs.course_number[0]) * 100
        except (ValueError, IndexError):
            lvl = 0
        same_sem_pts = [p for p in points if p["semester"] == target_semester]
        for p in same_sem_pts:
            key = (crs.department_code, lvl)
            cohort_totals[key]["total"] += p["total_enrolled"]
            cohort_totals[key]["count"] += 1

    cohort_avgs: dict = {}
    for key, data in cohort_totals.items():
        if data["count"] > 0:
            cohort_avgs[key] = data["total"] / data["count"]

    forecasts = []
    for cid in sorted(course_ids):
        course = course_map.get(cid)
        if not course:
            continue

        # Get cohort average for fallback
        try:
            lvl = int(course.course_number[0]) * 100
        except (ValueError, IndexError):
            lvl = 0
        cohort_avg = cohort_avgs.get((course.department_code, lvl))

        forecast = _compute_forecast(
            course_points.get(cid, []), target_semester, cohort_avg
        )
        forecasts.append({
            "course_id": cid,
            "department_code": course.department_code,
            "course_number": course.course_number,
            "title": course.title,
            "credits": course.credits,
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

    slot_data: dict = defaultdict(list)
    for r in records:
        key = (r.meeting_pattern, r.start_time, r.end_time)
        slot_data[key].append(r)

    result = []
    for (pattern, start, end), recs in slot_data.items():
        total_enrolled = sum(r.enrollment_total for r in recs)
        total_cap = sum(r.enrollment_cap for r in recs)
        avg_fill = round(total_enrolled / total_cap, 2) if total_cap > 0 else 0

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
    """Convert time string to minutes since midnight."""
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
    department: Optional[str] = Query(None),
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    course_ids = _apply_course_filters(course_ids, department, level, db)
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

    target_semester = _get_term_semester(db, term_id)

    academic_years = sorted(set(r.academic_year for r in records))
    num_years = len(academic_years)

    # ---- Existing annual averages ----
    total_headcount = sum(r.enrollment_total for r in records)
    avg_annual_headcount = round(total_headcount / num_years) if num_years else 0

    total_sch = sum(
        r.enrollment_total * (r.credits or 3)
        for r in records
    )
    avg_annual_sch = round(total_sch / num_years) if num_years else 0

    load_course_ids = {
        c.id for c in courses if getattr(c, "counts_toward_load", True)
    }
    total_instructor_credits = sum(
        r.credits or 3 for r in records if r.course_id in load_course_ids
    )
    total_fte = total_instructor_credits / 12.0 if total_instructor_credits else 1
    sch_per_fte = round(total_sch / total_fte, 1) if total_fte > 0 else 0
    avg_annual_fte = round(total_fte / num_years, 1) if num_years else 0

    # ---- Latest same-semester totals ----
    same_sem_records = [r for r in records if r.semester == target_semester]
    latest_year = max((r.academic_year for r in same_sem_records), default=None) if same_sem_records else None
    latest_enrolled = 0
    latest_seats = 0
    latest_sch = 0
    prev_enrolled = 0
    yoy_enrolled_change = 0.0

    if latest_year:
        latest_recs = [r for r in same_sem_records if r.academic_year == latest_year]
        latest_enrolled = sum(r.enrollment_total for r in latest_recs)
        latest_seats = sum(r.enrollment_cap for r in latest_recs)
        latest_sch = sum(r.enrollment_total * (r.credits or 3) for r in latest_recs)

        # Find prior year same semester
        prior_years = sorted(set(r.academic_year for r in same_sem_records if r.academic_year < latest_year))
        if prior_years:
            prev_year = prior_years[-1]
            prev_recs = [r for r in same_sem_records if r.academic_year == prev_year]
            prev_enrolled = sum(r.enrollment_total for r in prev_recs)
            if prev_enrolled > 0:
                yoy_enrolled_change = round((latest_enrolled - prev_enrolled) / prev_enrolled * 100, 1)

    fill_rate = round(latest_enrolled / latest_seats, 3) if latest_seats > 0 else 0

    # ---- Fill rate by level ----
    level_data: dict = defaultdict(lambda: {"enrolled": 0, "sections": 0})
    for r in records:
        crs = course_map.get(r.course_id)
        if crs:
            try:
                lvl = (int(crs.course_number[:1]) * 100)
            except (ValueError, IndexError):
                lvl = 0
            level_data[lvl]["enrolled"] += r.enrollment_total
            level_data[lvl]["sections"] += 1

    fill_by_level: list = []
    for lvl in sorted(level_data.keys()):
        d = level_data[lvl]
        capacity = d["sections"] * FULL_SECTION_SIZE
        rate = round(d["enrolled"] / capacity, 3) if capacity else 0
        fill_by_level.append({
            "level": lvl,
            "fill_rate": rate,
            "enrolled": d["enrolled"],
            "sections": d["sections"],
        })

    # ---- Courses needing attention ----
    courses_needing_attention = []
    # Group same-semester records by course
    course_sem_data: dict = defaultdict(list)
    for r in same_sem_records:
        course_sem_data[r.course_id].append(r)

    for cid, crs_records in course_sem_data.items():
        crs = course_map.get(cid)
        if not crs:
            continue

        # Group by academic year
        by_year: dict = defaultdict(lambda: {"enrolled": 0, "cap": 0})
        for r in crs_records:
            by_year[r.academic_year]["enrolled"] += r.enrollment_total
            by_year[r.academic_year]["cap"] += r.enrollment_cap

        flags = []
        enrollments = []
        for ay in sorted(by_year.keys()):
            e = by_year[ay]["enrolled"]
            c = by_year[ay]["cap"]
            enrollments.append(e)
            if c > 0 and e / c > 1.0:
                flags.append("over_capacity")
            if e < 5:
                flags.append("cancel_risk")

        # Coefficient of variation
        if len(enrollments) >= 2:
            mean_e = sum(enrollments) / len(enrollments)
            if mean_e > 0:
                variance = sum((x - mean_e) ** 2 for x in enrollments) / len(enrollments)
                cv = math.sqrt(variance) / mean_e
                if cv > 0.3:
                    flags.append("high_volatility")

        if flags:
            courses_needing_attention.append({
                "course_id": cid,
                "department_code": crs.department_code,
                "course_number": crs.course_number,
                "title": crs.title,
                "flags": list(set(flags)),
            })

    return {
        "avg_annual_headcount": avg_annual_headcount,
        "avg_annual_sch": avg_annual_sch,
        "sch_per_fte": sch_per_fte,
        "avg_annual_fte": avg_annual_fte,
        "num_years": num_years,
        "total_enrolled": latest_enrolled,
        "total_seats": latest_seats,
        "fill_rate": fill_rate,
        "total_sch": latest_sch,
        "yoy_enrolled_change": yoy_enrolled_change,
        "fill_by_level": fill_by_level,
        "courses_needing_attention": courses_needing_attention,
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
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    course_ids = _get_term_course_ids(db, term_id)
    if course_id is not None:
        course_ids = course_ids & {course_id}
    if not course_ids:
        return {"modalities": [], "modality_names": []}

    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    # Group by modality for fill rate comparison
    modality_data: dict = defaultdict(lambda: {"enrolled": 0, "cap": 0, "count": 0})
    year_modality: dict = defaultdict(lambda: defaultdict(int))
    all_modalities: set = set()
    for r in records:
        mode = r.modality or "Unknown"
        year_modality[r.academic_year][mode] += r.enrollment_total
        all_modalities.add(mode)
        modality_data[mode]["enrolled"] += r.enrollment_total
        modality_data[mode]["cap"] += r.enrollment_cap
        modality_data[mode]["count"] += 1

    modality_names = sorted(all_modalities)
    result = []
    for ay in sorted(year_modality.keys()):
        row: dict = {"academic_year": ay}
        for m in modality_names:
            row[m] = year_modality[ay].get(m, 0)
        result.append(row)

    # Add fill rate summary by modality
    modality_fill = []
    for mode in modality_names:
        d = modality_data[mode]
        fill = round(d["enrolled"] / d["cap"], 3) if d["cap"] > 0 else 0
        modality_fill.append({
            "modality": mode,
            "fill_rate": fill,
            "enrolled": d["enrolled"],
            "capacity": d["cap"],
            "sections": d["count"],
        })

    return {
        "modalities": result,
        "modality_names": modality_names,
        "modality_fill": modality_fill,
    }


# ---------------------------------------------------------------------------
# GET /analytics/yoy-changes
# ---------------------------------------------------------------------------
@router.get("/analytics/yoy-changes")
def yoy_changes(
    term_id: int = Query(...),
    limit: int = Query(5),
    db: Session = Depends(get_db),
):
    """Compare most recent same-semester enrollment with prior year."""
    target_semester = _get_term_semester(db, term_id)
    course_ids = _get_term_course_ids(db, term_id)
    if not course_ids:
        return {"top_growers": [], "top_decliners": []}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    records = (
        db.query(EnrollmentRecord)
        .filter(
            EnrollmentRecord.course_id.in_(course_ids),
            EnrollmentRecord.semester == target_semester,
        )
        .all()
    )

    # Group by course and year
    by_course_year: dict = defaultdict(lambda: defaultdict(int))
    for r in records:
        by_course_year[r.course_id][r.academic_year] += r.enrollment_total

    changes = []
    for cid, year_data in by_course_year.items():
        crs = course_map.get(cid)
        if not crs:
            continue
        years = sorted(year_data.keys())
        if len(years) < 2:
            continue
        current = year_data[years[-1]]
        previous = year_data[years[-2]]
        if previous == 0:
            continue
        yoy_pct = round((current - previous) / previous * 100, 1)
        changes.append({
            "course_id": cid,
            "label": f"{crs.department_code} {crs.course_number}",
            "yoy_pct": yoy_pct,
            "current": current,
            "previous": previous,
        })

    changes.sort(key=lambda x: x["yoy_pct"], reverse=True)

    top_growers = changes[:limit]
    top_decliners = list(reversed(changes[-limit:])) if len(changes) >= limit else list(reversed(changes))
    # Remove overlap: decliners should have negative yoy_pct
    top_decliners = [c for c in top_decliners if c["yoy_pct"] < 0]

    return {"top_growers": top_growers, "top_decliners": top_decliners}


# ---------------------------------------------------------------------------
# GET /analytics/course-fill-heatmap
# ---------------------------------------------------------------------------
@router.get("/analytics/course-fill-heatmap")
def course_fill_heatmap(
    term_id: int = Query(...),
    department: Optional[str] = Query(None),
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return a course x term grid of fill rates."""
    course_ids = _get_term_course_ids(db, term_id)
    course_ids = _apply_course_filters(course_ids, department, level, db)
    if not course_ids:
        return {"courses": [], "terms": [], "cells": []}

    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_map = {c.id: c for c in courses}

    records = (
        db.query(EnrollmentRecord)
        .filter(EnrollmentRecord.course_id.in_(course_ids))
        .all()
    )

    # Group by (course_id, academic_year, semester)
    grouped: dict = defaultdict(lambda: {"enrolled": 0, "cap": 0})
    all_terms: set = set()
    for r in records:
        key = (r.course_id, r.academic_year, r.semester)
        grouped[key]["enrolled"] += r.enrollment_total
        grouped[key]["cap"] += r.enrollment_cap
        all_terms.add((r.academic_year, r.semester))

    terms_list = sorted(all_terms)
    courses_list = []
    for cid in sorted(course_ids):
        crs = course_map.get(cid)
        if crs:
            courses_list.append({
                "course_id": cid,
                "label": f"{crs.department_code} {crs.course_number}",
            })

    cells = []
    for (cid, ay, sem), data in grouped.items():
        fill_rate = round(data["enrolled"] / data["cap"], 3) if data["cap"] > 0 else 0
        cells.append({
            "course_id": cid,
            "academic_year": ay,
            "semester": sem,
            "fill_rate": fill_rate,
            "enrolled": data["enrolled"],
            "capacity": data["cap"],
        })

    return {
        "courses": courses_list,
        "terms": [{"academic_year": ay, "semester": sem} for ay, sem in terms_list],
        "cells": cells,
    }


# ---------------------------------------------------------------------------
# GET /analytics/room-pressure
# ---------------------------------------------------------------------------
@router.get("/analytics/room-pressure")
def room_pressure(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Query live Meeting/Room/TimeBlock data to show room utilization by time block."""
    from app.models.meeting import Meeting
    from app.models.room import Room
    from app.models.time_block import TimeBlock

    # Get all rooms
    total_rooms = db.query(Room).count()
    if total_rooms == 0:
        return {"time_blocks": []}

    # Get all time blocks
    time_blocks = db.query(TimeBlock).all()
    if not time_blocks:
        return {"time_blocks": []}

    # Get all meetings for sections in this term that have a room and time block
    meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(
            Section.term_id == term_id,
            Meeting.room_id.isnot(None),
            Meeting.time_block_id.isnot(None),
        )
        .all()
    )

    # Count rooms in use per time block
    tb_rooms: dict = defaultdict(set)
    for m in meetings:
        tb_rooms[m.time_block_id].add(m.room_id)

    result = []
    for tb in time_blocks:
        rooms_in_use = len(tb_rooms.get(tb.id, set()))
        utilization = round(rooms_in_use / total_rooms, 3) if total_rooms > 0 else 0
        result.append({
            "time_block_id": tb.id,
            "label": tb.label,
            "pattern": tb.pattern.value if hasattr(tb.pattern, "value") else str(tb.pattern),
            "total_rooms": total_rooms,
            "rooms_in_use": rooms_in_use,
            "utilization": utilization,
        })

    # Sort by utilization descending
    result.sort(key=lambda x: -x["utilization"])

    return {"time_blocks": result}


# ---------------------------------------------------------------------------
# GET /analytics/missing-courses
# ---------------------------------------------------------------------------
@router.get("/analytics/missing-courses")
def missing_courses(
    term_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Return courses that have historical enrollment for the same semester
    type but are NOT in the current term's sections."""
    from app.models.term import Term

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        return {"courses": []}

    sem_map = {"fall": "Fall", "spring": "Spring", "summer": "Summer", "winter": "Winter"}
    target_semester = sem_map.get(term.type, "Fall")

    current_ids = _get_term_course_ids(db, term_id)

    hist_records = (
        db.query(EnrollmentRecord.course_id)
        .filter(
            EnrollmentRecord.semester == target_semester,
            EnrollmentRecord.course_id.isnot(None),
        )
        .distinct()
        .all()
    )
    hist_ids = {row[0] for row in hist_records} - current_ids
    if not hist_ids:
        return {"courses": []}

    courses = db.query(Course).filter(Course.id.in_(hist_ids)).all()

    result = []
    for c in sorted(courses, key=lambda x: (x.department_code, x.course_number)):
        appearances = (
            db.query(EnrollmentRecord.academic_year)
            .filter(
                EnrollmentRecord.course_id == c.id,
                EnrollmentRecord.semester == target_semester,
            )
            .distinct()
            .count()
        )
        result.append({
            "course_id": c.id,
            "department_code": c.department_code,
            "course_number": c.course_number,
            "title": c.title,
            "credits": c.credits,
            "times_offered": appearances,
        })

    return {"courses": result}


# ---------------------------------------------------------------------------
# GET /analytics/course-rotation
# ---------------------------------------------------------------------------
SEM_ORDER = {"Fall": 0, "Spring": 1, "Summer": 2, "Winter": 3}


@router.get("/analytics/course-rotation")
def course_rotation(
    department: Optional[str] = Query(None),
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Multi-year grid showing which courses are offered which terms.
    Combines data from scheduled sections (current terms) and historical
    enrollment records.
    """
    # 1. Build the column list from both terms and enrollment records
    terms = db.query(Term).order_by(Term.start_date).all()
    term_lookup: dict[str, int] = {}  # "2024-25:Fall" -> term_id
    sem_map = {"fall": "Fall", "spring": "Spring", "summer": "Summer", "winter": "Winter"}
    for t in terms:
        semester = sem_map.get(t.type, "Fall")
        ay_label = t.academic_year.label if t.academic_year else None
        if ay_label:
            term_lookup[f"{ay_label}:{semester}"] = t.id

    columns_set: set[tuple[str, str]] = set()

    er_columns = (
        db.query(EnrollmentRecord.academic_year, EnrollmentRecord.semester)
        .distinct()
        .all()
    )
    for ay, sem in er_columns:
        if ay and sem:
            columns_set.add((ay, sem))

    for t in terms:
        if t.academic_year:
            columns_set.add((t.academic_year.label, sem_map.get(t.type, "Fall")))

    sorted_columns = sorted(
        columns_set,
        key=lambda x: (x[0], SEM_ORDER.get(x[1], 9)),
    )
    column_list = [
        {
            "academic_year": ay,
            "semester": sem,
            "term_id": term_lookup.get(f"{ay}:{sem}"),
        }
        for ay, sem in sorted_columns
    ]

    # 2. Get all courses (filtered)
    course_query = db.query(Course)
    if department:
        course_query = course_query.filter(Course.department_code == department)
    courses = course_query.order_by(Course.department_code, Course.course_number).all()

    if level is not None:
        courses = [
            c for c in courses
            if _course_level(c.course_number) == level
        ]

    # 3. Build grid from scheduled sections
    grid: dict[str, dict] = {}  # "course_id:ay:sem" -> cell

    section_rows = (
        db.query(
            Section.course_id,
            Section.term_id,
            func.count(Section.id).label("num_sections"),
            func.sum(Section.enrollment_cap).label("total_cap"),
        )
        .group_by(Section.course_id, Section.term_id)
        .all()
    )

    term_to_col: dict[int, tuple[str, str]] = {}
    for t in terms:
        if t.academic_year:
            term_to_col[t.id] = (t.academic_year.label, sem_map.get(t.type, "Fall"))

    for row in section_rows:
        col = term_to_col.get(row.term_id)
        if not col:
            continue
        key = f"{row.course_id}:{col[0]}:{col[1]}"
        grid[key] = {
            "offered": True,
            "num_sections": row.num_sections,
            "total_enrollment": row.total_cap,
            "source": "scheduled",
        }

    # 4. Fill in historical enrollment data
    er_data = (
        db.query(
            EnrollmentRecord.course_id,
            EnrollmentRecord.academic_year,
            EnrollmentRecord.semester,
            func.count(EnrollmentRecord.id).label("num_sections"),
            func.sum(EnrollmentRecord.enrollment_total).label("total_enrolled"),
        )
        .filter(EnrollmentRecord.course_id.isnot(None))
        .group_by(
            EnrollmentRecord.course_id,
            EnrollmentRecord.academic_year,
            EnrollmentRecord.semester,
        )
        .all()
    )
    for row in er_data:
        key = f"{row.course_id}:{row.academic_year}:{row.semester}"
        if key not in grid:
            grid[key] = {
                "offered": True,
                "num_sections": row.num_sections,
                "total_enrollment": row.total_enrolled or 0,
                "source": "historical",
            }

    # 5. Detect gaps: courses not offered for 2+ consecutive same-semester slots
    gaps: list[dict] = []
    for sem in ["Fall", "Spring"]:
        sem_columns = [col for col in sorted_columns if col[1] == sem]
        if len(sem_columns) < 2:
            continue
        for c in courses:
            consecutive_missing = 0
            for ay, s in sem_columns:
                key = f"{c.id}:{ay}:{s}"
                if key in grid:
                    consecutive_missing = 0
                else:
                    consecutive_missing += 1
                    if consecutive_missing >= 2:
                        gaps.append({
                            "course_id": c.id,
                            "department_code": c.department_code,
                            "course_number": c.course_number,
                            "semester": sem,
                            "last_missing_year": ay,
                            "consecutive_terms": consecutive_missing,
                        })

    # 6. Build response
    course_list = [
        {
            "id": c.id,
            "department_code": c.department_code,
            "course_number": c.course_number,
            "title": c.title,
            "credits": c.credits,
        }
        for c in courses
    ]

    return {
        "courses": course_list,
        "columns": column_list,
        "grid": grid,
        "gaps": gaps,
    }


def _course_level(course_number: str) -> int:
    """Extract the hundred-level from a course number (e.g., '256' -> 200)."""
    try:
        return int(course_number[0]) * 100
    except (ValueError, IndexError):
        return 0
