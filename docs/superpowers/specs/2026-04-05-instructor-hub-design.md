# Instructor Hub — Design Spec

**Date:** 2026-04-05  
**Status:** Approved  
**Scope:** Redesign the instructor management UI from scattered pages into a unified Instructor Hub with guided onboarding, term-type availability, and live workload reporting.

## Problem

Instructor management was built incrementally as other features needed it. The result is:

1. **Scattered data entry** — basic creation on the list page, profile editing on a separate detail page, availability editing in two places, instructor assignment in meeting dialogs
2. **Inconsistent patterns** — inline forms, modals, separate pages, embedded expandable panels with no unifying pattern
3. **No guided workflow** — no onboarding flow for new instructors; users must discover where each piece of data lives
4. **Information overload** — the detail page tries to do too much with tabs, while the list page also embeds availability editing

## Solution: Instructor Hub

Replace `InstructorsPage` and `InstructorDetailPage` with a single **Instructor Hub** using a master-detail layout.

### Route Changes

| Current | New |
|---------|-----|
| `/instructors` (list page) | `/instructors` (Instructor Hub) |
| `/instructors/:id` (detail page) | Removed — detail is the right panel of the hub |

Single route: `/instructors`. Selecting an instructor in the roster updates the right panel. URL may optionally include `?id=123` for deep-linking/bookmarking.

## Layout

### Left Panel: Instructor Roster

Fixed-width panel (~300px) containing:

- **Header** with instructor count badge
- **Search bar** — filters roster by name
- **Type filter tabs** — All / Faculty / IAS / Adjunct / NIAS
- **Instructor list** — each entry shows:
  - Name (last, first)
  - Type badge
  - Credit usage: `current/max cr` (e.g., "9/12 cr")
  - Section count
  - Overload warning (amber/red) when equivalent credits exceed max
  - Inactive instructors shown in italic with "Inactive" label
- **Selected instructor** highlighted with blue left border and background
- **Bottom actions:**
  - "Export All — XLSX" button (green) — exports full department load report for the selected term
  - "+ New Instructor" button (blue) — opens onboarding wizard

### Right Panel: Instructor Detail

Displays the selected instructor's information across 4 tabs:

- **Header**: Instructor name, type/rank/tenure summary, term selector dropdown, delete button
- **Term selector** in header — affects Availability and Workload tabs contextually

#### Tab 1: Profile

Three sections in a form layout:

**Contact Information** (2-column grid):
- First Name, Last Name
- Email, Phone
- Office Location (full width)
- Emergency Contact Number (full width)

**Employment** (3-column grid):
- Department, Type (dropdown), Rank (dropdown)
- Tenure Status (dropdown), Hire Date (date picker), Active (toggle)

**Scheduling Preferences** (2-column grid):
- Modality Constraint (dropdown), Max Credits (number input)

Footer: Cancel / Save Changes buttons.

#### Tab 2: Availability

Term-type aware availability management with sub-tabs for Fall / Spring / Summer / Winter.

**Fall and Spring** — full hourly availability grid:
- 5-day (M/T/W/Th/F) × hourly time slots (8 AM – 4 PM or configured range)
- Three-state toggle per cell: Available → Unavailable → Prefer to Avoid (click to cycle)
- Color-coded: green (available), red (unavailable), amber (prefer to avoid)
- Quick actions: "Copy from previous term", "Copy Fall → Spring", "Set all available", "Clear all"
- "Currently Scheduled" section below grid — shows the instructor's assigned sections for the selected term

**Summer and Winter** — simple yes/no toggle:
- Large card-style buttons: "Available" / "Not Available"
- Question: "Is this instructor available to teach during [Summer/Winter] terms?"

**Pre-population behavior:** When a new term is created, the instructor's availability auto-populates from the matching term-type template. Editable per-term afterward.

**Data model change:** Current `InstructorAvailability` is term-specific. The term-type template concept requires either:
- A new `InstructorAvailabilityTemplate` model keyed by term type (fall/spring/summer/winter) rather than term ID
- Or a convention where availability is copied from the most recent term of the same type

Recommended: New template model. Simpler to reason about and doesn't depend on prior term data existing.

Footer: Undo / Save Availability buttons.

#### Tab 3: Workload

Live load report preview for the selected instructor and term.

**KPI Cards** (4-column grid):
- Sections count
- Teaching Credits
- Equivalent Credits (color-coded: green if within max, red if overloaded, shows "of X max")
- Student Credit Hours (SCH)

**Assigned Sections table:**
- Columns: Course code, Title, Credits, Equivalent Credits, Cap, Schedule, Modality
- Read-only — links to meeting/section editing are elsewhere

**Load Adjustments table:**
- Columns: Description, Equivalent Credits, Type, Delete button
- "+ Add Adjustment" link to add new adjustments inline
- Adjustment types: Release, Overload, Other

**Total bar:**
- Running total: teaching credits + adjustment credits vs. max credits
- Visual pass/fail indicator ("✓ Within limit" or "⚠ Overloaded by X credits")

**Future enhancement (out of scope):** Recurring load adjustments — ability to mark an adjustment as recurring across terms, similar to course rotation. The "+ Add Adjustment" flow could later gain a "Make recurring" option.

#### Tab 4: Notes

Categorized communication log.

**Add Note form** (always visible at top):
- Category dropdown: General, Scheduling, Contract, Performance
- Term dropdown (optional): scope note to a specific term or leave as general
- Text area
- Save Note button

**Category filter pills** below form: All / Scheduling / Contract / Performance / General

**Notes list** (newest first):
- Card-style entries with: category badge (color-coded), term scope, date, content, delete button
- Term selector in header: "All Terms" shows everything; specific term filters to that term's notes + general notes

## New Instructor Onboarding Wizard

Triggered by "+ New Instructor" button. Opens as a modal overlay over the hub.

### Step 1: Profile (required)

Single form with all profile fields. Required fields highlighted with blue borders:
- First Name, Last Name, Email, Department, Type

Optional fields (no highlight):
- Phone, Emergency Contact, Office Location, Rank, Tenure Status, Hire Date, Max Credits (defaults to 12)

Footer: Cancel / Next: Scheduling →

### Step 2: Scheduling Preferences (skippable)

- **Modality Constraint** — presented as 4 visual cards (Any, Online Only, MWF Only, TTh Only) instead of a dropdown. Cards show name + brief description. Selected card highlighted.
- **Initial Note** — optional textarea for any scheduling preferences, contract details, etc.
- Info box: "You can set detailed per-day availability in the next step, or skip and add it later."

Footer: ← Back / Skip & Save / Next: Availability →

### Step 3: Availability (skippable)

Same term-type tabbed interface as the Availability tab:
- **Fall / Spring tabs** — full availability grid, defaults to all-available
- **Summer / Winter tabs** — yes/no toggle
- Quick actions: "Copy from existing instructor", "Copy Fall → Spring", "Set all available"
- Status cards at bottom showing configuration state for all 4 term types

Footer: ← Back / Skip & Save / ✓ Save Instructor

**After saving:** Modal closes, new instructor appears selected in the roster.

## Backend Changes

### New Model: InstructorAvailabilityTemplate

For Fall/Spring — hourly grid templates (same structure as existing `InstructorAvailability` but keyed by term_type instead of term_id):

```
InstructorAvailabilityTemplate
  - id (int, PK)
  - instructor_id (FK to Instructor)
  - term_type (str: "fall", "spring")
  - day_of_week (str: "M", "T", "W", "Th", "F")
  - start_time (Time)
  - end_time (Time)
  - type (Enum: unavailable, prefer_avoid)
  
  Unique constraint: (instructor_id, term_type, day_of_week, start_time)
```

For Summer/Winter — simple boolean on the Instructor model:

```
Instructor (new fields)
  - available_summer (bool, default: True)
  - available_winter (bool, default: True)
```

This avoids a mixed-purpose table. Fall/Spring templates use rows like the existing availability model. Summer/Winter are simple booleans on the instructor record.

### New Field: Instructor.emergency_contact

- `emergency_contact` (str, 30 chars, nullable)
- `available_summer` (bool, default: True)
- `available_winter` (bool, default: True)

### New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/instructors/{id}/availability-templates` | Get all term-type templates |
| PUT | `/instructors/{id}/availability-templates/{term_type}` | Set/replace template for a term type |
| POST | `/instructors/{id}/availability-templates/{term_type}/apply/{term_id}` | Copy template to a specific term |

### Modified Endpoints

- `POST /instructors` — accept `emergency_contact` field
- `PUT /instructors/{id}` — accept `emergency_contact` field
- Existing availability endpoints remain unchanged (per-term availability still works)

### Schema Changes

- `InstructorCreate` / `InstructorUpdate` / `InstructorRead` — add `emergency_contact`, `available_summer`, `available_winter` fields
- New schemas: `AvailabilityTemplateCreate`, `AvailabilityTemplateRead`

### Migration

- Add `emergency_contact`, `available_summer`, `available_winter` columns to `instructors` table
- Create `instructor_availability_templates` table

## Frontend Changes

### Remove

- `InstructorDetailPage` (`/instructors/:id`) — functionality absorbed into hub
- Embedded `AvailabilityEditor` on `InstructorsPage` — moved to Availability tab
- Inline add form on `InstructorsPage` — replaced by onboarding wizard

### New Components

- `InstructorHub` — main page component (master-detail layout)
- `InstructorRoster` — left panel (search, filters, list, actions)
- `InstructorDetail` — right panel container (tabs)
- `ProfileTab` — profile editing form
- `AvailabilityTab` — term-type tabbed availability with grid + yes/no
- `WorkloadTab` — KPI cards, sections table, adjustments, total bar
- `NotesTab` — add form, filter pills, notes list
- `NewInstructorWizard` — 3-step modal wizard
- `AvailabilityGrid` — reusable grid component (extracted from current AvailabilityEditor)
- `TermTypeToggle` — yes/no availability toggle for Summer/Winter

### Modified Components

- `MeetingDialog` — no changes needed (instructor dropdowns work the same)
- `InstructorScheduleDialog` — no changes needed
- `InstructorSelectionStep` (rotation) — no changes needed
- `App.tsx` routing — remove `/instructors/:id` route, update `/instructors` to use `InstructorHub`
- Sidebar navigation — no changes (still links to `/instructors`)

## What's NOT in Scope

- **Recurring load adjustments** — planned future enhancement; the Workload tab's "+ Add Adjustment" is the natural integration point
- **Instructor assignment from the hub** — assigning instructors to sections/meetings stays in the schedule grid's MeetingDialog
- **Bulk instructor import** — no CSV/XLSX import for instructor data
- **Changes to the schedule grid** — instructor display on DraggableMeetingCard, MeetingDetailDialog unchanged
- **Changes to analytics** — workload analytics endpoint stays the same; the hub's Workload tab consumes it directly
