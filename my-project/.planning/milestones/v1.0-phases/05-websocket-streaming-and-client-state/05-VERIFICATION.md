---
phase: 05-websocket-streaming-and-client-state
verified: 2026-03-15T00:00:00Z
status: human_needed
score: 13/14 must-haves verified
human_verification:
  - test: "Trigger a file change in the watched directory and measure time until a graph_delta WebSocket message arrives in the browser console"
    expected: "A graph_delta message appears in the browser console within 2 seconds of the file being saved"
    why_human: "End-to-end latency from file write to browser WS message cannot be verified by static analysis — requires a live runtime with server, file watcher, and browser"
---

# Phase 05: WebSocket Streaming and Client State — Verification Report

**Phase Goal:** The backend streams graph deltas to the browser over WebSocket using delta-only messages with version tags, and the client applies patches to a Zustand state store with automatic reconnect recovery — the real-time connection between pipeline and visualization

**Verified:** 2026-03-15T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

The must-haves are drawn from both PLAN frontmatter blocks. 14 truths are tested below.

#### Plan 01 Truths (Server-side)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Graph delta events from DependencyGraph are broadcast to all connected WebSocket clients as JSON messages | VERIFIED | `websocket.ts:66` — `graph.on('delta', ...)` subscribed once at registration; `broadcast(message)` called at line 106 |
| 2 | Inference result events from InferenceEngine are broadcast to all connected WebSocket clients as JSON messages | VERIFIED | `websocket.ts:110` — `inferenceEngine.on('inference', ...)` subscribed once; `broadcast(message)` called at line 119 |
| 3 | Each WebSocket client receives a full graph snapshot (InitialStateMessage) immediately on connection | VERIFIED | `websocket.ts:130-138` — `graph.getSnapshot()` called in route handler on connect, sent via `socket.send(JSON.stringify(initialState))` |
| 4 | GET /api/snapshot returns the current full graph state as an InitialStateMessage JSON response | VERIFIED | `snapshot.ts:15-25` — route handler calls `graph.getSnapshot()` and `graph.getVersion()`, builds `InitialStateMessage`, returns via `reply.send(response)` |
| 5 | WebSocket messages contain only deltas — not the full graph state | VERIFIED | `GraphDeltaMessage` type carries `addedNodes`, `removedNodeIds`, `updatedNodes`, `addedEdges`, `removedEdgeIds` — not the full graph; full state only sent on `initial_state` message type |
| 6 | Every WS message envelope includes a monotonic version tag | VERIFIED | `websocket.ts:98` delta message `version: delta.version`; `websocket.ts:113` inference `version: result.graphVersion`; `websocket.ts:133` initial state `version: graph.getVersion()`; `DependencyGraph.ts:294` version incremented on each flush |

#### Plan 02 Truths (Client-side)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Client automatically connects to /ws WebSocket on page load and receives initial graph state | VERIFIED | `main.ts:6-7` — `new WsClient()` + `wsClient.connect()` at module level; `wsClient.ts:47` — `new WebSocket('/ws')`; `handleMessage` routes `initial_state` to `applySnapshot` |
| 8 | Client Zustand store applies delta patches incrementally — nodes and edges update without full replacement | VERIFIED | `graphStore.ts:44-79` — `applyDelta` creates new Map copies, removes by ID, adds/updates by ID; version incremented per delta |
| 9 | Client reconnects automatically with exponential backoff when connection drops — retries forever | VERIFIED | `wsClient.ts:76-91` — `onclose` calls `scheduleReconnect()`; `wsClient.ts:124-138` — `scheduleReconnect` uses `Math.min(BASE_MS * 2^attempt + jitter, MAX_MS)`, calls `this.connect()` from timer, no termination condition |
| 10 | Version gaps trigger automatic snapshot recovery via GET /api/snapshot | VERIFIED | `wsClient.ts:184-188` — `if (this.lastQueuedVersion > 0 && msg.version !== this.lastQueuedVersion + 1)` calls `triggerGapRecovery()`; `wsClient.ts:250` — `fetch('/api/snapshot')` |
| 11 | Incoming deltas are batched for ~500ms before applying to the Zustand store | VERIFIED | `wsClient.ts:214-220` — `queueDelta` pushes to `pendingDeltas`, starts `batchTimer = setTimeout(flushDeltas, BATCH_WINDOW_MS)` (500ms); `flushDeltas` drains and applies in order |
| 12 | Malformed/unrecognized messages are silently dropped with console.error only | VERIFIED | `wsClient.ts:153-157` — `ServerMessageSchema.safeParse(raw)`; on failure `console.error('[WS] Invalid message:', parsed.error)` then `return` |
| 13 | Connection status is tracked in the store (connecting/connected/disconnected/syncing) | VERIFIED | `graphStore.ts:9` — `type ConnectionStatus = 'connecting' \| 'connected' \| 'disconnected' \| 'syncing'`; `wsClient.ts` sets each state at appropriate lifecycle points |
| 14 | Viewport (zoom, pan) is saved to localStorage and restorable on reload | VERIFIED | `viewport.ts:19-25` — `saveViewport` writes to localStorage; `viewport.ts:31-47` — `loadViewport` reads and validates; `clearViewport` also provided |

**Score:** 13/14 truths verified automatically; 1 requires human runtime test (success criterion 1: 2-second latency)

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Contains | Status |
|----------|-----------|--------------|----------|--------|
| `packages/server/src/plugins/websocket.ts` | 60 | 151 | client Set, broadcast, `/ws` route, delta + inference subscriptions | VERIFIED |
| `packages/server/src/plugins/snapshot.ts` | 20 | 26 | `snapshotPlugin`, `GET /api/snapshot` | VERIFIED |
| `packages/shared/src/types/messages.ts` | — | 37 | `InferenceMessage` exported (line 22), 4-member `ServerMessage` union (line 36) | VERIFIED |
| `packages/server/src/graph/DependencyGraph.ts` | — | 642 | `getSnapshot()` method (line 208), iterates nodes+edges, skips `__ext__/` | VERIFIED |
| `packages/client/src/schemas/serverMessages.ts` | — | 107 | `ServerMessageSchema` discriminated union on line 91, `ServerMessageParsed` type | VERIFIED |
| `packages/client/src/store/graphStore.ts` | — | 113 | `useGraphStore`, `graphStore`, `applyDelta`, `applySnapshot`, `setConnectionStatus` | VERIFIED |
| `packages/client/src/ws/wsClient.ts` | — | 283 | `WsClient` class, `connect()`, `destroy()`, `scheduleReconnect()`, `queueDelta()`, `flushDeltas()`, `requestSnapshot()` | VERIFIED |
| `packages/client/src/utils/viewport.ts` | — | 60 | `saveViewport`, `loadViewport`, `clearViewport` | VERIFIED |

---

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Pattern | Status |
|------|----|-----|---------|--------|
| `websocket.ts` | `graph.on('delta')` | EventEmitter subscription at plugin registration | `graph\.on\('delta'` | WIRED — line 66 |
| `websocket.ts` | `inferenceEngine.on('inference')` | EventEmitter subscription at plugin registration | `inferenceEngine\.on\('inference'` | WIRED — line 110 |
| `index.ts` | `websocket.ts` | `fastify.register(websocketPlugin)` | `register.*websocketPlugin` | WIRED — line 55 |
| `snapshot.ts` | `DependencyGraph.getSnapshot()` | `graph.getSnapshot()` in route handler | `graph\.getSnapshot` | WIRED — `snapshot.ts:16`, `websocket.ts:130` |

#### Plan 02 Key Links

| From | To | Via | Pattern | Status |
|------|----|-----|---------|--------|
| `wsClient.ts` | `serverMessages.ts` | Zod safeParse on every incoming WS message | `ServerMessageSchema\.safeParse` | WIRED — lines 153, 258 |
| `wsClient.ts` | `graphStore.ts` | `graphStore.getState().applyDelta/applySnapshot` calls | `graphStore\.getState\(\)\.` | WIRED — 13 call sites including lines 165, 229, 273 |
| `main.ts` | `wsClient.ts` | WsClient instantiation and connect() call | `new WsClient\|wsClient\.connect` | WIRED — lines 6–7 |
| `wsClient.ts` | `/ws` | `new WebSocket('/ws')` | `new WebSocket.*'/ws'` | WIRED — line 47 |
| `wsClient.ts` | `/api/snapshot` | `fetch('/api/snapshot')` for version gap recovery | `fetch.*'/api/snapshot'` | WIRED — line 250 |

All 9 key links verified.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WS-01 | 05-01, 05-02 | Backend streams graph deltas to frontend via WebSocket in real-time | SATISFIED | `graph.on('delta')` in `websocket.ts:66`; `WsClient` connects to `/ws` in `wsClient.ts:47`; full data path from `DependencyGraph` emit to `graphStore.applyDelta` is wired |
| WS-02 | 05-01, 05-02 | WebSocket messages contain only deltas (added/removed/updated nodes and edges), not full graph state | SATISFIED | `GraphDeltaMessage` type carries only changed items; broadcast function at `websocket.ts:96-106` sends `GraphDeltaMessage` — not a full snapshot; full state is only sent as `initial_state` on connect |
| WS-03 | 05-01, 05-02 | Messages include version tags for ordering and deduplication | SATISFIED | All three server message types include `version: number`; `DependencyGraph` increments version monotonically per flush; client uses `lastQueuedVersion` for gap detection |
| WS-04 | 05-02 | Client reconnects automatically and recovers state from last known version without re-layout | SATISFIED | `scheduleReconnect()` retries forever with exponential backoff; on reconnect the server sends `initial_state` which `applySnapshot` applies (replacing nodes/edges Map) without triggering layout; `requestSnapshot()` via `fetch('/api/snapshot')` handles version gaps |

All 4 requirements satisfied. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/client/src/main.ts` | 9 | Comment: "Phase 6 will replace this placeholder with React + Konva canvas rendering." | INFO | Not a code stub — the WsClient wiring on lines 6-7 is complete and functional. The HTML placeholder (`<h1>ArchLens</h1>`) is the expected minimal rendering until Phase 6 adds the canvas. No impact on WebSocket transport goal. |

No blocker or warning anti-patterns found.

---

### Human Verification Required

#### 1. End-to-End Latency: File Change to Browser Delta Message

**Test:** Start the server (`pnpm --filter @archlens/server run dev`) and client (`pnpm --filter @archlens/client run dev`). Open the browser at http://localhost:5173. Open DevTools console. Modify any `.ts` file in the watched directory (e.g., append a comment). Observe the console.

**Expected:** A `graph_delta` message (logged by `WsClient.handleMessage`) or a store update appears in the browser console within 2 seconds of saving the file.

**Why human:** End-to-end latency involves file system event delivery (chokidar), parse worker scheduling (Piscina), DependencyGraph 50ms consolidation debounce, WS broadcast, and the 500ms client batch window. The maximum observed latency in normal conditions should be well under 2 seconds (debounce 50ms + batch 500ms = ~550ms), but this cannot be proven by static analysis alone.

#### 2. Reconnect Recovery Without Re-Layout

**Test:** Connect browser, observe initial state. Kill the server process. Wait for "Disconnected" in console. Restart the server. Observe reconnect behavior.

**Expected:** Browser console shows reconnect attempts with increasing delay, then "Connected" and a new `initial_state` applied. The graph state is fully restored. Because `applySnapshot` replaces the Zustand Map directly (no layout algorithm called), re-layout does not occur.

**Why human:** The "without triggering a re-layout" guarantee depends on Phase 6's canvas renderer not re-running layout on snapshot updates — this is a contract between Phase 5 and Phase 6. Phase 5's side (delivering snapshot via `applySnapshot`) is verifiable, but the full guarantee requires Phase 6 to be complete.

---

### Gaps Summary

No gaps. All automated checks pass. The phase goal is structurally achieved:

- Server broadcasts delta-only messages with version tags over `/ws`
- Client validates, batches, and applies deltas to a Zustand store
- Reconnect recovery is fully implemented (infinite backoff + snapshot fetch)
- Version gap detection is implemented and wired to `/api/snapshot`
- All 4 WebSocket Streaming requirements (WS-01 through WS-04) are satisfied

One human verification item remains: the 2-second latency success criterion (success criterion 1) and the reconnect-without-re-layout guarantee (success criterion 3, which also depends on Phase 6 behavior).

---

_Verified: 2026-03-15T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
