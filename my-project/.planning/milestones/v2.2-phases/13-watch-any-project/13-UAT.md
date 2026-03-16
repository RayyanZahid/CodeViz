---
status: complete
phase: 13-watch-any-project
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md
started: 2026-03-16T23:10:00Z
updated: 2026-03-16T23:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Directory Bar Visible on Load
expected: A top bar appears above the canvas and sidebar showing the currently watched directory path pre-filled in an input field, with a "Watch" button beside it.
result: pass

### 2. Switch to Valid Directory
expected: Type a different valid directory path in the input, press Enter. The old graph disappears, a scanning indicator appears, and the new project's dependency graph loads incrementally with nodes appearing on the canvas.
result: pass

### 3. Watch Button Triggers Switch
expected: Type a valid directory path, click the "Watch" button (instead of pressing Enter). The switch behavior is identical — old graph clears, scanning shows, new graph loads.
result: pass

### 4. Invalid Path Shows Error
expected: Type a non-existent or invalid directory path and submit. A red error message appears below the directory bar indicating the path is invalid. No graph reset occurs.
result: pass

### 5. Scanning Indicator During Switch
expected: After submitting a new valid directory, a scanning indicator appears in the directory bar and a centered overlay message appears on the empty canvas while the new project is being scanned.
result: pass

### 6. Old Data Clears on Switch
expected: After switching directories, all previous nodes, edges, activity feed entries, and risk indicators are fully cleared before new data from the switched project appears. No stale data from the old project remains.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
