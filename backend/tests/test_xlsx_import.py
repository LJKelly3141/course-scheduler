from __future__ import annotations

from datetime import time
from types import SimpleNamespace

from datetime import date

from app.services.xlsx_schedule_parser import (
    parse_days,
    parse_time,
    parse_days_and_times,
    parse_course,
    parse_section,
    parse_room,
    detect_modality,
    match_time_block,
    parse_xlsx_row,
    parse_meeting_dates,
    suggest_term_from_dates,
    find_instructor_matches,
)


# ---------------------------------------------------------------------------
# parse_days
# ---------------------------------------------------------------------------
def test_parse_days_mwf():
    assert parse_days("MoWeFr") == ["M", "W", "F"]


def test_parse_days_tth():
    assert parse_days("TuTh") == ["T", "Th"]


def test_parse_days_single():
    assert parse_days("Mo") == ["M"]


def test_parse_days_all_weekdays():
    assert parse_days("MoTuWeThFr") == ["M", "T", "W", "Th", "F"]


# ---------------------------------------------------------------------------
# parse_time
# ---------------------------------------------------------------------------
def test_parse_time_am():
    assert parse_time("9:00AM") == time(9, 0)


def test_parse_time_pm():
    assert parse_time("1:50PM") == time(13, 50)


def test_parse_time_12pm():
    assert parse_time("12:00PM") == time(12, 0)


def test_parse_time_12am():
    assert parse_time("12:00AM") == time(0, 0)


def test_parse_time_with_space():
    assert parse_time(" 9:30AM ") == time(9, 30)


# ---------------------------------------------------------------------------
# parse_days_and_times
# ---------------------------------------------------------------------------
def test_parse_days_and_times_mwf():
    days, start, end = parse_days_and_times("MoWeFr 9:00AM - 9:50AM")
    assert days == ["M", "W", "F"]
    assert start == time(9, 0)
    assert end == time(9, 50)


def test_parse_days_and_times_tth():
    days, start, end = parse_days_and_times("TuTh 9:30AM - 10:45AM")
    assert days == ["T", "Th"]
    assert start == time(9, 30)
    assert end == time(10, 45)


def test_parse_days_and_times_pm():
    days, start, end = parse_days_and_times("MoWeFr 1:00PM - 1:50PM")
    assert days == ["M", "W", "F"]
    assert start == time(13, 0)
    assert end == time(13, 50)


def test_parse_days_and_times_tba():
    days, start, end = parse_days_and_times("TBA")
    assert days is None
    assert start is None
    assert end is None


def test_parse_days_and_times_empty():
    days, start, end = parse_days_and_times("")
    assert days is None
    assert start is None
    assert end is None


# ---------------------------------------------------------------------------
# parse_course
# ---------------------------------------------------------------------------
def test_parse_course_standard():
    dept, num, title = parse_course("ECON 201 - Principles of Microeconomics")
    assert dept == "ECON"
    assert num == "201"
    assert title == "Principles of Microeconomics"


def test_parse_course_long_title():
    dept, num, title = parse_course("ECON 745 - Legal and Ethical Issues in Healthcare Data")
    assert dept == "ECON"
    assert num == "745"
    assert title == "Legal and Ethical Issues in Healthcare Data"


def test_parse_course_short():
    dept, num, title = parse_course("ECON 100 - Modern Economics")
    assert dept == "ECON"
    assert num == "100"
    assert title == "Modern Economics"


# ---------------------------------------------------------------------------
# parse_section
# ---------------------------------------------------------------------------
def test_parse_section_regular():
    assert parse_section("01-LEC Regular") == "01"


def test_parse_section_session():
    assert parse_section("90-LEC Session A") == "90"


def test_parse_section_field():
    assert parse_section("01-FLD Regular") == "01"


def test_parse_section_independent():
    assert parse_section("01-IND Regular") == "01"


# ---------------------------------------------------------------------------
# parse_room
# ---------------------------------------------------------------------------
def test_parse_room_standard():
    building, room = parse_room("South Hall 224")
    assert building == "South Hall"
    assert room == "224"


def test_parse_room_single_word_building():
    building, room = parse_room("Library 101")
    assert building == "Library"
    assert room == "101"


def test_parse_room_tba():
    building, room = parse_room("TBA")
    assert building is None
    assert room is None


def test_parse_room_online():
    building, room = parse_room("On-Line")
    assert building is None
    assert room is None


def test_parse_room_empty():
    building, room = parse_room("")
    assert building is None
    assert room is None


# ---------------------------------------------------------------------------
# detect_modality
# ---------------------------------------------------------------------------
def test_detect_modality_online():
    assert detect_modality("On-Line") == "online"


def test_detect_modality_room():
    assert detect_modality("South Hall 224") == "in_person"


def test_detect_modality_tba():
    assert detect_modality("TBA") == "in_person"


# ---------------------------------------------------------------------------
# match_time_block
# ---------------------------------------------------------------------------
def _make_tb(id, days_json, start, end):
    return SimpleNamespace(id=id, days_of_week=days_json, start_time=start, end_time=end)


def test_match_time_block_found():
    blocks = [
        _make_tb(1, '["M", "W", "F"]', time(9, 0), time(9, 50)),
        _make_tb(2, '["T", "Th"]', time(9, 30), time(10, 45)),
    ]
    assert match_time_block(["M", "W", "F"], time(9, 0), time(9, 50), blocks) == 1
    assert match_time_block(["T", "Th"], time(9, 30), time(10, 45), blocks) == 2


def test_match_time_block_not_found():
    blocks = [
        _make_tb(1, '["M", "W", "F"]', time(9, 0), time(9, 50)),
    ]
    assert match_time_block(["T", "Th"], time(14, 0), time(15, 15), blocks) is None


# ---------------------------------------------------------------------------
# parse_xlsx_row
# ---------------------------------------------------------------------------
def test_full_row_parse():
    row = {
        "Class": 1736,
        "Course": "ECON 201 - Principles of Microeconomics",
        "Section": "01-LEC Regular",
        "Days & Times": "MoWeFr 9:00AM - 9:50AM",
        "Room": "South Hall 224",
        "Instructor": "Christine Bretschneider-Fries",
    }
    parsed, errors = parse_xlsx_row(row, 2)
    assert errors == []
    assert parsed["crn"] == 1736
    assert parsed["department_code"] == "ECON"
    assert parsed["course_number"] == "201"
    assert parsed["title"] == "Principles of Microeconomics"
    assert parsed["section_number"] == "01"
    assert parsed["days"] == ["M", "W", "F"]
    assert parsed["start_time"] == "09:00:00"
    assert parsed["end_time"] == "09:50:00"
    assert parsed["building_name"] == "South Hall"
    assert parsed["room_number"] == "224"
    assert parsed["instructor_name"] == "Christine Bretschneider-Fries"
    assert parsed["modality"] == "in_person"


def test_tba_row_parse():
    row = {
        "Class": 1121,
        "Course": "ECON 201 - Principles of Microeconomics",
        "Section": "90-LEC Session A",
        "Days & Times": "TBA",
        "Room": "On-Line",
        "Instructor": "Lisa Breger",
    }
    parsed, errors = parse_xlsx_row(row, 3)
    assert errors == []
    assert parsed["days"] is None
    assert parsed["start_time"] is None
    assert parsed["end_time"] is None
    assert parsed["building_name"] is None
    assert parsed["room_number"] is None
    assert parsed["modality"] == "online"
    assert parsed["section_number"] == "90"


def test_missing_course_error():
    row = {
        "Class": 1,
        "Course": "",
        "Section": "01-LEC Regular",
        "Days & Times": "TBA",
        "Room": "TBA",
        "Instructor": "Someone",
    }
    parsed, errors = parse_xlsx_row(row, 4)
    assert parsed is None
    assert len(errors) > 0
    assert "Course" in errors[0]


# ---------------------------------------------------------------------------
# parse_meeting_dates
# ---------------------------------------------------------------------------
def test_parse_meeting_dates_standard():
    start, end = parse_meeting_dates("09/02/2026 - 12/15/2026")
    assert start == date(2026, 9, 2)
    assert end == date(2026, 12, 15)


def test_parse_meeting_dates_spring():
    start, end = parse_meeting_dates("01/20/2027 - 05/15/2027")
    assert start == date(2027, 1, 20)
    assert end == date(2027, 5, 15)


def test_parse_meeting_dates_empty():
    assert parse_meeting_dates("") == (None, None)


def test_parse_meeting_dates_invalid():
    assert parse_meeting_dates("not-a-date") == (None, None)


def test_parse_meeting_dates_single_date():
    assert parse_meeting_dates("09/02/2026") == (None, None)


# ---------------------------------------------------------------------------
# suggest_term_from_dates
# ---------------------------------------------------------------------------
def test_suggest_term_fall():
    rows = [
        {"_meeting_start": date(2026, 9, 2), "_meeting_end": date(2026, 12, 15)},
        {"_meeting_start": date(2026, 9, 2), "_meeting_end": date(2026, 12, 10)},
    ]
    result = suggest_term_from_dates(rows)
    assert result is not None
    assert result["name"] == "Fall 2026"
    assert result["type"] == "semester"
    assert result["start_date"] == "2026-09-02"
    assert result["end_date"] == "2026-12-15"


def test_suggest_term_spring():
    rows = [
        {"_meeting_start": date(2027, 1, 20), "_meeting_end": date(2027, 5, 15)},
    ]
    result = suggest_term_from_dates(rows)
    assert result is not None
    assert result["name"] == "Spring 2027"


def test_suggest_term_summer():
    rows = [
        {"_meeting_start": date(2026, 6, 1), "_meeting_end": date(2026, 7, 31)},
    ]
    result = suggest_term_from_dates(rows)
    assert result is not None
    assert result["name"] == "Summer 2026"


def test_suggest_term_no_dates():
    rows = [{"_meeting_start": None, "_meeting_end": None}]
    assert suggest_term_from_dates(rows) is None


def test_suggest_term_empty_rows():
    assert suggest_term_from_dates([]) is None


# ---------------------------------------------------------------------------
# find_instructor_matches
# ---------------------------------------------------------------------------
def _make_instructor(id, name, email):
    return SimpleNamespace(id=id, name=name, email=email)


def test_find_instructor_exact_match():
    instructors = [_make_instructor(1, "Alice Johnson", "alice@uwrf.edu")]
    results = find_instructor_matches(["Alice Johnson"], instructors)
    assert len(results) == 1
    assert results[0]["name"] == "Alice Johnson"
    assert len(results[0]["matches"]) == 1
    assert results[0]["matches"][0]["id"] == 1
    assert results[0]["matches"][0]["score"] == 1.0


def test_find_instructor_case_insensitive_exact():
    instructors = [_make_instructor(1, "Alice Johnson", "alice@uwrf.edu")]
    results = find_instructor_matches(["alice johnson"], instructors)
    assert results[0]["matches"][0]["score"] == 1.0


def test_find_instructor_fuzzy_match():
    instructors = [_make_instructor(1, "Christine Bretschneider", "christine@uwrf.edu")]
    results = find_instructor_matches(["Christine Bretschneider-Fries"], instructors)
    assert len(results[0]["matches"]) == 1
    assert results[0]["matches"][0]["score"] >= 0.7


def test_find_instructor_no_match():
    instructors = [_make_instructor(1, "Alice Johnson", "alice@uwrf.edu")]
    results = find_instructor_matches(["Totally Different Person"], instructors)
    assert len(results) == 1
    assert len(results[0]["matches"]) == 0


def test_find_instructor_multiple_candidates():
    instructors = [
        _make_instructor(1, "John Smith", "john.s@uwrf.edu"),
        _make_instructor(2, "John Smithson", "john.sm@uwrf.edu"),
    ]
    results = find_instructor_matches(["John Smith"], instructors)
    assert len(results[0]["matches"]) >= 1
    # Exact match should be first (score 1.0)
    assert results[0]["matches"][0]["score"] == 1.0
    assert results[0]["matches"][0]["id"] == 1
