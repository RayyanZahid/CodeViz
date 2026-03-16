---
phase: 06-canvas-renderer-and-layout-engine
plan: 03
subsystem: ui
tags: [d3-force, d3-force-boundary, layout, force-directed, sticky-nodes, canvas]

# Dependency graph
requires:
  - phase: 06-01
    provides: ZoneConfig module (getZoneLayout, getZoneCenter, ZONE_LAYOUTS, CANVAS_WIDTH, CANVAS_HEIGHT), two-layer Konva Stage foundation
  - phase: 05-websocket-streaming-and-client-state
    provides: GraphNode and GraphEdge types from @archlens/shared/types; InitialStateMessage with layoutPositions field
provides:
  - IncrementalPlacer class with d3-force simulation, sticky fx/fy pinning, zone centering and boundary forces
  - loadPositions() to hydrate from server snapshot (sticky immediately)
  - placeNewNodes() returning positions for all nodes (existing pinned, new settled)
  - getPositions(), getPosition(), removeNode(), hasPosition(), getNewNodeCount() accessors
  - Type declarations for d3-force-boundary (d3-force-boundary.d.ts)
affects:
  - 06-02 (NodeRenderer/EdgeRenderer will consume positions from IncrementalPlacer)
  - 06-04 (ViewportController fit-to-view needs positions for bounding box)
  - 06-05 (AnimationQueue references node positions for glow overlay placement)

# Tech tracking
tech-stack:
  added:
    - "@types/d3-force" ^3.0.10 (dev — d3-force 3.0.0 ships no TypeScript types)
  patterns:
    - Sticky node contract: existing nodes get fx/fy=position on every sim run (never move)
    - Fresh SimNode objects: GraphNode store refs never passed to d3-force (prevents store mutation)
    - Silent simulation: simulation.alpha(0.3).stop().tick(50) — never simulation.restart() animated
    - Post-tick zone clamping: safety net for soft forceX/forceY zone centering constraints
    - Early-exit optimization: getNewNodeCount() == 0 short-circuits placeNewNodes()

key-files:
  created:
    - packages/client/src/layout/IncrementalPlacer.ts
    - packages/client/src/types/d3-force-boundary.d.ts
  modified:
    - packages/client/package.json (added @types/d3-force devDependency)
    - pnpm-lock.yaml

key-decisions:
  - "@types/d3-force installed — d3-force 3.0.0 ships no TypeScript declarations; @types/d3-force 3.0.10 provides them"
  - "d3-force-boundary type stub created locally — package has no .d.ts; default export pattern with strength/hardBoundary API"
  - "forceBoundary applied globally (canvas bounds) — per-zone boundary replaced by soft forceX/forceY + post-tick clamping for zone containment"
  - "SimulationLinkDatum<SimNode> & {source/target: string} union for typed sim links"
  - "ReturnType<typeof forceSimulation> used for simulation field type to avoid generic complexity"

patterns-established:
  - "Pattern 5: Sticky incremental layout — loadPositions() from snapshot + placeNewNodes() for deltas"
  - "Pattern 6: SimNode isolation — fresh plain objects per layout run, never store GraphNode refs"

requirements-completed: [LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 6 Plan 03: IncrementalPlacer Layout Engine Summary

**d3-force layout engine with sticky fx/fy node pinning, per-zone forceX/forceY centering, and silent tick(50) simulation — existing nodes never move, new nodes settle near related neighbors within their assigned zone**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T03:11:45Z
- **Completed:** 2026-03-16T03:14:02Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Implemented IncrementalPlacer with the sticky-node contract — existing nodes pinned via fx/fy on every simulation run, satisfying LAYOUT-02 and LAYOUT-04
- New nodes are placed near related nodes within zone boundaries via d3-force link attraction + per-zone forceX/forceY centering (LAYOUT-03)
- Simulation runs silently via `simulation.alpha(0.3).stop().tick(50)` — no visible node animation (LAYOUT-01)
- Created TypeScript type declarations for d3-force-boundary (package ships no .d.ts) and installed @types/d3-force

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement IncrementalPlacer with d3-force simulation and sticky node contract** - `54e1fab` (feat)

## Files Created/Modified
- `packages/client/src/layout/IncrementalPlacer.ts` - d3-force layout engine (264 lines): IncrementalPlacer class with loadPositions, placeNewNodes, getPositions, getPosition, removeNode, hasPosition, getNewNodeCount; SimNode/SimLink types; private clampToZone helper
- `packages/client/src/types/d3-force-boundary.d.ts` - TypeScript module declaration for d3-force-boundary v0.0.1 (default export + ForceBoundary interface with strength/hardBoundary/border methods)
- `packages/client/package.json` - Added @types/d3-force ^3.0.10 to devDependencies
- `pnpm-lock.yaml` - Updated with @types/d3-force dependency tree

## Decisions Made
- Installed `@types/d3-force` rather than hand-rolling d3-force type declarations — d3-force 3.0.0 ships plain JS with no `.d.ts`; the official @types package is at 3.0.10 and matches the API exactly
- Created local `d3-force-boundary.d.ts` — the package (v0.0.1) ships no types and the `@types/` namespace has no entry; the declaration was derived from the source ESM file
- Used `forceBoundary(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)` as a single global canvas boundary rather than per-zone boundaries — per-zone forceBoundary with `all-nodes` scope would fight zone centering forces; soft forceX/forceY + post-tick clamping achieves zone containment with less simulation conflict
- `simulation.alpha(0.3).stop().tick(50)` sequence — setting alpha then stopping clears the internal timer before manual ticking, preventing any race with an animated loop
- `ReturnType<typeof forceSimulation<SimNode, any>>` for the simulation field type — avoids threading the SimLink generic through the class signature unnecessarily

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/d3-force and created d3-force-boundary type stub**
- **Found during:** Task 1 (implementing IncrementalPlacer imports)
- **Issue:** d3-force 3.0.0 ships no TypeScript declarations; d3-force-boundary ships no .d.ts and has no @types entry; TypeScript would fail on both imports
- **Fix:** Installed @types/d3-force 3.0.10 as devDependency; created packages/client/src/types/d3-force-boundary.d.ts with module declaration derived from ESM source
- **Files modified:** packages/client/package.json, pnpm-lock.yaml, packages/client/src/types/d3-force-boundary.d.ts (created)
- **Verification:** pnpm --filter @archlens/client exec tsc --noEmit passes with zero errors
- **Committed in:** 54e1fab (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 - blocking type resolution)
**Impact on plan:** Required for TypeScript compilation to succeed. No scope creep — types-only addition.

## Issues Encountered
- d3-force-boundary uses a default export (`export default forceBoundary`) while the plan showed a named import (`import { forceBoundary }`). Fixed to use default import pattern consistent with the ESM source.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IncrementalPlacer ready to be instantiated in ArchCanvas.tsx (Plan 02's NodeRenderer wiring)
- loadPositions() awaits server's InitialStateMessage.layoutPositions field (to be verified in Plan 06-04/06-05)
- placeNewNodes() can be called from graphStore.subscribe() in ArchCanvas.tsx after each delta
- TypeScript compiles clean with zero errors — ready for Plans 04 and 05

---
*Phase: 06-canvas-renderer-and-layout-engine*
*Completed: 2026-03-16*
