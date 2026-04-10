# Availability Enforcement — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Depends on:** Instructor Hub (merged to main)

## Problem

Instructor availability templates exist but aren't enforced. Setting availability preferences in the Instructor Hub has no effect on scheduling — the conflict engine only checks per-term availability records, and there's no mechanism to auto-populate those from templates.

## Behavior Summary

1. **Auto-apply on term creation:** When a new term is created, copy all instructor availability templates into per-term availability records for that term automatically.
2. **Template stays unchanged on override:** Editing per-term availability for a specific term does NOT modify the template. Templates are defaults; per-term records are the working copy.
3. **Unavailable slots → hard conflict:** Scheduling into an unavailable slot creates a hard conflict that blocks term finalization.
4. **Prefer to avoid → soft warning:** Scheduling into a prefer-to-avoid slot creates a soft/advisory warning only.
5. **Inline warning on single assignment:** When manually assigning an instructor to a meeting via MeetingDialog, show an inline warning if the slot conflicts with their availability. This warning does NOT appear during bulk operations (import, rotation apply, term copy).
6. **Mutable warnings:** A setting in the Settings page to disable inline assignment warnings.

## Detailed Design

### 1. Auto-Apply Templates on Term Creation

**When:** `POST /api/terms` creates a new term.

**What happens:**
- After the term is created, iterate all instructors.
- For each instructor, look up their availability template matching the new term's type (fall/spring).
- Copy all template rows into `InstructorAvailability` records for the new term.
- For summer/winter terms: if `instructor.available_summer` (or `available_winter`) is `false`, create unavailable records covering all time slots for all days.
- If an instructor has no template for the term type, no per-term records are created (they're fully available by default).

**Backend change:** Modify the term creation endpoint (`POST /api/terms` in `backend/app/api/routes/terms.py`) to call a new service function after creating the term.

**New service function:** `backend/app/services/availability_service.py`

```python
def apply_templates_to_term(db: Session, term: Term) -> int:
    """Copy availability templates to per-term records for all instructors.
    Returns the number of availability records created."""
```

This function:
- Queries all instructors
- For fall/spring terms: queries `InstructorAvailabilityTemplate` where `term_type` matches
- For summer/winter terms: checks `instructor.available_summer` / `available_winter`
- Creates `InstructorAvailability` rows
- Returns count of records created

### 2. Per-Term Override

The existing `PUT /api/instructors/{id}/availability?term_id={term_id}` endpoint already replaces all per-term availability. No changes needed — this naturally overrides the auto-applied records without touching templates.

The Instructor Hub's Availability tab should clarify the distinction:
- Template editing (Fall/Spring/Summer/Winter sub-tabs): "These are defaults applied to new terms"
- Per-term editing: accessible from the existing schedule/availability workflow, or could be added as a "View per-term overrides" option in the hub

### 3. Conflict Engine Changes

**File:** `backend/app/services/conflict_engine.py`

The conflict engine already checks `InstructorAvailability` for `unavailable` type. With auto-apply, those records will exist. Two additions needed:

**a) Prefer-to-avoid as soft warning:**

Currently only `unavailable` is checked. Add a check for `prefer_avoid` type that produces a **soft warning** instead of a hard conflict.

Add to `detect_hard_conflicts()` or the soft constraints module:
- Query `InstructorAvailability` where `type == prefer_avoid` for the instructor+term
- If a meeting overlaps a prefer_avoid slot, add a soft warning: "Instructor {name} prefers to avoid {day} {time}"

**File:** `backend/app/services/soft_constraints.py` — add prefer_avoid check here since it's advisory.

**b) Unavailable stays as hard conflict:** No change needed — already works.

### 4. Inline Warning in MeetingDialog

**File:** `frontend/src/components/meetings/MeetingDialog.tsx`

When the user selects an instructor for a meeting (either section-level or meeting-level):
- Check the instructor's per-term availability against the meeting's time slot
- If the slot overlaps an `unavailable` period, show an inline warning banner: "⚠ {Instructor} is unavailable at this time"
- If it overlaps a `prefer_avoid` period, show a softer note: "{Instructor} prefers to avoid this time"

**When NOT to show:** The warning should only appear in the MeetingDialog (single assignment). It should NOT appear during:
- `POST /api/import/*` (XLSX import)
- Rotation apply (`POST /api/rotation/apply/*`)
- Term copy operations
- Any bulk endpoint

This is naturally handled because those endpoints don't go through the MeetingDialog UI.

**Implementation:** The MeetingDialog already loads instructor data. Add a query for the selected instructor's availability for the current term. Compare against the selected time block's day/time.

### 5. Warning Mute Setting

**Setting:** `disable_availability_warnings` (boolean, default: false)

**Backend:** Add to `AppSetting` or use the existing settings key-value store.
- `GET /api/settings` returns all settings including this one
- `PUT /api/settings` can update it

**Frontend:** Add a toggle in the Settings page under a "Scheduling" section:
- "Disable inline availability warnings" — "Turn off warnings when assigning instructors to time slots that conflict with their availability preferences"

When this setting is enabled, the MeetingDialog skips the availability check (warnings don't appear). Hard/soft conflicts in term validation are NOT affected — those always run regardless of this setting.

## What's NOT in Scope

- **Recurring load adjustments** — separate future feature
- **Availability templates UI changes** — the Instructor Hub's Availability tab already handles template editing
- **Bulk apply/re-apply button** — auto-apply on term creation is sufficient for now; manual re-apply to existing terms could be added later
- **Per-meeting override** — the user resolves conflicts by either changing the schedule or editing per-term availability; no per-meeting exception mechanism

## Migration Notes

- Existing terms won't have auto-applied availability records. This is fine — instructors are "fully available" when no records exist, which matches current behavior.
- The auto-apply only runs on NEW term creation going forward.
- Users can manually set per-term availability for existing terms through the existing availability endpoints.
