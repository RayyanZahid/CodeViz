---
phase: 12-edge-interaction-and-component-glow
plan: "01"
subsystem: ui
tags: [konva, react, canvas, tooltip, interaction]

# Dependency graph
requires:
  - phase: 11-activity-feed
    provides: existing ArchCanvas/EdgeRenderer/NodeRenderer wiring that this plan extends
provides:
  - Interactive edge arrows with hover tooltip (source/target names, dependency count, import symbols)
  - Edge click-to-highlight with endpoint node emphasis and non-connected node dimming
  - EdgeRenderer.getAllLines() and resetLineStyle() public API for style manipulation
  - EdgeTooltipData type exported from ArchCanvas for App.tsx consumption
affects:
  - 12-02 (next plan in phase — thickness legend and glow) relies on same EdgeRenderer class

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Konva.Arrow listening:true + hitStrokeWidth:15 for wider invisible hit area
    - Stage mousemove with instanceof Konva.Arrow check for hover detection
    - Stable ref pattern (onEdgeHoverRef) for effect closure callbacks
    - HTML overlay positioned absolutely over Konva canvas for tooltip rendering
    - Closure-local mutable state (highlightedEdgeId) for highlight tracking inside useEffect

key-files:
  created: []
  modified:
    - packages/client/src/canvas/EdgeRenderer.ts
    - packages/client/src/canvas/ArchCanvas.tsx
    - packages/client/src/App.tsx

key-decisions:
  - "listening:true replaces listening:false on Konva.Arrow — edges now participate in Konva hit detection"
  - "hitStrokeWidth:15 extends clickable area 15px either side without changing visual stroke width"
  - "dependencyCount stored as custom Konva attr on each arrow so tooltip/resetLineStyle can read it without graphStore access"
  - "getAllLines() returns internal Map reference (not a copy) — callers must not mutate it"
  - "resetLineStyle() reconstructs a minimal fakeEdge object to reuse computeEdgeStrokeWidth/computeEdgeOpacity helpers"
  - "HTML tooltip overlay (not Konva text) for crisp text rendering and full CSS styling flexibility"
  - "Tooltip position clamped to canvas container bounds to prevent overflow"
  - "clearEdgeHighlight() also calls clearSelection(nodeRenderer) to restore node opacities — unified clear path"
  - "Escape key listener on document, not stage container, for reliable keyboard handling"

patterns-established:
  - "Stable ref pattern: const ref = useRef(prop); ref.current = prop — used for onEdgeHoverRef alongside existing onViewportChangeRef pattern"
  - "Closure-local highlight state (let highlightedEdgeId) keeps edge highlight logic entirely within the effect without React state re-renders"

requirements-completed: [EDGE-01, EDGE-02]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 12 Plan 01: Edge Interaction and Component Glow Summary

**Konva edge arrows made interactive: hover shows HTML tooltip with source/target names and import symbols; click highlights both endpoint nodes and dims all others with accent-blue edge styling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:10:50Z
- **Completed:** 2026-03-16T22:14:50Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- EdgeRenderer extended with listening:true, hitStrokeWidth:15, dependencyCount attr storage, getAllLines() and resetLineStyle() public methods
- ArchCanvas wired with mousemove handler detecting Konva.Arrow targets, edge click handler that highlights both endpoints and dims all other nodes, clearEdgeHighlight helper called on background click and Escape key
- App.tsx renders positioned HTML tooltip overlay when edgeTooltip state is non-null, with source/target names, dependency count singular/plural, and up to 5 import symbols from target keyExports

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable edge interaction and add hover/click handlers with tooltip and highlight** - `620dc46` (feat)

## Files Created/Modified
- `packages/client/src/canvas/EdgeRenderer.ts` - Added listening:true, hitStrokeWidth:15, dependencyCount attr, getAllLines(), resetLineStyle() methods
- `packages/client/src/canvas/ArchCanvas.tsx` - Added EdgeTooltipData type export, onEdgeHover prop, mousemove edge hover handler, edge click-to-highlight with clearEdgeHighlight, Escape key listener
- `packages/client/src/App.tsx` - Added edgeTooltip state, EdgeTooltipData import, onEdgeHover={setEdgeTooltip} prop, HTML tooltip overlay with position clamping

## Decisions Made
- Used `instanceof Konva.Arrow` for reliable type checking in mousemove and click handlers (safer than checking attr presence)
- Target node's `keyExports` used as proxy for import symbols per CONTEXT.md decision — component-level edges aggregate file-level imports
- Tooltip positioned with offset (+12x, -8y from cursor) to avoid obscuring the edge being hovered
- clearEdgeHighlight() resets both edge style AND node selection (calls clearSelection) — single clear path prevents visual state leakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled with zero errors on first pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Edge interaction complete (EDGE-01, EDGE-02 satisfied)
- Ready for Phase 12 Plan 02: thickness legend overlay and component glow animation
- EdgeRenderer getAllLines() already available for any legend or glow work

---
*Phase: 12-edge-interaction-and-component-glow*
*Completed: 2026-03-16*
