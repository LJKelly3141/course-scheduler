# Analytics

This reference covers the Analytics page's enrollment trends, schedule efficiency metrics, prerequisite graphs, and workload management. For a hands-on walkthrough of instructor workloads, see [Tracking Instructor Workloads](?page=tutorial-workload).

The Analytics page provides data-driven insights into enrollment trends, schedule efficiency, and instructor workloads using historical and current-term data.

## Getting There

Navigate to **Analytics** in the app sidebar.

## Key Concepts

- **Fill Rate** — Percentage of enrollment cap filled (enrollment / cap)
- **Enrollment Trend** — Whether a course's enrollment is growing, declining, or stable over time
- **Room Utilization** — How efficiently rooms are being used across time slots
- **Teaching Load** — Total credits assigned to an instructor in a term

## Filter Controls

At the top of the page, two dropdown filters let you focus the data:
- **Department** — Show analytics for a specific department or all departments
- **Course Level** — Filter by course level (100, 200, 300, 400+)

Filters apply across all five tabs.

## Tabs

### Overview

High-level KPIs and trend charts:
- **Summary cards** — Total enrollment, average fill rate, sections offered
- **Enrollment forecasts** — Projected enrollment for upcoming terms based on historical trends
- **Fill rate trends** — How fill rates have changed over time

### Course Detail

Course-level enrollment analysis:
- Per-course enrollment history across terms
- Section sizing analysis (are sections right-sized?)
- Growing and declining course identification
- Recommendations for adding or cutting sections

### Schedule Ops

Schedule efficiency metrics:
- **Room utilization** — How many time slots each room is used vs. available
- **Time slot analysis** — Which time blocks are most/least popular
- **Session distribution** — For summer terms, how sections are spread across sessions
- **Recommendations** — Suggestions for optimizing room and time slot usage

### Prerequisites

Course dependency chain visualization and scheduling conflict detection:
- **Prerequisite graph** — Interactive graph showing how courses depend on one another, with arrows indicating prerequisite and corequisite relationships. Courses offered in the current term are highlighted; courses not offered are shown in gray.
- **Prerequisite warnings** — Alerts for scheduling conflicts involving prerequisites (e.g., a prerequisite course scheduled at the same time as or after a dependent course), displayed as a warning banner above the graph
- **Legend** — Color-coded key distinguishing offered vs. not-offered courses and corequisite relationships

### Workload

Instructor load analysis and management:
- **KPI cards** — Total instructors, teaching credits, SCH, and overloaded count
- **Instructor table** — Expandable rows showing each instructor's sections, credits, and load status
- **Instructor type** — Edit an instructor's type (Faculty/IAS/Adjunct/NIAS) directly from the table
- **Load adjustments** — Add, view, and delete reassigned time entries (release credits, ADHOC, overload) per instructor
- **Overload warnings** — Instructors exceeding their max credits are highlighted
- **Export to Excel** — Downloads a faculty load report matching the standard department format (see **Instructors → Load Report** for full details)

#### Adding Reassigned Time

Select an instructor's row to expand it, then select **+ Add Release / ADHOC** to enter reassigned time (research release, admin release, course release, etc.). Each entry includes a description, type, and credit value. These appear in the exported load report alongside teaching assignments. See the **Instructors** help topic for a detailed walkthrough.

## Tips

> **Tip:** Analytics are most useful after importing enrollment history data. Go to **Import / Export** and upload multi-year enrollment spreadsheets to power the trend analysis.

> **Tip:** The Workload tab is especially helpful during schedule planning to balance loads across faculty before finalizing.

> **Tip:** The faculty load report is available from both the **Instructors** page toolbar and the **Workload** tab here — both produce the same Excel file.
