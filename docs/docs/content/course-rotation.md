# Course Plan

This reference covers building and applying course plans, importing from existing terms, and managing offerings. For a hands-on walkthrough, see [Planning Your Course Plan](?page=tutorial-rotation).

The Course Plan page lets you build a multi-semester plan that defines which courses your department offers each semester, how many sections to run, and with what modality and time preferences. Once your plan is set, you can apply it to a term to auto-generate sections.

## Getting There

Navigate to **Course Plan** under **Planning** in the app sidebar.

## Key Concepts

- **Rotation Plan** — A reusable blueprint listing courses and their semester offerings
- **Offering** — A single entry within a course's semester: how many sections, enrollment cap, modality, time block, and year parity
- **Year Parity** — Whether a course is offered every year, even years only, or odd years only
- **Apply to Term** — Auto-creates sections in a draft term based on the saved rotation plan

## Building a Rotation Plan

### Add a Course

Select **+ Add Course** in the toolbar. A search dialog appears where you can find courses by department code, course number, or title. Selecting a course adds it to the plan with a default Fall offering (1 section, cap 30, In Person, Every Year).

Courses already in the plan are excluded from the search results.

### Course Cards

Each course in the plan appears as a collapsible card showing:
- Department code, course number, title, and credits
- Total sections and active semesters at a glance
- Four semester rows: Fall, Spring, Summer, Winter

Select the card header to collapse or expand it. Select the **X** button on the header to remove the course from the plan entirely.

### Adding Offerings

Under each semester, click **+ Add** (or **+ Add [Semester] offering** if the semester is empty) to open an inline form with these fields:

- **Sections** — Number of sections to create (1-20)
- **Enrollment Cap** — Maximum students per section
- **Modality** — In Person, Online, Hybrid, or HyFlex
- **Year Parity** — Every Year, Even Years, or Odd Years
- **Time Block** — Preferred time slot from the configured time blocks, or "No time assigned"
- **Notes** — Optional free-text notes

When adding a second offering to a semester that already has one, the form pre-fills values from the existing offering as smart defaults.

### Editing Offerings

Select any offering row to open it for inline editing. The edit form includes the same fields as the add form, plus:

- **Save** — Persist changes to the offering
- **Delete** — Remove this offering
- **Cancel** — Discard changes
- **Copy to** — Duplicate this offering to another semester (Fall, Spring, Summer, or Winter)

### Year Parity Indicators

Each offering displays a colored dot indicating its year parity:
- **Green** — Every Year
- **Blue** — Even Years
- **Purple** — Odd Years

### Saving

Changes to the rotation plan are held locally until you save. A warning banner appears when you have unsaved changes. Save using either:
- The **Save Plan** button in the toolbar
- The keyboard shortcut **Ctrl+S** (or **Cmd+S** on Mac)

If you try to navigate away with unsaved changes, the browser will prompt you to confirm.

## Apply to Term

Select **Apply to Term** to auto-generate sections in a draft term based on the saved rotation plan.

1. Select a draft term from the dropdown (finalized terms are not listed) and choose **Next**
2. **Select Instructors** — Choose which instructors to include by name. Instructors are grouped by type (Faculty, IAS, NIAS, Adjunct). All default to TBD. Use the group-level "Include All" button or check individual instructors.
3. Choose **Apply**
4. The system matches rotation entries to the term's semester type and the year's parity, then creates sections with instructor and room assignments based on your selections

The results dialog shows:
- How many rotation entries matched the term
- How many new sections were created
- How many meetings were scheduled (when time blocks were specified)
- A detail table listing each created section with its course, section number, cap, modality, and time

Existing sections in the term are preserved — Apply does not duplicate or overwrite them.

> **Tip:** If you have unsaved changes, a warning appears in the Apply dialog reminding you to save first so the latest plan is used.

> **Tip:** Instructors not checked in the selection step will appear as TBD in the created sections. You can assign them later on the Schedule Grid.

## Import from Term

Select **Import from Term** to pull section patterns from an existing term schedule into the rotation plan. This is a 3-step wizard:

1. **Select Term** — Choose any term from the dropdown and select **Next**
2. **Select Instructors** — Choose which instructors to include by name. Instructors from the term are grouped by type (Faculty, IAS, NIAS, Adjunct). All default to TBD. Use group-level toggles or check individual instructors, then select **Next**.
3. **Preview** — Review the extracted offering groups. Sections are grouped by course, modality, and time block. Instructors you selected in step 2 appear by name; others show as TBD. Use checkboxes to select or deselect entries, then select **Import**.

The imported entries are mapped to the appropriate semester column (Fall, Spring, Summer, or Winter) based on the source term's type. Imported course cards are automatically expanded. Use the **Back** button to return to previous steps without losing your selections.

> **Tip:** Import from Term is useful when you want to base your rotation plan on an existing schedule rather than building it from scratch.

## Copying Offerings

When editing an offering, use the **Copy to** buttons to duplicate it to another semester. This is helpful when a course runs with the same configuration in multiple semesters.

## Summary Bar

Below the course cards, a summary bar shows:
- Total courses planned
- Total sections across all offerings
- Maximum student credit hours (SCH), calculated as sections x enrollment cap x credits

## Tips

> **Tip:** You can add multiple offerings to the same course and semester — for example, one In Person section and one Online section in Fall.

> **Tip:** Use year parity to plan alternating-year courses. Set a course to "Even Years" or "Odd Years" and it will only generate sections when applied to a matching term year.

> **Tip:** The rotation plan is saved independently of any term. You can apply the same plan to multiple terms over time.
