---
status: testing
phase: 08-data-pipeline-repair
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-03-16T19:30:00Z
updated: 2026-03-16T19:30:00Z
---

## Current Test

number: 1
name: Component Metadata Fields Pass Through
expected: |
  Select a component node in the graph canvas. In the node details/inspector, you should see fileCount (a number) and keyExports (a list of exported names) displayed — these fields were previously silently stripped by validation and would not appear.
awaiting: user response

## Tests

### 1. Component Metadata Fields Pass Through
expected: Select a component node in the graph canvas. In the node details/inspector, fileCount and keyExports should be visible for nodes that have them. These were previously stripped by Zod validation.
result: [pending]

### 2. Inference Data Populates Panels
expected: With the server running and inference active, Inspector Panel / Risk Panel / Activity Feed should show real inference data for component nodes — not empty or broken content. Previously these panels were empty because inference IDs were file-level and didn't match component-level canvas nodes.
result: [pending]

### 3. Pipeline Health Status Dot Visible
expected: A small colored dot should appear in the bottom-left corner of the canvas. When connected to the server, it should be green with no label text (unobtrusive). The dot should be positioned to avoid overlapping the minimap or selected-node indicator.
result: [pending]

### 4. Status Dot Reflects Connection State
expected: If the server is stopped or connection is lost, the status dot should turn yellow (connecting/syncing) or red (disconnected) and display a label describing the state. Reconnecting should return it to green with no label.
result: [pending]

### 5. Edge dependencyCount Field Available
expected: Select an edge in the graph. The edge details should include a dependencyCount field (if the edge has one). This was previously stripped by Zod validation along with the node fields.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
