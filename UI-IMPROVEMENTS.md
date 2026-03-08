# UI Improvement Suggestions

## Quick Wins (small changes, big polish)

1. **Toast notifications** — Replace inline success/error text with a toast system (e.g., sonner). Currently "Export complete", "Import complete", "Report copied" all use different inline patterns. A consistent toast would unify feedback.

2. **Drop target highlighting** — When dragging a meeting on the schedule grid, droppable cells don't highlight. Adding a subtle background on hover would make drag-and-drop feel much more intuitive.

3. **Drag handle icon** — Meeting cards have `cursor: grab` but no visual affordance. A small grip icon would make discoverability better.

4. **Striped table rows** — All tables use `hover:bg-muted/30` but no alternating row colors. Adding `even:bg-muted/20` would improve scanability across Courses, Instructors, Rooms, and Terms pages.

5. **Unscheduled sections badge** — No persistent indicator showing how many sections still need scheduling. A red badge on the Schedule nav item or a banner on the schedule page would help.

6. **Conflict count in sidebar** — Color-coded badge (red for hard conflicts, amber for warnings) next to the Schedule nav item so the chair sees issues without navigating.

## Medium Effort (noticeable UX improvement)

7. **Undo after drag** — After a successful drag-and-drop reschedule, show a temporary "Undo" toast (5 seconds). This gives confidence to experiment with placements.

8. **Table sorting** — No sort functionality on any table. Adding clickable column headers with sort arrows on Courses, Instructors, and Rooms pages would help find things faster.

9. **Loading skeletons** — Dashboard and Analytics pages show a spinner while loading. Skeleton placeholders (gray rectangles matching card shapes) would feel much faster.

10. **Keyboard shortcuts** — Common actions like `Ctrl+N` for new meeting, `Escape` to close dialogs, arrow keys to navigate the schedule grid. Power users (department chairs using this daily) would benefit.

11. **Mobile/tablet responsive schedule** — The 5-column day grid is fixed width. On smaller screens, a day-picker showing one day at a time would make it usable on an iPad.

12. **Building-grouped rooms** — The Rooms page is a flat list. Grouping by building (collapsible sections) would be clearer when you have many rooms.

## Larger Features

13. **Instructor workload summary** — A compact view showing each instructor's total credit hours, number of sections, and time gaps between classes. Currently you have to piece this together manually.

14. **Schedule print/PDF improvements** — The HTML export works but a "Print current view" button that prints exactly what's on screen (with proper print CSS) would be very useful for meetings.

15. **Conflict preview on drag** — While dragging a meeting, highlight any rooms/instructors/times that would cause conflicts. This would prevent the trial-and-error of dropping then checking for errors.

16. **Search/filter across courses** — No global search. A search bar that filters courses, instructors, or rooms by name would help on pages with many entries.
