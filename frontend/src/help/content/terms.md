# Terms

The Terms page manages academic terms (semesters) and their lifecycle from draft through finalization. Terms can have multiple sessions with individual dates and head count tracking.

## Getting There

Click **Terms** in the sidebar.

## Key Concepts

- **Term** — An academic period (Fall, Spring, Summer, Winter) with start and end dates
- **Draft** — A term that can be freely edited
- **Final** — A locked term; editing, adding, and deleting meetings is disabled
- **Session** — A sub-period within a term (e.g., Session A, Session B)
- **Academic Year** — A grouping like "2025-2026" that spans multiple terms

## Managing Terms

### Add a Term

Click **+ Add Term** at the top. Fill in:
- **Name** — e.g., "Fall 2026", "Summer 2026"
- **Type** — Fall, Spring, Summer, or Winter
- **Start Date** — Term start date
- **End Date** — Term end date

The term is created in **Draft** status.

### Edit a Term

Click the **pencil icon** to edit the name, type, or dates. Editing is only available for draft terms.

### Delete a Term

Click the **trash icon** to delete a single term. Deleting a term removes all its sections and meetings. This action requires confirmation.

### Batch Delete Terms

Use the **checkboxes** on the left side of each term row to select multiple terms, then click **Delete Selected** to remove them all at once.

### Academic Year Assignment

Terms are automatically assigned to an academic year based on their start date and the academic year start month configured in Settings. The academic year column shows the assignment (e.g., "2025-2026").

## Term Lifecycle

### Draft → Final

1. Build your schedule (add sections, assign meetings)
2. Resolve all **hard conflicts** (check Dashboard or Schedule Grid)
3. Go to **Terms** and click the **lock icon** to finalize
4. The term status changes to **Final** — all editing is disabled

### Final → Draft (Unlock)

Click the **lock icon** again to unlock a finalized term and return it to draft status for further editing.

## Copy Term

Click the **Copy** button on any term to create a duplicate. Options:
- **New Name** — Name for the copied term
- **Type** — Term type
- **Start/End Dates** — Dates for the new term
- **Include Assignments** — Whether to copy instructor and room assignments along with sections

This is useful for creating next year's schedule starting from this year's.

## Sessions

Expand any term row to manage its sessions.

### Add Sessions

Click **+ Add Session** to create a session manually, or use **Paste Sessions** to import from a spreadsheet.

Session fields:
- **Name** — Session identifier (e.g., "A", "B", "1-3", "Full")
- **Start Date** — Session start date
- **End Date** — Session end date
- **Head Count Days** — Number of days before head count
- **Head Count Date** — Specific date for enrollment snapshot
- **Notes** — Additional session information

### Paste Sessions

Click **Paste Sessions** to import a table from your clipboard. The dialog supports:
- Tab-separated or comma-separated values
- **Merge** mode — Adds new sessions alongside existing ones
- **Replace** mode — Removes existing sessions and replaces with pasted data

### Sections and Sessions

When creating sections for a term with sessions, you can assign each section to a specific session. This determines the section's date range and head count date.

## Tips

> **Tip:** You can have multiple draft terms at the same time to plan ahead.

> **Tip:** Copying a term with assignments is the fastest way to start planning a new semester based on the previous year's schedule.

> **Tip:** The term selector in the sidebar header lets you quickly switch between terms throughout the app.
