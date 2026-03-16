---
status: complete
phase: 06-canvas-renderer-and-layout-engine
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md
started: 2026-03-15T00:00:00Z
updated: 2026-03-15T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Canvas Renders in Browser
expected: Opening the app in a browser shows a Konva canvas that fills the viewport container. The canvas has a virtual size of 2400x1600 and responds to window resizing.
result: pass

### 2. Zone Backgrounds Visible
expected: 6 colored zone areas are visible on the canvas — frontend, api, services, data-stores, external, and infrastructure — each with a distinct background color and a bold text label.
result: pass

### 3. Nodes Render as Colored Rectangles
expected: Architecture nodes appear as rounded colored rectangles with truncated text labels. Each node is colored according to its zone (matching zone background colors). Node size scales based on edge count.
result: pass

### 4. Edges Render as Curved Arrows
expected: Dependency edges appear as curved arrows (bezier with arrowheads) connecting related nodes across or within zones.
result: pass

### 5. Nodes Positioned Within Zone Boundaries
expected: Each node appears within its assigned zone area. Nodes cluster near related neighbors. No nodes float outside zone boundaries.
result: pass

### 6. Existing Positions Preserved on Updates
expected: When new nodes arrive via WebSocket delta, existing nodes stay in place (sticky positions). Only new nodes get placed by the layout engine.
result: pass

### 7. Zoom with Mouse Wheel
expected: Scrolling the mouse wheel zooms in/out. Zoom is centered on the cursor position (zoom-to-pointer behavior). Scale range is bounded.
result: pass

### 8. Pan by Dragging
expected: Click and drag on the canvas background pans the view. The viewport moves smoothly in the drag direction.
result: pass

### 9. Navigation UI Controls
expected: Top-right corner shows navigation controls: zoom-in (+) button, zoom-out (-) button, fit-to-view button, and minimap toggle button.
result: pass

### 10. Fit-to-View
expected: Clicking the fit-to-view button centers and scales the viewport to show all nodes in the canvas.
result: pass

### 11. Minimap Toggle
expected: Clicking the minimap toggle shows a small 200x133 overview stage with zone backgrounds and a white rectangle indicating the current viewport position. Clicking again hides it.
result: pass

### 12. Click-to-Select Node
expected: Clicking a node selects it — the node gets a highlighted stroke. Direct dependency nodes also get a softer highlight stroke. Clicking canvas background deselects.
result: pass

### 13. Glow Animation on Changes
expected: When file change deltas arrive via WebSocket, affected nodes and edges show a colored glow/shadow effect that linearly fades over ~30 seconds, then the glow shapes are removed.
result: pass

### 14. Zone Labels Hide on Zoom-Out
expected: Zone text labels are visible at normal zoom but become hidden when zoomed out past 0.8x scale, keeping the overview clean.
result: pass

### 15. Viewport Persists Across Refresh
expected: Zoom level and pan position are saved to localStorage. Refreshing the page restores the previous viewport state.
result: pass

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
