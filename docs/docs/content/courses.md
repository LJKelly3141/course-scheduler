# Courses

This reference covers managing the course catalog and term sections. For a hands-on walkthrough of creating sections and assigning meetings, see [Building a Schedule on the Grid](?page=tutorial-build-schedule).

The Courses page lets you manage your department's course catalog and the sections offered each term. Each course can have multiple sections, and each section can be assigned an instructor, room, and meeting time.

## Getting There

Navigate to **Courses** in the app sidebar.

## Key Concepts

- **Course** — A catalog entry (e.g., CS 252 "Web Development", 3 credits)
- **Section** — A specific offering of a course in a term (e.g., Section 01, cap 30)
- **Modality** — How a section is delivered: In Person, Online Sync, Online Async, or Hybrid
- **Scheduled / Unscheduled** — Whether a section has meeting times assigned

## Managing Courses

### Add a Course

Select **+ Add Course** at the top. Fill in:
- **Department** — Department code (e.g., "CS", "MATH")
- **Course #** — Course number (e.g., "252")
- **Title** — Course title (e.g., "Web Development")
- **Credits** — Credit hours
- **Counts Toward Load** — Whether this course counts toward instructor teaching load (checked by default)

### Edit a Course

Select the **Edit** link on any course row to open the edit dialog. Change any field and save.

### Delete Courses

Select the **Delete** link on a single course, or check multiple courses with checkboxes and use **Delete Selected**.

### Search

Use the search bar to filter courses by department, course number, or title. Results update as you type.

## Managing Sections

Expand any course row (select the arrow) to see its sections for the selected term.

### Add a Section

Select **+ Add Section** under the expanded course. Fill in:
- **Section Number** — e.g., "01", "02"
- **Enrollment Cap** — Maximum students
- **Modality** — In Person, Online Sync, Online Async, or Hybrid
- **Instructor** — Assign from the instructor dropdown
- **Session** — Select which session this section belongs to, chosen from the sessions configured on the term (e.g., "Session A", "8-Week Session")
- **Lecture Hours** — Contact hours per week (optional)
- **Special Course Fee** — Dollar amount (optional)
- **Notes** — Any additional information

### Section Status

Each section shows its scheduling status:
- **Green "Scheduled"** — Has meeting times assigned
- **Yellow "Unscheduled"** — No meetings yet

For Online Async sections, use the **Mark Scheduled** button to set status without creating a physical meeting.

### Edit or Schedule a Section

- Select the **Edit** link to open the Meeting Dialog and assign a time/room, or to edit section details
- Select the **Delete** link to delete the section

## Tips

> **Tip:** The "Counts Toward Load" checkbox determines whether a course's sections factor into instructor workload calculations. Uncheck it for independent studies, thesis credits, etc.

> **Tip:** Sections are term-specific. When you switch terms in the sidebar, you'll see different sections for the same courses.

> **Tip:** Select any column header (Dept, Course #, Title, Credits, Sections) to sort the course list by that column. Select again to reverse the sort order.

> **Tip:** The **Trend** column shows a sparkline of recent enrollment history for each course. Select the sparkline to open a detailed enrollment trend dialog with forecast enrollment, suggested number of sections, and a suggested enrollment cap per section.

> **Tip:** Enrollment forecasts in the trend dialog include a confidence indicator and trend direction, helping you set appropriate enrollment caps when creating sections.
