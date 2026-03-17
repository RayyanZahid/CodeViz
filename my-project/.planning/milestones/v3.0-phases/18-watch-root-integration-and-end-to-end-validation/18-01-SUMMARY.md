---
phase: 18-watch-root-integration-and-end-to-end-validation
plan: 01
subsystem: infra
tags: [sqlite, drizzle, zustand, websocket, replay, watch-root, toast]

# Dependency graph
requires:
  - phase: 15-server-replay-layer
    provides: snapshotsRepository, intentSessionsRepository, checkpointsRepository with deleteByWatchRoot methods
  - phase: 16-replay-mode-state-machine
    provides: replayStore with exitReplay/clearBuffer; WsClient watch_root_changed handler
  - phase: 17-timeline-slider-and-intent-panel-ui
    provides: replayStore snapshots/playback state; App.tsx layout
provides:
  - SQLite purge of graphSnapshots, intentSessions, snapshotCheckpoints, and changeEvents on watch-root switch
  - Client-side amber toast notification when replay mode is auto-exited during root switch
  - replayExitedForSwitch Zustand field for cross-component toast signaling
affects:
  - end-to-end-validation
  - journey tests for watch-root switching

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand field as toast signal: non-null value triggers display, auto-cleared after 2s via useEffect timeout"
    - "All SQLite purges in switchWatchRoot are synchronous (better-sqlite3 .run()) — no await needed"
    - "deleteByWatchRoot pattern on repositories allows targeted purge without session ID knowledge"

key-files:
  created: []
  modified:
    - packages/server/src/index.ts
    - packages/client/src/ws/wsClient.ts
    - packages/client/src/App.tsx
    - packages/client/src/store/replayStore.ts

key-decisions:
  - "Zustand atom approach for toast signal (replayExitedForSwitch in replayStore) over WsClient callback — avoids callback wiring complexity, consistent with existing store patterns"
  - "setReplayExitedForSwitch only fires inside isReplay guard in watch_root_changed — toast must not appear on every root switch, only when user was in replay mode"
  - "changeEvents table has no watchRoot column — db.delete(changeEvents).run() clears all rows (session-scoped, no value after switch)"
  - "layoutPositions NOT deleted — positions persist per watch root per CONTEXT.md design decision"

patterns-established:
  - "Replay-exit toast: Zustand string | null field, set by WsClient, auto-cleared after 2s by App.tsx useEffect"

requirements-completed:
  - INFRA-04

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 18 Plan 01: Watch-Root SQLite Purge and Replay-Exit Toast Summary

**SQLite purge of 4 replay/intent tables on watch-root switch plus amber toast notification when replay is auto-exited during directory change**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T10:45:12Z
- **Completed:** 2026-03-17T10:47:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `switchWatchRoot()` in `index.ts` now calls `snapshotsRepository.deleteByWatchRoot()`, `intentSessionsRepository.deleteByWatchRoot()`, `checkpointsRepository.deleteByWatchRoot()`, and `db.delete(changeEvents).run()` between the graphNodes purge and aggregator reset — before broadcasting `watch_root_changed`
- `replayStore` extended with `replayExitedForSwitch: string | null` field and `setReplayExitedForSwitch` action for cross-component toast signaling
- `wsClient.ts` sets `replayExitedForSwitch(msg.directory)` only inside the `isReplay` guard — toast never fires on non-replay root switches
- `App.tsx` renders fixed-position amber toast "Exited replay — switching to [dirname]" and auto-dismisses after 2 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SQLite purge for replay/intent tables in switchWatchRoot** - `b8aefbd` (feat)
2. **Task 2: Add replay-exit toast notification on watch-root switch** - `000d308` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/server/src/index.ts` - Added 3 repository imports + changeEvents import, inserted 4 purge calls in switchWatchRoot between step 4 and step 5
- `packages/client/src/store/replayStore.ts` - Added `replayExitedForSwitch` field and `setReplayExitedForSwitch` action
- `packages/client/src/ws/wsClient.ts` - Set `replayExitedForSwitch(msg.directory)` inside isReplay guard in watch_root_changed handler
- `packages/client/src/App.tsx` - Added selector, auto-dismiss useEffect, and fixed-position amber toast render

## Decisions Made
- Used Zustand atom approach (`replayExitedForSwitch` in replayStore) instead of WsClient callback for toast signaling — avoids callback wiring complexity and is consistent with existing store patterns
- `changeEvents` table uses global delete (`db.delete(changeEvents).run()`) since it has no `watchRoot` column — rows are session-scoped with no value after a root switch
- `layoutPositions` intentionally excluded from all purge calls per CONTEXT.md (layout positions persist across root switches for "familiar node placement")
- All 4 purge calls are placed BEFORE `broadcast({ type: 'watch_root_changed' })` (step 6) to guarantee clean state before the client receives the event and could fetch stale data

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Watch-root switching now correctly purges all old snapshot/intent/checkpoint data from SQLite before starting the new pipeline
- Client correctly notifies users when replay mode is auto-exited during a directory switch
- Ready for end-to-end validation journey tests for Phase 18

---
*Phase: 18-watch-root-integration-and-end-to-end-validation*
*Completed: 2026-03-17*
