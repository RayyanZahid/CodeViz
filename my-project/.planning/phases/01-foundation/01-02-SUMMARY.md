---
phase: 01-foundation
plan: 02
subsystem: database
tags: [sqlite, drizzle-orm, better-sqlite3, wal, repository-pattern, typescript, esm]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm monorepo, server package, shared types (GraphNode, GraphEdge, ChangeEvent)
provides:
  - SQLite database (archlens.db) with WAL mode enabled
  - Drizzle schema for 4 tables: graph_nodes, graph_edges, change_events, layout_positions
  - drizzle.config.ts for drizzle-kit push/generate
  - nodesRepository: findById, findAll, upsert, deleteById
  - edgesRepository: findById, findAll, findByNodeId, insert, deleteById, deleteByNodeId
  - eventsRepository: append (insert-only), findAll, findSince, getLatestSequence
  - positionsRepository: findByNodeId, findAll, upsert, deleteByNodeId
affects: [02-server-foundation, 03-client-foundation, 04-inference, 05-realtime, 06-visualization]

# Tech tracking
tech-stack:
  added:
    - drizzle-orm ^0.40.0 (already declared in server package.json; Drizzle API used here)
    - drizzle-kit ^0.30.0 (already declared in server devDependencies; drizzle-kit push used)
    - better-sqlite3 ^11.0.0 (already compiled; Database API used for WAL pragma and sync access)
  patterns:
    - Repository pattern: one file per domain entity, each exports a typed object with CRUD methods
    - Synchronous Drizzle API (better-sqlite3 is synchronous, no async/await in any repository)
    - Upsert via onConflictDoUpdate for nodes and positions (idempotent write)
    - Append-only semantics for changeEvents (no update/delete methods exposed)
    - sql template literal for aggregate queries (max(id) in getLatestSequence)
    - .js extensions on all imports (NodeNext ESM requirement)

key-files:
  created:
    - packages/server/drizzle.config.ts
    - packages/server/src/db/connection.ts
    - packages/server/src/db/schema.ts
    - packages/server/src/db/repository/nodes.ts
    - packages/server/src/db/repository/edges.ts
    - packages/server/src/db/repository/events.ts
    - packages/server/src/db/repository/positions.ts
  modified: []

key-decisions:
  - "WAL pragma is set on the Database instance in connection.ts; drizzle-kit push creates the file without WAL, but connection.ts sets it persistently on first open"
  - "Append-only semantics enforced structurally in eventsRepository by omitting update/delete methods — id column uses autoIncrement for monotonic sequence"
  - "onConflictDoUpdate used for nodes.upsert and positions.upsert — simpler and more correct than delete+insert, preserves referential integrity"
  - "InferSelectModel / InferInsertModel used for return types — avoids manual interface duplication and stays in sync with schema automatically"

patterns-established:
  - "Pattern: Repository exports a plain object (not class) with synchronous methods — matches better-sqlite3 sync API"
  - "Pattern: Each repository imports db from ../connection.js and schema symbols from ../schema.js — single connection instance across all repositories"
  - "Pattern: fileList column uses text mode json with $type<string[]> — stores JSON array in SQLite text column, decoded by Drizzle automatically"

requirements-completed: [FOUND-02, FOUND-03, PERS-01, PERS-02, PERS-03]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 1 Plan 02: SQLite Persistence Layer Summary

**SQLite database with WAL mode, Drizzle ORM schema for 4 tables (graph_nodes, graph_edges, change_events, layout_positions), and typed repository layer with upsert, append-only events, and edge-connected node queries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T21:08:00Z
- **Completed:** 2026-03-15T21:12:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- SQLite database with WAL mode and NORMAL synchronous write (WAL pragma set persistently via connection.ts on first open)
- Drizzle schema covers all 4 tables with correct column types: text/json for fileList and payload, integer timestamp_ms for all date columns, real for position coordinates
- Repository layer provides full typed CRUD; nodes and positions support idempotent upsert; events are append-only with sequence-based querying; edges support lookup by connected node (source OR target)

## Task Commits

Each task was committed atomically:

1. **Task 1: SQLite connection, Drizzle schema, drizzle.config.ts** - `a51ff22` (feat)
2. **Task 2: Repository layer for nodes, edges, events, positions** - `30d698d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `packages/server/drizzle.config.ts` - drizzle-kit config: sqlite dialect, schema path, archlens.db URL
- `packages/server/src/db/connection.ts` - Database open with WAL+NORMAL pragmas, drizzle client exported as `db`
- `packages/server/src/db/schema.ts` - Four Drizzle table definitions: graphNodes, graphEdges, changeEvents, layoutPositions
- `packages/server/src/db/repository/nodes.ts` - nodesRepository: findById, findAll, upsert, deleteById
- `packages/server/src/db/repository/edges.ts` - edgesRepository: findById, findAll, findByNodeId, insert, deleteById, deleteByNodeId
- `packages/server/src/db/repository/events.ts` - eventsRepository: append, findAll, findSince, getLatestSequence
- `packages/server/src/db/repository/positions.ts` - positionsRepository: findByNodeId, findAll, upsert, deleteByNodeId

## Decisions Made
- WAL pragma is set in connection.ts on the Database instance. drizzle-kit push creates archlens.db without WAL, but the pragma persists once set by connection.ts. This is the correct behavior — WAL mode is durable and survives connection close/reopen.
- Chose onConflictDoUpdate for upsert (nodes, positions) over delete+insert — preserves referential integrity (layout_positions.nodeId references graph_nodes.id) and is atomic.
- Append-only semantics for changeEvents are enforced structurally by not exposing update or delete methods — the repository interface is the contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Persistence layer complete — Plan 03 (server HTTP/WebSocket) can import `db` from connection.ts and repositories from db/repository/*.ts
- All 4 tables created via drizzle-kit push — re-running push is idempotent (no changes detected)
- WAL mode active — high-throughput event appends from the watcher pipeline will work correctly
- TypeScript compiles cleanly (tsc --noEmit passes with 0 errors)

---
*Phase: 01-foundation*
*Completed: 2026-03-15*

## Self-Check: PASSED

- SUMMARY.md: FOUND at .planning/phases/01-foundation/01-02-SUMMARY.md
- Task 1 commit a51ff22: FOUND
- Task 2 commit 30d698d: FOUND
- All 7 created files verified present on disk
- WAL mode verified active: journal_mode = wal
- All 4 tables verified: change_events, graph_edges, graph_nodes, layout_positions
- TypeScript compiles cleanly: tsc --noEmit exits 0
