---
phase: 13-watch-any-project
plan: 01
subsystem: api
tags: [fastify, websocket, drizzle, sqlite, typescript]

# Dependency graph
requires:
  - phase: 12-edge-interaction-and-component-glow
    provides: stable graph + inference + WebSocket streaming pipeline
  - phase: 09-persistence
    provides: SQLite DB with graphNodes/graphEdges tables and DependencyGraph.loadFromDatabase()
provides:
  - POST /api/watch — validates a new directory path and triggers full runtime graph/DB/pipeline reset
  - GET /api/watch — returns the currently watched directory path
  - DependencyGraph.reset() — clears all in-memory graph state without emitting events
  - ComponentAggregator.resetCache() — clears lastSnapshot and fileToComponentMap caches
  - InferenceEngine.deltaHandler stored reference + destroy() removes graph listener
  - WatchRootChangedMessage type in shared messages.ts and client Zod schema
  - broadcast() exported from websocket.ts for use in index.ts
  - wireInferenceBroadcast() helper in index.ts for re-wiring inference events on switch
affects: [13-watch-any-project-plan-02, client-watch-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin options callback pattern: watchRoot plugin receives getWatchRoot/setWatchRoot callbacks from index.ts — keeps plugin decoupled from module-level state"
    - "Named handler pattern: InferenceEngine stores deltaHandler reference so destroy() can call graph.off() cleanly"
    - "Re-wire pattern: wireInferenceBroadcast() helper called on initial setup and after each watch-root switch to bind new InferenceEngine inference events"

key-files:
  created:
    - packages/server/src/plugins/watchRoot.ts
  modified:
    - packages/server/src/graph/DependencyGraph.ts
    - packages/server/src/graph/ComponentAggregator.ts
    - packages/server/src/inference/InferenceEngine.ts
    - packages/server/src/plugins/websocket.ts
    - packages/server/src/index.ts
    - packages/shared/src/types/messages.ts
    - packages/client/src/schemas/serverMessages.ts

key-decisions:
  - "watchRoot plugin receives getWatchRoot/setWatchRoot callbacks from index.ts rather than direct imports — keeps plugin pure and testable"
  - "switchWatchRoot() deletes graphEdges before graphNodes to satisfy FK constraint in SQLite schema"
  - "inference event subscription moved out of websocket.ts into index.ts wireInferenceBroadcast() so it can be re-registered when inferenceEngine is replaced on directory switch"
  - "broadcast() exported from websocket.ts (module-level function) so index.ts can send watch_root_changed without circular imports"
  - "DependencyGraph.reset() does not emit a delta event — caller (switchWatchRoot) handles client notification via broadcast(watch_root_changed)"
  - "graph and aggregator remain stable object references across watch-root switches; only pipeline and inferenceEngine are replaced"

patterns-established:
  - "Callback injection for runtime-mutable server state: plugins receive getter/setter callbacks rather than direct variable bindings"

requirements-completed: [WATCH-02, WATCH-03, WATCH-04]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 13 Plan 01: Watch Any Project Summary

**REST GET/POST /api/watch endpoints with full runtime graph reset — stops pipeline, purges SQLite, clears graph+aggregator, broadcasts watch_root_changed, starts fresh pipeline on new directory**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:46:31Z
- **Completed:** 2026-03-16T22:50:32Z
- **Tasks:** 2
- **Files modified:** 7 modified, 1 created

## Accomplishments
- Added `DependencyGraph.reset()` clearing all in-memory graph state (nodes, edges, prevFileResults, activeCycles, consolidation timer, pendingBatches, version)
- Added `ComponentAggregator.resetCache()` clearing lastSnapshot and fileToComponentMap caches
- Fixed InferenceEngine to store a named `deltaHandler` so `destroy()` properly removes the graph delta listener — prevents stale listeners after watch-root switch
- Created `watchRoot.ts` Fastify plugin with GET and POST `/api/watch`, including fs.access + fs.stat path validation
- Refactored `index.ts` with `let pipeline/inferenceEngine`, `switchWatchRoot()` async function, and `wireInferenceBroadcast()` re-wire helper
- Added `WatchRootChangedMessage` to shared messages.ts union and client Zod discriminated union
- Exported `broadcast` and `translateInferenceToComponentIds` from websocket.ts; moved inference subscription to index.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DependencyGraph.reset(), WatchRootChangedMessage type, and client Zod schema** - `5beae1a` (feat)
2. **Task 2: Create watchRoot plugin with GET/POST /api/watch and wire into server** - `ef290ce` (feat)

## Files Created/Modified
- `packages/server/src/plugins/watchRoot.ts` - New Fastify plugin: GET /api/watch returns current dir; POST /api/watch validates path and calls setWatchRoot callback
- `packages/server/src/graph/DependencyGraph.ts` - Added public reset() method clearing all in-memory state
- `packages/server/src/graph/ComponentAggregator.ts` - Added resetCache() method clearing lastSnapshot and fileToComponentMap
- `packages/server/src/inference/InferenceEngine.ts` - Added deltaHandler named reference; destroy() now calls graph.off('delta', deltaHandler)
- `packages/server/src/plugins/websocket.ts` - Exported broadcast() and translateInferenceToComponentIds(); removed inferenceEngine from plugin options; removed inference event subscription (moved to index.ts)
- `packages/server/src/index.ts` - Full refactor: let pipeline/inferenceEngine, wireInferenceBroadcast() helper, switchWatchRoot() sequence, watchRootPlugin registration
- `packages/shared/src/types/messages.ts` - Added WatchRootChangedMessage interface and added to ServerMessage union
- `packages/client/src/schemas/serverMessages.ts` - Added WatchRootChangedMessageSchema to discriminated union

## Decisions Made
- Plugin receives callbacks (`getWatchRoot`/`setWatchRoot`) rather than direct module-level variable access — keeps the plugin decoupled and testable
- `graphEdges` deleted before `graphNodes` in SQLite purge to respect FK constraint (graphEdges.sourceId/targetId reference graphNodes.id)
- `graph` and `aggregator` remain as `const` stable references throughout the server lifetime; only `pipeline` and `inferenceEngine` are `let` and replaced on switch
- `DependencyGraph.reset()` does not emit a delta — the switch sequence handles client notification directly via `broadcast({ type: 'watch_root_changed', ... })`
- Inference event subscription moved from websocket.ts to index.ts `wireInferenceBroadcast()` helper — this is the only mutable binding that needs re-wiring; the graph delta subscription in websocket.ts is stable since `graph` and `aggregator` never change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports from websocket.ts after moving inference subscription**
- **Found during:** Task 2 (websocket.ts refactor)
- **Issue:** After moving inference event subscription to index.ts, websocket.ts had unused imports: `InferenceMessage`, `InferenceResult`, `InferenceEngine`, `GraphNode`, `GraphEdge`, `NodeMetadata`, `normalizeExt`, and the unused `buildGraphNode` helper function
- **Fix:** Removed all unused imports and the `buildGraphNode` function; kept only what is actually used in the plugin
- **Files modified:** packages/server/src/plugins/websocket.ts
- **Verification:** `npx tsc --noEmit` passes for both server and client packages
- **Committed in:** ef290ce (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - cleanup of unused imports/functions after refactor)
**Impact on plan:** Necessary cleanup — TypeScript strict mode would flag unused imports. No scope creep.

## Issues Encountered
- None — both TypeScript packages compiled cleanly after each change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend watch-root switching is fully implemented and wired
- GET /api/watch and POST /api/watch are ready for the client UI (Phase 13 Plan 02)
- WebSocket clients receive `watch_root_changed` message on directory switch, followed by fresh `initial_state` as the new pipeline scan completes
- No blockers

## Self-Check: PASSED

- packages/server/src/plugins/watchRoot.ts: FOUND
- packages/server/src/graph/DependencyGraph.ts: FOUND
- packages/shared/src/types/messages.ts: FOUND
- packages/client/src/schemas/serverMessages.ts: FOUND
- .planning/phases/13-watch-any-project/13-01-SUMMARY.md: FOUND
- Commit 5beae1a: FOUND
- Commit ef290ce: FOUND

---
*Phase: 13-watch-any-project*
*Completed: 2026-03-16*
