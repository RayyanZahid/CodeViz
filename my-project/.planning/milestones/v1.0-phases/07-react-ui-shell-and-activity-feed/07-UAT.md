---
status: testing
phase: 07-react-ui-shell-and-activity-feed
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md
started: 2026-03-15T12:00:00Z
updated: 2026-03-15T12:00:00Z
---

## Current Test

number: 1
name: Two-Column App Layout
expected: |
  The app displays a two-column flex layout: the canvas area fills the remaining space on the left, and a 280px sidebar appears on the right containing three panels (NodeInspector, RiskPanel, ActivityFeed).
awaiting: user response

## Tests

### 1. Two-Column App Layout
expected: The app displays a two-column flex layout: the canvas area fills the remaining space on the left, and a 280px sidebar appears on the right containing three panels (NodeInspector, RiskPanel, ActivityFeed).
result: [pending]

### 2. ActivityFeed Panel
expected: The ActivityFeed panel in the sidebar is collapsible. When inference events arrive via WebSocket, they appear as natural-language sentences with a color-coded dot icon (based on event type), and a relative timestamp (now/Xs/Xm/Xh). A badge shows the item count.
result: [pending]

### 3. ActivityFeed Empty State
expected: When no inference events have been received, the ActivityFeed panel shows an empty state message instead of a blank list.
result: [pending]

### 4. NodeInspector Panel — Selected Node
expected: Clicking a node on the canvas populates the NodeInspector panel with three sections: (1) file list (max 10, with +N more if truncated), (2) outgoing and incoming dependencies as clickable items, and (3) up to 5 recent changes from the activity feed matching that node.
result: [pending]

### 5. NodeInspector Empty State
expected: When no node is selected on the canvas, the NodeInspector shows an empty/placeholder state prompting the user to select a node.
result: [pending]

### 6. RiskPanel — Unreviewed Risks
expected: The RiskPanel displays unreviewed architectural risks with a colored severity circle (red=blocker, orange=major, yellow=minor), risk type label, and a "Mark reviewed" button per row. A red badge on the panel header shows the unreviewed count.
result: [pending]

### 7. RiskPanel — Mark Reviewed
expected: Clicking "Mark reviewed" on a risk row moves that risk from the unreviewed list into a collapsed "Reviewed" section. The reviewed section has an expand/collapse toggle and a count of reviewed items.
result: [pending]

### 8. Cross-Panel Node Highlighting
expected: Clicking a dependency name in NodeInspector or clicking a risk row in RiskPanel highlights and pans the canvas viewport to center on the referenced node.
result: [pending]

### 9. Minimap and Nav Controls Position
expected: The minimap overlay and navigation controls appear within the canvas area (not overlapping the sidebar). They are positioned using absolute positioning within the canvas wrapper.
result: [pending]

### 10. Active Node Glow Decay
expected: When inference events reference a node, that node shows a glow/highlight on the canvas. After approximately 30 seconds of no new events for that node, the glow fades away (pruned by the decay interval).
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
