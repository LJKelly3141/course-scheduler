# Exporting & Sharing

Generate spreadsheets, printable views, calendar files, and web-published schedules for your dean's office, faculty, and department records.

## Prerequisites

- A term with a completed schedule (see [Building a Schedule](?page=tutorial-build-schedule))
- For GitHub Pages publishing: GitHub configured in Settings (see [Settings](?page=settings))

## Step 1: Open the Export Menu

All schedule exports start from the Schedule Grid.

1. Click **Schedule Grid** in the sidebar
2. Make sure the correct term is selected in the term selector at the top
3. Click the **Export** dropdown in the toolbar

You will see several export options, each designed for a different audience and purpose.

## Step 2: Download an XLSX Spreadsheet

The Excel export produces a spreadsheet suitable for sharing with your dean's office or for further editing outside the app.

1. Click **Download XLSX** in the Export menu
2. The file downloads automatically (e.g., `Fall_2025_schedule.xlsx`)

Use this when you need to send the schedule to administrators who want to review or modify it in Excel.

## Step 3: Download an HTML Schedule

The HTML export generates a self-contained web page with your department name in the header, styled for printing.

1. Click **Download HTML** in the Export menu
2. The file downloads as a single `.html` file
3. Open it in any browser to view or print

This is useful for posting on a bulletin board, emailing as an attachment, or saving as a department archive.

## Step 4: Save to a Local Directory

If you have configured an export directory in Settings, you can write the HTML file there directly.

1. Click **Save to Local Directory** in the Export menu
2. The HTML file is saved to the folder you configured in **Settings > Local Export > Export Directory**

This is convenient for maintaining a shared drive or archive folder that others can access.

## Step 5: Publish to GitHub Pages

For a shareable link anyone can view in a browser:

1. First, configure GitHub in **Settings > GitHub Pages** if you have not already (you need a repository URL and a personal access token with `repo` scope)
2. From the Export menu, click **Push to GitHub Pages**
3. The app generates the HTML, commits it to your GitHub repository, and GitHub Pages serves it publicly
4. Copy the shareable URL to send to faculty, staff, or administration

The URL is displayed on the Settings page under **GitHub Pages URL**. Share this link with anyone who needs to see the schedule without installing the app.

## Step 6: Print Views

The Export menu includes three print-optimized views that open in a new browser tab:

- **Print -- By Room** -- Schedule grouped by room. Each room gets its own section with all meetings listed. Useful for posting on room doors or for facilities management.
- **Print -- By Instructor** -- Schedule grouped by instructor. Each faculty member gets their own section showing all their classes, times, and rooms. Useful for distributing individual schedules.
- **Print -- Master Grid** -- A compact grid with rooms as rows and time blocks as columns. Gives a full-department overview on one or two pages. Useful for department planning meetings.

Each view opens in a new tab with print-friendly styling. Use your browser's **Print** function (Cmd+P / Ctrl+P) to print or save as PDF.

## Step 7: Export ICS Calendar Files

Send instructors their class schedules as calendar files they can import into Outlook, Apple Calendar, or Google Calendar.

1. On the Schedule Grid, click the **Email Schedules** button
2. Select instructors from the list on the left (use **Select All** or check individually)
3. For each selected instructor, you can:
   - Click the **Calendar** icon to download their individual `.ics` file
   - Click the **Email** icon to open an email draft and download the `.ics` file
4. For bulk operations:
   - Click **Download All Selected Calendars** to get a ZIP file with individual `.ics` files for each instructor
   - Click **Email All Selected** to open an email to all selected instructors and download the ZIP

Each `.ics` file contains recurring weekly events for the instructor's classes, including course name, section number, room location, meeting times, and weekly recurrence through the term end date. Instructors import the file into their calendar app to see their teaching schedule alongside their other commitments.

## Step 8: Download the Faculty Load Report

The load report is a separate export focused on instructor workloads rather than the schedule itself.

1. Go to **Instructors** and click **Load Report** in the toolbar, or
2. Go to **Analytics > Workload** and click **Export to Excel**

The report downloads as an Excel file (e.g., `faculty_load_Fall_2025.xlsx`) with instructor assignments, reassigned time, subtotals with SUM formulas, and overload highlighting. See [Managing Instructor Workload](?page=tutorial-workload) for details on preparing the load data.

## Export Summary

| Export | Format | Audience | How to Access |
|--------|--------|----------|--------------|
| XLSX Schedule | Excel | Dean's office, registrar | Export menu |
| HTML Schedule | Web page | Department archive, email | Export menu |
| Local Directory | HTML file | Shared drives | Export menu |
| GitHub Pages | Public URL | Faculty, staff, admin | Export menu |
| Print By Room | Browser tab | Room postings, facilities | Export menu |
| Print By Instructor | Browser tab | Individual faculty | Export menu |
| Print Master Grid | Browser tab | Department meetings | Export menu |
| ICS Calendar | .ics files | Instructors (Outlook, etc.) | Email Schedules button |
| Faculty Load Report | Excel | Dean's office | Instructors or Analytics |

## What You've Learned

- How to export the schedule as XLSX, HTML, or published web page
- How to use print views for room postings, instructor distribution, and department planning
- How to generate and distribute ICS calendar files for instructors
- How to download the faculty load report
- Which export format is appropriate for each audience

## What's Next

To plan which courses your department offers each semester on a multi-year basis, see [Planning Course Rotation](?page=tutorial-rotation).
