# Conflicts & Validation

This reference covers hard conflicts, soft warnings, inline validation, and finalization rules. For a hands-on walkthrough of resolving conflicts, see [Resolving Schedule Conflicts](?page=tutorial-conflicts).

The scheduling system automatically detects conflicts and warnings to help you build a valid schedule. Hard conflicts must be resolved before a term can be finalized. Soft warnings are advisory and can be dismissed.

## Getting There

Conflicts appear in multiple places throughout the app:
- **Dashboard** — Conflicts & Warnings panel
- **Schedule Grid** — Conflict Sidebar (toggle with the Conflicts button)
- **Meeting Dialog** — Inline validation when creating or editing a meeting

## Hard Conflicts

Hard conflicts represent scheduling errors that **block term finalization**. They must be resolved.

| Conflict Type | Description |
|--------------|-------------|
| **Room Conflict** | Two meetings are scheduled in the same room at overlapping times |
| **Instructor Conflict** | The same instructor is scheduled for two meetings at overlapping times |
| **Section Conflict** | The same section has overlapping meetings |
| **Room Capacity** | A section's enrollment cap exceeds the assigned room's capacity |
| **Modality Mismatch** | An instructor's modality constraint conflicts with the section (e.g., "Online Only" instructor assigned to an in-person section) |
| **Instructor Unavailability** | A meeting is scheduled during a time the instructor marked as "Unavailable" on their availability grid |
| **Time Validity** | Invalid day codes or end time before start time |

## Soft Warnings

Soft warnings are advisory — they highlight potential issues but don't prevent finalization. You can dismiss warnings you've reviewed.

| Warning Type | Description |
|-------------|-------------|
| **Credit Overload** | Instructor is at or above their max credit limit |
| **Preferred-Avoid Time** | Meeting is during a time the instructor marked as "Prefer Avoid" |
| **Room Capacity Waste** | Room is more than 20% larger than needed for the section |
| **Room Tight Fit** | Room capacity exactly matches the enrollment cap (no room for growth) |
| **Non-Standard Time** | Meeting uses a custom time block instead of a standard MWF/TTh/Evening block |
| **Consecutive Blocks** | Instructor has more than 3 consecutive teaching blocks |

## Inline Validation

When you **create or update a meeting** through the Meeting Dialog, the system checks for conflicts immediately and shows them in the dialog. You can still save the meeting, but the conflicts will be recorded.

## Dismissing Warnings

On the Dashboard and in the Schedule Grid's Conflict Sidebar:

1. Find the soft warning you want to dismiss
2. Select the **dismiss** button (X icon)
3. The warning moves to the "Dismissed" tab

To restore a dismissed warning, go to the Dismissed tab and select **restore**.

Dismissed warnings are tracked per term — dismissing a warning in Fall 2026 doesn't affect Spring 2027.

## Term Validation

The system runs a full validation scan when you:
- Open the Dashboard for a term
- Open the Schedule Grid for a term
- Attempt to finalize a term

Validation checks all meetings in the term against all conflict and warning rules.

## Finalization Rules

To finalize (lock) a term:
1. **All hard conflicts must be resolved** — the finalize button is disabled if any exist
2. Soft warnings do **not** block finalization — they're advisory only
3. Once finalized, the term is locked: no meetings can be created, edited, or deleted
4. You can unlock a term to return it to draft mode for further editing

## Tips

> **Tip:** The conflict count badge on the Schedule Grid's "Conflicts" button gives you a quick at-a-glance count of unresolved issues.

> **Tip:** When drag-and-dropping a meeting on the Schedule Grid, conflicts are checked automatically after the drop. Use Undo (Ctrl+Z / Cmd+Z) to reverse if a conflict is created.

> **Tip:** The Dashboard panel is the best place to get a comprehensive view of all conflicts and warnings for a term.
