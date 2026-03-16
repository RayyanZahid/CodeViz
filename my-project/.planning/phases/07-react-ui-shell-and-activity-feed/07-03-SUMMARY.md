---
phase: 07-react-ui-shell-and-activity-feed
plan: "03"
subsystem: ui
tags: [react, konva, zustand, flex-layout, sidebar, cross-panel-navigation]

# Dependency graph
requires:
  - phase: 07-02
    provides: NodeInspector and RiskPanel components with onHighlightNode prop interfaces
  - phase: 07-01
    provides: ActivityFeed component and inferenceStore with pruneExpiredActive
  - phase: 06-canvas-renderer-and-layout-engine
    provides: ArchCanvas, ViewportController, IncrementalPlacer with getPositions()
provides:
  - Full two-column flex layout (canvas area + 280px sidebar) in App.tsx
  - Cross-panel navigation via handleHighlightNode callback
  - ViewportController.panToNode() for centering viewport on a world coordinate
  - ArchCanvas.canvasRef with selectNodeOnCanvas() imperative handle
  - ArchCanvas.nodePositionsRef for reading node world positions
  - 30-second active node glow decay interval wired to inferenceStore.pruneExpiredActive()
affects:
  - future UI additions to the sidebar
  - any feature needing cross-panel canvas navigation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canvasRef imperative handle pattern for parent-to-canvas programmatic interaction
    - nodePositionsRef shared ref pattern for reading canvas layout state without prop drilling
    - position:absolute within canvas wrapper div (not position:fixed) for correct sidebar coexistence

key-files:
  created: []
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/canvas/ViewportController.ts
    - packages/client/src/canvas/ArchCanvas.tsx
    - packages/client/src/minimap/MinimapStage.tsx

key-decisions:
  - "handleHighlightNode calls canvasRef.current.selectNodeOnCanvas() which internally calls handleSelectNodeRef.current(nodeId) — no separate setSelectedNodeId call needed to avoid redundant state update"
  - "nodePositionsRef updated on both initial fullSync and in subscribe callback when addedNodeIds.length > 0 — covers both initial load and incremental graph updates"
  - "MinimapStage changed from position:fixed to position:absolute — must render within canvas wrapper div (position:relative) not full viewport"
  - "Navigation controls and selected-node indicator changed from position:fixed to position:absolute — aligns within canvas area, not overlapping 280px sidebar"

patterns-established:
  - "canvasRef pattern: ArchCanvas exposes { selectNodeOnCanvas } via canvasRef prop for programmatic node selection from parent components"
  - "nodePositionsRef pattern: ArchCanvas populates a shared ref with world positions after each layout run, enabling App.tsx to call panToNode without ArchCanvas knowing about panels"
  - "Cross-panel navigation pattern: handleHighlightNode in App.tsx is the single coordination point — calls both canvas highlight and viewport pan"

requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 7 Plan 03: React UI Shell and Activity Feed Summary

**Full MVP layout wired: flex canvas + 280px sidebar with Inspector/Risk/Feed panels, cross-panel node highlighting and viewport pan via selectNodeOnCanvas and panToNode, and 30-second active node glow decay**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T04:12:50Z
- **Completed:** 2026-03-16T04:15:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `panToNode(worldX, worldY)` to ViewportController to center viewport on a world coordinate
- Added `canvasRef` and `nodePositionsRef` props to ArchCanvas for programmatic cross-panel interaction
- Restructured App.tsx with two-column flex layout: canvas area (flex:1) + right sidebar (280px)
- Wired all three panels (NodeInspector, RiskPanel, ActivityFeed) in the sidebar with cross-panel callbacks
- Fixed `position:fixed` to `position:absolute` for nav controls, selected-node indicator, and minimap
- Added 30-second interval calling `inferenceStore.getState().pruneExpiredActive()` for glow decay

## Task Commits

Each task was committed atomically:

1. **Task 1: Add panToNode to ViewportController and expose canvas imperative handles** - `b801bf5` (feat)
2. **Task 2: Restructure App.tsx with sidebar layout and wire all panels** - `37378e2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/client/src/canvas/ViewportController.ts` - Added `panToNode(worldX, worldY)` method
- `packages/client/src/canvas/ArchCanvas.tsx` - Added `nodePositionsRef` and `canvasRef` props; expose `selectNodeOnCanvas` imperative handle; populate `nodePositionsRef` on fullSync and subscribe
- `packages/client/src/App.tsx` - Full restructure: flex layout, sidebar with three panels, `handleHighlightNode` callback, `nodePositionsRef`/`canvasRef` refs, `pruneExpiredActive` interval, all `position:fixed` changed to `position:absolute`
- `packages/client/src/minimap/MinimapStage.tsx` - Changed wrapper from `position:fixed` to `position:absolute`

## Decisions Made
- `handleHighlightNode` calls `canvasRef.current?.selectNodeOnCanvas(nodeId)` which internally fires `handleSelectNodeRef.current(nodeId)` — no separate `setSelectedNodeId` call to avoid duplicate state update
- `nodePositionsRef` is populated during both `fullSync` (initial render) and the `graphStore.subscribe` callback (when `addedNodeIds.length > 0`) so positions are always current
- MinimapStage position changed from `fixed` to `absolute` to stay within the canvas wrapper (not bleed into the sidebar area)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full MVP is complete: file change → parse → graph delta → inference → WebSocket → canvas + sidebar panels update
- All seven Phase 7 requirements (UI-01 through UI-07) are fulfilled
- No blockers

---
*Phase: 07-react-ui-shell-and-activity-feed*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: `packages/client/src/canvas/ViewportController.ts`
- FOUND: `packages/client/src/canvas/ArchCanvas.tsx`
- FOUND: `packages/client/src/App.tsx`
- FOUND: `packages/client/src/minimap/MinimapStage.tsx`
- FOUND: `.planning/phases/07-react-ui-shell-and-activity-feed/07-03-SUMMARY.md`
- FOUND commit b801bf5: feat(07-03): add panToNode to ViewportController and expose canvas imperative handles
- FOUND commit 37378e2: feat(07-03): restructure App.tsx with sidebar layout and wire all panels
- FOUND commit e4de4d9: docs(07-03): complete App sidebar layout and cross-panel navigation plan
- TypeScript: PASS (zero errors)
