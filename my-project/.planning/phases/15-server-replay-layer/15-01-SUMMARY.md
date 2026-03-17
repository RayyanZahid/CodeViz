---
phase: 15-server-replay-layer
plan: 01
subsystem: database
tags: [drizzle-orm, sqlite, better-sqlite3, checkpoint, snapshot, intent]

# Dependency graph
requires:
  - phase: 14-schema-foundation-and-shared-types
    provides: graphSnapshots table, intentSessions table, snapshotsRepository, intentSessionsRepository, IntentCategory type

provides:
  - snapshot_checkpoints table in SQLite with CRUD via checkpointsRepository
  - snapshotsRepository.deleteOldestNonCheckpoint for FIFO pruning that preserves checkpoints
  - snapshotsRepository.getLatestId for IntentAnalyzer session start-snapshot lookup
  - intentSessionsRepository.updateConfidence for in-place confidence re-evaluation
  - IntentCategory aligned to 6 user-specified values (DEPENDENCY_UPDATE, CLEANUP replacing INFRASTRUCTURE, UNCERTAIN)

affects:
  - 15-02 (IntentAnalyzer builds on checkpointsRepository, updateConfidence, getLatestId, aligned IntentCategory)
  - 15-03 (SnapshotManager checkpoint logic uses checkpointsRepository and deleteOldestNonCheckpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Repository pattern (same object-with-methods shape as snapshotsRepository and intentSessionsRepository)
    - Logical FK without .references() — matches intentSessions.startSnapshotId pattern (FK OFF in connection.ts)
    - notInArray guard: always check cpIds.length > 0 before using notInArray to prevent invalid NOT IN () SQL

key-files:
  created:
    - packages/server/src/db/repository/checkpoints.ts
  modified:
    - packages/server/src/db/schema.ts
    - packages/server/src/db/repository/snapshots.ts
    - packages/server/src/db/repository/intentSessions.ts
    - packages/shared/src/types/timeline.ts

key-decisions:
  - "IntentCategory updated to 6 user-specified categories: DEPENDENCY_UPDATE replaces INFRASTRUCTURE, CLEANUP replaces UNCERTAIN — backward-compatible since SQLite category column is plain text"
  - "snapshotCheckpoints uses logical FK to graph_snapshots (no .references()) — consistent with intentSessions.startSnapshotId pattern; FK enforcement OFF in connection.ts"
  - "deleteOldestNonCheckpoint guards notInArray with cpIds.length > 0 to prevent invalid NOT IN () SQL per research note"
  - "updateConfidence takes both confidence and objective so label can be updated alongside score when signals shift within the same category"

patterns-established:
  - "Pattern: notInArray guard — always check array.length > 0 before using notInArray() in Drizzle queries"
  - "Pattern: Logical FK — integer columns pointing to other table IDs without .references() when foreign_keys=OFF"

requirements-completed: [INFRA-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 15 Plan 01: Checkpoint Schema Foundation Summary

**snapshot_checkpoints SQLite table, full checkpointsRepository CRUD, FIFO-checkpoint-aware pruning, and IntentCategory aligned to 6 user-locked categories (DEPENDENCY_UPDATE + CLEANUP)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T00:58:51Z
- **Completed:** 2026-03-17T01:00:50Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Added `snapshotCheckpoints` table to schema.ts and pushed to archlens.db via drizzle-kit push
- Created `checkpointsRepository` with 7 methods: insert, getBySession, getSnapshotIds, getCount, deleteOldest, deleteBySession, deleteByWatchRoot
- Extended `snapshotsRepository` with `deleteOldestNonCheckpoint` (notInArray guard) and `getLatestId`
- Added `updateConfidence(id, confidence, objective)` to `intentSessionsRepository`
- Replaced `INFRASTRUCTURE` and `UNCERTAIN` with `DEPENDENCY_UPDATE` and `CLEANUP` in `IntentCategory`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add snapshot_checkpoints table, checkpoint repository, and snapshot repository extensions** - `021b10b` (feat)
2. **Task 2: Align IntentCategory to user decisions and add intentSessionsRepository.updateConfidence** - `8f7e19a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/server/src/db/schema.ts` - Added snapshotCheckpoints table definition after intentSessions
- `packages/server/src/db/repository/checkpoints.ts` - New checkpointsRepository with full CRUD surface
- `packages/server/src/db/repository/snapshots.ts` - Added deleteOldestNonCheckpoint and getLatestId; updated imports to include notInArray, and, snapshotCheckpoints
- `packages/server/src/db/repository/intentSessions.ts` - Added updateConfidence method
- `packages/shared/src/types/timeline.ts` - Updated IntentCategory const (DEPENDENCY_UPDATE, CLEANUP)

## Decisions Made

- `IntentCategory` updated to 6 user-specified categories — DEPENDENCY_UPDATE replaces INFRASTRUCTURE, CLEANUP replaces UNCERTAIN. Non-breaking since the SQLite `category` column is plain text with no enum constraint.
- `snapshotCheckpoints.snapshotId` uses a logical FK (no `.references()`) — consistent with the `intentSessions.startSnapshotId` pattern established in Phase 14 when `foreign_keys=OFF` was confirmed.
- `deleteOldestNonCheckpoint` uses ternary guard on `cpIds.length > 0` before calling `notInArray` — per research note, `NOT IN ()` is invalid SQL.
- `updateConfidence` takes `objective` alongside `confidence` so both label and score can be updated in one call when the IntentAnalyzer re-evaluates.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (IntentAnalyzer) can proceed: `checkpointsRepository`, `updateConfidence`, `getLatestId`, and aligned `IntentCategory` are all in place
- Plan 03 (SnapshotManager checkpoint logic + timeline plugin) can proceed: `checkpointsRepository` and `deleteOldestNonCheckpoint` are ready
- `pnpm typecheck` passes with 0 errors across server, client, and shared packages

---
*Phase: 15-server-replay-layer*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: packages/server/src/db/schema.ts
- FOUND: packages/server/src/db/repository/checkpoints.ts
- FOUND: packages/server/src/db/repository/snapshots.ts
- FOUND: packages/server/src/db/repository/intentSessions.ts
- FOUND: packages/shared/src/types/timeline.ts
- FOUND: .planning/phases/15-server-replay-layer/15-01-SUMMARY.md
- FOUND: commit 021b10b (Task 1)
- FOUND: commit 8f7e19a (Task 2)
