---
phase: 15-server-replay-layer
plan: 03
subsystem: server-api
tags: [fastify, rest-endpoints, timeline, intent-analyzer, lifecycle-management]

# Dependency graph
requires:
  - phase: 15-01
    provides: snapshotsRepository.getMetaBySession, snapshotsRepository.findById, intentSessionsRepository.findBySession
  - phase: 15-02
    provides: IntentAnalyzer class, SnapshotManager with checkpoint logic

provides:
  - GET /api/timeline REST endpoint returning SnapshotMeta[] for current session
  - GET /api/snapshot/:id REST endpoint returning bundled historical snapshot
  - GET /api/intents REST endpoint returning IntentSession[] for current session
  - IntentAnalyzer fully lifecycle-managed (create on startup, destroy/recreate on watch-root switch, destroy on shutdown)

affects:
  - Phase 16 (client timeline slider can now query /api/timeline and /api/snapshot/:id)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getSessionId closure pattern: timelinePlugin receives () => snapshotManager.getSessionId() so endpoint always serves the current session after watch-root switch
    - Destroy-before-reset ordering: IntentAnalyzer destroyed before graph reset so closeSession can record correct endSnapshotId
    - FastifyPluginAsync options interface: TimelinePluginOptions typed for getSessionId callback

key-files:
  created:
    - packages/server/src/plugins/timeline.ts
  modified:
    - packages/server/src/index.ts

key-decisions:
  - "timelinePlugin uses getSessionId closure over snapshotManager — after switchWatchRoot replaces snapshotManager, the closure returns the new session ID automatically without plugin re-registration"
  - "IntentAnalyzer destroyed before graph reset in switchWatchRoot (step 2c) — ensures closeSession records endSnapshotId from the correct session before SQLite tables are purged"
  - "Date-to-epoch-ms conversions use instanceof Date guard for safety — Drizzle timestamp_ms mode returns Date objects but API contracts use number"

patterns-established:
  - "Pattern: getSessionId closure — pass () => manager.getSessionId() to plugins instead of the session ID string directly, so runtime switches propagate automatically"

requirements-completed: [INFRA-03]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 15 Plan 03: Timeline REST Plugin and IntentAnalyzer Lifecycle Summary

**Three REST endpoints for timeline browsing (GET /api/timeline, GET /api/snapshot/:id, GET /api/intents) plus full IntentAnalyzer lifecycle management in server startup, watch-root switch, and shutdown**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T01:09:22Z
- **Completed:** 2026-03-17T01:11:16Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `timelinePlugin` Fastify plugin (78 lines) with three REST endpoints: GET /api/timeline, GET /api/snapshot/:id, GET /api/intents
- All Date-to-epoch-ms conversions handled via instanceof guard (Drizzle timestamp_ms mode returns Date objects)
- Wired `IntentAnalyzer` into `index.ts`: created on startup sharing snapshotManager's sessionId
- Registered `timelinePlugin` with a `getSessionId` closure so it always serves the current session after watch-root switches
- Added IntentAnalyzer destruction at step 2c in `switchWatchRoot` (before graph reset) and recreation at step 8c (after new SnapshotManager)
- Updated `onClose` hook to destroy IntentAnalyzer first (before SnapshotManager) to ensure correct endSnapshotId recording

## Task Commits

Each task was committed atomically:

1. **Task 1: Create timeline REST plugin with three endpoints** - `52665b4` (feat)
2. **Task 2: Wire IntentAnalyzer and timeline plugin into server lifecycle** - `38ad42b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/server/src/plugins/timeline.ts` - New Fastify plugin: GET /api/timeline (SnapshotMeta[]), GET /api/snapshot/:id (bundled historical snapshot), GET /api/intents (IntentSession[])
- `packages/server/src/index.ts` - Added IntentAnalyzer and timelinePlugin imports; IntentAnalyzer creation on startup; timelinePlugin registration; IntentAnalyzer destroy/recreate in switchWatchRoot; IntentAnalyzer destroy in onClose

## Decisions Made

- `timelinePlugin` uses a `getSessionId: () => snapshotManager.getSessionId()` closure rather than a static session ID string — after `switchWatchRoot()` replaces `snapshotManager`, the closure automatically returns the new session ID without requiring plugin re-registration.
- `IntentAnalyzer` is destroyed at step 2c in `switchWatchRoot` (before the graph reset at step 3) — this ensures `closeSession()` can record the correct `endSnapshotId` from the current session before the SQLite graph tables are purged.
- Date-to-epoch-ms conversions in `timeline.ts` use an `instanceof Date` guard for safety — Drizzle's `timestamp_ms` mode returns `Date` objects but the API contracts and shared types use `number` (epoch milliseconds).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 15 is complete: all four success criteria from ROADMAP.md are now verifiable
  - GET /api/timeline returns snapshot metadata with sequence numbers and timestamps after file changes
  - GET /api/snapshot/:id returns complete graph snapshot (O(1) retrieval from stored blob)
  - IntentAnalyzer classifies architectural events into one of 6 coarse categories with confidence score
  - WAL mode ensures writing during an active session does not pause the pipeline
- Phase 16 (Mode State Machine) can proceed: client can now query timeline and replay snapshots via REST
- `pnpm typecheck` passes with 0 errors across server, client, and shared packages

---
*Phase: 15-server-replay-layer*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: packages/server/src/plugins/timeline.ts
- FOUND: packages/server/src/index.ts
- FOUND: .planning/phases/15-server-replay-layer/15-03-SUMMARY.md
- FOUND: commit 52665b4 (Task 1)
- FOUND: commit 38ad42b (Task 2)
