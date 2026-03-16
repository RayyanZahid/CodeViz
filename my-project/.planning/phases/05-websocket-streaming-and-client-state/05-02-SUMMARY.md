---
phase: 05-websocket-streaming-and-client-state
plan: 02
subsystem: ui
tags: [websocket, zustand, zod, typescript, real-time, client-state, viewport]

# Dependency graph
requires:
  - phase: 05-websocket-streaming-and-client-state
    plan: 01
    provides: "@fastify/websocket /ws route broadcasting 4-member ServerMessage union; GET /api/snapshot for reconnect recovery"
  - phase: 04-architectural-inference-engine
    provides: InferenceMessage and RiskSignal types in shared package
  - phase: 03-dependency-graph-model
    provides: GraphNode and GraphEdge wire types in shared package
provides:
  - "Zod ServerMessageSchema — discriminated union validating all 4 ServerMessage types at runtime"
  - "Zustand graphStore with nodes (Map), edges (Map), version, connectionStatus, applyDelta, applySnapshot"
  - "WsClient class with exponential backoff reconnect (500ms-30s, forever retry), 500ms batch window, version gap detection"
  - "Viewport localStorage helpers (saveViewport/loadViewport/clearViewport) for Phase 6 canvas consumption"
  - "main.ts initializes WsClient singleton on page load — full data flow from server delta to Zustand store"
affects:
  - phase-06-canvas-rendering
  - phase-07-ui-overlays

# Tech tracking
tech-stack:
  added:
    - "zustand ^5.0.11 — React state management with vanilla store access via .getState()"
    - "zod ^3.25.67 — Runtime schema validation (pinned to v3 range per RESEARCH.md recommendation)"
  patterns:
    - "Double-paren Zustand create pattern: create<Store>()((set, get) => ({...})) for TypeScript middleware compat"
    - "Relaxed Zod string types for enum fields to tolerate future enum additions without breaking validation"
    - "Type-cast boundary: Zod-parsed data cast to shared types at store call sites (as unknown as T)"
    - "Module-level WsClient singleton in main.ts (not inside React component) to avoid StrictMode double-connection"
    - "lastQueuedVersion tracks queued (not applied) version for correct gap detection with buffered deltas"
    - "500ms batch window using pendingDeltas queue + setTimeout — single flush call per window"

key-files:
  created:
    - packages/client/src/schemas/serverMessages.ts
    - packages/client/src/store/graphStore.ts
    - packages/client/src/ws/wsClient.ts
    - packages/client/src/utils/viewport.ts
  modified:
    - packages/client/src/main.ts
    - packages/client/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Zod schema uses z.string() for NodeType/EdgeType/ZoneName fields (not z.literal per enum value) — tolerates future enum additions, runtime values are always valid"
  - "Type cast (as unknown as InitialStateMessage / GraphDeltaMessage) at WsClient call sites bridges Zod relaxed output to strict shared types"
  - "lastQueuedVersion (not graphStore.version) used for version gap detection — store version reflects applied state, but pending batch may have advanced ahead"
  - "graphStore exported as const alongside useGraphStore — same Zustand instance, both names valid for vanilla vs. React hook usage"
  - "clearViewport() added beyond plan spec — completes the viewport API surface for Phase 6 reset-to-default usage"

patterns-established:
  - "Zod validation boundary: all incoming WS messages parsed with ServerMessageSchema.safeParse() — invalid messages dropped with console.error, never reach store"
  - "Store mutation via Map copies (new Map(existing)) — Zustand requires new object references for React re-render detection"
  - "WsClient.destroy() public method for test/cleanup — cancels all timers, removes WS listeners, closes socket"

requirements-completed: [WS-01, WS-02, WS-03, WS-04]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 05 Plan 02: Client-Side WebSocket Consumer and State Management Summary

**Zustand graphStore with Map-based delta patching, hand-rolled WsClient with exponential backoff and version gap recovery, Zod runtime schema validation for all 4 ServerMessage types, and viewport localStorage helpers wired into the client entry point**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T02:22:09Z
- **Completed:** 2026-03-16T02:25:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed `zustand ^5` and `zod ^3` in client package (zod pinned to v3 per RESEARCH.md recommendation)
- Created `ServerMessageSchema` — Zod discriminated union validating all 4 ServerMessage types at runtime
- Created `useGraphStore` Zustand store with Map-based nodes/edges, applyDelta (immutable patching), applySnapshot, connectionStatus
- Built `WsClient` class with exponential backoff (500ms base, 30s max, retry forever), 500ms batch window, version gap detection
- Created viewport localStorage helpers (`saveViewport`/`loadViewport`/`clearViewport`) ready for Phase 6 canvas consumption
- Wired WsClient singleton into `main.ts` — full data flow operational on page load

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, create Zod schemas and Zustand graphStore** - `f371c80` (feat)
2. **Task 2: Create WsClient, viewport helpers, and wire into main.ts** - `d4d45b4` (feat)

## Files Created/Modified
- `packages/client/src/schemas/serverMessages.ts` (NEW) - Zod discriminated union ServerMessageSchema with sub-schemas for all message types and inference fields
- `packages/client/src/store/graphStore.ts` (NEW) - Zustand store with nodes/edges Maps, applyDelta/applySnapshot actions, connectionStatus, changeSummary
- `packages/client/src/ws/wsClient.ts` (NEW) - WsClient class with reconnect, batch window, version gap detection, snapshot recovery
- `packages/client/src/utils/viewport.ts` (NEW) - Viewport localStorage helpers for Phase 6 consumption
- `packages/client/src/main.ts` - Updated to initialize WsClient singleton and connect on page load
- `packages/client/package.json` - Added zustand ^5 and zod ^3 dependencies
- `pnpm-lock.yaml` - Updated lock file with new packages

## Decisions Made
- Zod schema uses `z.string()` for `nodeType`/`edgeType`/zone enum fields (not `z.literal` per value) — tolerates future enum additions without breaking client validation; runtime values are always valid NodeType/EdgeType string literals
- Type cast (`as unknown as InitialStateMessage`/`GraphDeltaMessage`) at WsClient call sites — bridges the intentionally relaxed Zod output to the strict shared TypeScript types expected by graphStore actions
- `lastQueuedVersion` (not `graphStore.getState().version`) used for version gap detection — the store version reflects applied state but the batch window may have advanced `lastQueuedVersion` ahead of what's in the store yet
- `graphStore` vanilla reference exported as alias for `useGraphStore` — same Zustand instance, WsClient uses `.getState()` accessor while React components use the hook

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added type casts at Zod-to-shared-types boundary**
- **Found during:** Task 2 (WsClient implementation)
- **Issue:** TypeScript error: Zod schema infers `nodeType: string` but `applySnapshot`/`applyDelta` store methods expect `GraphNode` with `nodeType: NodeType`. The Zod schema intentionally uses `z.string()` (per plan spec) for forward compatibility, creating a type mismatch.
- **Fix:** Added `as unknown as InitialStateMessage` and `as unknown as GraphDeltaMessage` casts at the three WsClient call sites where Zod-parsed messages are passed to store methods
- **Files modified:** packages/client/src/ws/wsClient.ts
- **Verification:** `pnpm --filter @archlens/client exec tsc --noEmit` passes with no errors
- **Committed in:** d4d45b4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type error)
**Impact on plan:** The type cast is the correct architectural choice — intentionally relaxed Zod validation with strict TypeScript types at store boundaries. No scope creep.

## Issues Encountered

None — TypeScript error was a predictable consequence of the intentionally relaxed Zod schema design specified in the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Client-side WebSocket transport complete: auto-connects to `/ws`, validates all messages with Zod, applies deltas/snapshots to Zustand store
- Viewport helpers (`saveViewport`/`loadViewport`) ready for Phase 6 canvas renderer to call on every pan/zoom change
- `useGraphStore` hook is available for Phase 6 React components to read `nodes`, `edges`, `version`, `connectionStatus`
- `changeSummary` in the store is set on reconnect — Phase 7 can display "N nodes added since last visit" banner
- Phase 6 (canvas rendering) can begin immediately — all state management infrastructure is in place

---
*Phase: 05-websocket-streaming-and-client-state*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: packages/client/src/schemas/serverMessages.ts
- FOUND: packages/client/src/store/graphStore.ts
- FOUND: packages/client/src/ws/wsClient.ts
- FOUND: packages/client/src/utils/viewport.ts
- FOUND: .planning/phases/05-websocket-streaming-and-client-state/05-02-SUMMARY.md
- COMMIT f371c80: feat(05-02): install Zustand/Zod, create Zod schemas and graphStore
- COMMIT d4d45b4: feat(05-02): create WsClient, viewport helpers, wire into main.ts
- zustand ^5.0.11 and zod ^3.25.67 present in packages/client/package.json
- ServerMessageSchema discriminated union with 4 members exported from schemas/serverMessages.ts
- useGraphStore and graphStore exported from store/graphStore.ts with applyDelta/applySnapshot actions
- WsClient class with connect()/destroy() exported from ws/wsClient.ts
- Client TypeScript compilation passes: pnpm --filter @archlens/client exec tsc --noEmit
