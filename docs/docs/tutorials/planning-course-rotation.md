# Planning Course Rotation

Build a multi-semester plan that defines which courses your department offers each term, how many sections to run, and on what schedule -- then apply it to generate sections automatically.

## Prerequisites

- Courses imported into the system (see [Importing Schedule Data](?page=tutorial-import))
- At least one draft term to apply the plan to

## Step 1: Open the Course Rotation Page

Click **Course Rotation** in the sidebar. The page shows a list of course cards, each with semester rows for Fall, Spring, Summer, and Winter. If this is your first time here, the plan will be empty.

## Step 2: Add Courses to the Rotation

1. Click **+ Add Course** in the toolbar
2. Search for a course by department code, number, or title (e.g., "ECON 226" or "Microeconomics")
3. Select the course from the results
4. The course appears as a new card with a default Fall offering (1 section, cap 30, In Person, Every Year)

Repeat for each course your department offers. Courses already in the plan are excluded from search results, so you will not accidentally add duplicates.

## Step 3: Configure Semester Offerings

Each course card has four semester rows: Fall, Spring, Summer, and Winter. Configure what you offer each semester.

1. Click a course card to expand it
2. Under a semester (e.g., Fall), click **+ Add** to create a new offering
3. Fill in the details:
   - **Sections** -- How many sections to run (e.g., 2)
   - **Enrollment Cap** -- Max students per section (e.g., 35)
   - **Modality** -- In Person, Online, Hybrid, or HyFlex
   - **Year Parity** -- How often to offer it:
     - **Every Year** (green dot) -- Offered annually
     - **Even Years** (blue dot) -- Offered in even-numbered academic years only
     - **Odd Years** (purple dot) -- Offered in odd-numbered academic years only
   - **Time Block** -- Preferred time slot (optional), or "No time assigned"
   - **Notes** -- Any additional information

For example, ECON 226 Principles of Microeconomics might have:
- **Fall**: 2 sections, cap 35, In Person, Every Year
- **Spring**: 1 section, cap 35, In Person, Every Year
- **Summer**: 1 section, cap 30, Online, Even Years

## Step 4: Use Year Parity for Alternating Courses

Year parity is especially useful for upper-division courses that do not run every semester. The color dots on each offering make the pattern visible at a glance:

- **Green** = Every Year -- core courses like ECON 226
- **Blue** = Even Years -- e.g., ECON 415 Advanced Econometrics offered in even years
- **Purple** = Odd Years -- e.g., ECON 420 International Trade offered in odd years

When you apply the rotation to a term, the system checks the academic year and only creates sections for offerings whose parity matches.

## Step 5: Copy Offerings Across Semesters

If a course runs with the same configuration in multiple semesters, use the copy feature instead of re-entering everything.

1. Click an existing offering row to open it for editing
2. Click one of the **Copy to** buttons (Fall, Spring, Summer, or Winter)
3. The offering is duplicated to the target semester with the same settings
4. Adjust any details if needed (e.g., different cap or modality for summer)

## Step 6: Save the Plan

Changes are held locally until you save. A warning banner appears when you have unsaved changes.

1. Click **Save Plan** in the toolbar, or press **Cmd+S** (Mac) / **Ctrl+S** (Windows)
2. The plan is saved to the database

If you try to navigate away with unsaved changes, the browser prompts you to confirm.

## Step 7: Apply the Rotation to a Term

This is where the plan turns into actual sections in your schedule.

1. Click **Apply to Term** in the toolbar
2. Select a **draft term** from the dropdown (finalized terms cannot be modified) and click **Next**
3. **Select Instructors** -- Choose which instructors to include. They are grouped by type (Faculty, IAS, NIAS, Adjunct). Instructors you do not select will appear as TBD on the created sections. Use the group-level "Include All" button or check individuals.
4. Click **Apply**

The system matches rotation entries to the term's semester type and academic year parity, then creates sections. The results dialog shows:
- How many rotation entries matched the term
- How many new sections were created
- How many meetings were scheduled (when time blocks were specified)
- A detail table listing each created section

Existing sections in the term are preserved -- Apply does not duplicate or overwrite them.

## Step 8: Import from an Existing Term

If you already have a well-built schedule and want to use it as the basis for your rotation plan, import it rather than building from scratch.

1. Click **Import from Term** in the toolbar
2. **Step 1** -- Select the source term (e.g., "Fall 2025") and click **Next**
3. **Step 2** -- Select which instructors to include by name (others appear as TBD) and click **Next**
4. **Step 3** -- Preview the extracted offerings grouped by course, modality, and time block. Use checkboxes to select or deselect entries.
5. Click **Import** to add the offerings to your rotation plan

The imported entries are mapped to the appropriate semester column based on the source term's type (e.g., importing from a Fall term populates the Fall column).

## What You've Learned

- How to add courses to the rotation plan and configure semester offerings
- How year parity (Every Year, Even Years, Odd Years) controls alternating-year scheduling
- How to copy offerings across semesters to save time
- How to apply the rotation plan to a draft term to auto-generate sections
- How to import offerings from an existing term to seed the rotation plan

## What's Next

To create a new term based on an existing one with all its sections and assignments, see [Copying a Term for Next Semester](?page=tutorial-copy-term).
