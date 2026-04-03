# ICS Calendar Export for Instructor Schedules

## Purpose

Allow department chairs to generate ICS calendar files for instructors' teaching schedules. When an instructor opens the file in Outlook, they see recurring calendar events for each of their classes — one event per meeting pattern, repeating weekly through the term.

## Scope

- Backend endpoint to generate `.ics` files per instructor per term
- Frontend UI buttons in the existing Email Schedules dialog
- Only sections with scheduled meeting times (in_person, hybrid, online_sync) — skip online_async

## Backend

### New Endpoint

`GET /terms/{term_id}/export/ics/{instructor_id}`

Returns `Content-Type: text/calendar` with `Content-Disposition: attachment; filename="{name}-schedule.ics"`.

### ICS Event Structure

Each meeting for the instructor in the term becomes one recurring VEVENT:

| ICS Field | Value | Source |
|-----------|-------|--------|
| SUMMARY | `MATH 101-01 Introduction to Mathematics` | Course dept_code, number, section_number, title |
| LOCATION | `SCI 101 (Science Building)` | Room.room_number + Building.abbreviation/name |
| DTSTART | First matching weekday of the term at meeting start_time | Term.start_date + Meeting.days_of_week + Meeting.start_time |
| DTEND | Same day at meeting end_time | Same day + Meeting.end_time |
| RRULE | `FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=<term_end>` | Meeting.days_of_week mapped + Term.end_date |
| DESCRIPTION | `Section 01 \| In Person \| Cap: 30 \| 3 credits` | Section/course metadata |
| UID | `meeting-{meeting_id}@coursescheduler` | Stable unique ID for Outlook dedup |

### Day Code Mapping

App day codes to RRULE BYDAY values:

| App | RRULE |
|-----|-------|
| M | MO |
| T | TU |
| W | WE |
| Th | TH |
| F | FR |
| S | SA |
| U | SU |

### First Occurrence Calculation

DTSTART must be the actual first class day, not just Term.start_date (which may be a Monday when the class meets TTh). Logic:

1. Parse `Term.start_date` 
2. For each day in `Meeting.days_of_week`, find the next occurrence on or after start_date
3. Use the earliest matching day as DTSTART

### Timezone

All events use `America/Chicago` (UWRF is in Central Time). The VCALENDAR includes a VTIMEZONE component for CDT/CST, and DTSTART/DTEND use `TZID=America/Chicago`.

### Filtering

- Only meetings where the instructor is assigned (via Meeting.instructor_id)
- Only sections with modality in: `in_person`, `hybrid`, `online_sync`
- Only meetings with non-null start_time and end_time

### New Dependency

`icalendar` Python library — add to `requirements.txt`, `pyproject.toml`, and PyInstaller hidden imports in `course_scheduler.spec`.

### File Location

New service function in `backend/app/services/ics_export.py`. Route added to `backend/app/api/routes/export_html.py` (where the existing `/terms/{term_id}/export/instructor-schedules` endpoint lives).

## Frontend

### Existing Dialog

`frontend/src/components/schedule/InstructorScheduleDialog.tsx` — the Email Schedules dialog that already lists instructors with Copy/Email buttons.

### Per-Instructor ICS Download

Add a calendar icon button (CalendarDays from lucide-react) next to each instructor's existing Copy and Email buttons. On click:

1. Fetch `GET /terms/{termId}/export/ics/{instructorId}` as a blob
2. Trigger browser download as `{LastName}-{FirstName}-schedule.ics`

### Bulk Download

Add "Download All Calendars" button in the bulk actions area (alongside Copy All, Email All). Downloads one `.ics` file per selected instructor. Each file downloads separately.

### Email Limitation

The existing email flow uses `mailto:` links, which cannot attach files. The ICS download is a separate action. The user downloads the .ics, then attaches it manually if emailing. No changes to the existing email flow.

## Testing

- Backend: pytest for ICS generation — verify RRULE day mapping, first-occurrence calculation, timezone encoding, and that the output parses as valid ICS
- Frontend: TypeScript type check
- Manual: download .ics, open in Outlook, verify recurring events appear on correct days/times with location
