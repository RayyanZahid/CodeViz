---
phase: 16-client-state-layer-and-mode-isolation
plan: 03
subsystem: ui
tags: [konva, react, zustand, replay, animation, tween]

# Dependency graph
requires:
  - phase: 16-01
    provides: replayStore Zustand slice with enterReplay/exitReplay actions and isReplay mode gate
  - phase: 16-02
    provides: ReplayBanner component wired to replayStore (confirms replayStore integration pattern)
provides:
  - replayTransitions.ts module with morphNodesToPositions, fadeInNodes, fadeOutNodes, applyReplayTint, restoreOriginalTint
  - ArchCanvas graphStore subscription guard (early return when isReplay=true)
  - ArchCanvas replayStore subscription orchestrating enter/exit with morph/fade/tint/viewport animations
  - "No architecture at this point in time" empty graph overlay during replay with 0 nodes
  - loadSnapshotAndEnterReplay async function exported from ArchCanvas for Phase 17 timeline slider
affects: [17-timeline-slider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Konva.Tween morph animation: iterate targetPositions map, create Tween per shape animating x/y with EaseInOut 500ms, onFinish destroys tween"
    - "replayStore.subscribe enter/exit gate: (state.isReplay && !prev.isReplay) for enter, (!state.isReplay && prev.isReplay && wasInReplay) for exit"
    - "Historical-only node creation via syncAll with merged Map (liveNodes + historicalOnlyNodes) since NodeRenderer.createShape is private"
    - "Blue replay tint as shadow glow on node Rects: shadowColor #64a0ff, shadowBlur 8, shadowOpacity 0.5, stored/restored via tintedFills Map"
    - "graphStore subscription replay guard: replayStore.getState().isReplay early return prevents live deltas from corrupting historical canvas"

key-files:
  created:
    - packages/client/src/canvas/replayTransitions.ts
  modified:
    - packages/client/src/canvas/ArchCanvas.tsx

key-decisions:
  - "NodeRenderer.createShape is private — historical-only nodes added via syncAll with merged Map (live + historical-only), then reconciled back on exit via syncAll(liveNodes)"
  - "replayTransitions.ts functions are pure (no store imports) — all state passed as arguments for testability and to avoid hidden dependencies"
  - "Blue tint via shadow glow (not fill color change) — preserves zone colors while adding visible blue overlay; original shadow settings stored as JSON in tintedFills Map for exact restoration"
  - "ArchCanvas wrapped in relative-positioned div to allow absolute overlay positioning for empty graph message and future Phase 17 overlays"
  - "wasInReplay flag guards exit transition — prevents exit handler firing if enter never ran (e.g., if component mounts while isReplay=false and then isReplay is set false again)"

patterns-established:
  - "Replay enter/exit pattern: compute diff (common/addedHistorical/removedHistorical), merge shapes, compute positions, morph/fade, tint, fit viewport"
  - "Pure animation helper pattern: functions in replayTransitions.ts receive renderer+data, no store access, callable from any context"

requirements-completed: [REPLAY-03, REPLAY-04]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 16 Plan 03: Client State Layer and Mode Isolation Summary

**Konva morph/fade/tint animation layer for replay mode: smooth 500ms transitions between live and historical graph positions with blue shadow glow tint and ArchCanvas graphStore subscription guard**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T07:38:45Z
- **Completed:** 2026-03-17T07:43:29Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `replayTransitions.ts` with 5 pure animation helpers: morphNodesToPositions (Konva.Tween x/y), fadeInNodes (opacity 0->1), fadeOutNodes (opacity 1->0 + visible=false), applyReplayTint (blue shadow glow with saved originals), restoreOriginalTint (restore from Map)
- Added graphStore subscription guard in ArchCanvas — `replayStore.getState().isReplay` early return prevents live deltas from updating the canvas while viewing historical snapshot
- Wired replayStore.subscribe in ArchCanvas for full enter/exit orchestration: node categorization, merged syncAll for historical-only shapes, placer-computed positions, morph/fade/tint, edge sync, viewport auto-zoom
- Added empty graph overlay: "No architecture at this point in time" centered message when isReplay && replayNodeCount === 0
- Exported `loadSnapshotAndEnterReplay(snapshotId)` async function for Phase 17 timeline slider

## Task Commits

Each task was committed atomically:

1. **Task 1: Create replayTransitions.ts with morph, fade, and tint helpers** - `6240c87` (feat)
2. **Task 2: Wire ArchCanvas with replay subscription guard, entry/exit orchestration, and empty graph message** - `e758b37` (feat)

## Files Created/Modified
- `packages/client/src/canvas/replayTransitions.ts` - Pure animation helpers: 5 exported functions for morph/fade/tint with Konva.Tween API; no store imports
- `packages/client/src/canvas/ArchCanvas.tsx` - Added replayStore/useReplayStore imports, replayTransitions imports; graphStore subscription guard; replayStore.subscribe with full enter/exit transition logic; empty graph overlay JSX; loadSnapshotAndEnterReplay export; Stage wrapped in relative div

## Decisions Made
- `NodeRenderer.createShape` is private — used `syncAll` with a merged `Map(liveNodes + historicalOnlyNodes)` to create historical-only shapes; on exit, `syncAll(liveNodes)` reconciles them back (removes extras). This is semantically clean and avoids any API surface concerns.
- Blue tint approach: shadow glow (`shadowColor: #64a0ff, shadowBlur: 8, shadowOpacity: 0.5`) rather than fill color change. This preserves zone color identity while adding a visible blue overlay. Original shadow settings stored as JSON strings in `tintedFills` Map for exact restoration.
- `ArchCanvas` Stage wrapped in relative-positioned `<div>` to allow the absolute-positioned empty graph overlay. This is a minor DOM structure change with no functional impact on existing canvas behavior.
- `wasInReplay` boolean flag added inside the replayStore subscription closure to gate the exit handler — prevents the exit branch from firing during initial mount if the store happens to transition from false to false (degenerate case).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript generic type syntax error in loadSnapshotAndEnterReplay**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Used `Parameters<typeof replayStore.getState().enterReplay>[2]` as cast target — TypeScript parser rejects generic expressions with `.` method calls in type position
- **Fix:** Changed to `as any` with eslint-disable comments (as specified in the plan's fallback note "Wire format matches GraphNode/GraphEdge shape")
- **Files modified:** packages/client/src/canvas/ArchCanvas.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** e758b37 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minimal — only affected the type cast in loadSnapshotAndEnterReplay. The `as any` pattern was explicitly mentioned as an option in the plan spec.

## Issues Encountered
- TypeScript parse error on `Parameters<typeof fn>[N]` in type position — fixed by using `as any` (Rule 1, documented above)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 17 timeline slider can call `loadSnapshotAndEnterReplay(snapshotId)` imported from `packages/client/src/canvas/ArchCanvas.tsx` to trigger replay transitions
- ArchCanvas fully isolates replay canvas from live graphStore updates — initial_state during replay applies silently to graphStore but canvas stays on historical snapshot
- replayStore.exitReplay() triggers the exit transition, morphing nodes back to live positions
- All Phase 16 requirements complete: replayStore (Plan 01), ReplayBanner (Plan 02), canvas transitions (Plan 03)

---
*Phase: 16-client-state-layer-and-mode-isolation*
*Completed: 2026-03-17*
