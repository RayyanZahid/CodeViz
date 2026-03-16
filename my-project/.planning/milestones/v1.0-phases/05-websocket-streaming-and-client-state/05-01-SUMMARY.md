---
phase: 05-websocket-streaming-and-client-state
plan: 01
subsystem: api
tags: [websocket, fastify, real-time, streaming, graph-delta, typescript]

# Dependency graph
requires:
  - phase: 04-architectural-inference-engine
    provides: InferenceEngine emitting typed 'inference' events with InferenceResult; DependencyGraph emitting typed 'delta' events with GraphDelta and monotonic version counter
  - phase: 03-dependency-graph-model
    provides: DependencyGraph with getAllNodeIds(), getNodeMetadata(), getVersion(), getInDegree(), getOutDegree(); graph.on('delta') EventEmitter subscription
provides:
  - "@fastify/websocket v11 installed and registered as Fastify plugin"
  - "Shared types include InferenceMessage, ErrorMessage, and 4-member ServerMessage union"
  - "DependencyGraph.getSnapshot() serializing in-memory graph to wire-format GraphNode[]/GraphEdge[]"
  - "WebSocket plugin at /ws broadcasting graph_delta and inference messages to all connected clients"
  - "Snapshot REST endpoint GET /api/snapshot returning full InitialStateMessage for reconnect recovery"
  - "Server entry point wiring both plugins with correct initialization order"
affects:
  - 05-02-client-state
  - phase-06-canvas-rendering

# Tech tracking
tech-stack:
  added:
    - "@fastify/websocket ^11.2.0 — Fastify WebSocket route plugin, ws: true routes"
    - "@types/ws ^8.18.1 — TypeScript types for ws WebSocket objects"
  patterns:
    - "Module-level Set<WebSocket> client set with readyState guard in broadcast function"
    - "Single event subscriptions at plugin registration time (not per-connection) to avoid O(N^2) listener leak"
    - "Internal GraphDelta (node IDs as strings) mapped to wire GraphDeltaMessage (GraphNode objects) at broadcast time"
    - "External stubs (__ext__/ prefix) filtered out at both snapshot and delta broadcast boundaries"
    - "v10+ WebSocket handler receives socket directly (not connection.socket SocketStream pattern)"
    - "FastifyPluginAsync with typed options for graph and inferenceEngine injection"

key-files:
  created:
    - packages/server/src/plugins/websocket.ts
    - packages/server/src/plugins/snapshot.ts
  modified:
    - packages/shared/src/types/messages.ts
    - packages/server/src/graph/DependencyGraph.ts
    - packages/server/src/index.ts
    - packages/server/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Module-level clients Set prevents per-connection listener registration (O(N^2) protection per RESEARCH.md Pitfall 4)"
  - "External stub nodes (__ext__/ prefix) excluded from both getSnapshot() serialization and delta broadcast — they have no client-visible metadata"
  - "addedEdges in delta: GraphDeltaEdge {v, w, symbols} mapped to wire GraphEdge {id, sourceId, targetId, edgeType} at broadcast boundary"
  - "layoutPositions left as empty object — Phase 6 will populate from SQLite layout_positions table"
  - "inferenceEngine typed events subscription uses on('inference', ...) at plugin registration time following same pattern as graph.on('delta', ...)"

patterns-established:
  - "Plugin injection pattern: FastifyPluginAsync<{ graph: DependencyGraph; inferenceEngine: InferenceEngine }> — follows healthPlugin convention"
  - "Wire-type mapping boundary: internal types (NodeMetadata, GraphDeltaEdge) converted to shared wire types (GraphNode, GraphEdge) at plugin boundary, never in DependencyGraph itself"
  - "getSnapshot() read-only serialization method on DependencyGraph — no mutations, skips __ext__/ stubs, uses same mapping logic as delta broadcast"

requirements-completed: [WS-01, WS-02, WS-03]

# Metrics
duration: 15min
completed: 2026-03-16
---

# Phase 05 Plan 01: Server-Side WebSocket Streaming Infrastructure Summary

**@fastify/websocket v11 route at /ws broadcasting graph_delta and inference messages, GET /api/snapshot for reconnect recovery, and 4-member ServerMessage union with InferenceMessage and ErrorMessage**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-16T02:12:59Z
- **Completed:** 2026-03-16T02:27:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added `InferenceMessage` and `ErrorMessage` to shared types, expanding `ServerMessage` union from 2 to 4 members
- Added `getSnapshot()` to `DependencyGraph` serializing in-memory graph to wire-format `GraphNode[]`/`GraphEdge[]` (skipping `__ext__/` stubs)
- Installed `@fastify/websocket` v11.2.0 and `@types/ws` v8.18.1 in server package
- Built `/ws` WebSocket plugin with module-level client set, single event subscriptions (graph delta + inference), initial state on connect
- Built `GET /api/snapshot` REST endpoint returning `InitialStateMessage` for reconnect recovery
- Wired both plugins into `index.ts` after graph and inferenceEngine initialization

## Task Commits

Each task was committed atomically:

1. **Task 1: Update shared types, add getSnapshot(), install @fastify/websocket** - `6da38a6` (feat)
2. **Task 2: Create WebSocket plugin, snapshot plugin, and wire into server** - `6d88ee3` (feat)
3. **Task 2 (artifact min_lines fix): Add JSDoc to snapshot plugin** - `b0743f1` (refactor)

## Files Created/Modified
- `packages/shared/src/types/messages.ts` - Added InferenceMessage, ErrorMessage; expanded ServerMessage to 4-member union
- `packages/server/src/graph/DependencyGraph.ts` - Added getSnapshot() public method; added GraphNode/GraphEdge imports
- `packages/server/src/plugins/websocket.ts` (NEW) - /ws route plugin with Set<WebSocket> client management, graph delta and inference event broadcasting, initial state on connect
- `packages/server/src/plugins/snapshot.ts` (NEW) - GET /api/snapshot REST endpoint returning InitialStateMessage
- `packages/server/src/index.ts` - Registered websocketPlugin and snapshotPlugin imports and registrations
- `packages/server/package.json` - Added @fastify/websocket and @types/ws dependencies
- `pnpm-lock.yaml` - Updated lock file with new packages

## Decisions Made
- Module-level `Set<WebSocket>` and single `graph.on('delta', ...)` + `inferenceEngine.on('inference', ...)` subscriptions at plugin registration time — prevents O(N^2) listener leak when N clients connect (per RESEARCH.md Pitfall 4)
- Internal `GraphDelta` (node IDs as `string[]`) mapped to wire `GraphDeltaMessage` (full `GraphNode[]` objects) at broadcast time using `graph.getNodeMetadata()` and edge accessors
- `__ext__/` stub nodes filtered at both snapshot boundary and delta broadcast boundary — they have no client-visible metadata
- `layoutPositions` is an empty object placeholder — Phase 6 will populate from SQLite `layout_positions` table
- `@fastify/websocket` v10+ direct WebSocket handler pattern used (not legacy `connection.socket` SocketStream pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing issue (not caused by this plan): `packages/server/dist/parser/worker.js` has a stale CommonJS build that fails with `require is not defined in ES module scope` when the Piscina worker is spawned. This is triggered by the file watcher watching the current directory. Rebuilding with `pnpm --filter @archlens/server run build:workers` regenerates the worker correctly. The HTTP endpoints (health, snapshot) respond correctly before the worker thread error occurs. This issue pre-dates Phase 5 and is documented as a known concern in STATE.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Server-side WebSocket transport is complete: `/ws` route broadcasts all graph and inference events
- `GET /api/snapshot` provides full state recovery for reconnect scenarios
- Phase 5 Plan 02 (client-side state management) can now connect to `/ws` and consume the 4-member `ServerMessage` union
- Shared types (`InferenceMessage`, `ErrorMessage`, `ServerMessage`) are available for client-side Zod schema definitions

---
*Phase: 05-websocket-streaming-and-client-state*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: packages/server/src/plugins/websocket.ts
- FOUND: packages/server/src/plugins/snapshot.ts
- FOUND: packages/shared/src/types/messages.ts (InferenceMessage exported, 2 occurrences)
- FOUND: packages/server/src/graph/DependencyGraph.ts (getSnapshot() method present)
- FOUND: packages/server/src/index.ts
- FOUND: .planning/phases/05-websocket-streaming-and-client-state/05-01-SUMMARY.md
- COMMIT b0743f1: refactor(05-01): add JSDoc to snapshot plugin
- COMMIT 6d88ee3: feat(05-01): add WebSocket plugin, snapshot plugin, wire into server
- COMMIT 6da38a6: feat(05-01): update shared types, add getSnapshot(), install @fastify/websocket
- @fastify/websocket ^11.2.0 present in packages/server/package.json
