---
status: complete
phase: 18-watch-root-integration-and-end-to-end-validation
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md
started: 2026-03-17T11:30:00Z
updated: 2026-03-17T11:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Build and Server Start
expected: Server builds without TypeScript errors and starts successfully. No import errors for repository modules or changeEvents schema.
result: pass

### 2. SQLite Data Purge on Watch-Root Switch
expected: When switching the watched directory via POST /api/watch, old timeline snapshots, intent sessions, snapshot checkpoints, and change events are deleted from SQLite before the new pipeline starts. GET /api/timeline returns empty results shortly after the switch.
result: pass

### 3. Replay-Exit Toast When Switching Roots
expected: When in replay mode and a watch-root switch occurs, an amber toast notification "Exited replay — switching to [dirname]" appears at the top of the page and auto-dismisses after 2 seconds.
result: pass

### 4. No Toast on Non-Replay Root Switch
expected: When NOT in replay mode and switching watch roots, no replay-exit toast appears. The switch happens silently with just the normal root-changed behavior.
result: pass

### 5. Fresh Snapshots for New Directory
expected: After switching to a new watched directory, fresh snapshots appear containing only nodes/edges from the new directory's files. Each snapshot has correct shape: id, sequenceNumber, timestamp, triggerFiles.
result: pass

### 6. No Cross-Contamination Between Directories
expected: After switching from directory A to directory B, directory B's snapshots contain only file paths from directory B. No node IDs or file names from directory A appear in directory B's data.
result: pass

### 7. Journey Test Suite Passes
expected: All 26 journey tests pass (build-and-start 4, phase-14 4, phase-15 4, phase-16 4, phase-17 5, canary 1, phase-18 4) with 0 failures.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
