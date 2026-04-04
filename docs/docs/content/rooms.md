# Rooms

This reference covers managing buildings, rooms, and room capacities used for scheduling and conflict detection.

The Rooms page manages your building and room inventory, including room capacities used for conflict detection.

## Getting There

Navigate to **Rooms** in the app sidebar.

## Key Concepts

- **Building** — A physical building with a name and abbreviation (e.g., "North Hall" / "NH")
- **Room** — A specific room within a building with a capacity (e.g., "NH 301", capacity 35)
- **Room Capacity** — Maximum number of students; used for capacity violation detection

## Managing Rooms

### Add a Room

Select **+ Add Room** at the top. Fill in:
- **Building** — Select from the dropdown of existing buildings
- **Room Number** — The room identifier (e.g., "301", "A102")
- **Capacity** — Maximum student capacity

### Edit Capacity

Select the **capacity number** on any room row to edit it inline. Press Enter or click away to save.

### Delete Rooms

Select the **Delete** link on a single room to remove it. To delete multiple rooms at once, select them using the checkboxes and choose **Delete Selected**.

### Sorting

Select any column header to sort the room list by that column.

### Search

Use the search bar to filter rooms by building name, abbreviation, or room number.

## How Capacity Is Used

The scheduling system uses room capacity in two ways:

- **Hard Conflict** — If a section's enrollment cap exceeds the room's capacity, a hard conflict is created that blocks term finalization
- **Soft Warning** — If a room is more than 20% oversized for a section (capacity waste) or is an exact match (tight fit), a soft warning is shown

## Tips

> **Tip:** Buildings are typically created during room import rather than manually. Use **Import / Export** to upload your facility catalog.

> **Tip:** Building abbreviations (e.g., "NH" for "North Hall") are used throughout the schedule grid for compact display.
