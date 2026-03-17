---
status: complete
phase: 17-timeline-slider-and-intent-panel-ui
source: 17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md, 17-04-SUMMARY.md, 17-05-SUMMARY.md
started: 2026-03-17T10:30:00Z
updated: 2026-03-17T10:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. IntentPanel Visible in Sidebar
expected: The IntentPanel appears as a collapsible panel in the sidebar, positioned between RiskPanel and ActivityFeed. It shows an AI objective label with formatted category tag and a color-coded confidence badge in the header. Clicking the header collapses/expands the panel.
result: pass

### 2. TimelineBar Visible Below Canvas
expected: A full-width 60px timeline bar appears below the canvas+sidebar row, spanning the entire width. It shows a scrubber track with heatmap background (opacity-weighted buckets) and timestamp labels at 25% intervals along the axis.
result: pass

### 3. Timeline Scrubbing
expected: Clicking on the timeline bar navigates to that snapshot point in time (enters replay mode). Dragging the thumb scrubs through snapshots visually without loading each one; the actual snapshot loads only on mouse release (pointerUp).
result: pass

### 4. Epoch Markers on Timeline
expected: Amber tick marks appear on the timeline at focus-shift boundaries (when the AI intent category changes). White tick marks appear at activity gaps (>90 seconds between snapshots).
result: pass

### 5. Live-Edge Dot
expected: During replay mode, a pulsing green dot appears at the right edge of the timeline indicating the live position. The dot is hidden when not in replay mode.
result: pass

### 6. Keyboard Play/Pause
expected: Pressing Space bar toggles auto-play on/off during replay. Playback auto-advances through snapshots at the current speed. When reaching the last snapshot, playback auto-exits to live mode. Space does not trigger when focus is in an input/textarea.
result: pass

### 7. Keyboard Step and Speed
expected: Arrow Left/Right steps one snapshot backward/forward. Plus (+) and Minus (-) keys cycle playback speed between 1x, 2x, and 4x. Speed changes are reflected in the playback controls display.
result: pass

### 8. Activity Feed Epoch Filtering
expected: During replay, the Activity Feed shows only events within the current epoch (bounded by intent session transitions). The header changes to "Activity (Category Label · N events)" format. When scrubbing to an empty epoch, a "No events in this epoch" message is shown. Outside replay, the feed shows all events normally.
result: pass

### 9. Diff Overlay via Shift-Click
expected: Shift-clicking a point on the timeline sets it as the diff base. Nodes on the canvas are highlighted with shadow glow: green for added nodes, red+faded for removed nodes, amber for changed nodes. Edge stroke colors also change to match. The overlay clears when exiting replay.
result: pass

### 10. IntentPanel Subtask Checklist and History
expected: The IntentPanel shows a derived subtask checklist grouping activity events by category (file creation, risk detection, dependency changes, file modifications). A collapsible history sub-section (starts collapsed) lists up to 10 past intent sessions with "h:mm AM/PM" timestamps. A focus-shift notification (amber left border) appears when the current session category differs from the previous one.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
