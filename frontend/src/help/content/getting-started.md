# Getting Started

Course Scheduler helps you build, validate, and publish course schedules for your department. This guide walks you through the typical workflow from start to finish.

## First-Time Setup

1. Open **Settings** from the sidebar
2. Set your **Department Name** — this appears on exported schedules
3. Set the **Academic Year Start Month** (default: July for a Jul 1 – Jun 30 year)
4. Optionally configure an **Export Directory** for saving schedule files locally
5. Optionally set up **GitHub Pages** for publishing schedules online

## Typical Workflow

### 1. Create a Term

Go to **Terms** and click **+ Add Term**. Enter the term name (e.g., "Fall 2026"), select the type (Fall, Spring, Summer, Winterim), and set start/end dates. The term starts in **Draft** mode so you can make changes freely.

For summer terms, expand the term row and add **sessions** (e.g., Session A, Session B) with their individual dates and head count information.

### 2. Import Your Data

Go to **Import / Export** and import your data in this order:

1. **Rooms** — Upload your building and room catalog (XLSX or CSV)
2. **Instructors** — Upload your faculty roster with email, department, and constraints
3. **Courses** — Upload your course catalog with department codes, numbers, titles, and credits
4. **Schedule** — Upload a registrar export to auto-create sections and meetings with intelligent column mapping and instructor matching
5. **Enrollment History** (optional) — Upload multi-year enrollment data for analytics

Each import shows a **preview** before committing. You can edit rows, fix errors, and review instructor matches before saving.

### 3. Review the Dashboard

The **Dashboard** shows an overview of your selected term:
- Summary cards (sections, credits, instructors, projected SCH, conflicts)
- A conflicts and warnings panel
- Courses that were historically offered but are missing from this term
- A course analytics table with enrollment projections

### 4. Build and Adjust the Schedule

On the **Schedule Grid**, view your schedule by Room, Instructor, or Course Level. You can:
- **Drag and drop** meetings to reschedule them
- Use **filters** to focus on specific departments, rooms, instructors, or levels
- Open the **Conflict Sidebar** to see and resolve issues
- Click any meeting card to view details or edit

On the **Courses** page, manage sections directly — add new sections, change modality, assign instructors, and set enrollment caps.

### 5. Resolve Conflicts

**Hard conflicts** (red) block term finalization — these must be resolved:
- Room double-bookings
- Instructor double-bookings
- Capacity violations

**Soft warnings** (yellow) are advisory — review and dismiss as appropriate:
- Credit overloads
- Room size mismatches
- Consecutive teaching blocks

### 6. Finalize and Export

Once all hard conflicts are resolved:
1. Go to **Terms** and click the **lock icon** to finalize the term
2. Go to **Schedule Grid** and use the **Export** dropdown:
   - **Download XLSX** — spreadsheet for further editing
   - **Download HTML** — printable static page
   - **Save to Local Directory** — writes to your configured export folder
   - **Push to GitHub Pages** — publishes online with a shareable link

## Quick Tips

> **Tip:** Use **Ctrl+Z / Cmd+Z** (or the undo button in the header) to undo any change. Redo with **Ctrl+Y / Cmd+Y**.

> **Tip:** Click the **theme toggle** in the sidebar footer to switch between light, dark, and system themes.

> **Tip:** The app auto-saves everything. There's no save button — changes are saved as you make them.
