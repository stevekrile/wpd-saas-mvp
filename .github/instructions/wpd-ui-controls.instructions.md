---
description: "Use when building or modifying WPD UI screens with record lists, forms, and CRUD actions. Defines standard button placement and control-row rules."
applyTo: "wpd-client/src/**/*.{ts,tsx,css}"
---
# WPD UI Control Layout Rules

Use this button presentation standard across the project:

1. Insert actions for lists (for example, `Create`) go in the top-right area above the list.
2. Edit/Delete controls for a record go at the bottom-right below the record summary, or far right in grid-oriented record cards.
3. Navigation actions (for example, `Back`, `View Details`, `Cancel and return`) must never share the same action row as record edit/delete/save controls.

Implementation guidance:

- Keep a dedicated navigation row or header area for navigation controls.
- Keep a dedicated record-action row for editing controls (`Edit`, `Delete`, `Save`).
- In card grids, put navigation links on their own line and destructive actions on a separate right-aligned line.
