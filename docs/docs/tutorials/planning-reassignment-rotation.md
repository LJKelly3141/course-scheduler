# Planning Reassignment Rotations

Define recurring load adjustments for your department's instructors -- research reassignments, admin duties, overloads -- and apply them to new terms automatically.

## Prerequisites

- Instructors imported into the system (see [Importing Schedule Data](?page=tutorial-import))
- At least one draft term to apply the plan to
- Familiarity with load adjustments (see [Managing Instructor Workload](?page=tutorial-workload))

## Step 1: Open the Reassignment Plan Page

Click **Reassignment Plan** under **Planning** in the sidebar. The page shows a grid of instructors and semesters. If this is your first time here, the grid will be empty.

## Step 2: Add an Instructor to the Grid

1. Click **+ Add Instructor** below the grid
2. Select an instructor from the dropdown (e.g., "Smith, Jane (faculty)")
3. Click a semester button (e.g., **Fall**) to open the add form for that cell

## Step 3: Create a Plan Entry

Fill in the entry form:

1. **Description** -- What the adjustment is for (e.g., "Department Chair")
2. **Type** -- Choose the category:
   - **Admin Reassignment** for administrative duties
   - **Research Reassignment** for research activity
   - **Course Reassignment** for grant-funded release
   - **Overload** for credits beyond the normal max
3. **Credits** -- The equivalent credit value (e.g., 3)
4. **Year Parity** -- How often this applies:
   - **Every Year** -- Applied annually
   - **Even Years** -- Applied only in even-numbered academic years
   - **Odd Years** -- Applied only in odd-numbered academic years
5. Click **Save**

The entry appears in the grid cell with colored badges showing the year parity and adjustment type.

For example, a department chair with a 3-credit admin reassignment every fall would have one entry in the Fall column: "Admin Reassignment -- Department Chair (3 cr) -- Every Year."

## Step 4: Add More Entries

Repeat for each instructor and semester combination. Common patterns:

- **Department chair**: 3 cr Admin Reassignment in Fall and Spring, Every Year
- **Research active faculty**: 3 cr Research Reassignment in Fall, Every Year
- **Committee chair (alternating)**: 3 cr Admin Reassignment in Spring, Even Years
- **Grant-funded release**: 3 cr Course Reassignment in Fall, Every Year (while grant is active)

To add entries for an instructor already in the grid, click **+ Add** in the appropriate semester cell.

## Step 5: Import from an Existing Term

If you already have load adjustments entered in a completed term, import them rather than re-entering everything.

1. Click **Import from Term** in the toolbar
2. Select the source term (e.g., "Fall 2025")
3. Review the extracted adjustments -- all are selected by default
4. Uncheck any you do not want to import
5. Click **Import**

The entries are added to the appropriate semester column based on the source term's type. Year parity defaults to "Every Year" -- adjust manually if an adjustment only applies in alternating years.

> **Tip:** You can import from multiple terms to build up the full plan. Importing from a Fall term populates the Fall column, then importing from a Spring term populates Spring, without overwriting Fall entries.

## Step 6: Apply the Plan to a Draft Term

When a new term is ready for scheduling, apply the reassignment plan to auto-create load adjustments.

1. Click **Apply to Term** in the toolbar
2. Select a **draft term** from the dropdown (e.g., "Fall 2026")
3. Click **Apply**

The system checks each plan entry against the term:
- Does the entry's semester match the term's semester? (e.g., Fall entries for a Fall term)
- Does the year parity match? (e.g., "Even Years" entries only apply if 2026 is even)

The results dialog shows:
- How many plan entries matched the term
- How many load adjustments were created
- How many were skipped because they already exist in the term

## Step 7: Verify the Results

After applying, verify the adjustments were created correctly:

1. Go to **Instructors** and select an instructor
2. Open the **Reassignments** tab
3. Switch to **Department** view to see all instructors' adjustments for the term
4. Or check **Analytics > Workload** tab for a term-wide summary

If any adjustments need correction, edit or delete them directly from the Reassignments tab.

## What You've Learned

- How to add instructors and plan entries to the reassignment grid
- How year parity controls alternating-year adjustments
- How to import existing adjustments from a prior term to seed the plan
- How to apply the plan to a draft term to auto-create load adjustments
- How to verify the results in the instructor detail and analytics views

## What's Next

To plan which courses your department offers each semester, see [Planning Your Course Plan](?page=tutorial-rotation). To learn more about the load report format, see [Managing Instructor Workload](?page=tutorial-workload).
