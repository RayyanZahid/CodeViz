---
phase: 06-canvas-renderer-and-layout-engine
plan: 02
subsystem: ui
tags: [konva, canvas, quadtree, culling, viewport, rendering, graph-visualization]

# Dependency graph
requires:
  - phase: 06-canvas-renderer-and-layout-engine
    plan: 01
    provides: Two-layer Konva Stage, ZoneConfig module, graphStore.subscribe hook point in ArchCanvas.tsx
provides:
  - NodeRenderer: imperative Konva.Group management (Rect+Text) per GraphNode, zone-colored, sized by edge count
  - EdgeRenderer: imperative Konva.Arrow management per GraphEdge with bezier tension=0.3 and arrowheads
  - ZoneRenderer: 6 zone background rectangles with labels (hidden at scale>0.8 zoom)
  - CullingIndex: quadtree spatial index for O(log n) viewport culling of nodes and edges
affects:
  - 06-03 (AnimationQueue uses getShape/getLine from NodeRenderer/EdgeRenderer for glow overlays)
  - 06-04 (ArchCanvas wires all four renderers; ViewportController calls CullingIndex.updateVisibility)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Imperative Konva shape lifecycle (create/update/destroy) keyed by entity ID in Map
    - Delta-based incremental updates (applyDelta) alongside full sync (syncAll) for flexibility
    - Edge arrows moved to bottom of layer so they render behind node groups
    - Zone backgrounds moved to bottom of layer via moveToBottom() at render time
    - CullingIndex stores edge map via setEdges() — decoupled from EdgeRenderer internals
    - Custom attributes (sourceId/targetId) stored on Konva.Arrow for updatePositions() lookups

key-files:
  created:
    - packages/client/src/canvas/NodeRenderer.ts
    - packages/client/src/canvas/EdgeRenderer.ts
    - packages/client/src/canvas/ZoneRenderer.ts
    - packages/client/src/canvas/CullingIndex.ts

key-decisions:
  - "CullingIndex.setEdges() method decouples edge data from EdgeRenderer — CullingIndex stores its own edge map for visibility computation"
  - "EdgeRenderer stores sourceId/targetId as Konva custom attributes on each Arrow for updatePositions() without external data"
  - "Zone backgrounds rendered with moveToBottom() ensuring nodes always render above zone fills"
  - "Edge arrows also use moveToBottom() so node groups remain on top for click-to-select (Plan 04)"

patterns-established:
  - "Pattern 5: Konva shape lifecycle in Map<id, Shape> — create/update/destroy keyed by entity ID"
  - "Pattern 6: applyDelta(current, prev) for incremental updates + syncAll(nodes) for initial full render"
  - "Pattern 7: quadtree.retrieve(viewport) for O(log n) spatial query; edge visibility derived from node set"

requirements-completed: [REND-03, REND-06]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 6 Plan 02: Canvas Renderer and Layout Engine Summary

**Four imperative Konva renderer classes (NodeRenderer, EdgeRenderer, ZoneRenderer, CullingIndex) converting GraphNode/GraphEdge state into zone-colored shapes with quadtree viewport culling for 60fps at 300 nodes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T03:10:31Z
- **Completed:** 2026-03-16T03:12:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- NodeRenderer creates zone-colored rounded rect groups (fillColor from ZoneConfig) scaled by total edge count (clamp: 70-160px), with 18-char truncated text labels; supports syncAll, applyDelta, setPosition, getPosition, getShape, getAllNodeBounds, setVisible
- EdgeRenderer creates bezier Konva.Arrow shapes (tension=0.3, pointerLength=8, pointerWidth=6) between node positions; supports syncAll, applyDelta, updatePositions, getLine, setVisible; arrows use moveToBottom for correct z-order
- ZoneRenderer draws 6 zone backgrounds (translucent bgColor Rect + bold Text label per ZONE_LAYOUTS) with updateLabelVisibility(scale) hiding labels above 0.8x zoom
- CullingIndex maintains a quadtree spatial index of node bounds; updateVisibility(viewport) queries overlapping nodes in O(log n) and toggles node/edge visibility in O(nodes+edges)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NodeRenderer and EdgeRenderer with imperative Konva shape management** - `04f6aae` (feat)
2. **Task 2: Create ZoneRenderer and CullingIndex with quadtree spatial queries** - `1212232` (feat)

## Files Created/Modified
- `packages/client/src/canvas/NodeRenderer.ts` - Konva.Group per node (Rect+Text), zone fill, edge-count scaling, position tracking, delta updates, visibility control (248 lines)
- `packages/client/src/canvas/EdgeRenderer.ts` - Konva.Arrow per edge, bezier tension, position refresh via updatePositions(), delta updates (163 lines)
- `packages/client/src/canvas/ZoneRenderer.ts` - 6 zone backgrounds with zoom-level label toggling (92 lines)
- `packages/client/src/canvas/CullingIndex.ts` - Quadtree spatial index, viewport culling, edge visibility derived from node set (138 lines)

## Decisions Made
- CullingIndex.setEdges() method added beyond plan spec — needed because CullingIndex must know edge sourceId/targetId to compute edge visibility, but EdgeRenderer internals are private. setEdges() maintains a separate edges map on CullingIndex.
- Konva.Arrow custom attributes (sourceId, targetId) used in EdgeRenderer.updatePositions() to avoid needing an external edges parameter; matches plan's "reads node positions" intent without coupling to edge data structure.
- Edge arrows and zone groups both use moveToBottom() to ensure node groups remain visually on top, preserving click-to-select hit detection for Plan 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added setEdges() method to CullingIndex**
- **Found during:** Task 2 (CullingIndex implementation)
- **Issue:** Plan spec says "For edges: an edge is visible if either its source or target is visible" but CullingIndex constructor only receives nodeRenderer and edgeRenderer, not edge data. Edge sourceId/targetId are not accessible from EdgeRenderer public API, making edge visibility computation impossible without an edge data source.
- **Fix:** Added `setEdges(edges: Map<string, GraphEdge>)` method and `edges` field. Plan 04 wiring will call this alongside rebuild(). The fix is minimal (one method + one field) and keeps CullingIndex decoupled from EdgeRenderer internals.
- **Files modified:** packages/client/src/canvas/CullingIndex.ts
- **Verification:** TypeScript compilation passes; edge iteration uses stored edges map correctly
- **Committed in:** 1212232 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 2 - missing critical functionality for edge culling)
**Impact on plan:** Auto-fix necessary for edge visibility to function. setEdges() is a minimal, clearly-named addition that Plan 04 will call alongside rebuild(). No scope creep.

## Issues Encountered
- None - TypeScript compiled clean on first attempt for both tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four renderer classes ready for wiring in Plan 04 (ArchCanvas integration)
- NodeRenderer.getShape() and EdgeRenderer.getLine() ready for Plan 03 AnimationQueue glow overlays
- CullingIndex.setEdges() + rebuild() + updateVisibility() call sequence documented for Plan 04 ViewportController
- TypeScript compilation passes with zero errors across all four files

---
*Phase: 06-canvas-renderer-and-layout-engine*
*Completed: 2026-03-16*
