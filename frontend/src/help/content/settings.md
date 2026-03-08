# Settings

The Settings page configures global application preferences, export destinations, database management, and GitHub Pages integration.

## Getting There

Click **Settings** in the sidebar.

## General

### Department Name

The name shown in the header of exported HTML schedules. Set this to your department's official name (e.g., "Department of Computer Science and Information Systems").

## Academic Year

### Start Month

The month when your academic year begins. Default is **July** (July 1 – June 30). This determines how terms are automatically grouped into academic years.

For example, with a July start month:
- Fall 2025 (starts August) → Academic Year 2025-2026
- Spring 2026 (starts January) → Academic Year 2025-2026
- Summer 2026 (starts June) → Academic Year 2025-2026

## Local Export

### Export Directory

The folder where **Save to Local Directory** writes HTML schedule files. Click the path input to open a directory picker, or type a path directly.

The directory picker lets you:
- Browse folders in the file system
- Navigate to parent directories
- Create new folders

## Database

This section displays information about your SQLite database:

- **File Path** — Where the database is stored on disk
- **Size** — Current database file size

### Download Backup

Click **Download Backup** to save a portable copy of your entire database. This creates a standalone `.db` file you can use to restore your data or move to another machine.

> **Tip:** Back up your database regularly, especially before major imports or before upgrading the application.

## GitHub Pages

Publish your schedule as a web page anyone can view with a link.

### Setup

1. Click **Set Up GitHub** (or **Reconfigure** if already connected)
2. Enter your **Repository URL** — a GitHub repo where the schedule HTML will be pushed (e.g., `https://github.com/yourname/schedules`)
3. Enter a **Personal Access Token** — generate one at GitHub with `repo` scope
4. Optionally set a **Custom URL** — the base URL for your GitHub Pages site (auto-derived if left blank)

### Connection Status

- **Green dot** — Connected and ready to publish
- **Gray dot** — Not configured

### How It Works

When you click **Push to GitHub Pages** from the Schedule Grid:
1. The app generates an HTML schedule page
2. Commits it to your configured GitHub repository
3. GitHub Pages serves it as a public web page
4. You get a shareable link to give to faculty, staff, or administration

> **Tip:** Your access token is stored securely on the backend and is never sent back to the browser after initial setup. Only the connection status is visible.
