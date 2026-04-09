---
name: release
description: Bump version, push tag to trigger CI builds (macOS + Windows), publish release, and update landing page.
---

This skill automates the full release process for The Chair's Desk. Execute the steps below sequentially. Stop and report to the user if any step fails.

## Step 1: Version Bump

1. Read `package.json` and extract the current `"version"` field.
2. Auto-increment the patch number (e.g., `1.0.0` -> `1.0.1`).
3. Use `AskUserQuestion` to present the auto-bumped version and let the user confirm or provide a different version string.
4. Edit `package.json` to set the confirmed version.

## Step 2: Commit, Tag, Push

1. Stage and commit the version bump:
   ```bash
   git add package.json
   git commit -m "Release vX.Y.Z"
   ```
2. Create the tag:
   ```bash
   git tag vX.Y.Z
   ```
3. Push commits and tag:
   ```bash
   git push origin main --tags
   ```
   The tag push triggers `.github/workflows/release.yml` which builds both macOS DMG and Windows installers, then creates a **draft** GitHub Release with all artifacts.

## Step 3: Wait for CI

1. Find the triggered workflow run:
   ```bash
   gh run list --workflow=release.yml --limit=1 --json databaseId,status -q '.[0].databaseId'
   ```
2. Wait for it to complete:
   ```bash
   gh run watch <run-id> --exit-status
   ```
   This blocks until the run finishes. Use a timeout of 600000ms (10 minutes).
3. If the run fails, report the failure URL and stop:
   ```bash
   gh run view <run-id> --web
   ```

## Step 4: Publish the Release

The CI workflow creates the release as a draft. Publish it:
```bash
gh release edit vX.Y.Z --draft=false
```

## Step 5: Update Landing Page

Update `docs/index.html` to reference the new version:

1. Replace all occurrences of the old version string (e.g., `v1.0.0`) with the new version (`vX.Y.Z`) — this covers the hero badge, download URLs, and DMG/EXE filenames.
2. Commit and push:
   ```bash
   git add docs/index.html
   git commit -m "Update landing page download links to vX.Y.Z"
   git push origin main
   ```

## Step 6: Return Download URLs

Fetch and display all release asset URLs:
```bash
gh release view vX.Y.Z --json assets -q '.assets[].browserDownloadUrl'
```

Display the URLs to the user, labeled by platform:
- **macOS:** the `.dmg` URL
- **Windows Installer:** the `Setup` `.exe` URL
- **Windows Portable:** the `portable` `.exe` URL

Also display the release page URL:
```bash
gh release view vX.Y.Z --json url -q '.url'
```
