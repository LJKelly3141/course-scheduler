# Plan: Windows Portable Build + GitHub Releases via CI

## Context

The app currently builds macOS DMG locally. The user needs a Windows portable version (no admin rights — unzip and run). Since PyInstaller can't cross-compile, GitHub Actions builds the Windows version on a Windows runner. The macOS DMG continues to be built locally and manually uploaded to the GitHub Release.

## Scope

- Rename the app: package name `chairsdesk`, display name "The Chair's Desk"
- GitHub Actions workflow: builds Windows NSIS installer + portable ZIP on tag push or manual dispatch
- GitHub Releases: creates a draft release and uploads Windows artifacts. User manually uploads DMG.
- Windows icon in `build/`
- Windows build script in `package.json`

Homebrew Cask is a follow-up (not in this plan).

## Step 0: Rename the app

**File:** `package.json`

Change these fields:
- `"name"`: `"course-scheduler"` → `"chairsdesk"`
- `"productName"` (in `"build"`): `"Course Scheduler"` → `"The Chair's Desk"`
- `"appId"` (in `"build"`): `"app.coursescheduler"` → `"app.chairsdesk"`

**File:** `electron/main.cjs`
- Window title is set from the loaded HTML `<title>` tag or Electron defaults to productName — verify and update if hardcoded

**File:** `frontend/index.html`
- Update `<title>` tag to `The Chair's Desk`

**Note:** The database path uses `app.getPath("userData")` which derives from the app name. Changing the name will change the path from `course-scheduler/` to `chairsdesk/`. Need to handle migration of existing databases:
- On first launch, check if `~/Library/Application Support/course-scheduler/scheduler.db` (macOS) or `%APPDATA%\course-scheduler\scheduler.db` (Windows) exists at the old path
- If so, copy it to the new path
- This goes in `electron/main.cjs` startup logic

## Files to Create/Modify

| File | Change |
|------|--------|
| `package.json` | Rename app, add `"win"` + `"nsis"` targets, add `build:backend:win` script |
| `frontend/index.html` | Update `<title>` to "The Chair's Desk" |
| `electron/main.cjs` | Add database migration from old app name path |
| `build/icon.ico` | Copy from `department-chair-scheduler-icon.ico` |
| `.github/workflows/release.yml` | **New** — CI workflow |

## Step 1: Copy Windows icon

Copy `department-chair-scheduler-icon.ico` → `build/icon.ico`

Electron-builder expects icons at `build/icon.ico` for Windows.

## Step 2: Add Windows config to `package.json`

Add `"win"` and `"nsis"` sections to the existing `"build"` config:

```json
"win": {
  "target": ["nsis", "dir"],
  "icon": "build/icon.ico"
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "perMachine": false,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "deleteAppDataOnUninstall": false
}
```

This produces:
- **NSIS installer** (`.exe`) — defaults to per-user install (`%LOCALAPPDATA%`), but user can choose per-machine (`Program Files`) during install if they have admin rights. The `allowToChangeInstallationDirectory` + `perMachine: false` combo lets both scenarios work from one installer.
- **Unpacked directory** — the workflow zips this for the portable version.

Add a Windows-compatible backend build script:

```json
"build:backend:win": "cd backend && venv\\Scripts\\pyinstaller course_scheduler.spec --noconfirm"
```

## Step 3: Create GitHub Actions workflow

**File:** `.github/workflows/release.yml`

**Triggers:**
- Tag push matching `v*` (e.g., `v1.0.0`)
- Manual dispatch (workflow_dispatch) for testing

**Single job:**

### Windows build + release (`windows-latest`)
1. Checkout
2. Setup Node.js 20, Python 3.11
3. Create venv: `python -m venv backend\venv && backend\venv\Scripts\pip install -e "backend[dev]"`
4. `npm ci && cd frontend && npm ci`
5. `npm run build:frontend`
6. `npm run build:backend:win`
7. `npx electron-builder --win --dir`
8. Zip `dist-electron/win-unpacked/` → `Course-Scheduler-windows-portable.zip`
9. Create GitHub Release for the tag
10. Upload three assets: NSIS installer (`.exe`), portable ZIP, and auto-generated release notes
11. Release is created as a draft so you can manually upload the macOS DMG before publishing

**Windows artifacts produced:**
- `Course Scheduler Setup X.X.X.exe` — NSIS installer (per-user default, per-machine option with admin)
- `Course-Scheduler-windows-portable.zip` — Unzip and run, no install

**CI minutes estimate:** ~10 min Windows (×2 = 20 counted minutes per release). Budget: ~100 releases/month from 2000 min.

## Step 4: Add `build:backend:win` to the pip install

The `pyproject.toml` lists `requires-python = ">=3.11"` but the local venv is 3.9. CI uses 3.11. No change needed — the spec works on both. But need to ensure the CI installs `icalendar` and `pytz` (they're in the dependency list already).

## Verification

1. Push the workflow and tag `v0.0.1-test`
2. Check GitHub Actions — Windows job should pass
3. Check GitHub Releases — should have a draft release with NSIS installer + portable ZIP attached
4. Optionally: build DMG locally with `npm run build:app`, upload to the draft release, then publish
5. Download the Windows artifacts, test on a Windows machine:
   - **Portable:** Unzip, double-click `Course Scheduler.exe`
   - **Installer:** Run Setup .exe, install per-user or per-machine, launch from Start Menu
   - Both: backend should start, database created in `%APPDATA%\course-scheduler\`
6. Local `npm run build:app` still works unchanged for macOS development builds
