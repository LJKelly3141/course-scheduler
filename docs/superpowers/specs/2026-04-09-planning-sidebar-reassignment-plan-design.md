# Planning Sidebar & Reassignment Plan Page

**Date:** 2026-04-09
**Status:** Draft

## Context

The release rotation feature was built embedded inside the InstructorDetail view with a confusing "templates" concept. The user needs:

1. A top-level **Reassignment Plan** page (like Course Rotation) where they define recurring reassignment patterns for all instructors and apply them to draft terms.
2. Better sidebar organization — Course Rotation and Reassignment Plan are both planning tools, not analysis tools.
3. Rename "Course Rotation" to **Course Plan** for consistency.
4. Eliminate the word "templates" from the UI entirely.

## Design

### Sidebar Reorganization

Current:
```
Scheduling:  Dashboard, Schedule Grid
Manage:      Courses, Instructors, Rooms
Analyze:     Analytics, Course Rotation, Import/Export
Admin:       Terms, Settings
```

Proposed:
```
Scheduling:  Dashboard, Schedule Grid
Manage:      Courses, Instructors, Rooms
Planning:    Course Plan, Reassignment Plan
Analyze:     Analytics, Import/Export
Admin:       Terms, Settings
```

Changes:
- New **Planning** group between Manage and Analyze
- **Course Rotation** renamed to **Course Plan**, moved from Analyze to Planning
- **Reassignment Plan** added as new page in Planning group
- Route for Course Plan stays at `/rotation` (no URL change needed)
- Route for Reassignment Plan: `/reassignment-plan`

### Reassignment Plan Page (`/reassignment-plan`)

Promotes the existing `ReleasePlanningView` component to a top-level page. Same grid pattern as `CourseRotationPage`:

- **Grid layout:** Instructors (rows) x Semesters (columns: Fall, Spring, Summer, Winter)
- **Each cell:** Shows planned reassignment entries with year parity badges and adjustment type color coding
- **Inline editing:** Add/edit/delete entries directly in cells
- **Toolbar actions:**
  - **Import from Term** — extract existing LoadAdjustments from a term and create plan entries
  - **Apply to Term** — apply matching plan entries to a draft term, creating LoadAdjustment records
  - **Batch save** — save all changes at once
- **Add instructor:** Dropdown to add instructors to the grid

**Terminology mapping:**
| Old term | New term |
|----------|----------|
| Template | Plan entry / Planned reassignment |
| Release rotation entry | Reassignment plan entry |
| Templates view | *(removed — this IS the page now)* |

### Per-Instructor ReleasesTab (InstructorDetail)

- Tab label stays **"Reassignments"**
- **Remove the "Templates" view mode** — that functionality is now the top-level Reassignment Plan page
- Keep "Instructor" view (single instructor, multi-term adjustment CRUD)
- Keep "Department" view (all instructors for selected terms)
- Keep export functionality (XLSX/HTML)

### Course Plan Rename

- Sidebar label: "Course Plan" (was "Course Rotation")
- Page title/header: "Course Plan" (was "Course Rotation")
- Route stays `/rotation` — no URL breaking change
- Internal code (component names, API routes) stays as-is — only user-facing labels change

## Files to Modify

### Frontend
- `frontend/src/components/layout/AppSidebar.tsx` — sidebar groups, rename Course Rotation label, add Reassignment Plan link
- `frontend/src/pages/CourseRotationPage.tsx` — page title/header text only
- `frontend/src/components/instructors/ReleasePlanningView.tsx` — promote to page component, remove "template" terminology
- `frontend/src/components/instructors/ReleasesTab.tsx` — remove "templates" view mode
- `frontend/src/App.tsx` — add `/reassignment-plan` route
- `frontend/src/api/types.ts` — no changes needed (types are fine)

### New Files
- `frontend/src/pages/ReassignmentPlanPage.tsx` — thin wrapper that renders the promoted ReleasePlanningView

### Backend
- No backend changes needed — the `release_rotation` API routes and model already support everything. Only the frontend labels change.

## Verification

1. **Sidebar:** Confirm 5 groups render correctly, Course Plan and Reassignment Plan appear under Planning
2. **Course Plan page:** Navigate to `/rotation`, confirm header says "Course Plan", all functionality unchanged
3. **Reassignment Plan page:** Navigate to `/reassignment-plan`, confirm grid loads with instructors x semesters, CRUD works, Import/Apply work
4. **InstructorDetail Reassignments tab:** Confirm "Templates" view mode is gone, Instructor and Department views still work
5. **No "template" text:** Search frontend for "template" to confirm all instances are renamed
6. **TypeScript:** `npx tsc --noEmit` passes
7. **Build:** `npm run build` succeeds
