from __future__ import annotations

from datetime import date, timedelta


def compute_session_end_date(session_start: date, duration_weeks: int) -> date:
    """Compute end date from session start and duration in weeks.

    Rule: end = session_start + (duration_weeks - 1) * 7 days,
    then advance to the next Friday (inclusive — if already Friday, stay).
    """
    raw_end = session_start + timedelta(days=(duration_weeks - 1) * 7)
    # weekday(): Monday=0 ... Friday=4 ... Sunday=6
    days_until_friday = (4 - raw_end.weekday()) % 7
    return raw_end + timedelta(days=days_until_friday)
