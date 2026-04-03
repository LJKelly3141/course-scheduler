# Import & Export

The Import page supports five types of data import from XLSX and CSV files. The Schedule Grid provides four export options. All imports include a preview step so you can review and edit data before committing.

## Getting There

Click **Import / Export** in the sidebar for imports. For exports, use the **Export** dropdown on the Schedule Grid page.

## Import Types

### 1. Rooms

Upload a building and room catalog.

**Expected columns:**
- `building_name` — Full building name (e.g., "North Hall")
- `building_abbreviation` — Short code (e.g., "NH")
- `room_number` — Room identifier (e.g., "301")
- `capacity` — Maximum student capacity

Columns are auto-detected by header name. You can adjust the mapping if needed.

### 2. Instructors

Upload a faculty roster.

**Expected columns:**
- `name` — Full name
- `email` — Email address
- `department` — Department code
- `modality_constraint` — "any", "in_person_only", or "online_only"
- `max_credits` — Maximum teaching credits per term

### 3. Courses

Upload a course catalog.

**Expected columns:**
- `department_code` — Department code (e.g., "CS")
- `course_number` — Course number (e.g., "252")
- `title` — Course title
- `credits` — Credit hours

### 4. Schedule

Upload a registrar or department schedule export. This is the most powerful import type with intelligent parsing.

**Features:**
- **Column Mapping** — Map your spreadsheet columns to the expected fields (course, section, days, times, room, instructor, etc.)
- **Day Code Parsing** — Automatically parses day patterns like "MWF", "TTh", "MW" into the correct day codes
- **Time Parsing** — Handles various time formats (12-hour, 24-hour)
- **Instructor Matching** — Fuzzy matching against existing instructors with confidence scores. You can review matches, link to different instructors, or create new instructor records
- **Modality Detection** — Identifies online and asynchronous sections automatically
- **Session Detection** — Parses session codes from section numbers for summer terms

**Workflow:**
1. Upload your XLSX/CSV file
2. Review the column mapping — adjust any incorrect mappings
3. Preview the parsed data — edit rows, fix errors, remove unwanted rows
4. Review instructor matches — confirm, change, or create new instructors
5. Select the target term (existing or create new)
6. Click **Import** to commit

### 5. Enrollment History

Upload multi-year enrollment data for analytics.

**Format:** XLSX with one sheet per academic year (e.g., "AY25", "AY24")

**Expected columns per sheet:**
- `Class Program Code` — Department code
- `Catalog Nbr` — Course number
- `Class Section` — Section number
- `Class Type` — Lecture, Lab, etc.
- `Enrollment Total` — Actual enrollment
- `Enrollment Max Cap` — Maximum capacity
- `Meeting Pattern` — Day codes (e.g., "MWF")
- `Meeting Time Start` / `Meeting Time End` — Time range
- `Instructor Name` — Instructor

This data powers the Analytics page's trend analysis and enrollment forecasts.

## Preview Workflow

All imports follow the same pattern:

1. **Upload** — Select your XLSX or CSV file
2. **Preview** — See the parsed data in a table with validation errors highlighted
3. **Edit** — Fix errors inline, add rows, remove rows
4. **Commit** — Click Import to save to the database

The system validates data before importing and highlights issues like missing required fields, duplicate entries, or unrecognized values.

## Export Options

On the **Schedule Grid** page, the Export dropdown provides:

| Option | Description |
|--------|-------------|
| **Download XLSX** | Downloads the schedule as an Excel spreadsheet |
| **Download HTML** | Downloads a printable HTML page with your department name in the header |
| **Save to Local Directory** | Saves the HTML file to the export directory configured in Settings |
| **Push to GitHub Pages** | Publishes the HTML to your GitHub Pages site and provides a shareable URL |
| **Print — By Room** | Opens a printable schedule grouped by room in a new browser tab |
| **Print — By Instructor** | Opens a printable schedule grouped by instructor in a new browser tab |
| **Print — Master Grid** | Opens a master grid view (rooms as rows, time blocks as columns) in a new tab |

## Calendar Export (ICS)

The **Email Schedules** button on the Schedule Grid page provides calendar export alongside the email feature:

- **Per-instructor download** — Click the calendar icon next to any selected instructor to download their .ics file
- **Bulk download** — Click **Download All Selected Calendars** to get a ZIP file containing individual .ics files for each selected instructor
- **Email + calendar** — The Email button automatically downloads the .ics file alongside opening the email draft

ICS files contain recurring weekly events compatible with Microsoft Outlook, Apple Calendar, and Google Calendar. Events include course name, section, room/building location, and meeting times with weekly recurrence through the term end date.

## Tips

> **Tip:** Import in this order: Rooms → Instructors → Courses → Schedule. The schedule import needs rooms, instructors, and courses to already exist for matching.

> **Tip:** The schedule import's preview mode (`preview=true`) validates without saving. Use this to check your data before committing.

> **Tip:** For summer terms with multiple sessions, use the **Paste Sessions** feature on the Terms page to add or replace session data via Merge or Replace modes.
