# Instructors

This reference covers the faculty roster, availability grid, instructor detail pages, and load reports. For a hands-on walkthrough of managing instructor workloads, see [Tracking Instructor Workloads](?page=tutorial-workload).

The Instructors page manages your faculty roster, including contact information, teaching constraints, availability, and workload tracking.

## Getting There

Navigate to **Instructors** in the app sidebar. Select any instructor's **name** to open their detail page.

## Key Concepts

- **Instructor Type** — Faculty, IAS (Instructional Academic Staff), Adjunct, or NIAS (Non-Instructional Academic Staff)
- **Modality Constraint** — What an instructor can teach: Any, Online Only, MWF Only, or TTh Only
- **Max Credits** — Maximum teaching credit load per term
- **Availability** — A weekly grid showing when an instructor is available, unavailable, or prefers to avoid teaching

## Instructor Roster

### Add an Instructor

Select **+ Add Instructor** at the top. Fill in:
- **Name** — Full name
- **Email** — Email address
- **Department** — Department code
- **Type** — Faculty, IAS, Adjunct, or NIAS
- **Modality** — Any, Online Only, MWF Only, or TTh Only

### Edit an Instructor

The actions column provides **Detail**, **Availability**, and **Delete** links for each instructor. Select **Detail** or the instructor's **name** to open the full detail page.

### Active / Inactive

Active status is shown as "Yes" or "No" text on the roster. To change an instructor's active status, open their detail page and edit it on the Profile tab. Inactive instructors won't appear in assignment dropdowns.

### Batch Delete

Use the checkboxes to select multiple instructors, then click **Delete Selected** to remove them all at once.

### Sorting

Select any column header to sort the roster by that column.

### Search

Use the search bar to filter by name, email, or department.

## Availability Grid

Select the **Availability** link in the actions column to toggle the instructor's weekly availability grid (Monday–Friday, 7 AM – 8 PM).

Select any cell to cycle through states:
- **Green checkmark (Available)** — Can be scheduled at this time
- **Red X (Unavailable)** — Cannot teach at this time; scheduling here creates a hard conflict
- **Yellow triangle (Prefer Avoid)** — Can teach but prefers not to; scheduling here creates a soft warning

Changes save automatically.

## Instructor Detail Page

Select an instructor's **name** to open their detail page with three tabs:

### Profile Tab

- **Contact Information** — First name, last name, email, phone, office location
- **Employment Details** — Academic rank, tenure status, hire date, instructor type
- **Notes** — Categorized notes with optional term association

**Academic Ranks:** Professor, Associate Professor, Assistant Professor, Senior Lecturer, Lecturer, Adjunct Instructor

**Tenure Status:** Tenured, Tenure Track, Non-Tenure

### Schedule & Availability Tab

Shows the instructor's weekly meeting grid for the selected term — a visual display of all their assigned meetings.

### Workload Tab

Displays per-term workload information:
- Sections assigned with course details and credits
- Total credits for the term
- Load adjustments (reassigned time, release credits, etc.)
- Overload warnings when credits exceed the max

## Instructor Notes

On the Profile tab, the Notes section lets you record important information:

### Add a Note

Select **+ Add Note**. Fill in:
- **Category** — General, Availability, Preference, Performance, or Other
- **Term** — Optionally associate the note with a specific term
- **Content** — The note text

### Edit or Delete Notes

Each note has **edit** and **delete** buttons. Notes are sorted by creation date.

## Load Report

The **Load Report** button in the Instructors page toolbar downloads a faculty load report as an Excel file for the currently selected term. This matches the standard department format used for submitting workload documentation.

### Downloading

1. Select a **term** from the term selector in the header
2. Select **Load Report** in the toolbar (next to Add Instructor)
3. The file downloads automatically with a name like `faculty_load_Fall_2025.xlsx`

The same report is also available from **Analytics → Workload → Export to Excel**.

### Report Contents

The Excel file includes 15 columns:

| Column | Description |
|--------|-------------|
| Last Name / First Name | Instructor name |
| Status | Employment type (F, IAS, ADJ, NIAS) |
| Dept Code | Department |
| Course # / Section # | Course and section identifiers |
| Lec, Lab or Fld | Instruction type |
| Class Name | Course title |
| Enrollment | Enrollment cap |
| Actual Credits | Course credit hours |
| Equivalent Credits | Adjusted credits for load calculation |
| SCH | Student Credit Hours (enrollment × credits) |
| TOTAL LOAD for Semester | Sum of equivalent credits (formula) |
| Reassignment/Suggestion | Load adjustment description |
| Forms completed? | Empty — fill in manually after export |

Each instructor's courses are listed individually, followed by any load adjustments (reassigned time), then a **subtotal row** with SUM formulas. Instructors exceeding their max credits are highlighted in yellow. Unassigned sections appear at the bottom.

### Entering Reassigned Time

To get an accurate load report, you need to enter reassigned time for instructors who have non-teaching duties. For example, a faculty member with 12 max credits who has 3 credits reassigned to research, 3 to department chair duties, and 3 to committee work would show 3 teaching credits + 9 reassigned credits = 12 total load.

**To add reassigned time:**

1. Go to **Analytics → Workload** tab
2. Select an instructor's row to expand it
3. Select **+ Add Release / ADHOC** at the bottom of the expanded section
4. Fill in:
   - **Description** — What the reassignment is for (e.g., "Research Reassigned Time", "Department Chair", "Assessment Committee Chair")
   - **Type** — Choose the category: Research Release, Admin Release, Course Release, ADHOC, Overload, or Other
   - **Credits** — The number of equivalent credits (e.g., 3)
5. Select **Save**

Repeat for each reassignment. These entries appear in the load report under the instructor's courses with the description in the "Class Name" column and the type in the "Reassignment/Suggestion" column.

> **Common reassignment types:**
> - **Research Release** — Reassigned time for research activity
> - **Admin Release** — Department chair, program director, committee chair duties
> - **Course Release** — Bought-out credits (e.g., grant-funded release)
> - **Overload** — Credits beyond the normal max (increases total load)

You can also view and manage an individual instructor's load adjustments from their **Detail Page → Workload tab**.

## Tips

> **Tip:** Modality constraints are enforced — assigning an "Online Only" instructor to an in-person section creates a hard conflict.

> **Tip:** The workload tab is especially useful during schedule building to see who has room for more sections and who is at capacity.

> **Tip:** Enter all reassigned time before generating the load report so the totals reflect actual workload accurately.
