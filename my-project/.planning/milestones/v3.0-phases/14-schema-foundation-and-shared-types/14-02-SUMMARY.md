---
phase: 14-schema-foundation-and-shared-types
plan: 02
subsystem: infra
tags: [snapshot, debounce, fifo-pruning, sqlite, websocket, event-driven, typescript]

# Dependency graph
requires:
  - phase: 14-01
    provides: snapshotsRepository (insert, getCount, deleteOldest), SnapshotMeta type, SnapshotSavedMessage type
provides:
  - SnapshotManager class with delta-threshold logic (structural=immediate, minor=10-count accumulation)
  - Debounced snapshot capture (3s window, decoupled from delta hot path)
  - FIFO pruning at 200 snapshots per session via snapshotsRepository.deleteOldest
  - Server lifecycle wiring: create on startup, destroy/recreate on watch-root switch, destroy on shutdown
  - Initial snapshot capture after first scan completes (2s post-pipeline.start delay)
  - SnapshotSavedMessage broadcast to WebSocket clients after each write
affects:
  - 15 (IntentAnalyzer can correlate snapshot IDs with activity windows)
  - 16 (Mode state machine uses snapshot metadata for replay timeline)
  - 17 (Timeline slider reads SnapshotMeta from broadcasts)
  - 18 (Replay engine loads graphJson from SQLite by snapshot ID)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bound handler stored in constructor for clean removeListener() in destroy() (EventEmitter pattern)"
    - "Debounce-decoupled writes — delta handler returns immediately, snapshot writes happen in timer callback"
    - "Structural vs minor change classification for threshold-based snapshot triggering"
    - "FIFO pruning: getCount() check followed by deleteOldest() after each insert"

key-files:
  created:
    - packages/server/src/snapshot/SnapshotManager.ts
  modified:
    - packages/server/src/index.ts

key-decisions:
  - "GraphDelta.addedNodes is string[] (file path IDs), not objects — plan spec said 'their id field' but actual type is plain strings; adapted trigger file collection accordingly"
  - "DependencyGraph.getSnapshot() returns {nodes, edges} only — no layoutPositions; positions field in graphJson set to empty object (reserved for Phase 6 layout persistence)"
  - "2-second post-pipeline.start delay for captureInitialSnapshot — allows DependencyGraph's 50ms consolidation window to flush all initial scan deltas before first snapshot"

patterns-established:
  - "SnapshotManager follows same destroy() lifecycle pattern as InferenceEngine in index.ts"
  - "New snapshot directory packages/server/src/snapshot/ established for snapshot-related classes"

requirements-completed: [INFRA-02]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 14 Plan 02: SnapshotManager Summary

**Delta-threshold SnapshotManager with structural/minor change classification, 3s debounce, 200-entry FIFO pruning, and full server lifecycle wiring (startup, watch-root switch, shutdown)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T00:19:36Z
- **Completed:** 2026-03-17T00:22:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created SnapshotManager class that subscribes to graph delta events, classifies structural vs minor changes, and triggers debounced snapshots using snapshotsRepository from Plan 01
- Implemented hybrid threshold: structural changes (new/removed nodes, edges, cycle changes) trigger immediate debounced snapshot; minor changes (export modifications) accumulate to threshold of 10
- Wired full server lifecycle in index.ts: SnapshotManager created on startup, destroyed and recreated during watch-root switch, destroyed via onClose hook
- Snapshot metadata broadcast to WebSocket clients as `snapshot_saved` messages after each SQLite write

## Task Commits

Each task was committed atomically:

1. **Task 1: SnapshotManager class with delta-threshold logic** - `155fdba` (feat)
2. **Task 2: Wire SnapshotManager into server lifecycle** - `2afbbf1` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `packages/server/src/snapshot/SnapshotManager.ts` - New: SnapshotManager class with onDelta, scheduleSnapshot, captureSnapshot, captureInitialSnapshot, destroy, getSessionId
- `packages/server/src/index.ts` - Added SnapshotManager import, creation, lifecycle wiring in switchWatchRoot and onClose, initial snapshot trigger in start()

## Decisions Made

- `GraphDelta.addedNodes` is `string[]` (file path IDs directly), not objects with an `.id` field — adapted trigger file collection to push strings directly instead of extracting `.id`
- `DependencyGraph.getSnapshot()` returns `{ nodes, edges }` without `layoutPositions` — graphJson positions field set to `{}` as a placeholder, consistent with the Phase 6 layout persistence plan
- 2-second delay before `captureInitialSnapshot()` in the `start()` function to allow DependencyGraph's 50ms consolidation window to settle all initial scan deltas before capturing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted trigger file collection for actual GraphDelta type**
- **Found during:** Task 1 (SnapshotManager class)
- **Issue:** Plan spec said "extract unique file paths from delta.addedNodes (their id field)" but GraphDelta.addedNodes is string[] — the strings ARE the IDs; there is no `.id` property
- **Fix:** Changed code to push `nodeId` strings directly from `delta.addedNodes` and `delta.modifiedNodes` (no `.id` accessor needed)
- **Files modified:** packages/server/src/snapshot/SnapshotManager.ts
- **Verification:** pnpm typecheck passes with 0 errors
- **Committed in:** 155fdba (Task 1 commit)

**2. [Rule 1 - Bug] Adapted graphJson positions for actual getSnapshot() return type**
- **Found during:** Task 1 (captureSnapshot method)
- **Issue:** Plan spec referenced `snapshot.layoutPositions` as a field from `graph.getSnapshot()`, but DependencyGraph.getSnapshot() returns `{ nodes, edges }` only — no layoutPositions field exists
- **Fix:** Set `positions: {}` in graphJson blob as a reserved placeholder for Phase 6 layout persistence
- **Files modified:** packages/server/src/snapshot/SnapshotManager.ts
- **Verification:** pnpm typecheck passes with 0 errors; graphJson schema still valid
- **Committed in:** 155fdba (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — code adapted to match actual TypeScript types, no behavior change)
**Impact on plan:** Both fixes required for correctness. No scope creep. Position tracking reserved for Phase 6 as originally planned.

## Issues Encountered

None. Both deviations were type adaptations caught during implementation and resolved immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SnapshotManager is live and will begin writing snapshots to SQLite as soon as the server starts and files change
- snapshotsRepository.getMetaBySession provides the timeline metadata stream for Phase 17's slider
- Phase 15 (IntentAnalyzer) can now correlate snapshot IDs via snapshotsRepository.findBySession
- Phase 16 (Mode state machine) can read graphJson blobs from SQLite by snapshot ID for replay
- All Phase 14 requirements (INFRA-01, INFRA-02) are now complete

---
*Phase: 14-schema-foundation-and-shared-types*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: packages/server/src/snapshot/SnapshotManager.ts
- FOUND: packages/server/src/index.ts (modified with SnapshotManager lifecycle)
- FOUND: commit 155fdba (Task 1)
- FOUND: commit 2afbbf1 (Task 2)
- pnpm typecheck: 0 errors
