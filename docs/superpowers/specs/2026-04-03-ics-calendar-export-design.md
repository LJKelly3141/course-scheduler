# ICS Calendar Export for Instructor Schedules

## Purpose

Allow department chairs to generate ICS calendar files for instructors' teaching schedules. When an instructor opens the file in Outlook, they see recurring calendar events for each of their classes — one event per meeting pattern, repeating weekly through the term.

## Scope

- Backend endpoints to generate `.ics` files (single instructor or bulk)
- Frontend UI buttons in the existing Email Schedules dialog
- Only sections with scheduled meeting times (in_person, hybrid, online_sync) — skip online_async

## Backend

### Endpoints

**Single instructor:**
`GET /terms/{term_id}/export/ics/{instructor_id}`

Returns `Content-Type: text/calendar` with `Content-Disposition: attachment; filename="{name}-schedule.ics"`. One VCALENDAR with that instructor's meetings as VEVENTs.

**Bulk (multiple instructors):**
`GET /terms/{term_id}/export/ics?instructor_ids=1,2,3`

Returns a single `.ics` file containing VEVENTs for all requested instructors. This avoids the browser multi-download problem — one file, one fetch, all events import into Outlook at once.

### ICS Event Structure

Each meeting for an instructor in the term becomes one recurring VEVENT:

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

New service function in `backend/app/services/ics_export.py`. Routes added to `backend/app/api/routes/export_html.py` (where the existing `/terms/{term_id}/export/instructor-schedules` endpoint lives).

## Frontend

### Existing Dialog

`frontend/src/components/schedule/InstructorScheduleDialog.tsx` — the Email Schedules dialog with a two-column layout: instructor list (280px sidebar) with Copy/Email buttons, and a preview pane.

### Per-Instructor ICS Download

Add a `CalendarDays` icon button (from lucide-react, consistent with the rest of the app) next to each instructor's existing Copy and Email buttons. On click:

1. Set a per-button loading state (disable the button, show spinner or dimmed icon)
2. Fetch `GET /terms/{termId}/export/ics/{instructorId}` via `api.getRaw()` as a blob
3. Trigger browser download using the existing pattern from SchedulePage XLSX export: `URL.createObjectURL(blob)` → programmatic `<a>` click → `URL.revokeObjectURL()`
4. Filename: `{LastName}-{FirstName}-schedule.ics`
5. On error: show feedback message using the existing `copyFeedback` state pattern (e.g., "Download failed for {name}")

### Sidebar Layout Note

The existing per-instructor row already has 2 icon buttons (copy, email) in a tight 280px sidebar. Adding a third 14px icon button should fit, but verify during implementation. If too tight, either: (a) increase sidebar to 300px, or (b) put the calendar button on a second line below the name.

### Bulk Download

Add "Download All Calendars" button in the footer bulk actions area (alongside Copy All, Email All). On click:

1. Disable button, show loading text ("Downloading...")
2. Fetch `GET /terms/{termId}/export/ics?instructor_ids={selectedIds}` as a single blob
3. Download as `schedules-{termName}.ics`
4. On error: show feedback message

This is a single HTTP request returning one combined `.ics` file — not N separate downloads.

### Error Handling

All download actions use try/catch with feedback messages, following the same pattern as the existing `copyFeedback` state:
- Success: "Downloaded {name}'s calendar" (auto-dismiss after 2s)
- Error: "Download failed: {error message}" (auto-dismiss after 4s)

### Email Limitation

The existing email flow uses `mailto:` links, which cannot attach files. The ICS download is a separate action. The user downloads the .ics, then attaches it manually if emailing. No changes to the existing email flow.

## Testing

- Backend: pytest for ICS generation — verify RRULE day mapping, first-occurrence calculation, timezone encoding, and that the output parses as valid ICS
- Frontend: TypeScript type check
- Manual: download .ics, open in Outlook, verify recurring events appear on correct days/times with location
- Manual: bulk download for 3+ instructors, verify single file opens correctly in Outlook
