# Backlog

Unimplemented feature ideas and UI improvements. Use superpowers brainstorming skill to plan any of these before starting work.

---

## Accessibility (from UI audit)

### Medium Priority
- **Table semantics** — Add `scope="col"` to all `<th>` elements, `aria-label` to select-all/row checkboxes, `aria-expanded` to expandable rows, `<caption className="sr-only">` to each table. Files: `CoursesPage.tsx`, `InstructorsPage.tsx`, `RoomsPage.tsx`
- **Navigation state** — Pass `aria-current="page"` from NavLink render prop to `SidebarMenuButton` in `AppSidebar.tsx`
- **Semantic export menu** — Replace custom div/button dropdown with `DropdownMenu` component in `SchedulePage.tsx` (lines 277-349)
- **View mode button state** — Add `role="radiogroup"` + `role="radio"` + `aria-checked` to view mode buttons in `SchedulePage.tsx`
- **Conflicts toggle state** — Add `aria-expanded` and `aria-controls` to conflicts toggle button in `SchedulePage.tsx`
- **Live regions** — Add `role="alert"` to error containers in dialogs, `role="status"` to loading spinners
- **Dark mode contrast** — Fix `opacity-60` on dismissed conflicts in `ConflictSidebar.tsx` and `DashboardPage.tsx`
- **Touch targets** — Increase small icon buttons to minimum 32x32px in `AppLayout.tsx`, `ConflictSidebar.tsx`, `sidebar.tsx`, `TermsPage.tsx`

## Visual Polish

- **Typography** — Consider distinctive heading font (Outfit, Plus Jakarta Sans) for page titles, sidebar labels, dialog titles. Keep system fonts for data-dense tables/grids
- **Schedule grid** — Soften grid lines (`border-border/30`), fade time column, increase meeting card border-radius, add subtle shadow
- **Dashboard KPI cards** — Larger stat numbers (`text-3xl`), subtle shadow, colored accent bar at top
- **Layout spacing** — `p-4 lg:p-8` on main content area for breathing room on larger screens
- **Sidebar active indicator** — 3px left border accent in primary color on active nav item
- **Color refinements** — Secondary accent color for warnings, soften course level color saturation in light mode

## Motion & Micro-interactions
*Depends on prefers-reduced-motion support (already implemented)*

- **Page transitions** — Staggered fade-in for dashboard KPI cards
- **Tab indicator animation** — Sliding underline for tab switching

## Quick Wins

- **Drop target highlighting** — Subtle background on droppable cells during drag
- **Drag handle icon** — Visible grip affordance on meeting cards
- **Striped table rows** — `even:bg-muted/20` for table scanability
- **Unscheduled sections badge** — Persistent indicator of sections needing scheduling
- **Conflict count badge** — Color-coded badge next to Schedule nav item
- **Undo after drag** — Temporary toast after drag-and-drop reschedule
- **Keyboard shortcuts** — `Ctrl+N` for new meeting, `Escape` for dialogs, arrow keys for grid
- **Building-grouped rooms** — Group rooms by building on Rooms page
- **Conflict preview on drag** — Highlight conflicting items while dragging
- **Global search** — Search across courses, instructors, rooms

## Feature Ideas

- **Faculty teaching preferences** — Let instructors rank which courses they want to teach
- **Sabbatical / leave tracking** — Track who's on sabbatical, medical leave, reduced appointment
- **Office hours tracking** — When faculty hold office hours
- **Program requirement mapping** — Link courses to degree program requirements
- **Cross-listed / stacked courses** — Track cross-listings and lecture+lab pairings
- **Waitlist / demand tracking** — Track courses that filled up to justify adding sections
- **Section cap recommendations** — Suggest caps based on historical enrollment
- **Adjunct budget tracking** — Budgeted vs. assigned adjunct credits
- **Room utilization report** — Underused/overbooked rooms across the schedule
- **Lab/equipment scheduling** — Shared labs or equipment beyond just rooms
- **Term planning checklist** — Tasks for each scheduling cycle
- **Change log / audit trail** — Who changed what and when
- **Export to registrar format** — Banner, PeopleSoft, etc.
- **Department summary dashboard** — Total SCH, FTE, adjunct vs. faculty split, modality breakdown
- **Accreditation data export** — Credit hours, class sizes, faculty qualifications
- **Instructor schedule cards** — Per-instructor printable schedule
- **Semester-to-semester cloning with diff** — Clone last term, see what changed
- **"What if" sandbox mode** — Duplicate a draft to try alternatives
- **Deadline / calendar integration** — Key scheduling dates
