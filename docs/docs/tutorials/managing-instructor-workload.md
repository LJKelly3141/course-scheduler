# Managing Instructor Workload

Track teaching loads, add reassigned time for non-teaching duties, and generate the faculty load report your dean's office needs.

## Prerequisites

- At least one term with sections and instructor assignments (see [Building a Schedule](?page=tutorial-build-schedule))
- Instructors imported with their max credit limits set (see [Importing Schedule Data](?page=tutorial-import))

## Step 1: Review the Workload Dashboard

The Analytics Workload tab gives you a bird's-eye view of instructor loads across the term.

1. Click **Analytics** in the sidebar
2. Select the **Workload** tab
3. Review the KPI cards at the top:
   - **Total Instructors** -- Number of instructors with assignments this term
   - **Teaching Credits** -- Sum of all teaching credits assigned
   - **SCH** -- Total Student Credit Hours (enrollment x credits across all sections)
   - **Overloaded** -- Count of instructors whose total load exceeds their max credits

If the Overloaded count is greater than zero, you have work to do.

## Step 2: Examine Individual Instructor Loads

Below the KPI cards, the instructor table lists each instructor with their credit total and load status.

1. Find an instructor in the table (use the search or scroll)
2. Click their row to expand it
3. The expanded view shows:
   - Each assigned section with course name, section number, credits, and enrollment cap
   - Any existing load adjustments (reassigned time, releases, overload)
   - The total credit load for the term

For example, Dr. Smith might show:
- ECON 226 - 001 (3 credits)
- ECON 226 - 002 (3 credits)
- ECON 340 - 001 (3 credits)
- Total: 9 teaching credits

## Step 3: Add Reassigned Time

Faculty members often have non-teaching duties that count toward their load -- research, committee work, administrative roles. Enter these as load adjustments so the total reflects their actual workload.

1. Expand an instructor's row in the Workload table
2. Click **+ Add Release / ADHOC** at the bottom of the expanded section
3. Fill in the form:
   - **Description** -- A clear label for the assignment (e.g., "Research Reassigned Time", "Department Chair", "Assessment Committee Chair", "Graduate Coordinator")
   - **Type** -- Choose the category:
     - **Research Release** -- Reassigned time for research activity
     - **Admin Release** -- Department chair, program director, committee duties
     - **Course Release** -- Bought-out credits (e.g., grant-funded release)
     - **ADHOC** -- Temporary or one-time assignments
     - **Overload** -- Credits beyond the normal max (increases total)
     - **Other** -- Anything that does not fit the above categories
   - **Credits** -- The equivalent credit value (e.g., 3)
4. Click **Save**

For example, a department chair with a 12-credit max might have:
- 3 credits teaching (ECON 226 - 001)
- 3 credits Department Chair (Admin Release)
- 3 credits Research Reassigned Time (Research Release)
- 3 credits Assessment Committee (Admin Release)
- **Total: 12 credits** -- at full load without being overloaded

Repeat for each reassigned time entry. You can add multiple entries per instructor.

## Step 4: Check for Overloads

After entering reassigned time, review the table for overload warnings:

- Instructors whose total load exceeds their max credits are highlighted
- The Overloaded KPI card updates in real time

If an instructor is overloaded, you have several options:
- Reassign one of their sections to another instructor
- Change their max credits if the overload is approved
- Add an **Overload** type entry to formally document the approved extra credits

## Step 5: Review from the Instructor Detail Page

You can also manage workload from an individual instructor's detail page:

1. Click **Instructors** in the sidebar
2. Click an instructor's name to open their detail page
3. Select the **Workload** tab
4. This shows the same information as the Analytics Workload table, but for this one instructor, with their sections and load adjustments

This view is useful when you are working with a specific faculty member on their schedule.

## Step 6: Download the Faculty Load Report

When you are ready to submit workload documentation to your dean's office, generate the Excel report.

1. Go to either:
   - **Instructors** page and click **Load Report** in the toolbar, or
   - **Analytics > Workload** tab and click **Export to Excel**
2. The file downloads automatically with a name like `faculty_load_Fall_2025.xlsx`

Both buttons produce the same report for the currently selected term.

### What the Report Contains

The Excel file has 15 columns matching the standard department format:

| Column | Content |
|--------|---------|
| Last Name / First Name | Instructor name |
| Status | Employment type: F (Faculty), IAS, ADJ, NIAS |
| Dept Code | Department |
| Course # / Section # | Course and section identifiers |
| Lec, Lab or Fld | Instruction type |
| Class Name | Course title (or reassignment description) |
| Enrollment | Enrollment cap |
| Actual Credits | Course credit hours |
| Equivalent Credits | Adjusted credits for load calculation |
| SCH | Student Credit Hours |
| TOTAL LOAD for Semester | Sum formula for equivalent credits |
| Reassignment/Suggestion | Load adjustment type |
| Forms completed? | Empty -- fill in manually after export |

Each instructor's courses are listed individually, followed by their reassigned time entries, then a subtotal row with SUM formulas that automatically total the credits. Instructors exceeding their max credits are highlighted in yellow so they stand out when reviewing the report.

Unassigned sections (instructor TBD) appear at the bottom of the report.

## What You've Learned

- How to review instructor workloads on the Analytics Workload tab
- How to expand an instructor row to see their individual section assignments
- How to add reassigned time entries (research release, admin release, course release, etc.)
- How to identify and address overloaded instructors
- How to download the faculty load report in the standard Excel format
- That the load report is available from both the Instructors page and the Analytics Workload tab

## What's Next

With workloads balanced, you are ready to export and share the schedule. See [Exporting & Sharing](?page=tutorial-export).
