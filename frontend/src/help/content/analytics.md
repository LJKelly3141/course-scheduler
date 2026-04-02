# Analytics

The Analytics page provides data-driven insights into enrollment trends, schedule efficiency, and instructor workloads using historical and current-term data.

## Getting There

Click **Analytics** in the sidebar.

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

Instructor load analysis:
- **Credit distribution** — Histogram of teaching loads across instructors
- **Historical averages** — Average load per instructor over past terms
- **Load forecasting** — Projected loads for upcoming terms
- **Overload identification** — Instructors at or above their max credit limit

## Tips

> **Tip:** Analytics are most useful after importing enrollment history data. Go to **Import / Export** and upload multi-year enrollment spreadsheets to power the trend analysis.

> **Tip:** The Workload tab is especially helpful during schedule planning to balance loads across faculty before finalizing.
