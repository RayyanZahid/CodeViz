---
phase: 06-canvas-renderer-and-layout-engine
plan: 04
subsystem: ui
tags: [konva, react-konva, animation, viewport, minimap, canvas, zustand, click-to-select]

# Dependency graph
requires:
  - phase: 06-canvas-renderer-and-layout-engine
    plan: 02
    provides: NodeRenderer (getShape, getAllNodeBounds, setVisible), EdgeRenderer (getLine, setVisible), ZoneRenderer (updateLabelVisibility), CullingIndex (updateVisibility, rebuild, setEdges)
  - phase: 06-canvas-renderer-and-layout-engine
    plan: 03
    provides: IncrementalPlacer (placeNewNodes, getPositions, removeNode, loadPositions)
  - phase: 05-websocket-streaming-and-client-state
    provides: graphStore Zustand store with subscribe(), GraphNode/GraphEdge types, viewport.ts persistence utilities
provides:
  - AnimationQueue: 30s linear glow decay on animation layer via Konva.Animation RAF loop
  - ViewportController: zoom-to-pointer (wheel), pan persistence, fit-to-view, zoomIn/zoomOut, viewport localStorage persistence
  - MinimapStage: 200x133 Konva Stage overview with zone backgrounds and white viewport indicator rectangle
  - ArchCanvas: complete orchestrator wiring all 7 subsystems with imperative graphStore.subscribe() subscription
  - Click-to-select: selects node + highlights direct dependency nodes with bright/soft strokes
  - Navigation UI: zoom +/- buttons, fit-to-view, minimap toggle in fixed top-right overlay
affects:
  - Phase 7 (any future phases building on the complete canvas)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AnimationQueue pattern: Konva.Animation on animLayer only, no layer.draw() in callback, glow shapes removed after DECAY_MS
    - ViewportController zoom-to-pointer: world-space point computed before scale, repositioned after (RESEARCH.md Pattern 4)
    - Forward-declared viewport variable: let viewport then assigned after creation to allow handleViewportChange closure to capture it
    - TypeScript closure narrowing: capture non-null const (gl, al) immediately after guard for use inside nested closures
    - Node zone attribute: stored on Konva.Group via setAttr('zone') at creation for AnimationQueue zone lookup
    - Click-to-select: parent-chain walk using getType()==='Group' && id() to find node group from any child target

key-files:
  created:
    - packages/client/src/canvas/AnimationQueue.ts
    - packages/client/src/canvas/ViewportController.ts
    - packages/client/src/minimap/MinimapStage.tsx
  modified:
    - packages/client/src/canvas/ArchCanvas.tsx (complete rewrite — skeleton to full orchestrator)
    - packages/client/src/canvas/NodeRenderer.ts (added zone attr on group + updateShape sync)
    - packages/client/src/App.tsx (navigation controls overlay + minimap + viewport state)

key-decisions:
  - "Zone attr stored on Konva.Group (setAttr('zone')) in NodeRenderer.createShape — AnimationQueue.activateFromDelta() needs glow color without graphStore access"
  - "Forward-declared viewport variable pattern — handleViewportChange closure must capture viewport before ViewportController constructor completes"
  - "Capture gl/al as non-null consts after guard — TypeScript cannot narrow ref.current values across closure boundaries in useEffect"
  - "Parent-chain walk for click-to-select uses getType()==='Group' && id() — more reliable than instanceof across Konva versions"
  - "stage.off('wheel') and stage.off('dragend') in cleanup — ViewportController attaches these; manual cleanup needed since ViewportController has no destroy()"
  - "Minimap clamped viewport indicator — viewportRect can exceed minimap bounds when zoomed out far; clamp prevents Konva rendering artifacts"

patterns-established:
  - "Pattern 8: AnimationQueue tick() — linear shadow decay, remove shapes at DECAY_MS to keep animLayer lightweight"
  - "Pattern 9: ViewportController zoom-to-pointer — world-space point preservation via (pointer - stage.pos) / scale"
  - "Pattern 10: Forward-declared let viewport — assign after construction, close over in callback"
  - "Pattern 11: useRef for stable callback refs — onViewportChangeRef/handleSelectNodeRef avoids stale closures without re-running effect"

requirements-completed: [REND-02, REND-06]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 6 Plan 04: Canvas Animation, Viewport, Minimap, and Full Integration Summary

**AnimationQueue with 30s glow decay, ViewportController with zoom-to-pointer, MinimapStage overview, and fully wired ArchCanvas orchestrating all 7 subsystems with click-to-select and navigation UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T03:18:37Z
- **Completed:** 2026-03-16T03:23:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AnimationQueue manages glow effects via Konva.Animation RAF loop: activate() creates shadow Rect + edge Line overlays on animLayer; tick() decays shadowOpacity/shadowBlur linearly over 30 seconds; expired shapes removed to keep animLayer lightweight
- ViewportController implements zoom-to-pointer (wheel event), pan persistence (dragend), fit-to-view (graphLayer.getClientRect bounding box centering), zoomIn/zoomOut centered on stage, and localStorage persistence via utils/viewport.ts
- MinimapStage renders a 200x133 Konva Stage with zone background rects at SCALE=0.083 and a white outline viewport indicator that tracks the current view
- ArchCanvas rewritten as complete orchestrator: wires ZoneRenderer, NodeRenderer, EdgeRenderer, IncrementalPlacer, AnimationQueue, ViewportController, and CullingIndex; imperative graphStore.subscribe() for delta processing; click-to-select with dependency highlighting; navigation buttons and minimap in App.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AnimationQueue and ViewportController** - `5a0f3c1` (feat)
2. **Task 2: Create MinimapStage, wire ArchCanvas integration, add navigation UI** - `064eb08` (feat)

## Files Created/Modified
- `packages/client/src/canvas/AnimationQueue.ts` - 30s glow decay via Konva.Animation; activate(), activateFromDelta(), destroy(); tick() with linear shadow decay (235 lines)
- `packages/client/src/canvas/ViewportController.ts` - zoom-to-pointer, pan persistence, fit-to-view, zoomIn/zoomOut, getViewportRect(), getScale() (223 lines)
- `packages/client/src/minimap/MinimapStage.tsx` - 200x133 Konva Stage with zone rects + clamped viewport indicator at SCALE=0.083 (96 lines)
- `packages/client/src/canvas/ArchCanvas.tsx` - Complete rewrite: 7-subsystem orchestrator, graphStore.subscribe, fullSync, click-to-select, cleanup (313 lines)
- `packages/client/src/canvas/NodeRenderer.ts` - Added `group.setAttr('zone', ...)` in createShape and updateShape for AnimationQueue zone color lookups
- `packages/client/src/App.tsx` - Navigation controls overlay (zoom +/-, fit, minimap toggle), MinimapStage wiring, selected node status bar (229 lines)

## Decisions Made
- Zone attr stored on Konva.Group at creation time — AnimationQueue.activateFromDelta() reads it to get glow color without needing graphStore access, which would introduce a dependency on store timing
- Forward-declared `let viewport` variable pattern — handleViewportChange must close over viewport, but ViewportController constructor takes handleViewportChange as a parameter. Solved with let + assignment after construction.
- TypeScript non-null capture pattern — `const gl: Konva.Layer = graphLayerRaw` immediately after the guard eliminates TS18047 errors inside nested closures, which TypeScript cannot narrow through closure boundaries
- stage.off('wheel') + stage.off('dragend') in useEffect cleanup — ViewportController attaches these listeners; without removal they accumulate on re-mount
- Clamped viewport indicator in MinimapStage — viewportRect can exceed minimap bounds when user is zoomed far out; clamping prevents Konva drawing artifacts outside stage bounds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added zone attr storage on NodeRenderer.createShape/updateShape**
- **Found during:** Task 1 (AnimationQueue implementation)
- **Issue:** Plan calls for `activateFromDelta()` to get zone for glow color, but NodeRenderer groups did not store the zone name. AnimationQueue cannot import graphStore (would create a circular concern) and cannot derive zone from fill color alone.
- **Fix:** Added `group.setAttr('zone', node.zone ?? 'unknown')` in both `createShape` and `updateShape` in NodeRenderer.ts. animateFromDelta() now reads `nodeShape.getAttr('zone')`.
- **Files modified:** packages/client/src/canvas/NodeRenderer.ts
- **Verification:** TypeScript compilation passes; attribute is readable in AnimationQueue without store access
- **Committed in:** 5a0f3c1 (Task 1 commit)

**2. [Rule 1 - Bug] TypeScript closure narrowing — TS18047 'graphLayer' is possibly null**
- **Found during:** Task 2 (ArchCanvas rewrite)
- **Issue:** TypeScript does not preserve narrowing of `ref.current` values across nested closure boundaries. Even after `if (!graphLayer) return`, the `graphLayer` variable inside `fullSync()` was flagged as possibly null (TS18047).
- **Fix:** Captured non-null constants `const gl: Konva.Layer = graphLayerRaw` and `const al: Konva.Layer = animLayerRaw` immediately after the guard. Used `gl`/`al` throughout the effect closure.
- **Files modified:** packages/client/src/canvas/ArchCanvas.tsx
- **Verification:** `pnpm --filter @archlens/client exec tsc --noEmit` passes with zero errors
- **Committed in:** 064eb08 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 - missing critical, 1 Rule 1 - bug fix)
**Impact on plan:** Both fixes necessary for correct TypeScript compilation and correct AnimationQueue behavior. No scope creep.

## Issues Encountered
- TypeScript closure narrowing issue required non-null const capture pattern — a recurring TypeScript pattern with Konva refs in useEffect
- Forward-declared viewport variable needed to break the circular dependency between handleViewportChange (needs viewport) and ViewportController constructor (needs handleViewportChange)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete canvas is functional: zone backgrounds, node groups, edges, glow animation, viewport navigation, minimap, click-to-select
- TypeScript compiles clean with zero errors across all 6 modified files
- Canvas is ready for end-to-end testing against a running server: nodes appear in zones, edges connect them, activity triggers glow, viewport persists across refresh
- Phase 7 can build additional features on top of this complete canvas foundation

## Self-Check: PASSED

- FOUND: packages/client/src/canvas/AnimationQueue.ts (235 lines)
- FOUND: packages/client/src/canvas/ViewportController.ts (223 lines)
- FOUND: packages/client/src/minimap/MinimapStage.tsx (96 lines)
- FOUND: packages/client/src/canvas/ArchCanvas.tsx (313 lines)
- FOUND: packages/client/src/App.tsx
- FOUND: commit 5a0f3c1 (Task 1)
- FOUND: commit 064eb08 (Task 2)

---
*Phase: 06-canvas-renderer-and-layout-engine*
*Completed: 2026-03-16*
