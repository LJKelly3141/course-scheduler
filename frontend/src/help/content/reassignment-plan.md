# Reassignment Plan

The Reassignment Plan page lets you define recurring load adjustment patterns for your department's instructors across semesters. Once your plan is set, you can apply it to a draft term to auto-create load adjustments (reassigned time, overloads, etc.).

## Getting There

Click **Reassignment Plan** under **Planning** in the sidebar.

## Key Concepts

- **Reassignment Plan** — A reusable grid defining which instructors have recurring load adjustments each semester
- **Plan Entry** — A single entry: an instructor, a semester, an adjustment type, credits, and year parity
- **Year Parity** — Whether the adjustment applies every year, even years only, or odd years only
- **Apply to Term** — Auto-creates load adjustment records in a draft term based on matching plan entries
- **Import from Term** — Extracts existing load adjustments from a term and adds them to the plan

## The Grid

The page displays a grid with:
- **Rows** — Instructors (sorted by last name)
- **Columns** — Fall, Spring, Summer, Winter

Each cell shows the planned adjustments for that instructor in that semester. Each entry displays:
- A **year parity badge** (green = Every Year, blue = Even Years, purple = Odd Years)
- An **adjustment type badge** (Research, Admin, Course, ADHOC, Overload, Other)
- The **description** and **credit amount**

## Adding Plan Entries

### Add to an Existing Instructor

Click **+ Add** in any semester cell for an instructor already in the grid. Fill in:

- **Description** — What the adjustment is for (e.g., "Department Chair", "Research Reassignment")
- **Type** — Research Reassignment, Admin Reassignment, Course Reassignment, ADHOC, Overload, or Other
- **Credits** — Equivalent credit value (e.g., 3)
- **Year Parity** — Every Year, Even Years, or Odd Years

Click **Save** to add the entry.

### Add a New Instructor

Click **+ Add Instructor** below the grid. Select an instructor from the dropdown, then click a semester button (Fall, Spring, Summer, or Winter) to open the add form for that cell.

## Deleting Entries

Click the **X** button on any entry to remove it from the plan.

## Year Parity

Year parity controls when an adjustment is applied:

- **Every Year** (green) — Applied to every term regardless of year
- **Even Years** (blue) — Only applied when the term's academic year is even
- **Odd Years** (purple) — Only applied when the term's academic year is odd

This is useful for adjustments that alternate, such as a faculty member who chairs a committee every other year.

## Adjustment Types

| Type | Description |
|------|-------------|
| Research Reassignment | Reassigned time for research activity |
| Admin Reassignment | Department chair, program director, committee duties |
| Course Reassignment | Bought-out credits (e.g., grant-funded release) |
| ADHOC | One-off or irregular adjustments |
| Overload | Credits beyond the normal max (increases total load) |
| Other | Anything not covered above |

## Apply to Term

Click **Apply to Term** to auto-create load adjustments in a draft term based on the plan.

1. Select a **draft term** from the dropdown
2. Click **Apply**
3. The system matches plan entries to the term's semester and year parity, then creates load adjustment records

The results show:
- How many plan entries matched
- How many adjustments were created
- How many were skipped (already exist in the term)

Existing adjustments in the term are not duplicated.

## Import from Term

Click **Import from Term** to extract existing load adjustments from a completed term and add them to the plan.

1. Select a **term** from the dropdown
2. Review the extracted adjustments — use checkboxes to select which to import
3. Click **Import**

The imported entries are mapped to the appropriate semester based on the source term's type (e.g., a Fall term populates the Fall column). Year parity defaults to "Every Year" — adjust manually if needed.

> **Tip:** Import from Term is useful when you have existing adjustments from a prior term and want to establish them as recurring patterns.

## Relationship to Per-Instructor Reassignments

The Reassignment Plan creates the **plan** — the recurring patterns. When you apply it, the actual **load adjustment records** are created in the target term. You can view and manage those records per-instructor on the **Instructors** page by selecting an instructor and opening the **Reassignments** tab.

The Reassignments tab shows two views:
- **Instructor** — One instructor's adjustments across multiple terms
- **Department** — All instructors' adjustments for selected terms

## Tips

> **Tip:** You can have multiple plan entries per instructor per semester — for example, both a research reassignment and an admin reassignment in Fall.

> **Tip:** Use year parity for alternating assignments. A faculty member who chairs a committee in even years can have an "Admin Reassignment" entry set to "Even Years."

> **Tip:** The plan is saved independently of any term. You can apply it to multiple terms over time as new draft terms are created.

> **Tip:** After applying the plan to a term, check the Workload tab in Analytics to verify the adjustments look correct before finalizing the term.
