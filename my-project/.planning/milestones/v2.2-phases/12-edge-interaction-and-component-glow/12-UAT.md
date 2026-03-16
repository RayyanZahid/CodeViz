---
status: testing
phase: 12-edge-interaction-and-component-glow
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-03-16T22:30:00Z
updated: 2026-03-16T22:30:00Z
---

## Current Test

number: 1
name: Edge Hover Tooltip
expected: |
  Hover over any edge (arrow) connecting two nodes on the canvas. An HTML tooltip should appear near the cursor showing: source node name, target node name, dependency count (e.g. "3 dependencies"), and up to 5 import symbols from the target. Moving the mouse away from the edge should hide the tooltip.
awaiting: user response

## Tests

### 1. Edge Hover Tooltip
expected: Hover over any edge arrow on the canvas. A tooltip appears near cursor showing source/target node names, dependency count, and up to 5 import symbols. Tooltip disappears when mouse leaves the edge.
result: [pending]

### 2. Edge Click-to-Highlight
expected: Click on any edge arrow. The edge turns accent-blue, both endpoint nodes are emphasized (full opacity), and all non-connected nodes are dimmed. Visual focus clearly shows the dependency relationship.
result: [pending]

### 3. Clear Edge Highlight
expected: After highlighting an edge (test 2), click the canvas background OR press Escape. The highlight clears — all nodes return to normal opacity and the edge returns to its default color/style.
result: [pending]

### 4. Edge Legend Card
expected: A semi-transparent legend card is always visible in the bottom-left corner of the canvas. It shows three line samples of increasing thickness with labels: "1-3 deps", "4-8 deps", "9+ deps". If the minimap is visible, the legend sits above it.
result: [pending]

### 5. Glow Pulse on Changed Nodes
expected: When a node changes (file save triggers watcher update), the node pulses with a glowing shadow effect — shadow opacity and blur oscillate visibly for about 2-3 seconds. The glow color matches the node's zone color.
result: [pending]

### 6. Bright Border Fade After Pulse
expected: After the pulse animation (test 5) finishes, the changed node has a bright border in its zone glow color. This border gradually fades over ~30 seconds, with the stroke width decreasing back to its original value.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
