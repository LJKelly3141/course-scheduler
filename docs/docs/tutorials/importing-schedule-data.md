# Importing Schedule Data

Import your rooms, instructors, courses, and schedule from spreadsheet files so you do not have to enter everything manually.

## Prerequisites

- The app installed and running
- At least one term created (see [Setting Up Your First Term](?page=tutorial-first-term))
- XLSX or CSV files with your data (registrar exports, room lists, faculty rosters)

## Step 1: Prepare Your Files

The import system expects specific columns in your spreadsheets. You do not need exact column names -- the importer auto-detects columns and lets you adjust the mapping -- but having data organized helps.

Here is what you will need for each import type:

| Import | Key Columns |
|--------|------------|
| Rooms | building_name, building_abbreviation, room_number, capacity |
| Instructors | name, email, department, modality_constraint, max_credits |
| Courses | department_code, course_number, title, credits |
| Schedule | course, section, days, start_time, end_time, room, instructor |

## Step 2: Import Rooms First

Rooms must exist before you can import a schedule, because the schedule importer matches room references to existing room records.

1. Click **Import / Export** in the sidebar
2. Select the **Rooms** import tab
3. Click **Choose File** and select your rooms spreadsheet
4. Review the column mapping -- the system auto-detects columns like `building_name`, `abbreviation`, `room_number`, and `capacity`
5. Adjust any incorrect mappings using the dropdown selectors
6. Review the preview table -- each row shows the parsed data with any validation errors highlighted
7. Fix errors inline if needed (click a cell to edit)
8. Click **Import** to save the rooms to the database

For example, a rooms file might contain rows like:

| building_name | building_abbreviation | room_number | capacity |
|--------------|----------------------|-------------|----------|
| North Hall | NH | 301 | 35 |
| North Hall | NH | 205 | 50 |
| Centennial Science Hall | CSH | 110 | 120 |

## Step 3: Import Instructors

Next, import your faculty roster so the schedule importer can match instructor names.

1. Select the **Instructors** import tab
2. Upload your instructor spreadsheet
3. Review and adjust the column mapping for `name`, `email`, `department`, `modality_constraint`, and `max_credits`
4. Preview the data and fix any errors
5. Click **Import**

Modality constraint values: `any`, `in_person_only`, or `online_only`. If your spreadsheet does not include this column, all instructors default to "any."

## Step 4: Import Courses

Import your course catalog so sections can be linked to courses.

1. Select the **Courses** import tab
2. Upload your course catalog spreadsheet
3. Review the column mapping for `department_code`, `course_number`, `title`, and `credits`
4. Preview and verify -- look for duplicate courses or missing credit values
5. Click **Import**

A typical row: department_code `ECON`, course_number `226`, title `Principles of Microeconomics`, credits `3`.

## Step 5: Import the Schedule

This is the most powerful import. It reads a registrar or department schedule export, parses day codes and times, matches instructors, and creates sections and meetings in your term.

1. Select the **Schedule** import tab
2. Upload your schedule XLSX file
3. **Column Mapping** -- The system detects columns for course, section number, days (e.g., "MWF", "TTh"), start time, end time, building, room number, and instructor. Adjust any mappings that are incorrect.
4. **Preview** -- Review the parsed rows. The importer handles:
   - Day code parsing ("MWF" becomes M, W, F; "TTh" becomes T, Th)
   - Time format conversion (12-hour and 24-hour formats)
   - Modality detection (identifies online and async sections)
   - Session detection for summer terms
5. **Instructor Matching** -- The system uses fuzzy matching to link instructor names in the spreadsheet to existing instructor records. Review the matches:
   - High-confidence matches are auto-linked
   - Low-confidence matches are flagged for your review
   - You can change the match, select a different instructor, or create a new instructor record
6. **Select the target term** -- Choose which term these sections belong to
7. Click **Import** to commit

Nothing is saved until you click Import. The preview is entirely non-destructive -- use it to verify your data before committing.

## Step 6: Verify the Import

After importing, check that everything came through correctly:

1. Go to **Courses** and verify your course list
2. Go to **Instructors** and spot-check a few faculty members
3. Go to the **Schedule Grid** and look at the visual layout
4. Check the **Dashboard** for a summary of sections, credits, and any detected conflicts

If something looks wrong, you can undo the import or re-import with corrected data.

## What You've Learned

- The correct import order: Rooms, Instructors, Courses, then Schedule
- How to map spreadsheet columns to the expected fields
- How the preview workflow lets you review and edit data before committing
- How fuzzy instructor matching works and how to resolve low-confidence matches
- That nothing is saved until you explicitly click Import

## What's Next

With your data imported, you are ready to build and refine the schedule. See [Building a Schedule](?page=tutorial-build-schedule).
