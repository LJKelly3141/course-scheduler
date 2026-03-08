# Spec: Static HTML Schedule Export

## Overview

Export the current term's schedule as a self-contained, single-file HTML page that replicates the app's schedule grid in read-only form. The export can be saved locally or pushed to a GitHub Pages repository for sharing via URL.

## Functional Requirements

### Exported Page Content

- **Schedule grid** with the same weekly calendar layout (M/T/W/Th/F columns, 8 AM–9 PM time axis)
- **All three view modes**: By Room, By Instructor, By Level — switchable via tabs (client-side JS)
- **Filter dropdowns** per view mode (specific room, instructor, or level) — same as the app
- **Color legend** matching the active view mode
- **Online asynchronous sections table** below the grid
- **Header**: `{Term Name} Schedule — {Department}` (e.g., "Fall 2026 Schedule — Economics Department")
- **No** dashboard, conflict sidebar, or edit/delete controls (read-only)

### Architecture

- **Backend API endpoint** generates the HTML using a Jinja2 template
- Endpoint: `GET /api/terms/{term_id}/export/html`
- Returns a complete self-contained `.html` file
- All CSS is inlined in a `<style>` tag
- All JS is inlined in a `<script>` tag (vanilla JS, no frameworks)
- All schedule data is embedded as a JSON blob in a `<script>` tag

### Data Embedded in Export

The backend serializes and embeds as JSON:

```json
{
  "term": { "id": 1, "name": "Fall 2026", ... },
  "meetings": [ ... ],
  "sections": [ ... ],
  "rooms": [ ... ],
  "instructors": [ ... ],
  "timeBlocks": [ ... ],
  "entityColors": [ "#4F46E5", ... ],
  "department": "Economics"
}
```

### Client-Side Rendering (Vanilla JS)

The embedded JS reads the JSON data and:

1. Builds color maps for rooms, instructors, and levels (same logic as the app)
2. Renders the weekly grid using CSS Grid + absolute positioning for meeting cards
3. Renders meeting cards with the modern tinted style (colored left border, light tinted background, dark text)
4. Handles tab switching between view modes (re-renders grid with new color function)
5. Handles filter dropdown changes (filters meetings, re-renders)
6. Renders the online async sections table below the grid
7. Renders the color legend for the active view mode

### Settings Page

Add a **Settings** page accessible from the app navigation with:

| Field | Description | Storage |
|-------|-------------|---------|
| `export_directory` | Local filesystem path for HTML exports | DB (app_settings table) |
| `github_repo_url` | GitHub repository URL for Pages deployment | DB (app_settings table) |
| `github_token` | Personal access token (PAT) with `repo` scope | DB (app_settings table, stored as-is since this is a local-only app) |

### Local Export

- **Trigger**: "Export HTML" button on the Schedule page
- **Behavior**: Backend generates the HTML, writes it to `{export_directory}/{term-slug}.html`
  - Term slug: lowercased, spaces replaced with hyphens (e.g., `fall-2026.html`)
- **Response**: Returns the file path that was written
- If `export_directory` is not configured, return an error prompting the user to set it in Settings

### GitHub Pages Export

- **Trigger**: "Publish to GitHub Pages" button on the Schedule page
- **Behavior**:
  1. Backend generates the HTML file
  2. Uses GitHub API (via `requests` or `httpx`) to push the file to the configured repo
  3. File path in repo: `{term-slug}.html` (e.g., `fall-2026.html`)
  4. Commit message: `Update schedule: {term name}`
  5. If the repo doesn't exist and the token has sufficient permissions, offer to create it with GitHub Pages enabled (auto-create via API)
  6. If the repo exists, commit and push the file (create or update)
- **Shareable URL**: `https://{username}.github.io/{repo-name}/{term-slug}.html`
- **Response**: Returns the GitHub Pages URL for the published schedule

### GitHub API Integration

- Use GitHub REST API v3 (Contents API for file operations)
- `PUT /repos/{owner}/{repo}/contents/{path}` to create/update files
- `POST /user/repos` to create a new repo if needed
- After creating a repo, enable GitHub Pages via `POST /repos/{owner}/{repo}/pages` with source `{ "branch": "main", "path": "/" }`
- Parse `github_repo_url` to extract owner and repo name

## Technical Design

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/app/api/routes/settings.py` | CRUD endpoints for app settings |
| `backend/app/api/routes/export.py` | Export endpoints (HTML generation, GitHub push) |
| `backend/app/models/settings.py` | `AppSetting` model (key-value store) |
| `backend/app/services/html_export.py` | Jinja2 template rendering + GitHub API calls |
| `backend/app/templates/schedule_export.html` | Jinja2 template for the exported page |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/SettingsPage.tsx` | Settings form (export dir, GitHub config) |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/main.py` | Register new routers (settings, export) |
| `frontend/src/App.tsx` or router config | Add Settings route |
| `frontend/src/pages/SchedulePage.tsx` | Add Export HTML / Publish buttons |

### Database Migration

New `app_settings` table:

```sql
CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL
);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get all settings (as key-value object) |
| `PUT` | `/api/settings` | Update settings (partial update) |
| `GET` | `/api/terms/{id}/export/html` | Download generated HTML file |
| `POST` | `/api/terms/{id}/export/local` | Save HTML to configured export directory |
| `POST` | `/api/terms/{id}/export/github` | Push HTML to GitHub Pages repo |

### Exported HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Term Name} Schedule — {Department}</title>
  <style>
    /* All CSS inlined: grid layout, card styles, tabs, legend, table */
  </style>
</head>
<body>
  <header>
    <h1>{Term Name} Schedule</h1>
    <p>{Department} Department</p>
  </header>

  <div id="controls">
    <!-- View mode tabs + filter dropdown (populated by JS) -->
  </div>

  <div id="legend">
    <!-- Color legend pills (populated by JS) -->
  </div>

  <div id="schedule-grid">
    <!-- Day columns + time axis + meeting cards (rendered by JS) -->
  </div>

  <div id="online-sections">
    <!-- Online async table (rendered by JS) -->
  </div>

  <script>
    const DATA = { /* embedded JSON */ };
    // Vanilla JS: grid rendering, tab switching, filtering
  </script>
</body>
</html>
```

## UI Flow

1. User navigates to **Schedule** page, selects a term
2. User clicks **Export** dropdown button (next to "+ Add Meeting")
3. Dropdown shows:
   - **Download HTML** — triggers browser download of the file
   - **Save to Export Directory** — saves to configured path, shows success toast with file path
   - **Publish to GitHub Pages** — pushes to GitHub, shows success toast with shareable URL
4. If Settings are not configured, the menu items show a note linking to Settings page

## Edge Cases

- **No meetings**: Export an empty grid with a "No scheduled meetings" message
- **GitHub repo doesn't exist**: Attempt to create it; show error if token lacks permissions
- **GitHub token invalid/expired**: Show clear error message
- **Export directory doesn't exist**: Attempt to create it; show error if permissions fail
- **Term slug collision**: Overwrite the existing file (this is the expected behavior for updates)
- **Large schedules**: All rendering is client-side so the file works regardless of size
