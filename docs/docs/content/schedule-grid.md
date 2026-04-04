# Schedule Grid

This reference covers the Schedule Grid's view modes, drag-and-drop, filters, conflict sidebar, and export options. For a hands-on walkthrough of building a schedule, see [Building a Schedule on the Grid](?page=tutorial-build-schedule).

The Schedule Grid is the main workspace for viewing and managing your course schedule. It displays meetings in a visual Monday-Friday grid organized by time blocks.

## Getting There

Navigate to **Schedule Grid** in the app sidebar.

## Key Concepts

- **Meeting** — A specific time/room/instructor assignment for a section
- **Time Block** — A standard time slot (MWF 50-min, TTh 75-min, or Evening 170-min)
- **View Mode** — How meetings are grouped: by Room, Instructor, or Course Level

## View Modes

Switch between three views using the tabs at the top of the grid:

| View | Groups By | Best For |
|------|-----------|----------|
| **By Room** | Room (columns) | Spotting room double-bookings, seeing room utilization |
| **By Instructor** | Instructor (columns) | Checking instructor workloads and conflicts |
| **By Level** | Course level: 100, 200, 300, 400, 600, 700 (columns) | Ensuring level distribution across time slots |

Each view uses a different color scheme so you can tell them apart at a glance. The color legend appears above the grid, between the filter bar and the grid itself.

## Drag and Drop

Select and hold any meeting card on the grid, then drag it to a new time slot to reschedule:

1. Grab the meeting card
2. Drag to the desired day/time row
3. Drop to reassign — the system automatically checks for conflicts
4. If a conflict is created, it appears in the Conflict Sidebar

Use **Undo** (Ctrl+Z / Cmd+Z) to reverse any drag-and-drop action.

## Multi-Select Filters

Four filter dropdowns let you focus the grid on specific subsets:

- **Department** — Show only courses from selected departments
- **Rooms** — Show only selected rooms
- **Instructors** — Show only selected instructors
- **Course Level** — Show only selected levels (100, 200, 300, 400+)

Filters work with AND logic across categories (e.g., "CS department" AND "Room NH 301") and OR logic within a category (e.g., "NH 301" OR "NH 302").

## Conflict Sidebar

Toggle the conflict sidebar using the **Conflicts** button (with badge count) in the filter bar. The sidebar shows:

- **Hard Conflicts** — Red indicators for issues that block finalization
- **Soft Warnings** — Yellow indicators for advisory issues

Select any conflict to see details. Choose **dismiss** on soft warnings you've reviewed and accepted.

## Export Options

The **Export** dropdown in the header provides:

| Option | What It Does |
|--------|-------------|
| Download XLSX | Downloads the schedule as a spreadsheet |
| Download HTML | Downloads a printable HTML page |
| Save to Local Directory | Saves HTML to the directory configured in Settings |
| Push to GitHub Pages | Publishes HTML to your GitHub Pages site with a shareable link |
| Print — By Room | Opens a printable schedule grouped by room in a new tab |
| Print — By Instructor | Opens a printable schedule grouped by instructor in a new tab |
| Print — Master Grid | Opens a printable master grid (rooms as rows, times as columns) in a new tab |

## Online / Async Sections

Below the grid, a separate table shows **Online Asynchronous** sections that don't have physical meeting times, along with their current status.

## Adding a Meeting

Select the **+ Add Meeting** button to open the Meeting Dialog. Select a section, time block (or custom time), room, and instructor. The system validates for conflicts before saving.

## Tips

> **Tip:** In the meeting detail popup, select **Edit** to change any field, or **Delete** to remove the meeting entirely.

> **Tip:** Use the **Compare Schedule** button to see a side-by-side diff between this term and a previous term.

## Email Schedules & Calendar Export

The **Email Schedules** button opens a dialog for sending instructor schedules and downloading calendar files.

1. Select instructors from the list on the left (use **Select All** or check individually)
2. Choose an instructor name to preview their schedule in the right panel
3. Per-instructor actions appear next to each selected instructor:
   - **Copy** — Copy the schedule text to clipboard
   - **Email** — Open an email draft with the schedule in the body and download the instructor's .ics calendar file
   - **Calendar** — Download the instructor's .ics calendar file only
4. Bulk actions at the bottom:
   - **Copy All Selected** — Copy all selected schedules to clipboard
   - **Download All Selected Calendars** — Download a ZIP file containing individual .ics files for each selected instructor
   - **Email All Selected** — Open an email to all selected instructors and download the ZIP of calendar files

### ICS Calendar Files

The .ics files are compatible with Microsoft Outlook, Apple Calendar, and Google Calendar. Each file contains recurring weekly events for the instructor's classes with:
- Course name and section number
- Room and building location
- Meeting days and times
- Recurrence through the end of the term

> **Tip:** When you click Email, the .ics file downloads automatically alongside the email draft. Attach the downloaded .ics file to the email before sending.
