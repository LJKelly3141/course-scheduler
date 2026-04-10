# Documentation Update: Course Plan Rename + Reassignment Plan Docs

**Date:** 2026-04-10
**Status:** Draft

## Context

The sidebar was reorganized: "Course Rotation" renamed to "Course Plan", and "Reassignment Plan" added as a new top-level page under a new "Planning" group. Documentation and help content need to reflect these changes and cover the new feature.

## Scope

### 1. Rename "Course Rotation" → "Course Plan"

Files to update (text only, no file renames):
- `frontend/src/help/topics.ts` — label on line 47
- `frontend/src/help/content/course-rotation.md` — title, body references
- `docs/docs/docs.js` — sidebar titles (lines 17 and 27)
- `docs/docs/content/course-rotation.md` — title, body references
- `docs/docs/tutorials/planning-course-rotation.md` — title, body references
- Cross-references in other docs that mention "Course Rotation"

### 2. Update sidebar/navigation references

Any docs mentioning the old "Analyze" group structure → update to "Planning" group.

### 3. New: Reassignment Plan reference page

Create `reassignment-plan.md` in both:
- `frontend/src/help/content/`
- `docs/docs/content/`

Content:
- What is the Reassignment Plan
- Grid layout: Instructors × Semesters
- Adding/editing/deleting plan entries
- Year parity (every year, even years, odd years)
- Adjustment types (research, admin, course, adhoc, overload, other)
- Import from Term workflow
- Apply to Term workflow
- Relationship to per-instructor Reassignments tab

### 4. New: Reassignment Plan tutorial

Create `planning-reassignment-rotation.md` in both:
- `docs/docs/tutorials/`

And equivalent content in:
- `frontend/src/help/content/` (as part of the reference page or separate)

Tutorial steps:
1. Navigate to Planning > Reassignment Plan
2. Add an instructor to the grid
3. Create a plan entry (e.g., 3cr research release every fall)
4. Set year parity for alternating patterns
5. Import existing adjustments from a completed term
6. Apply the plan to a new draft term
7. Verify results in the instructor's Reassignments tab

### 5. Register new content

- `frontend/src/help/topics.ts` — add reassignment-plan topic
- `docs/docs/docs.js` — add reference page + tutorial entries

### 6. Update cross-references

- `instructors.md` — mention Reassignment Plan page for department-wide planning
- `analytics.md` — note that load adjustments can be auto-created via Reassignment Plan

## Verification

1. In-app help: all 14 topics render, search works, Course Plan and Reassignment Plan appear
2. Docs site: all pages load, sidebar shows correct titles, new pages accessible
3. No broken links or stale "Course Rotation" references
