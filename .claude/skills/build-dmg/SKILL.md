---
name: build-dmg
description: Build the macOS DMG locally without tagging, pushing, or creating a release. Use when the user says "build dmg", "local build", or "test build".
---

Build The Chair's Desk macOS DMG locally for testing. No version bump, no git operations, no release.

## Steps

1. Run the full build:
   ```bash
   npm run build:app
   ```
   This runs `build:frontend` + `build:backend` + `electron-builder` and produces a DMG in `dist-electron/`.

2. After the build completes, find the DMG file:
   ```bash
   ls -lt dist-electron/*.dmg | head -1
   ```

3. If no DMG file is found, stop and report the error.

4. Report the DMG path and file size to the user so they can install and test it.
