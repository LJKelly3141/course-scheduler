# Database Location Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose where the SQLite database lives — on first launch via a native file dialog, and later via the Settings page.

**Architecture:** A `config.json` file in Electron's `userData` directory stores the chosen database path. Electron reads it at startup and passes `DATABASE_PATH` and `CONFIG_PATH` to the backend. The backend exposes a relocate endpoint that copies the database and updates config.json.

**Tech Stack:** Electron dialog API (native file picker), FastAPI endpoint, React Settings UI

---

### Task 1: Config file read/write in Electron

**Files:**
- Modify: `electron/main.cjs`

- [ ] **Step 1: Add config file helpers**

Add these functions after the existing `getDatabasePath()` function in `electron/main.cjs`:

```javascript
const { dialog } = require("electron");

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function writeConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
```

Also update the `require` line at the top of the file — add `dialog` to the destructured imports:

```javascript
const { app, BrowserWindow, Menu, dialog } = require("electron");
```

- [ ] **Step 2: Add first-launch dialog function**

Add this function after the config helpers:

```javascript
function showFirstLaunchDialog() {
  const defaultDir = app.getPath("userData");
  const result = dialog.showSaveDialogSync({
    title: "Choose Database Location",
    defaultPath: path.join(defaultDir, "scheduler.db"),
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });

  if (result) {
    return result;
  }
  // User cancelled — use default
  return path.join(defaultDir, "scheduler.db");
}
```

- [ ] **Step 3: Rewrite the startup flow**

Replace the existing `getDatabasePath()` function and the `app.whenReady()` block. The old `getDatabasePath()` returned a hardcoded path — the new `resolveDatabasePath()` reads from config or shows the first-launch dialog.

Remove the old `getDatabasePath()`:

```javascript
// DELETE this function:
// function getDatabasePath() {
//   const userDataPath = app.getPath("userData");
//   return path.join(userDataPath, "scheduler.db");
// }
```

Add `resolveDatabasePath()`:

```javascript
function resolveDatabasePath() {
  const config = readConfig();

  if (config.databasePath) {
    return config.databasePath;
  }

  // No config yet — check if an existing database is at the default location
  const defaultPath = path.join(app.getPath("userData"), "scheduler.db");

  if (fs.existsSync(defaultPath)) {
    // Existing install upgrading to config-based path tracking
    writeConfig({ databasePath: defaultPath });
    return defaultPath;
  }

  // True first launch — show dialog
  const chosenPath = showFirstLaunchDialog();
  writeConfig({ databasePath: chosenPath });
  return chosenPath;
}
```

- [ ] **Step 4: Update `migrateDatabase` to use resolved path**

Replace the `migrateDatabase()` function to accept the resolved path:

```javascript
function migrateDatabase(resolvedDbPath) {
  if (fs.existsSync(resolvedDbPath)) return;

  // Determine old path based on platform
  let oldDbPath;
  if (process.platform === "darwin") {
    oldDbPath = path.join(app.getPath("home"), "Library", "Application Support", "course-scheduler", "scheduler.db");
  } else if (process.platform === "win32") {
    oldDbPath = path.join(app.getPath("appData"), "course-scheduler", "scheduler.db");
  } else {
    oldDbPath = path.join(app.getPath("home"), ".config", "course-scheduler", "scheduler.db");
  }

  if (!fs.existsSync(oldDbPath)) return;

  const newDir = path.dirname(resolvedDbPath);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  console.log(`[electron] Migrating database from ${oldDbPath} to ${resolvedDbPath}`);
  fs.copyFileSync(oldDbPath, resolvedDbPath);
}
```

- [ ] **Step 5: Update `startBackend` to accept path and pass CONFIG_PATH**

Replace the `startBackend()` function:

```javascript
function startBackend(dbPath) {
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log("[electron] Dev mode: assuming backend is running externally.");
    return;
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[electron] Starting backend: ${backendPath}`);
  console.log(`[electron] Database path: ${dbPath}`);
  console.log(`[electron] Config path: ${getConfigPath()}`);

  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      CONFIG_PATH: getConfigPath(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("[electron] Failed to start backend:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[electron] Backend exited with code ${code}`);
    backendProcess = null;
  });
}
```

- [ ] **Step 6: Update `app.whenReady()` block**

Replace the entire `app.whenReady()` block:

```javascript
app.whenReady().then(async () => {
  isDev = !app.isPackaged;

  const dbPath = isDev
    ? path.join(app.getPath("userData"), "scheduler.db")
    : resolveDatabasePath();

  migrateDatabase(dbPath);
  startBackend(dbPath);

  try {
    await pollBackendHealth();
  } catch (err) {
    console.error("[electron]", err.message);
    if (!isDev) {
      dialog.showErrorBox(
        "The Chair's Desk",
        "The application backend failed to start. Please try again."
      );
      app.quit();
      return;
    }
  }

  createWindow();
  setupMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
```

- [ ] **Step 7: Verify the build still works**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors (Electron code isn't type-checked by tsc but this ensures no frontend breakage)

- [ ] **Step 8: Commit**

```bash
git add electron/main.cjs
git commit -m "feat: add config.json and first-launch database location dialog"
```

---

### Task 2: Backend relocate endpoint

**Files:**
- Modify: `backend/app/api/routes/settings.py`
- Test: `backend/tests/test_settings.py` (if exists, else manual verification)

- [ ] **Step 1: Add relocate request/response schemas**

Add these classes after the existing `DatabaseInfoResponse` class in `backend/app/api/routes/settings.py`:

```python
class DatabaseRelocateRequest(BaseModel):
    new_path: str
    copy_existing: bool = True


class DatabaseRelocateResponse(BaseModel):
    success: bool
    new_path: str
    copied: bool
```

- [ ] **Step 2: Add the relocate endpoint**

Add this endpoint after the existing `database_backup` endpoint:

```python
@router.post("/database-relocate", response_model=DatabaseRelocateResponse)
def database_relocate(payload: DatabaseRelocateRequest):
    """Relocate the database to a new path. Requires app restart."""
    import json
    import shutil

    new_path = os.path.abspath(os.path.expanduser(payload.new_path))

    # Ensure new directory exists
    new_dir = os.path.dirname(new_path)
    if not os.path.isdir(new_dir):
        try:
            os.makedirs(new_dir, exist_ok=True)
        except OSError as e:
            raise HTTPException(status_code=400, detail=f"Cannot create directory: {e}")

    # Copy existing database if requested
    copied = False
    if payload.copy_existing:
        current_db = os.environ.get("DATABASE_PATH", "./scheduler.db")
        current_db = os.path.abspath(current_db)
        if os.path.isfile(current_db) and os.path.abspath(new_path) != current_db:
            try:
                shutil.copy2(current_db, new_path)
                copied = True
            except OSError as e:
                raise HTTPException(status_code=400, detail=f"Failed to copy database: {e}")

    # Update config.json
    config_path = os.environ.get("CONFIG_PATH", "")
    if config_path and os.path.isfile(config_path):
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
        except (json.JSONDecodeError, OSError):
            config = {}
        config["databasePath"] = new_path
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

    return DatabaseRelocateResponse(
        success=True,
        new_path=new_path,
        copied=copied,
    )
```

- [ ] **Step 3: Run tests**

Run: `cd backend && source venv/bin/activate && pytest -x -q`
Expected: All tests pass (the new endpoint won't be called by existing tests)

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routes/settings.py
git commit -m "feat: add POST /settings/database-relocate endpoint"
```

---

### Task 3: Settings page — Change Location UI

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add state for the relocate flow**

At the top of the `SettingsPage` component, add state variables near the existing state declarations:

```tsx
const [showRelocate, setShowRelocate] = useState(false);
const [relocatePath, setRelocatePath] = useState("");
const [relocateCopy, setRelocateCopy] = useState(true);
const [relocateStatus, setRelocateStatus] = useState<string | null>(null);
```

Also add the import for `FolderOpen` icon at the top of the file alongside existing lucide imports:

```tsx
import { FolderOpen } from "lucide-react";
```

- [ ] **Step 2: Add the relocate mutation**

Add this mutation near the other mutations in the component:

```tsx
const relocateMutation = useMutation({
  mutationFn: (payload: { new_path: string; copy_existing: boolean }) =>
    api.post("/settings/database-relocate", payload),
  onSuccess: () => {
    setRelocateStatus("Database location updated. Please restart the app to use the new location.");
    setShowRelocate(false);
  },
  onError: () => {
    setRelocateStatus("Failed to relocate database. Check the path and try again.");
  },
});
```

- [ ] **Step 3: Add the Change Location UI to the Database section**

In the Database section of the JSX, after the existing "Download Backup" button and its description paragraph, add:

```tsx
            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRelocate(!showRelocate);
                  setRelocatePath(dbInfo?.path || "");
                  setRelocateStatus(null);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Change Location
              </Button>

              {relocateStatus && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {relocateStatus}
                </p>
              )}

              {showRelocate && (
                <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border">
                  <label htmlFor="relocate-path" className="text-sm font-medium">
                    New database path
                  </label>
                  <input
                    id="relocate-path"
                    type="text"
                    className="w-full border border-border rounded px-3 py-2 text-sm font-mono"
                    value={relocatePath}
                    onChange={(e) => setRelocatePath(e.target.value)}
                    placeholder="/path/to/scheduler.db"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="relocate-copy"
                      type="checkbox"
                      checked={relocateCopy}
                      onChange={(e) => setRelocateCopy(e.target.checked)}
                    />
                    <label htmlFor="relocate-copy" className="text-sm">
                      Copy existing database to new location
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!relocatePath.trim() || relocateMutation.isPending}
                      onClick={() =>
                        relocateMutation.mutate({
                          new_path: relocatePath,
                          copy_existing: relocateCopy,
                        })
                      }
                    >
                      {relocateMutation.isPending ? "Moving..." : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRelocate(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The app will need to be restarted after changing the database location.
                  </p>
                </div>
              )}
            </div>
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add Change Location button to Settings database section"
```

---

### Task 4: Full verification

**Files:** None (testing only)

- [ ] **Step 1: Run backend tests**

Run: `cd backend && source venv/bin/activate && pytest -x -q`
Expected: All tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Test the following in the running app:
- [ ] Settings > Database section shows current path and size
- [ ] "Change Location" button reveals the relocate form
- [ ] Form pre-fills with current database path
- [ ] "Copy existing database" checkbox is checked by default
- [ ] Confirm button calls the endpoint and shows restart message
- [ ] Cancel button hides the form

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: database location chooser — first-launch dialog and Settings relocate"
```
