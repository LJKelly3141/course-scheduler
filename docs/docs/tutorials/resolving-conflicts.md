# Resolving Conflicts

Find and fix scheduling conflicts so you can finalize your term. Hard conflicts must be resolved before finalization; soft warnings are advisory.

## Prerequisites

- A term with scheduled meetings (see [Building a Schedule](?page=tutorial-build-schedule))

## Step 1: Open the Conflict Sidebar

The Schedule Grid is where you will do most conflict resolution work.

1. Click **Schedule Grid** in the sidebar
2. Click the **Conflicts** button in the toolbar to open the Conflict Sidebar
3. The badge on the button shows the total count of unresolved issues

The sidebar separates issues into two categories: hard conflicts (red) at the top and soft warnings (yellow) below.

## Step 2: Understand Hard Conflicts

Hard conflicts represent real scheduling errors that **block term finalization**. You must resolve all of them before you can lock the term. Here are the types you may encounter:

- **Room Conflict** -- Two meetings are booked in the same room at overlapping times. For example, ECON 226-001 and ACCT 201-001 are both in NH 301 at MWF 9:00-9:50.
- **Instructor Conflict** -- The same instructor is assigned to two meetings at overlapping times. For example, Dr. Smith is teaching in NH 301 and CSH 110 simultaneously.
- **Section Conflict** -- A single section has two meetings that overlap (usually a data entry error).
- **Room Capacity Exceeded** -- A section's enrollment cap is larger than the room can hold. For example, a section capped at 50 students is assigned to a room with 35 seats.
- **Modality Mismatch** -- An instructor with an "Online Only" constraint is assigned to an in-person section, or vice versa.
- **Instructor Unavailability** -- A meeting is scheduled during a time the instructor marked as "Unavailable" on their availability grid.

## Step 3: Fix Hard Conflicts

Click any conflict in the sidebar to see the details, including which meetings are involved. Then resolve it by one of these methods:

**For room or instructor double-bookings:**
1. Click one of the conflicting meetings on the grid
2. Click **Edit** in the meeting detail popup
3. Change the time block, room, or instructor to eliminate the overlap
4. Or drag the meeting card to a different time slot on the grid

**For room capacity violations:**
1. Click the meeting and select **Edit**
2. Assign a larger room, or reduce the section's enrollment cap on the Courses page

**For modality mismatches:**
1. Either change the instructor assignment to someone without the constraint
2. Or change the section's modality to match the instructor's constraint

**For instructor unavailability:**
1. Move the meeting to a time when the instructor is available
2. Or go to **Instructors > [Name] > Availability** and update their availability grid if the constraint has changed

## Step 4: Review Soft Warnings

Soft warnings do not block finalization, but they flag potential issues worth reviewing:

- **Credit Overload** -- An instructor is at or above their max credit limit. Check if this is intentional or if a section should be reassigned.
- **Preferred-Avoid Time** -- A meeting is during a time the instructor marked as "Prefer Avoid." The instructor can teach then but would rather not.
- **Room Capacity Waste** -- The room is more than 20% larger than needed for the section. A 120-seat lecture hall for a 25-student seminar wastes space.
- **Room Tight Fit** -- Room capacity exactly matches the enrollment cap, leaving no room for growth or late adds.
- **Non-Standard Time** -- A meeting uses a custom time block instead of a standard MWF/TTh/Evening slot.
- **Consecutive Blocks** -- An instructor has more than 3 consecutive teaching blocks without a break.

## Step 5: Dismiss Acceptable Warnings

Some warnings are expected and can be dismissed so they do not clutter the sidebar.

1. Find the soft warning you want to dismiss
2. Click the **dismiss** button (X icon) on the warning
3. The warning moves to the "Dismissed" tab in the sidebar

To restore a dismissed warning later, go to the Dismissed tab and click **restore**.

Dismissed warnings are tracked per term -- dismissing a warning in Fall 2025 does not affect Spring 2026.

## Step 6: Run Full Term Validation

For a comprehensive check beyond what the Conflict Sidebar shows:

1. Go to the **Dashboard** -- the Conflicts & Warnings panel shows all issues for the selected term
2. Or go to **Terms** and attempt to finalize -- the system runs a full validation scan

The validation checks every meeting in the term against all conflict and warning rules.

## Step 7: Finalize the Term

Once all hard conflicts are resolved:

1. Go to **Terms** in the sidebar
2. Find your term in the list
3. Click the **lock icon** to finalize
4. The term status changes from Draft to **Final**

A finalized term is locked -- no meetings can be created, edited, or deleted. If you need to make changes later, click the lock icon again to unlock the term and return it to draft status.

## What You've Learned

- How to open and use the Conflict Sidebar on the Schedule Grid
- The difference between hard conflicts (must fix) and soft warnings (advisory)
- Specific strategies for resolving each type of hard conflict
- How to dismiss acceptable soft warnings
- How to run full term validation and finalize a term

## What's Next

With your schedule finalized, it is time to export and share it. See [Exporting & Sharing](?page=tutorial-export).
