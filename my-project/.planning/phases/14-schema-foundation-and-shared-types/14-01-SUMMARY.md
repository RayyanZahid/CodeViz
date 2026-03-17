---
phase: 14-schema-foundation-and-shared-types
plan: 01
subsystem: database
tags: [drizzle-orm, sqlite, drizzle-kit, typescript, zod, websocket, repository-pattern]

# Dependency graph
requires: []
provides:
  - graph_snapshots SQLite table (Drizzle schema + drizzle-kit push applied)
  - intent_sessions SQLite table (Drizzle schema + drizzle-kit push applied)
  - packages/shared/src/types/timeline.ts with IntentCategory, SnapshotMeta, IntentSession, SnapshotSavedMessage, IntentUpdatedMessage, IntentClosedMessage
  - Extended ServerMessage union (8 members: 5 existing + 3 new timeline types)
  - snapshotsRepository with insert, findById, findBySession, getMetaBySession, getCount, deleteOldest, deleteBySession, deleteByWatchRoot
  - intentSessionsRepository with insert, findById, findBySession, findActive, close, deleteBySession, deleteByWatchRoot
  - Client Zod schemas for all 8 ServerMessage discriminated union members
affects:
  - 14-02 (SnapshotManager delta-threshold triggering uses snapshotsRepository)
  - 15 (IntentAnalyzer uses intentSessionsRepository)
  - 16 (Mode state machine uses both repositories for replay data)
  - 17 (Timeline slider uses SnapshotMeta types)
  - 18 (Replay engine uses graphSnapshots, IntentSession types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "const-object + derived type for enums (IntentCategory follows ZoneName/RiskType pattern)"
    - "InferSelectModel/InferInsertModel for repository row types (established pattern)"
    - "Plain repository objects with sync Drizzle methods (following positions.ts)"
    - "drizzle-kit push (not migrate) for schema changes"
    - "Relaxed Zod string schemas for enum fields to tolerate future additions"

key-files:
  created:
    - packages/shared/src/types/timeline.ts
    - packages/server/src/db/repository/snapshots.ts
    - packages/server/src/db/repository/intentSessions.ts
  modified:
    - packages/server/src/db/schema.ts
    - packages/shared/src/types/messages.ts
    - packages/shared/src/types/index.ts
    - packages/client/src/schemas/serverMessages.ts

key-decisions:
  - "No FK references on startSnapshotId/endSnapshotId in intent_sessions — foreign_keys=OFF in connection.ts so constraints would be silently unenforced; plain integers instead"
  - "getMetaBySession selects only metadata columns (excludes graphJson) to avoid loading large JSON blob during timeline browsing"
  - "Relaxed Zod string schemas for category field (z.string() not z.enum()) to tolerate future intent category additions"

patterns-established:
  - "Timeline types live in packages/shared/src/types/timeline.ts; server imports via ./timeline.js (.js extension for NodeNext)"
  - "Each new Drizzle table gets its own repository file in packages/server/src/db/repository/"
  - "New Zod sub-schemas and message schemas added to packages/client/src/schemas/serverMessages.ts following existing section structure"

requirements-completed: [INFRA-01]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 14 Plan 01: Schema Foundation and Shared Types Summary

**Two SQLite tables (graph_snapshots, intent_sessions) with Drizzle ORM, shared TypeScript timeline types, 8-member ServerMessage union, and repository access layers for snapshot FIFO and intent session lifecycle management**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T00:12:57Z
- **Completed:** 2026-03-17T00:15:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created graph_snapshots and intent_sessions Drizzle table definitions and pushed to live SQLite database
- Created packages/shared/src/types/timeline.ts with IntentCategory enum, SnapshotMeta, IntentSession domain types, and 3 WebSocket message types
- Extended ServerMessage discriminated union to 8 members and added corresponding Zod validation schemas in the client
- Built snapshotsRepository (8 methods including FIFO deleteOldest and metadata-only getMetaBySession) and intentSessionsRepository (7 methods including findActive and close)

## Task Commits

Each task was committed atomically:

1. **Task 1: Drizzle schema, shared types, and message protocol extension** - `5d818de` (feat)
2. **Task 2: Repository modules for snapshots and intent sessions** - `18a7765` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `packages/server/src/db/schema.ts` - Added graphSnapshots and intentSessions Drizzle table definitions
- `packages/shared/src/types/timeline.ts` - New: IntentCategory, SnapshotMeta, IntentSession, SnapshotSavedMessage, IntentUpdatedMessage, IntentClosedMessage
- `packages/shared/src/types/messages.ts` - Extended ServerMessage union to 8 members via import from timeline.js
- `packages/shared/src/types/index.ts` - Added export * from './timeline.js'
- `packages/client/src/schemas/serverMessages.ts` - Added SnapshotMetaSchema, IntentSessionSchema, 3 new message schemas to discriminated union (now 8 members)
- `packages/server/src/db/repository/snapshots.ts` - New: snapshotsRepository with full CRUD and FIFO pruning support
- `packages/server/src/db/repository/intentSessions.ts` - New: intentSessionsRepository with session lifecycle (findActive, close)

## Decisions Made

- No FK references on startSnapshotId/endSnapshotId in intent_sessions — foreign_keys=OFF in connection.ts means .references() would silently not be enforced; kept as plain integers per RESEARCH.md Pitfall 4
- getMetaBySession selects only metadata columns (id, sessionId, sequenceNumber, timestamp, summary, triggerFiles), explicitly excluding graphJson, so timeline browsing doesn't load full graph blobs
- Used z.string() (not z.enum()) for category field in IntentSessionSchema — relaxed pattern matches existing Zod conventions and tolerates future category additions without schema breakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both SQLite tables are live and accept inserts; ready for SnapshotManager (Plan 02) to start writing snapshots
- snapshotsRepository.getMetaBySession and deleteOldest are the key hooks for Plan 02's FIFO pruning and timeline metadata push
- intentSessionsRepository.findActive and close support Plan 15's IntentAnalyzer session lifecycle
- All shared types exported from @archlens/shared barrel; client Zod validation ready for the 3 new message types once server begins pushing them

---
*Phase: 14-schema-foundation-and-shared-types*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: packages/shared/src/types/timeline.ts
- FOUND: packages/server/src/db/repository/snapshots.ts
- FOUND: packages/server/src/db/repository/intentSessions.ts
- FOUND: commit 5d818de (Task 1)
- FOUND: commit 18a7765 (Task 2)
- FOUND: graph_snapshots table in SQLite
- FOUND: intent_sessions table in SQLite
