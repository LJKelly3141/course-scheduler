# Database Location Chooser

## Problem

The app stores its SQLite database at a fixed path (`AppData/Roaming/The Chair's Desk/scheduler.db` on Windows, `Application Support/` on macOS). Users have no way to choose where their data lives. This matters for:

- Portable users who want data alongside the app or on a USB drive
- Users who keep data on a cloud-synced folder (OneDrive, Dropbox)
- Multi-machine users who want the database on a network share

## Design

### Config File

A JSON config file at `app.getPath("userData")/config.json` stores the user's chosen database path. This file is always in AppData regardless of where the database itself lives.

```json
{
  "databasePath": "C:\\Users\\Logan\\Dropbox\\scheduler.db"
}
```

If no config file exists, the app uses the default path (`app.getPath("userData")/scheduler.db`).

### First-Launch Dialog

**When:** No `config.json` exists AND no database file at the default path (true first run).

**How:** Electron-native `dialog.showSaveDialogSync` before the backend starts. This must be native because the React UI hasn't loaded yet.

**Behavior:**
1. Show a save dialog with title "Choose Database Location"
2. Default filename: `scheduler.db`
3. Default directory: `app.getPath("userData")`
4. Filters: `[{ name: "SQLite Database", extensions: ["db"] }]`
5. If user picks a path: write it to `config.json`, use it
6. If user cancels: use the default path, write that to `config.json`

### Startup Flow (main.cjs)

```
app.whenReady()
  1. Read config.json → get databasePath (or null)
  2. If no config AND no database at default path:
     → Show first-launch dialog
     → Write chosen path to config.json
  3. If no config BUT database exists at default path:
     → Write default path to config.json (existing install, first upgrade)
  4. Resolve final databasePath from config.json
  5. Ensure parent directory exists (mkdir -p)
  6. migrateDatabase() (handles old path migration)
  7. startBackend() with DATABASE_PATH env var
  8. pollBackendHealth()
  9. createWindow()
```

### Settings Page — Change Location

**UI:** A "Change Location" button in the existing Database section on the Settings page.

**Flow:**
1. User clicks "Change Location"
2. Confirmation dialog appears with three options:
   - **Copy database to new location** — copies the .db file, updates config, prompts restart
   - **Start fresh at new location** — updates config only, prompts restart (new empty database created on next launch)
   - **Cancel** — no changes
3. If copy or fresh: call `POST /api/settings/database-relocate`
4. Backend performs the copy (if requested) and returns the new path
5. Frontend shows "Restart the app to use the new database location"
6. On restart, Electron reads the updated config.json and starts backend with new path

**Backend endpoint:** `POST /api/settings/database-relocate`
```json
// Request
{
  "new_path": "/path/to/scheduler.db",
  "copy_existing": true
}

// Response
{
  "success": true,
  "new_path": "/path/to/scheduler.db",
  "copied": true
}
```

The endpoint writes the new path to config.json (which lives at a known location relative to the database) and optionally copies the database file.

**Important:** The config.json write must happen from Electron, not the backend, because only Electron knows `app.getPath("userData")`. Two options:

- **Option A:** Backend returns success, frontend sends an IPC message to Electron to update config.json. Requires adding Electron IPC (preload script).
- **Option B (simpler):** The backend endpoint receives the config path as a parameter and writes it directly. Electron passes the config path to the backend as an env var at startup.

**Chosen: Option B.** Pass `CONFIG_PATH` env var to backend alongside `DATABASE_PATH`. The relocate endpoint writes the new path there.

### Environment Variables Passed to Backend

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_PATH` | Resolved path to scheduler.db | Where SQLite connects |
| `CONFIG_PATH` | Path to config.json in userData | Where relocate endpoint writes new path |

### Edge Cases

- **Config points to missing file:** Backend creates a new empty database at that path (normal SQLite behavior). No error.
- **Config points to inaccessible path:** Backend startup fails. Electron shows error dialog and deletes config.json so next launch shows the chooser again.
- **Old migration path:** `migrateDatabase()` still runs. If old-path database exists and new-path doesn't, it copies. Config.json records the final path.
- **Portable alongside exe:** User can pick a path next to the exe on first launch. Works naturally.

### Files to Modify

- `electron/main.cjs` — config.json read/write, first-launch dialog, pass CONFIG_PATH
- `backend/app/database.py` — no changes (already reads DATABASE_PATH)
- `backend/app/api/routes/settings.py` — add relocate endpoint
- `frontend/src/pages/SettingsPage.tsx` — add Change Location button and confirmation dialog

### Not In Scope

- Auto-detecting databases on removable drives
- Multiple database profiles / switching between databases
- Real-time database path changes without restart
