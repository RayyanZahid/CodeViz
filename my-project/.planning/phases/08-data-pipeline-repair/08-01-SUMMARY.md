---
phase: 08-data-pipeline-repair
plan: 01
subsystem: api
tags: [zod, typescript, graph, components, websocket, validation]

# Dependency graph
requires: []
provides:
  - Zod GraphNodeSchema with fileCount and keyExports optional fields
  - Zod GraphEdgeSchema with dependencyCount optional field
  - ComponentAggregator.getFileToComponentMap() returning Map<string, string>
affects: [08-data-pipeline-repair/08-02, client-store, websocket-plugin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod schemas stay in sync with TypeScript interfaces in shared types — add optional fields to schema when interface gains optional fields"
    - "ComponentAggregator exposes lookup maps via public getters rebuilt each aggregation cycle"

key-files:
  created: []
  modified:
    - packages/client/src/schemas/serverMessages.ts
    - packages/server/src/graph/ComponentAggregator.ts

key-decisions:
  - "Zod schemas remain strict (no .passthrough()) — strip unknown fields for safety"
  - "fileToComponentMap is rebuilt from scratch on every aggregateSnapshot() call — always current, no staleness"
  - "getFileToComponentMap() returns the internal Map directly (not a copy) — callers should not mutate it"

patterns-established:
  - "Optional fields on shared TypeScript interfaces must have matching .optional() fields in client Zod schemas"
  - "ComponentAggregator class uses private cached fields + public getters pattern for derived lookups"

requirements-completed: [PIPE-01, PIPE-02]

# Metrics
duration: 1min
completed: 2026-03-16
---

# Phase 8 Plan 01: Zod Schema Fields and File-to-Component Map Summary

**Zod schemas updated to pass fileCount, keyExports, and dependencyCount through validation; ComponentAggregator exposes reusable file-to-component lookup map via getFileToComponentMap()**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T19:09:50Z
- **Completed:** 2026-03-16T19:11:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Client Zod schemas now accept all component metadata fields that were previously silently stripped at the validation boundary
- GraphNodeSchema gains `fileCount` (number optional) and `keyExports` (string[] optional) to match the GraphNode TypeScript interface
- GraphEdgeSchema gains `dependencyCount` (number optional) to match the GraphEdge TypeScript interface
- ComponentAggregator now exposes `getFileToComponentMap()` — the file path to component ID lookup needed by Plan 02 for inference ID translation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add missing fields to client Zod schemas** - `5e59d3f` (feat)
2. **Task 2: Expose file-to-component lookup map from ComponentAggregator** - `a6e8bee` (feat)

## Files Created/Modified
- `packages/client/src/schemas/serverMessages.ts` - Added fileCount, keyExports to GraphNodeSchema; added dependencyCount to GraphEdgeSchema
- `packages/server/src/graph/ComponentAggregator.ts` - Added private fileToComponentMap field, populated it in aggregateSnapshot(), added public getFileToComponentMap() getter

## Decisions Made
- Zod schemas remain strict (no `.passthrough()`) — safer to strip unknown fields than to silently forward them
- `getFileToComponentMap()` returns the internal Map directly rather than a defensive copy — Plan 02 consumers are expected to read, not mutate
- Map is rebuilt from scratch on every `aggregateSnapshot()` call ensuring it is always synchronized with the current graph state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both packages compiled clean on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (inference ID translation) can now call `aggregator.getFileToComponentMap()` to translate file-level inference node IDs to component IDs
- Client stores will receive fileCount, keyExports, and dependencyCount fields in incoming WebSocket messages without Zod stripping them
- Both packages (client and server) compile clean — no TypeScript errors

---
*Phase: 08-data-pipeline-repair*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: packages/client/src/schemas/serverMessages.ts
- FOUND: packages/server/src/graph/ComponentAggregator.ts
- FOUND: .planning/phases/08-data-pipeline-repair/08-01-SUMMARY.md
- FOUND commit: 5e59d3f (Task 1)
- FOUND commit: a6e8bee (Task 2)
