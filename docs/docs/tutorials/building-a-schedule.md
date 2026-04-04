# Building a Schedule

Use the Schedule Grid to assign sections to time slots, rooms, and instructors -- then refine the layout using drag-and-drop, filters, and view modes.

## Prerequisites

- At least one term created with sections and courses (see [Setting Up Your First Term](?page=tutorial-first-term))
- Rooms and instructors imported (see [Importing Schedule Data](?page=tutorial-import))

## Step 1: Verify Sections Exist

Before scheduling, make sure every course has the right number of sections for this term.

1. Click **Courses** in the sidebar
2. Review the course list -- each course shows its section count for the selected term
3. To add a section, click a course row to expand it, then click **+ Add Section**
4. Set the section number, enrollment cap, and modality (In Person, Online, Hybrid, or HyFlex)
5. Assign an instructor if you already know who is teaching it, or leave it as TBD

Repeat for any courses that need additional sections. For example, ECON 226 Principles of Microeconomics might need two sections for Fall -- one in-person and one online.

## Step 2: Open the Schedule Grid

Click **Schedule Grid** in the sidebar. The grid shows a Monday-through-Friday layout with standard time blocks (MWF 50-minute, TTh 75-minute, and Evening 170-minute slots) as rows.

If you imported a schedule, you will see meetings already placed on the grid. Unscheduled sections appear in the list below the grid.

## Step 3: Add Meetings Using the Dialog

To schedule a section that does not yet have a meeting:

1. Click **+ Add Meeting** in the toolbar
2. In the Meeting Dialog, select:
   - **Section** -- Choose the course and section (e.g., "ECON 226 - 001")
   - **Days** -- Select the meeting pattern (MWF, TTh, or individual days)
   - **Time Block** -- Pick a standard time block, or set a custom start/end time
   - **Room** -- Choose a room (e.g., "NH 301")
   - **Instructor** -- Assign an instructor or leave as TBD
3. The system validates for conflicts immediately -- if the room or instructor is already booked at that time, you will see a warning
4. Click **Save** to create the meeting

The meeting appears on the grid in the appropriate time slot and day columns.

## Step 4: Reschedule with Drag-and-Drop

To move an existing meeting to a different time:

1. Click and hold a meeting card on the grid
2. Drag it to the desired time slot row
3. Drop to reassign -- the system checks for conflicts automatically
4. If a conflict is created, it appears in the Conflict Sidebar

Use **Cmd+Z** (Mac) or **Ctrl+Z** (Windows) to undo any drag-and-drop action if the new slot does not work out.

## Step 5: Use View Modes to Check Coverage

Switch between three views using the tabs at the top of the grid:

- **By Room** -- Each column is a room. Use this to spot room double-bookings and see how fully each room is utilized. If NH 301 has gaps all afternoon, you might shift a section there.
- **By Instructor** -- Each column is an instructor. Use this to check individual workloads and verify nobody is double-booked. Look for instructors with back-to-back-to-back blocks.
- **By Level** -- Columns are grouped by course level (100, 200, 300, 400, 600, 700). Use this to ensure lower-division courses are not all crammed into the same time slots, leaving upper-division students with conflicts.

Each view uses a distinct color scheme so you can tell them apart at a glance.

## Step 6: Filter to Focus

The filter bar provides four dropdown menus:

- **Department** -- Show only courses from specific departments (e.g., "ECON")
- **Rooms** -- Show only specific rooms (e.g., "NH 301", "NH 205")
- **Instructors** -- Show only a specific instructor's meetings
- **Course Level** -- Show only 100-level, 200-level, etc.

Filters combine with AND logic across categories and OR logic within a category. For example, filtering to "ECON" department and "NH 301" room shows only ECON courses scheduled in NH 301.

## Step 7: Watch for Conflict Indicators

Meetings with conflicts display visual indicators on the grid:

- **Red highlighting** -- Hard conflict (room or instructor double-booking, capacity violation)
- **Yellow highlighting** -- Soft warning (credit overload, room waste)

Click the **Conflicts** button in the toolbar to open the Conflict Sidebar for a full list. The badge on the button shows the count of unresolved issues.

## Step 8: Edit or Remove Meetings

To modify an existing meeting:

1. Click a meeting card on the grid to see its details
2. Click **Edit** to change the time, room, instructor, or days
3. Click **Delete** to remove the meeting entirely (the section returns to unscheduled status)

## What You've Learned

- How to verify sections exist before scheduling
- How to create meetings using the Meeting Dialog
- How to drag-and-drop meetings to reschedule them
- How to use view modes (By Room, By Instructor, By Level) to check schedule coverage
- How to apply filters to focus on specific subsets of the schedule
- How to spot and respond to conflict indicators on the grid

## What's Next

If you see red or yellow indicators on the grid, the next step is to resolve them. See [Resolving Conflicts](?page=tutorial-conflicts).
