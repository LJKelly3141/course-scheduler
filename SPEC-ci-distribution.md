# CI/CD Build & Distribution Spec

Automated GitHub Actions builds for macOS DMG and Windows installer, plus Homebrew Cask distribution.

---

## 1. GitHub Actions: Cross-Platform Builds

### 1.1 Trigger

- On push of a git tag matching `v*` (e.g., `v1.0.0`, `v1.2.3-beta`)
- Manual dispatch via `workflow_dispatch` for testing

### 1.2 Workflow File

Create `.github/workflows/build.yml`

### 1.3 macOS Job (`build-macos`)

**Runner**: `macos-latest` (Apple Silicon, also builds x64 via universal binary or separate job)

**Steps**:
1. Checkout repo
2. Set up Node.js 20
3. Set up Python 3.9 (match production version)
4. Install frontend deps: `cd frontend && npm ci`
5. Build frontend: `cd frontend && npm run build`
6. Create Python venv and install backend deps:
   ```
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -e ".[dev]"
   pip install bcrypt==4.0.1 pyinstaller
   ```
7. Build backend binary: `cd backend && ./venv/bin/pyinstaller course_scheduler.spec --noconfirm`
8. Install Electron deps: `npm ci` (root package.json)
9. Build DMG: `npx electron-builder --mac`
10. Upload `dist-electron/*.dmg` as release artifact

**Code Signing** (required for Gatekeeper):
- Store Apple Developer ID cert as base64 in GitHub secret `MAC_CERTIFICATE`
- Store cert password in `MAC_CERTIFICATE_PASSWORD`
- Store Apple ID + app-specific password for notarization in `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- Add to `package.json` build config:
  ```json
  "mac": {
    "target": "dmg",
    "category": "public.app-category.education",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "afterSign": "electron-builder-notarize"
  ```
- Create `build/entitlements.mac.plist` allowing JIT (needed for Python binary)
- Install `electron-builder-notarize` or use `@electron/notarize` in afterSign hook

**Without code signing** (unsigned builds):
- Builds will work but users must right-click > Open to bypass Gatekeeper
- Fine for internal UWRF use; skip signing config and notarization steps

### 1.4 Windows Job (`build-windows`)

**Runner**: `windows-latest`

**Steps**:
1. Checkout repo
2. Set up Node.js 20
3. Set up Python 3.9
4. Install frontend deps: `cd frontend && npm ci`
5. Build frontend: `cd frontend && npm run build`
6. Create Python venv and install backend deps:
   ```
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -e ".[dev]"
   pip install bcrypt==4.0.1 pyinstaller
   ```
7. Build backend binary: `cd backend && venv\Scripts\pyinstaller course_scheduler.spec --noconfirm`
8. Install Electron deps: `npm ci`
9. Build installer: `npx electron-builder --win`
10. Upload `dist-electron/*.exe` as release artifact

**Windows package.json config** — add to `build` section:
```json
"win": {
  "target": ["nsis"],
  "icon": "build/icon.ico"
},
"nsis": {
  "oneClick": true,
  "perMachine": false,
  "allowToChangeInstallationDirectory": false,
  "deleteAppDataOnUninstall": false
}
```

**Code Signing** (optional, prevents SmartScreen warnings):
- Requires an EV code signing certificate (expensive, ~$300-500/yr)
- Store cert as `WIN_CSC_LINK` (base64 pfx) and `WIN_CSC_KEY_PASSWORD`
- electron-builder auto-signs when these env vars are set

### 1.5 Release Job (`create-release`)

**Runs after** both build jobs complete.

**Steps**:
1. Download all build artifacts
2. Create GitHub Release from the tag using `softprops/action-gh-release`
3. Attach DMG and EXE installer to the release

### 1.6 Example Workflow

```yaml
name: Build & Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.9' }

      - name: Build frontend
        run: cd frontend && npm ci && npm run build

      - name: Build backend
        run: |
          cd backend
          python -m venv venv
          source venv/bin/activate
          pip install -e ".[dev]"
          pip install bcrypt==4.0.1 pyinstaller
          pyinstaller course_scheduler.spec --noconfirm

      - name: Build Electron (DMG)
        env:
          # Uncomment when code signing is set up:
          # CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          # CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
          # APPLE_ID: ${{ secrets.APPLE_ID }}
          # APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          # APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm ci
          npx electron-builder --mac

      - uses: actions/upload-artifact@v4
        with:
          name: macos-dmg
          path: dist-electron/*.dmg

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.9' }

      - name: Build frontend
        run: cd frontend && npm ci && npm run build

      - name: Build backend
        shell: bash
        run: |
          cd backend
          python -m venv venv
          source venv/Scripts/activate
          pip install -e ".[dev]"
          pip install bcrypt==4.0.1 pyinstaller
          pyinstaller course_scheduler.spec --noconfirm

      - name: Build Electron (Windows installer)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm ci
          npx electron-builder --win

      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: dist-electron/*.exe

  release:
    needs: [build-macos, build-windows]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with: { path: artifacts }

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/macos-dmg/*.dmg
            artifacts/windows-installer/*.exe
          generate_release_notes: true
```

---

## 2. Pre-Requisites & Config Changes

### 2.1 Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/build.yml` | CI workflow (above) |
| `build/icon.icns` | macOS app icon (1024x1024) |
| `build/icon.ico` | Windows app icon (256x256) |
| `build/icon.png` | Linux/fallback icon (512x512) |
| `build/entitlements.mac.plist` | macOS entitlements for hardened runtime |

### 2.2 `build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
</dict>
</plist>
```

### 2.3 `package.json` Updates

Add Windows target and icon paths to the existing `build` config:
```json
"build": {
  "appId": "app.coursescheduler",
  "productName": "Course Scheduler",
  "directories": { "output": "dist-electron" },
  "files": ["electron/**/*"],
  "extraResources": [
    { "from": "frontend/dist", "to": "frontend/dist" },
    { "from": "backend/dist/course_scheduler", "to": "backend" }
  ],
  "mac": {
    "target": "dmg",
    "category": "public.app-category.education",
    "icon": "build/icon.icns"
  },
  "dmg": {
    "title": "Course Scheduler",
    "contents": [
      { "x": 130, "y": 220 },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ]
  },
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": true,
    "perMachine": false,
    "deleteAppDataOnUninstall": false
  }
}
```

---

## 3. Homebrew Cask Distribution

### 3.1 Overview

Homebrew Casks distribute macOS `.dmg` / `.zip` apps. Users install via:
```
brew install --cask course-scheduler
```

### 3.2 Option A: Personal Homebrew Tap (Recommended to Start)

A "tap" is a GitHub repo named `homebrew-<name>` containing Cask formulas.

**Setup steps**:

1. **Create repo**: `github.com/<your-org>/homebrew-course-scheduler`

2. **Create Cask file** at `Casks/course-scheduler.rb`:
   ```ruby
   cask "course-scheduler" do
     version "1.0.0"
     sha256 "REPLACE_WITH_SHA256_OF_DMG"

     url "https://github.com/<your-org>/course-scheduler/releases/download/v#{version}/Course-Scheduler-#{version}.dmg"
     name "Course Scheduler"
     desc "UWRF department course scheduling tool"
     homepage "https://github.com/<your-org>/course-scheduler"

     app "Course Scheduler.app"

     zap trash: [
       "~/Library/Application Support/Course Scheduler",
       "~/Library/Preferences/app.coursescheduler.plist",
     ]
   end
   ```

3. **Users install via**:
   ```
   brew tap <your-org>/course-scheduler
   brew install --cask course-scheduler
   ```

### 3.3 Automating Cask Updates

Add a job to the release workflow that auto-updates the Cask formula on each release:

```yaml
  update-homebrew:
    needs: [release]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
        with:
          repository: <your-org>/homebrew-course-scheduler
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}

      - name: Download DMG for SHA256
        run: |
          VERSION=${GITHUB_REF_NAME#v}
          curl -L -o course-scheduler.dmg \
            "https://github.com/<your-org>/course-scheduler/releases/download/v${VERSION}/Course-Scheduler-${VERSION}.dmg"
          SHA=$(shasum -a 256 course-scheduler.dmg | awk '{print $1}')
          echo "VERSION=$VERSION" >> $GITHUB_ENV
          echo "SHA256=$SHA" >> $GITHUB_ENV

      - name: Update Cask formula
        run: |
          sed -i "s/version \".*\"/version \"$VERSION\"/" Casks/course-scheduler.rb
          sed -i "s/sha256 \".*\"/sha256 \"$SHA256\"/" Casks/course-scheduler.rb

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/course-scheduler.rb
          git commit -m "Update course-scheduler to $VERSION"
          git push
```

**Required secret**: `HOMEBREW_TAP_TOKEN` — a personal access token with `repo` scope for the tap repo.

### 3.4 Option B: Submit to homebrew-cask (Public)

For wider distribution, submit a PR to `Homebrew/homebrew-cask`. Requirements:
- App must be signed and notarized
- Must have a stable public release URL
- Must meet Homebrew's notable-app criteria (500+ GitHub stars or significant user base)
- Not realistic for an internal UWRF tool — use a tap instead

---

## 4. Implementation Checklist

### Phase 1: Prepare Build Assets
- [ ] Create `build/` directory with app icons (icns, ico, png)
- [ ] Create `build/entitlements.mac.plist`
- [ ] Update `package.json` with Windows target config
- [ ] Verify local macOS build works: `npm run build:app`
- [ ] Test Windows build locally or in a VM

### Phase 2: GitHub Actions CI
- [ ] Create `.github/workflows/build.yml`
- [ ] Push and trigger with a test tag: `git tag v0.0.1-test && git push --tags`
- [ ] Verify macOS job produces a DMG artifact
- [ ] Verify Windows job produces an EXE artifact
- [ ] Verify release job attaches both to the GitHub Release

### Phase 3: Code Signing (Optional)
- [ ] Obtain Apple Developer ID certificate ($99/yr Apple Developer Program)
- [ ] Export cert as p12 and base64-encode: `base64 -i cert.p12 | pbcopy`
- [ ] Add GitHub secrets: `MAC_CERTIFICATE`, `MAC_CERTIFICATE_PASSWORD`
- [ ] Add notarization secrets: `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- [ ] Install `electron-builder-notarize` or configure `@electron/notarize`
- [ ] Uncomment signing env vars in workflow
- [ ] Test signed build — should open without Gatekeeper warning

### Phase 4: Homebrew Tap
- [ ] Create `homebrew-course-scheduler` repo on GitHub
- [ ] Add `Casks/course-scheduler.rb` formula
- [ ] Create `HOMEBREW_TAP_TOKEN` personal access token
- [ ] Add `update-homebrew` job to release workflow
- [ ] Test: `brew tap <org>/course-scheduler && brew install --cask course-scheduler`

---

## 5. Cost & Account Requirements

| Item | Cost | Required? |
|------|------|-----------|
| GitHub Actions | Free (2,000 min/mo on free plan; macOS uses 10x multiplier) | Yes |
| Apple Developer Program | $99/year | Only for code signing |
| Windows EV Code Signing Cert | ~$300-500/year | Optional (avoids SmartScreen) |
| Homebrew Tap repo | Free | Yes (for Homebrew) |

**For internal UWRF use without signing**: Total cost is $0. Users bypass Gatekeeper with right-click > Open (macOS) or "Run anyway" (Windows SmartScreen).
