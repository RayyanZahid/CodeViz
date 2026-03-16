---
phase: 03-dependency-graph-model
plan: 01
subsystem: graph
tags: [graphlib, dependency-graph, event-emitter, cycle-detection, typescript, incremental-updates]

# Dependency graph
requires:
  - phase: 02-file-watching-and-parsing-pipeline
    provides: ParseBatchResult, ParseResult, FileRemoved types consumed by DependencyGraph
provides:
  - DependencyGraph class with incremental update, delta computation, cycle detection, event emission
  - GraphDelta, GraphDeltaCycle, GraphDeltaEdge, NodeMetadata, EdgeMetadata, CycleSeverity shared types
  - canonicalizeCycle and resolveImportTarget helpers exported for testability
affects:
  - 03-02 (persistence layer extends DependencyGraph via onDeltaComputed hook)
  - 04-inference-engine (subscribes to DependencyGraph 'delta' events)
  - 05-websocket-layer (uses GraphDelta type for wire format)

# Tech tracking
tech-stack:
  added:
    - "@dagrejs/graphlib ^4.0.1 — in-memory directed graph with O(1) node/edge ops and alg.findCycles"
  patterns:
    - "Typed EventEmitter subclass: DependencyGraph extends EventEmitter<{ delta: [GraphDelta] }>"
    - "Batch consolidation debounce: pendingBatches accumulator + setTimeout(50ms) before processing"
    - "Incremental per-file diffing: Map<filePath, ParseResult> tracks previous state for delta computation"
    - "Cycle canonicalization: rotate to lexicographically smallest node ID + join with ' -> ' for stable Set keys"
    - "External node stubs: non-relative imports map to __ext__/specifier graph nodes"
    - "Protected onDeltaComputed hook: no-op base implementation, overridden by persistence layer"

key-files:
  created:
    - packages/shared/src/types/graph-delta.ts
    - packages/server/src/graph/DependencyGraph.ts
  modified:
    - packages/shared/src/types/index.ts
    - packages/server/package.json

key-decisions:
  - "File path used as node ID (project-relative, forward slashes) — natural key from pipeline output"
  - "50ms debounce consolidation window for rapid batch accumulation before delta computation"
  - "Cycle severity thresholds: HIGH >= 10 in-degree sum, MEDIUM >= 4, LOW < 4 (in-degree as centrality proxy)"
  - "Single edge per file pair (non-multigraph) with aggregated symbol list — aligns with graphlib constraint"
  - "External/builtin imports map to __ext__/specifier stub nodes — monorepo workspace imports deferred to Phase 4+"
  - "onDeltaComputed protected hook pattern: base no-op, Plan 02 persistence layer overrides without coupling"

patterns-established:
  - "Incremental graph pattern: process only changed files per batch, never full rebuild"
  - "Delta-emit-after-persistence ordering: onDeltaComputed hook fires before emit('delta') for crash safety"
  - "Cycle detection once per flush: alg.findCycles runs after all files processed, not per-file"

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-05]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 3 Plan 01: Dependency Graph Model — Core DependencyGraph Summary

**@dagrejs/graphlib-backed DependencyGraph with 50ms debounce batch consolidation, three-state incremental deltas, typed EventEmitter emission, and Tarjan cycle detection with severity tiers**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T23:41:00Z
- **Completed:** 2026-03-15T23:47:05Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Defined GraphDelta, GraphDeltaCycle, GraphDeltaEdge, NodeMetadata, EdgeMetadata, and CycleSeverity shared types using the project's const-object-plus-derived-type convention
- Built DependencyGraph class (494 lines) with incremental per-file diffing, three-state delta computation (added/removed/modified nodes), edge reconciliation with symbol aggregation, and typed 'delta' EventEmitter events
- Implemented Tarjan-based cycle detection via alg.findCycles() with canonicalization for stable diffing, severity tiers (HIGH/MEDIUM/LOW based on in-degree sum), and report-only-changes semantics
- Installed @dagrejs/graphlib ^4.0.1 in server package; all types compile cleanly via pnpm typecheck

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dagrejs/graphlib and define shared GraphDelta types** - `c1f27ec` (feat)
2. **Task 2: Create DependencyGraph class with incremental updates and cycle detection** - `88b7264` (feat)

## Files Created/Modified

- `packages/shared/src/types/graph-delta.ts` — CycleSeverity const/type, NodeMetadata, EdgeMetadata, GraphDeltaCycle, GraphDeltaEdge, GraphDelta interfaces (95 lines)
- `packages/shared/src/types/index.ts` — Added `export * from './graph-delta.js'`
- `packages/server/src/graph/DependencyGraph.ts` — DependencyGraph class, canonicalizeCycle, resolveImportTarget helpers (494 lines)
- `packages/server/package.json` — Added @dagrejs/graphlib ^4.0.1 dependency

## Decisions Made

- **File path as node ID:** Project-relative forward-slash paths are the natural key from the Pipeline output. No additional normalization needed.
- **50ms consolidation window:** Additional safeguard on top of FileWatcher's 200ms debounce; handles back-pressure spikes.
- **Import symbol tracking via source specifier:** ParseResult.imports carries ImportInfo with `source` and `isTypeOnly` but no extracted symbol names. The source specifier is used as the symbol entry per edge (downstream inference can extract more specific symbols when needed).
- **External node stubs:** Non-relative imports create `__ext__/specifier` stub nodes to support ARCH-05 fan-out detection. Monorepo workspace import resolution deferred to Phase 4+.
- **onDeltaComputed hook:** Protected method pattern allows Plan 02 to extend the class for SQLite write-through without coupling DependencyGraph to persistence concerns.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DependencyGraph is fully instantiable and ready for Plan 02 to extend with SQLite write-through via the onDeltaComputed hook
- GraphDelta types are importable from `@archlens/shared/types` for use by WebSocket layer (Phase 5)
- canonicalizeCycle and resolveImportTarget are exported as module-level functions for unit testing in future plans
- No blockers for Plan 02

---
*Phase: 03-dependency-graph-model*
*Completed: 2026-03-15*
