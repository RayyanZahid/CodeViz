---
phase: 03-dependency-graph-model
plan: 02
subsystem: graph
tags: [graphlib, sqlite, drizzle-orm, persistence, pipeline-integration, dependency-graph, typescript]

# Dependency graph
requires:
  - phase: 03-dependency-graph-model-plan-01
    provides: DependencyGraph class with onDeltaComputed hook, GraphDelta types
  - phase: 02-file-watching-and-parsing-pipeline
    provides: Pipeline class, ParseBatchResult, file watcher integration
  - phase: 01-foundation
    provides: SQLite db connection (better-sqlite3 + Drizzle), graphNodes/graphEdges schema
provides:
  - GraphPersistence module with persistDelta (atomic SQLite write-through) and loadGraphState (startup load)
  - DependencyGraph.onDeltaComputed overridden to call persistDelta before delta emission
  - DependencyGraph.loadFromDatabase() public method for startup graph restoration
  - Server entry point wiring DependencyGraph + Pipeline for full end-to-end data flow
  - Full pipeline: file change -> debounce -> parse -> graph update -> delta -> SQLite write-through -> console log
affects:
  - 03-03 (phase 3 plan 3 — depends on complete pipeline)
  - 04-inference-engine (subscribes to DependencyGraph 'delta' events)
  - 05-websocket-layer (uses GraphDelta type for wire format)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic delta persistence: db.transaction() wraps all node/edge mutations per delta — crash-safe write-through"
    - "External node stub filtering: __ext__/ prefixed nodes skipped from SQLite (no FK row needed)"
    - "Persist-before-emit ordering: onDeltaComputed calls persistDelta synchronously before emit('delta')"
    - "Startup graph restoration: loadFromDatabase() called before pipeline.start() — prior state loaded before chokidar initial scan"
    - "ARCHLENS_WATCH_ROOT env var: configurable watch directory, defaults to process.cwd()"
    - "onClose hook pattern: fastify.addHook('onClose') for graceful pipeline shutdown"

key-files:
  created:
    - packages/server/src/graph/GraphPersistence.ts
  modified:
    - packages/server/src/graph/DependencyGraph.ts
    - packages/server/src/index.ts

key-decisions:
  - "External stub nodes (__ext__/ prefix) excluded from SQLite persistence — no node row required, FK constraints only apply to real file nodes"
  - "onDeltaComputed hook implemented directly in DependencyGraph (not subclass override) — eliminates the planned subclass indirection since Plan 02 owns the persistence concern"
  - "Edge insertion FK safety: added edges skip __ext__/ endpoints; removed nodes pre-delete all incident edges to avoid FK violations"
  - "activeCycles rebuilt via alg.findCycles() after loadFromDatabase to ensure correct cycle diffs on first post-startup delta"
  - "ARCHLENS_WATCH_ROOT env var with cwd() fallback — supports both development and production deployment contexts"

patterns-established:
  - "Graph persistence pattern: delta mutations ordered as upsert nodes -> insert edges -> delete edges -> delete nodes (FK constraint order)"
  - "Crash-safe write-through: persistDelta called in onDeltaComputed (before emit) so SQLite state is always ahead-of or equal-to in-memory graph"
  - "Startup restore before watch: loadFromDatabase() before pipeline.start() preserves prior session state across server restarts"

requirements-completed: [GRAPH-04, GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-05]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 3 Plan 02: SQLite write-through persistence and Pipeline integration completing the full file-change-to-persisted-graph data flow

**Atomic SQLite write-through for GraphDelta via db.transaction, startup graph restoration from SQLite, and server entry point wiring DependencyGraph to Pipeline for the complete file-change-to-persisted-graph pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T23:50:01Z
- **Completed:** 2026-03-15T23:53:18Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built GraphPersistence module (225 lines) with `persistDelta` (atomic SQLite write-through via db.transaction wrapping all node/edge mutations per delta) and `loadGraphState` (startup load of all persisted nodes and edges)
- Updated DependencyGraph to override `onDeltaComputed` with direct `persistDelta` call (crash-safe: persists before emitting 'delta' event), and added `loadFromDatabase()` public method that restores prior graph state including cycle set reconstruction
- Wired DependencyGraph + Pipeline in server entry point: `graph.loadFromDatabase()` before `pipeline.start()`, delta event logging, ARCHLENS_WATCH_ROOT env var support, and onClose graceful shutdown
- Full end-to-end pipeline now active: file change -> 200ms FileWatcher debounce -> 50ms DependencyGraph consolidation -> parse worker -> graph update -> GraphDelta -> SQLite write-through -> console log

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GraphPersistence module and wire persistence into DependencyGraph** - `c0e3542` (feat)
2. **Task 2: Wire DependencyGraph to Pipeline in server entry point** - `5e75600` (feat)

## Files Created/Modified

- `packages/server/src/graph/GraphPersistence.ts` — `persistDelta` with atomic db.transaction (node upserts, edge inserts/deletes, node deletes in FK-safe order), `loadGraphState` returning nodes and edges for startup restoration (225 lines)
- `packages/server/src/graph/DependencyGraph.ts` — Added `import { persistDelta, loadGraphState }`, overrode `onDeltaComputed` to call `persistDelta` with graph in/out degree callbacks, added public `loadFromDatabase()` method with activeCycles rebuild
- `packages/server/src/index.ts` — Added DependencyGraph + Pipeline imports, graph creation and DB load, delta event logging, Pipeline construction with `graph.onParseResult` callback, ARCHLENS_WATCH_ROOT env var, onClose cleanup hook

## Decisions Made

- **External stubs excluded from SQLite:** `__ext__/` prefixed nodes have no metadata and no FK rows. Persisting them would require additional schema work with no Phase 3 value — skipped cleanly.
- **Direct onDeltaComputed override (not subclass):** Plan 01 left a no-op hook for a planned subclass; Plan 02 simply overrides the method in DependencyGraph itself. Eliminates unnecessary indirection since persistence is a core DependencyGraph concern at this stage.
- **FK-safe deletion order:** For removed nodes, all incident edges are deleted first inside the same transaction before the node row is deleted. This handles cases where incident edges weren't included in `delta.removedEdgeIds` (e.g. edges from other nodes pointing to the removed node).
- **activeCycles rebuild after load:** alg.findCycles() is re-run after populating nodes/edges from DB so the cycle set is accurate before the first delta is processed. Without this, the first delta would incorrectly report all pre-existing cycles as "new".

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. `ARCHLENS_WATCH_ROOT` env var is optional (defaults to `process.cwd()`).

## Next Phase Readiness

- Full Phase 3 pipeline is complete: DependencyGraph receives parse results from Pipeline, computes deltas, persists to SQLite, and emits typed 'delta' events
- GraphDelta types are ready for Phase 5 WebSocket layer consumption
- DependencyGraph 'delta' event is ready for Phase 4 inference engine subscription
- Server restart loads prior graph state from SQLite — no cold-start data loss
- No blockers for Plan 03 (the final Phase 3 plan)

## Self-Check: PASSED

- FOUND: packages/server/src/graph/GraphPersistence.ts
- FOUND: packages/server/src/graph/DependencyGraph.ts
- FOUND: packages/server/src/index.ts
- FOUND: .planning/phases/03-dependency-graph-model/03-02-SUMMARY.md
- FOUND commit: c0e3542 (feat(03-02): create GraphPersistence module and wire persistence into DependencyGraph)
- FOUND commit: 5e75600 (feat(03-02): wire DependencyGraph to Pipeline in server entry point)
- typecheck: 0 errors

---
*Phase: 03-dependency-graph-model*
*Completed: 2026-03-15*
