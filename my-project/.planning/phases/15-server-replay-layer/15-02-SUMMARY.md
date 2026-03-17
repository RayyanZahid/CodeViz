---
phase: 15-server-replay-layer
plan: 02
subsystem: inference
tags: [intent-classification, ewma, heuristic-scoring, snapshot-checkpoints, websocket]

# Dependency graph
requires:
  - phase: 15-01
    provides: checkpointsRepository, snapshotsRepository.getLatestId, intentSessionsRepository.updateConfidence, IntentCategory aligned to 6 user-locked values

provides:
  - IntentAnalyzer class with EWMA-decay heuristic scoring for 6 intent categories
  - Intent session lifecycle management (open/close/update with focus-shift detection)
  - WebSocket broadcasts for intent_updated and intent_closed messages
  - SnapshotManager checkpoint creation every 50 snapshots (CHECKPOINT_INTERVAL=50)
  - SnapshotManager FIFO pruning via deleteOldestNonCheckpoint (preserves checkpoints)

affects:
  - 15-03 (IntentAnalyzer and SnapshotManager are ready for wiring into index.ts and REST endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - EWMA decay pattern: multiply all category scores by 0.85 before adding new signals per delta
    - Noise gate pattern: only act on classification when sum of all scores > MIN_SIGNAL_THRESHOLD (0.1)
    - Activity gap reset: if no delta for >90s, reset all scores to 0 before processing to prevent stale context
    - Confidence flood prevention: only re-broadcast intent_updated if confidence changed by >0.05
    - Focus shift pattern: close current session and open new when winning category changes

key-files:
  created:
    - packages/server/src/snapshot/IntentAnalyzer.ts
  modified:
    - packages/server/src/snapshot/SnapshotManager.ts

key-decisions:
  - "IntentAnalyzer broadcasts full IntentSession object on open; on update only re-broadcasts if confidence delta > 0.05 to avoid flooding WebSocket"
  - "Activity gap threshold 90s is the starting estimate from STATE.md blocker note — no further measurement needed at this stage"
  - "updateSession passes activeObjective to updateConfidence so both label and score stay in sync (matches updateConfidence signature from 15-01)"

patterns-established:
  - "Pattern: EWMA decay before signal addition — scores decay by 0.85, then new signals add on top, giving recent deltas more weight without discarding history entirely"
  - "Pattern: Noise gate on sum — check sumOfScores > 0.1 before classifying to avoid spurious sessions from single-signal noise"
  - "Pattern: Activity gap reset — track lastDeltaTimestamp and zero all scores if gap > 90s to treat as fresh context"

requirements-completed: [INFRA-03]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 15 Plan 02: IntentAnalyzer and SnapshotManager Checkpoint Logic Summary

**EWMA-decay intent classification engine (6 categories, focus-shift detection, WebSocket broadcast) plus checkpoint-aware FIFO pruning in SnapshotManager**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T01:04:08Z
- **Completed:** 2026-03-17T01:06:38Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `IntentAnalyzer` (378 lines) with full EWMA heuristic scoring across 6 intent categories, session lifecycle management, activity gap reset, noise gate, and focus-shift close+reopen
- Added checkpoint creation (every 50 snapshots) and checkpoint pruning (max 10) to `SnapshotManager`
- Replaced `deleteOldest` FIFO pruning with `deleteOldestNonCheckpoint` so checkpoint snapshots are never deleted by the FIFO sweeper

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IntentAnalyzer class with heuristic intent classification** - `e811fa0` (feat)
2. **Task 2: Add checkpoint creation and non-checkpoint FIFO pruning to SnapshotManager** - `01fe521` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/server/src/snapshot/IntentAnalyzer.ts` - New class: EWMA scoring, 6 intent categories, session lifecycle (open/close/update), focus-shift detection, activity gap reset, WebSocket broadcast
- `packages/server/src/snapshot/SnapshotManager.ts` - Added checkpointsRepository import, CHECKPOINT_INTERVAL=50, MAX_CHECKPOINTS=10, checkpoint creation at step 6b, deleteOldestNonCheckpoint at step 7

## Decisions Made

- IntentAnalyzer broadcasts a full `IntentSession` object on open but only re-broadcasts on update when confidence changes by >0.05 — prevents flooding when the agent is in steady state.
- Activity gap threshold of 90s from STATE.md blocker note is implemented as specified. No measurement required at this stage; it can be tuned in Phase 16+ if needed.
- `updateSession` passes `activeObjective` to `updateConfidence` so both confidence and label stay in sync — matches the `updateConfidence(id, confidence, objective)` signature established in 15-01.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can proceed: `IntentAnalyzer` and updated `SnapshotManager` are in place and compile cleanly
- Plan 03 needs to instantiate `IntentAnalyzer` in `index.ts` (same lifecycle as `SnapshotManager`) and wire REST endpoints for timeline browsing
- `pnpm typecheck` passes with 0 errors across server, client, and shared packages

---
*Phase: 15-server-replay-layer*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: packages/server/src/snapshot/IntentAnalyzer.ts
- FOUND: packages/server/src/snapshot/SnapshotManager.ts
- FOUND: .planning/phases/15-server-replay-layer/15-02-SUMMARY.md
- FOUND: commit e811fa0 (Task 1)
- FOUND: commit 01fe521 (Task 2)
