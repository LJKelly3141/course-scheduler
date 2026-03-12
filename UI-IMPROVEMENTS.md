# UI Improvements Plan

Comprehensive UI improvement plan for the UWRF Course Scheduler. Organized into parallel workstreams that can be executed by independent agents.

---

## Workstream 1: Accessibility — Critical Fixes

**Priority:** Highest — these block core functionality for assistive technology users.

### 1.1 Keyboard-Accessible Scheduling
- **Files:** `ScheduleGrid.tsx`, `DraggableMeetingCard.tsx`, `DroppableCell.tsx`
- **Tasks:**
  - Add `KeyboardSensor` to the `useSensors()` configuration in `ScheduleGrid.tsx` (currently only `PointerSensor`)
  - Add `tabIndex={0}`, `role="button"`, and `onKeyDown` handler (Enter/Space to open edit dialog) to `DraggableMeetingCard.tsx`
  - Add `aria-label` to each meeting card describing: course, time, room, instructor
  - Ensure droppable cells are reachable via keyboard when a drag operation is active

### 1.2 Schedule Grid Screen Reader Support
- **File:** `ScheduleGrid.tsx`
- **Approach note:** The schedule grid uses CSS Grid with absolutely-positioned meeting cards that span multiple visual rows. A strict ARIA `role="grid"` with `role="gridcell"` would misrepresent the layout — meetings don't live inside individual cells. Instead:
- **Tasks:**
  - Add `role="region"` and `aria-label="Weekly schedule grid"` to the main grid container
  - Add a visually-hidden (`sr-only`) list of all meetings as an accessible alternative: `<ul role="list" className="sr-only">` with each meeting as `<li>` containing course, days, time, room, instructor
  - Add `aria-live="polite"` region for "Moving meeting..." drag status
  - Add `aria-live="polite"` region to announce drop results ("Moved CS 101 to Monday 9:00 AM, NH 301")

### 1.3 Form Label Associations
- **Files:** `MeetingDialog.tsx`, `CourseEditDialog.tsx`, `ImportPage.tsx`
- **Tasks:**
  - Add matching `htmlFor`/`id` pairs to every label+input in `MeetingDialog.tsx`: Section Number, Enrollment Cap, Modality, Session, Duration, Instructor, Lecture Hours, Special Course Fee, Class Notes, Time Block, Start Time, End Time, Room, Meeting Instructor
  - Same for `CourseEditDialog.tsx`: Department Code, Course Number, Title, Credits
  - Same for `ImportPage.tsx`: Import type select, file input, column mapping selects, term select, new term creation inputs
  - Wrap the "Custom Time" checkbox in `MeetingDialog.tsx` in a proper `<label>` element
  - Add `aria-label` to day-toggle buttons (M, T, W, Th, F) in `MeetingDialog.tsx`

### 1.4 prefers-reduced-motion Support
- **Files:** `index.css`
- **Complexity note:** The app imports `tw-animate-css` (line 2 of `index.css`), which defines its own animation keyframes and classes. The override block will need `!important` or higher-specificity selectors to override those library-defined animations.
- **Tasks:**
  - Add a global `@media (prefers-reduced-motion: reduce)` block in `index.css` that disables/reduces:
    - `animate-spin` → static icon or no animation
    - `animate-pulse` → no animation
    - All `transition-*` durations → `0ms`
    - Dialog/sheet/popover fade/zoom/slide animations from `tw-animate-css` → instant show/hide
    - Sidebar width transitions → instant
  - Use a wildcard selector like `*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }` inside the media query to ensure library animations are also caught
  - Test that `tw-animate-css` fade/zoom/slide classes are correctly overridden

---

## Workstream 2: Accessibility — High Priority

**Priority:** High — major gaps that significantly degrade the experience.

### 2.1 Icon Button Accessible Labels
- **Files:** `AppLayout.tsx`, `ConflictSidebar.tsx`, `help-tooltip.tsx`, `CoursesPage.tsx`
- **Tasks:**
  - `AppLayout.tsx` lines 31-63: Add `aria-label` to Undo, Redo, and Help buttons (e.g., `aria-label={undoLabel ? \`Undo: ${undoLabel}\` : "Nothing to undo"}`)
  - `ConflictSidebar.tsx` line 27: Add `aria-label="Close conflicts sidebar"` to close button
  - `ConflictSidebar.tsx` lines 63, 87: Add `aria-label="Dismiss warning"` and `aria-label="Restore warning"`
  - `help-tooltip.tsx`: Wrap `HelpCircle` icon in a `<button>` element with `aria-label="Help"`
  - `CoursesPage.tsx` line 426-432: Add `aria-label="View enrollment trend"` to sparkline button

### 2.2 Touch Target Sizes
- **Files:** `AppLayout.tsx`, `ConflictSidebar.tsx`, `sidebar.tsx`, `TermsPage.tsx`
- **Note:** This is a desktop Electron app, so WCAG AAA's 44×44px is overkill. Target **32×32px** (`h-8 w-8`) as a pragmatic minimum — meets WCAG AA (24px) with margin.
- **Tasks:**
  - `AppLayout.tsx`: Increase Undo/Redo/Help buttons from `h-7 w-7` (28px) to `h-8 w-8` (32px)
  - `ConflictSidebar.tsx`: Increase dismiss/restore button padding to achieve minimum 32×32px touch target
  - `sidebar.tsx` lines 427, 562: Increase menu action buttons from `w-5` (20px) to `w-8` (32px)
  - `TermsPage.tsx` line 532: Increase delete session button from `h-6 w-6` to `h-8 w-8`
  - `help-tooltip.tsx`: Ensure help icon button meets 32×32px minimum

### 2.3 Live Regions and Status Announcements
- **Files:** `MeetingDialog.tsx`, `CourseEditDialog.tsx`, `ImportPage.tsx`, `SchedulePage.tsx`, plus all pages with loading spinners
- **Tasks:**
  - Add `role="alert" aria-live="assertive"` to error message containers in `MeetingDialog.tsx`, `CourseEditDialog.tsx`, `ImportPage.tsx`
  - Add `role="status" aria-live="polite"` wrapper around all loading spinner + text patterns. Add `aria-hidden="true"` to the spinner div itself
  - Add `aria-live="polite"` to export completion status in `SchedulePage.tsx`
  - Add `aria-live="polite"` to import result message in `ImportPage.tsx`

### 2.4 Dark Mode Contrast Fixes
- **Files:** `ConflictSidebar.tsx`, `DashboardPage.tsx`
- **Tasks:**
  - `ConflictSidebar.tsx` line 84: Remove `opacity-60` from dismissed conflict container; instead use `dark:text-slate-300` (higher contrast) and `dark:bg-slate-800` (lighter background)
  - `DashboardPage.tsx` lines 440-441: Same fix for dismissed conflicts in dashboard
  - Verify all `text-slate-400`/`text-slate-500` on dark backgrounds meet 4.5:1 contrast ratio

---

## Workstream 3: Accessibility — Medium Priority

**Priority:** Medium — improves usability and semantic correctness.

### 3.1 Table Semantics
- **Files:** `CoursesPage.tsx`, `InstructorsPage.tsx`, `RoomsPage.tsx`, `SchedulePage.tsx`
- **Tasks:**
  - Add `scope="col"` to all `<th>` elements in every data table
  - Add `aria-label="Select all courses"` (and equivalent) to select-all checkboxes in table headers
  - Add `aria-label="Select {entity name}"` to individual row checkboxes
  - `CoursesPage.tsx`: Add `aria-expanded` to expandable course rows, add `onKeyDown` handler for Enter/Space to toggle expansion
  - Add `<caption className="sr-only">` to each table describing its contents

### 3.2 Navigation State
- **File:** `AppSidebar.tsx`
- **Tasks:**
  - Pass `aria-current={isActive ? "page" : undefined}` from the `NavLink` render prop to `SidebarMenuButton`
  - Ensure the `SidebarMenuButton` component forwards this prop to its rendered element

### 3.3 Semantic Export Menu
- **File:** `SchedulePage.tsx` lines 277-349
- **Tasks:**
  - Replace the custom div/button dropdown with the existing `DropdownMenu` component from `components/ui/dropdown-menu.tsx`
  - This provides `role="menu"`, `role="menuitem"`, arrow key navigation, and Escape-to-close for free

### 3.4 View Mode Button State
- **File:** `SchedulePage.tsx` lines 411-422
- **Tasks:**
  - Add `role="radiogroup"` to the container div with `aria-label="Schedule view mode"`
  - Add `role="radio"` and `aria-checked={viewMode === mode}` to each button
  - OR convert to the existing Tabs component for built-in accessibility

### 3.5 Conflicts Toggle State
- **File:** `SchedulePage.tsx`
- **Tasks:**
  - Add `aria-expanded={showConflicts}` to the Conflicts toggle button
  - Add `aria-controls="conflict-sidebar"` pointing to the sidebar's `id`

---

## Workstream 4: Typography & Identity

**Priority:** Medium — transforms the app from generic to distinctive.

### 4.1 Font System
- **Files:** `index.html`, `index.css`
- **Tasks:**
  - Choose a distinctive heading font (candidates: Outfit, Plus Jakarta Sans, Satoshi — all free via Google Fonts or Fontsource)
  - Add font import to `index.html` or install via npm (`@fontsource/outfit`)
  - Update `index.css` font-family variables: display/heading font for `--font-heading`, keep system fonts for body/data-dense content
  - Apply heading font to: page titles, sidebar nav labels, card headers, dialog titles
  - Keep system fonts for: table data, form inputs, schedule grid text (performance + density)

---

## Workstream 5: Schedule Grid Polish

**Priority:** Medium — the hero component deserves visual refinement.
**Depends on:** Workstream 1.1 and 1.2 (same files).

### 5.1 Grid Visual Refinements
- **File:** `ScheduleGrid.tsx`, `DraggableMeetingCard.tsx`
- **Tasks:**
  - Soften grid lines: change border opacity to `border-border/30` for internal grid lines, keep full opacity for header/time column borders
  - Time column: reduce font weight or use `text-muted-foreground` to fade into background

### 5.2 Meeting Card Styling
- **File:** `DraggableMeetingCard.tsx`
- **Tasks:**
  - Increase border-radius from `rounded-md` to `rounded-lg` for softer card appearance
  - Add subtle `shadow-sm` for depth separation from the grid
  - Add `hover:shadow-md` and `hover:scale-[1.02]` for interactive feedback (must respect `prefers-reduced-motion` from Workstream 1.4)

---

## Workstream 6: Dashboard & Layout Refinements

**Priority:** Lower — polish and breathing room.

### 6.1 Dashboard KPI Cards
- **File:** `DashboardPage.tsx`
- **Tasks:**
  - Increase KPI stat number size from current to `text-3xl font-bold` — the number should be the most prominent element
  - Add subtle `shadow-sm` to KPI cards for depth (instead of relying only on border)
  - Add small colored accent bar (4px) at the top of each card matching its icon color

### 6.2 Layout Spacing
- **Files:** `AppLayout.tsx`, `DashboardPage.tsx`
- **Key finding:** All page padding is centralized in `AppLayout.tsx` line 65: `<main className="flex-1 overflow-y-auto p-4">`. Changing this one class propagates to all 12 pages.
- **Tasks:**
  - `AppLayout.tsx` line 65: Change `p-4` to `p-4 lg:p-8` for more breathing room on larger screens
  - `DashboardPage.tsx`: Increase card grid gap from `gap-3`/`gap-4` to `gap-4 lg:gap-5` on larger screens
  - Sidebar nav item vertical padding: increase slightly (`py-2` → `py-2.5`) in `AppSidebar.tsx` or `sidebar.tsx`

### 6.3 Sidebar Active Indicator
- **File:** `AppSidebar.tsx` or `sidebar.tsx`
- **Tasks:**
  - Add a 3px left border accent in primary color on the active navigation item
  - This provides both visual polish and a non-color indicator of the active page (accessibility bonus)

### 6.4 Color Refinements
- **Files:** `index.css`, `utils.ts`
- **Tasks:**
  - Consider a secondary accent color (amber/gold) for warnings and highlights — complements academic blue
  - Soften course level color saturation in light mode (reduce hex opacity from `24` to `1A` or similar) to feel less harsh against neutral backgrounds
  - Slightly differentiate sidebar background from main content (2-3% darker or a subtle gradient)

---

## Workstream 7: Motion & Micro-interactions

**Priority:** Lower — adds life and feedback to the interface.
**Depends on:** Workstream 1.4 (prefers-reduced-motion must be in place first).

### 7.1 Page Transitions
- **File:** `DashboardPage.tsx`
- **Tasks:**
  - Add staggered fade-in for dashboard KPI cards using CSS `animation-delay` per card
  - All animations must be wrapped in `@media (prefers-reduced-motion: no-preference)`

### 7.2 Sidebar Collapse Animation
- **File:** `sidebar.tsx`
- **Tasks:**
  - Add smooth width transition (200ms ease-out) for sidebar collapse/expand (if not already present)
  - Must respect `prefers-reduced-motion`

### 7.3 Tab Indicator Animation
- **File:** `tabs.tsx` or page-level tab usage
- **Tasks:**
  - Add sliding underline animation for the line-variant tab indicator
  - Must respect `prefers-reduced-motion`

---

## Previously Identified Quick Wins (from prior review)

These items were identified earlier and remain valid:

1. **Drop target highlighting** — When dragging a meeting, droppable cells should highlight with a subtle background
2. **Drag handle icon** — Meeting cards have `cursor: grab` but no visible grip affordance
3. **Striped table rows** — Add `even:bg-muted/20` to improve table scanability
4. **Unscheduled sections badge** — Persistent indicator showing how many sections still need scheduling
5. **Conflict count in sidebar** — Color-coded badge next to Schedule nav item
6. **Undo after drag** — Temporary "Undo" toast after drag-and-drop reschedule
7. ~~**Table sorting**~~ — Already implemented via `SortableHeader` component + `useSort` hook on Courses, Instructors, and Rooms pages
8. **Keyboard shortcuts** — `Ctrl+N` for new meeting, `Escape` to close dialogs, arrow keys for grid navigation
9. **Building-grouped rooms** — Group rooms by building on the Rooms page
10. **Conflict preview on drag** — Highlight conflicting rooms/instructors/times while dragging
11. **Search/filter** — Global search across courses, instructors, rooms

---

## Implementation Notes

### Agent Coordination
- **Workstreams 1-3** (Accessibility) can run in parallel — they touch different files with minimal overlap
  - Exception: Workstream 2.4 (dark mode contrast) touches same files as Workstream 3.1 — coordinate or run sequentially
- **Workstream 4** (Typography) is fully independent
- **Workstream 5** (Schedule Grid) depends on Workstream 1.1 and 1.2 completing first (same files)
- **Workstream 6** (Dashboard/Layout) is mostly independent, but 6.3 touches sidebar files also modified in 2.2
- **Workstream 7** (Motion) depends on Workstream 1.4 completing first

### Suggested Agent Assignment
| Agent | Workstreams | Notes |
|-------|-------------|-------|
| Agent A | 1.1, 1.2 | Schedule grid a11y — keyboard sensor + screen reader support |
| Agent B | 1.3 | Forms specialist — label associations across all dialogs |
| Agent C | 1.4, 7.1, 7.2, 7.3 | CSS/motion specialist — reduced-motion then animations |
| Agent D | 2.1, 2.2, 2.3, 2.4 | High-priority a11y sweep across many files |
| Agent E | 3.1, 3.2, 3.3, 3.4, 3.5 | Medium a11y — tables, nav, semantic components |
| Agent F | 4.1, 6.1, 6.2, 6.3, 6.4 | Design/visual — typography, spacing, color |
| Agent G | 5.1, 5.2 | Schedule grid polish — runs AFTER Agent A completes |

### Testing
- After Workstreams 1-3: Run `npx tsc --noEmit` and `npm run build` to verify no type errors
- After each workstream: Manual browser testing in both light and dark mode
- Accessibility testing: Use browser DevTools accessibility inspector or axe-core to verify ARIA roles and contrast
- Motion testing: Enable `prefers-reduced-motion` in OS settings and verify all animations are disabled

### Constraints
- **All data displayed must be real** — no fake, placeholder, or decorative data visualizations
- Preserve all existing functionality — these are UI/UX improvements only
- Maintain existing color system (OKLch) — extend, don't replace
- Keep system fonts for data-dense areas (tables, grid) for performance
