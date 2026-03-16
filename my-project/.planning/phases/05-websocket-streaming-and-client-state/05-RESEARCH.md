# Phase 5: WebSocket Streaming and Client State - Research

**Researched:** 2026-03-15
**Domain:** Real-time WebSocket transport, client state management, delta streaming
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reconnection experience:**
- Top banner across the screen when connection drops (like GitHub's offline banner), persistent until reconnected
- Canvas remains fully interactive during disconnection — pan, zoom, inspect all work; data is frozen at last known state
- Silent recovery on reconnect — banner disappears, missed updates apply instantly, no toast or summary
- Keep retrying forever with exponential backoff — never give up; user can browse stale data indefinitely

**State recovery behavior:**
- Instant snapshot on reconnect/reopen — server sends full graph state, graph appears fully formed with no animation
- Viewport (zoom level, pan position) restored from browser localStorage on reconnect
- Brief change summary when significant changes occurred while away — small indicator like "+12 nodes, +8 edges since last visit"

**Update delivery feel:**
- Batched updates — collect changes over a short window (~500ms) and apply as one batch for smoother visual transitions
- No visual highlighting at the delta/transport level — Phase 6's activity overlay handles all visual emphasis
- Version tags are internal only — used for reconnect recovery, not exposed to UI components
- Client-side throttle — Zustand store accepts all updates but downstream subscribers are throttled to ~60fps render rate

**Error and stale data handling:**
- Malformed/unrecognized messages: silent drop, log to console only
- Version gap detected (out of sync): show brief "Syncing..." indicator while auto-requesting full snapshot from server, then dismiss
- Server restart: treat identically to reconnection flow — same banner, same recovery path
- Project directory unavailable: distinct error state in banner — "Project directory unavailable" rather than generic connection loss

### Claude's Discretion

- WebSocket message serialization format
- Exact exponential backoff timing parameters
- Zustand store internal structure and selector patterns
- Version tagging scheme implementation
- Batch window tuning

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-01 | Backend streams graph deltas to frontend via WebSocket in real-time | @fastify/websocket v11 plugin adds ws: true routes; DependencyGraph already emits 'delta' events; InferenceEngine emits 'inference' events — both can be broadcast to connected clients |
| WS-02 | WebSocket messages contain only deltas (added/removed/updated nodes and edges), not full graph state | GraphDelta interface in shared types already has the correct shape; GraphDeltaMessage type in messages.ts is the WS message wrapper; InitialStateMessage for snapshot-on-connect |
| WS-03 | Messages include version tags for ordering and deduplication | GraphDelta.version is already a monotonic counter in DependencyGraph; version must be included in every WS message envelope |
| WS-04 | Client reconnects automatically and recovers state from last known version without re-layout | REST endpoint GET /api/snapshot returns full graph state for recovery; client tracks lastVersion, requests snapshot on version gap; exponential backoff WebSocket client with forever retry |

</phase_requirements>

## Summary

Phase 5 builds a thin, clean transport layer between the backend pipeline (Phase 4) and browser visualization (Phase 6). The server side uses `@fastify/websocket` v11.2.0 (the official Fastify WebSocket plugin) to expose a `/ws` route that broadcasts delta messages to all connected browser clients. The client side uses Zustand v5 for state management, a hand-rolled WebSocket client class (not a library) for reconnect logic with exponential backoff, and Zod for runtime validation of incoming messages.

The key architectural pattern for this phase is **separation of concerns**: the WS plugin subscribes to `graph.on('delta')` and `inferenceEngine.on('inference')` events and broadcasts JSON to all connected clients. The client WS class handles connection lifecycle and hands validated messages to the Zustand `graphStore`. The store applies deltas immutably and tracks `lastVersion` for reconnect recovery.

The project already has a Vite proxy configured at `/ws` pointing to `localhost:3100` (confirmed in `vite.config.ts`), and shared types in `packages/shared/src/types/messages.ts` already define `GraphDeltaMessage`, `InitialStateMessage`, and `ServerMessage` — this is the message format foundation to build from.

**Primary recommendation:** Use `@fastify/websocket` v11 for the server WS route, hand-roll the exponential backoff client, Zustand v5 `create()` hook for the graph store, and Zod v3 (not v4 — ecosystem is mid-migration) for message validation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/websocket | ^11.2.0 | Fastify WebSocket route plugin | Official Fastify plugin; v11.0.1+ requires Fastify ^5.0.0; built on `ws@8`; TypeScript types built in |
| @types/ws | ^8.x | TypeScript types for ws WebSocket objects | Required alongside @fastify/websocket for full typing |
| zustand | ^5.0.11 | Client graph state store | Current stable; 57k stars; zero-boilerplate React integration; works as vanilla store for WebSocket-driven updates outside React render cycle |
| zod | ^3.x | Runtime WebSocket message validation | v3 is production-stable; v4 is newly stable (ecosystem migrating); safeParse returns discriminated union — no try/catch needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/ws | ^8.5.x | ws WebSocket TypeScript types | Always install alongside @fastify/websocket |
| immer | optional | Immutable Zustand state mutations | Only if delta application logic becomes complex; not needed for flat object state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/websocket | socket.io | socket.io adds rooms, namespaces, fallbacks — overkill for single-route broadcast; @fastify/websocket stays close to native WS |
| @fastify/websocket | native ws | @fastify/websocket integrates with Fastify lifecycle, hooks, and plugin encapsulation — use it instead of raw ws |
| zustand | jotai | jotai is atom-based; zustand's single store with selectors is simpler for a graph state shape with one primary data structure |
| zustand | redux | Redux requires reducers, actions, store setup — zustand is ~10% of the boilerplate for equivalent functionality |
| Hand-rolled WS client | reconnecting-websocket | Library is unmaintained (last commit 2020); hand-rolling 50 lines gives full control over backoff tuning; project does not need the abstraction |
| zod v3 | zod v4 | Zod v4 changed string validators (z.email() vs z.string().email()); ecosystem still migrating as of 2026-03; stick with v3 for stability |

**Installation:**
```bash
# Server
pnpm --filter @archlens/server add @fastify/websocket @types/ws

# Client
pnpm --filter @archlens/client add zustand zod
```

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── plugins/
│   ├── health.ts           # existing
│   └── websocket.ts        # NEW: WS route plugin, client set, broadcaster
packages/client/src/
├── store/
│   └── graphStore.ts       # NEW: Zustand store — nodes, edges, version, status
├── ws/
│   └── wsClient.ts         # NEW: WebSocket client class — connect, reconnect, dispatch
├── schemas/
│   └── serverMessages.ts   # NEW: Zod schemas for ServerMessage union
└── main.ts                 # existing (wire up wsClient + store)
```

### Pattern 1: Server-Side WS Plugin with Client Set

**What:** Register `@fastify/websocket` as a plugin, create a `Set<WebSocket>` for connected clients, subscribe to graph delta and inference events, broadcast JSON to all open clients.

**When to use:** Single-server, single-route broadcast pattern. No rooms, no user targeting.

**Example:**
```typescript
// packages/server/src/plugins/websocket.ts
import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { InferenceEngine } from '../inference/InferenceEngine.js';
import type { ServerMessage } from '@archlens/shared/types';

// The connected client set — managed here, not in index.ts
const clients = new Set<WebSocket>();

function broadcast(message: ServerMessage): void {
  const json = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(json);
    }
  }
}

export const websocketPlugin: FastifyPluginAsync<{
  graph: DependencyGraph;
  inferenceEngine: InferenceEngine;
}> = async (fastify, { graph, inferenceEngine }) => {
  await fastify.register(import('@fastify/websocket'));

  // Subscribe to graph delta events — broadcast to all clients
  graph.on('delta', (delta) => {
    broadcast({
      type: 'graph_delta',
      version: delta.version,
      addedNodes: delta.addedNodes.map(/* ... map to GraphNode */),
      removedNodeIds: delta.removedNodeIds,
      updatedNodes: delta.modifiedNodes.map(/* ... */),
      addedEdges: delta.addedEdges.map(/* ... */),
      removedEdgeIds: delta.removedEdgeIds,
    });
  });

  fastify.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);

    // Send full snapshot on connect
    const snapshot = graph.getSnapshot();
    socket.send(JSON.stringify({
      type: 'initial_state',
      version: graph.getVersion(),
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      layoutPositions: {},
    } satisfies ServerMessage));

    socket.on('close', () => {
      clients.delete(socket);
    });
  });
};
```

**IMPORTANT:** In `@fastify/websocket` v10+, the route handler receives the **WebSocket directly** as the first argument (not a `SocketStream` wrapper). The `connection.socket` pattern was from pre-v10. Verify with the installed version.

### Pattern 2: Zustand Graph Store

**What:** A `create<GraphStore>()` store that holds `nodes`, `edges`, `version`, `connectionStatus`, and an `applyDelta` action. The WebSocket client calls `graphStore.getState().applyDelta(msg)` outside the React render cycle.

**When to use:** Transport layer needs to update state without triggering React re-renders for every individual field mutation.

**Example:**
```typescript
// packages/client/src/store/graphStore.ts
import { create } from 'zustand';
import type { GraphNode, GraphEdge, GraphDeltaMessage, InitialStateMessage } from '@archlens/shared/types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'syncing';

interface GraphStore {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  version: number;
  connectionStatus: ConnectionStatus;
  // Action — called by WebSocket client, not React components
  applyDelta: (msg: GraphDeltaMessage) => void;
  applySnapshot: (msg: InitialStateMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useGraphStore = create<GraphStore>()((set) => ({
  nodes: new Map(),
  edges: new Map(),
  version: 0,
  connectionStatus: 'connecting',

  applyDelta: (msg) => set((state) => {
    const nodes = new Map(state.nodes);
    const edges = new Map(state.edges);

    // Apply removals
    for (const id of msg.removedNodeIds) nodes.delete(id);
    for (const id of msg.removedEdgeIds) edges.delete(id);

    // Apply additions and updates
    for (const node of [...msg.addedNodes, ...msg.updatedNodes]) {
      nodes.set(node.id, node);
    }
    for (const edge of msg.addedEdges) {
      edges.set(edge.id, edge);
    }

    return { nodes, edges, version: msg.version };
  }),

  applySnapshot: (msg) => set({
    nodes: new Map(msg.nodes.map((n) => [n.id, n])),
    edges: new Map(msg.edges.map((e) => [e.id, e])),
    version: msg.version,
    connectionStatus: 'connected',
  }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));

// Export vanilla getter for WebSocket client (no React hook needed)
export const graphStore = useGraphStore;
```

### Pattern 3: Hand-Rolled WebSocket Client with Exponential Backoff

**What:** A plain TypeScript class that manages WebSocket lifecycle, reconnects with exponential backoff + jitter, tracks `lastVersion` for gap detection, and dispatches to the Zustand store.

**When to use:** Always — do not use `reconnecting-websocket` (unmaintained since 2020) or `websocket-ts` (adds a dep for 50 lines of logic).

**Example:**
```typescript
// packages/client/src/ws/wsClient.ts
import { ServerMessageSchema } from '../schemas/serverMessages.js';
import { graphStore } from '../store/graphStore.js';

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

export class WsClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    graphStore.getState().setConnectionStatus('connecting');
    this.ws = new WebSocket('/ws');

    this.ws.onopen = () => {
      this.attempt = 0;
      graphStore.getState().setConnectionStatus('connected');
    };

    this.ws.onmessage = (event) => {
      const parsed = ServerMessageSchema.safeParse(JSON.parse(event.data));
      if (!parsed.success) {
        console.error('[WS] Invalid message:', parsed.error);
        return;
      }
      const msg = parsed.data;
      if (msg.type === 'initial_state') {
        graphStore.getState().applySnapshot(msg);
      } else if (msg.type === 'graph_delta') {
        const currentVersion = graphStore.getState().version;
        if (msg.version !== currentVersion + 1) {
          // Version gap — request snapshot
          graphStore.getState().setConnectionStatus('syncing');
          this.requestSnapshot();
        } else {
          graphStore.getState().applyDelta(msg);
        }
      }
    };

    this.ws.onclose = () => {
      graphStore.getState().setConnectionStatus('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
    };
  }

  private scheduleReconnect(): void {
    const jitter = Math.random() * 1000;
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt + jitter, MAX_DELAY_MS);
    this.attempt++;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private requestSnapshot(): void {
    // REST fallback — GET /api/snapshot returns InitialStateMessage
    fetch('/api/snapshot')
      .then((r) => r.json())
      .then((data) => {
        const parsed = ServerMessageSchema.safeParse(data);
        if (parsed.success && parsed.data.type === 'initial_state') {
          graphStore.getState().applySnapshot(parsed.data);
          graphStore.getState().setConnectionStatus('connected');
        }
      })
      .catch(console.error);
  }

  destroy(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }
}
```

### Pattern 4: Zod Schema for ServerMessage Validation

**What:** Define Zod schemas matching the `ServerMessage` union from shared types. The client uses `safeParse` on every incoming WS message.

**Example:**
```typescript
// packages/client/src/schemas/serverMessages.ts
import { z } from 'zod';

const GraphNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodeType: z.string(),
  zone: z.string().nullable(),
  fileList: z.array(z.string()),
  incomingEdgeCount: z.number(),
  outgoingEdgeCount: z.number(),
  lastModified: z.string().or(z.date()),
});

const GraphEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  edgeType: z.string(),
});

const GraphDeltaMessageSchema = z.object({
  type: z.literal('graph_delta'),
  version: z.number(),
  addedNodes: z.array(GraphNodeSchema),
  removedNodeIds: z.array(z.string()),
  updatedNodes: z.array(GraphNodeSchema),
  addedEdges: z.array(GraphEdgeSchema),
  removedEdgeIds: z.array(z.string()),
});

const InitialStateMessageSchema = z.object({
  type: z.literal('initial_state'),
  version: z.number(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  layoutPositions: z.record(
    z.object({ x: z.number(), y: z.number(), zone: z.string().nullable() })
  ),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  GraphDeltaMessageSchema,
  InitialStateMessageSchema,
]);

export type ServerMessageParsed = z.infer<typeof ServerMessageSchema>;
```

### Pattern 5: Snapshot REST Endpoint for Recovery

**What:** A `GET /api/snapshot` endpoint that returns the current graph state as an `InitialStateMessage`. Used on first connect and on version gap recovery.

**Example:**
```typescript
// packages/server/src/plugins/snapshot.ts
import type { FastifyPluginAsync } from 'fastify';
import type { DependencyGraph } from '../graph/DependencyGraph.js';

export const snapshotPlugin: FastifyPluginAsync<{ graph: DependencyGraph }> = async (
  fastify,
  { graph }
) => {
  fastify.get('/api/snapshot', async (_req, reply) => {
    const { nodes, edges } = graph.getSnapshot();
    return reply.send({
      type: 'initial_state',
      version: graph.getVersion(),
      nodes,
      edges,
      layoutPositions: {},
    });
  });
};
```

**NOTE:** `DependencyGraph` currently has no `getSnapshot()` method. This needs to be added — it reads `getAllNodeIds()` and iterates nodes/edges to build the snapshot response.

### Pattern 6: Client-Side 500ms Batch Window

**What:** Buffer incoming delta messages on the client for ~500ms before applying to the Zustand store, merging multiple deltas into one batch application.

**Implementation note:** This is simpler than it sounds — queue incoming `GraphDeltaMessage` objects, flush on a `setTimeout(500)`. Each flush applies all queued deltas in order, then clears the queue.

```typescript
// In WsClient
private pendingDeltas: GraphDeltaMessage[] = [];
private batchTimer: ReturnType<typeof setTimeout> | null = null;

private queueDelta(msg: GraphDeltaMessage): void {
  this.pendingDeltas.push(msg);
  if (!this.batchTimer) {
    this.batchTimer = setTimeout(() => this.flushDeltas(), 500);
  }
}

private flushDeltas(): void {
  const deltas = this.pendingDeltas.splice(0);
  this.batchTimer = null;
  for (const delta of deltas) {
    graphStore.getState().applyDelta(delta);
  }
}
```

**Version gap detection** must check the last *queued* version, not `graphStore.getState().version`, since queued deltas haven't been applied yet.

### Pattern 7: Viewport Persistence in localStorage

**What:** Save `{ zoom, panX, panY }` to `localStorage` on every viewport change. On reconnect/reload, restore from localStorage before the snapshot arrives.

```typescript
// Viewport key per project (Phase 6 owns the actual canvas; Phase 5 just stores/reads)
const VIEWPORT_KEY = 'archlens:viewport';

export function saveViewport(zoom: number, panX: number, panY: number): void {
  localStorage.setItem(VIEWPORT_KEY, JSON.stringify({ zoom, panX, panY }));
}

export function loadViewport(): { zoom: number; panX: number; panY: number } | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
```

This is a simple read/write helper — Phase 6 (canvas rendering) will actually consume it and apply it to the Konva stage.

### Anti-Patterns to Avoid

- **Storing WebSocket inside Zustand state:** WebSocket is not serializable and should not live in the store. Keep it in the `WsClient` class instance.
- **Using `connection.socket` pattern with @fastify/websocket v11:** In v10+, the handler receives the WebSocket directly, not a stream wrapper. Check the installed version's types.
- **Broadcasting inside the route handler:** The broadcast loop belongs outside the route handler — subscribe to graph events at plugin registration time, not per-connection.
- **Using React `useEffect` for WebSocket initialization:** Initialize `WsClient` once in `main.ts` (or a module-level singleton), not inside a React component — avoids reconnect storms on component unmounts.
- **Sending full graph state on every delta:** Only deltas over WS (WS-02). Full state goes through `GET /api/snapshot` only.
- **Forgetting to check `socket.readyState === socket.OPEN` before sending:** Sending to a closing/closed socket throws or silently drops — always guard.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fastify WebSocket integration | Raw `ws` server + upgrade handlers | @fastify/websocket | Plugin handles HTTP upgrade, Fastify lifecycle, hooks, encapsulation |
| Message validation | Manual `typeof`/`in` checks | zod `safeParse` | Type narrowing, exhaustive error detail, inferred TS types |
| React state subscriptions | Custom pub/sub | Zustand selectors | React re-render batching, referential equality, selector memoization |

**Key insight:** The only "custom" piece is the WS client reconnect logic — this is intentionally hand-rolled because the ecosystem alternatives are unmaintained or add unnecessary abstractions.

## Common Pitfalls

### Pitfall 1: @fastify/websocket v10 API Change — No More `connection.socket`

**What goes wrong:** Pre-v10 docs and many blog posts show `connection.socket.on('message', ...)`. In v10+, the handler signature changed — the WebSocket is passed **directly** as the first argument.
**Why it happens:** Breaking change in v10 removed the `SocketStream` wrapper.
**How to avoid:** After installing, check the TypeScript type of the first handler argument. If it has a `.socket` property, you're using an older version. If it's directly a WebSocket, you're on v10+.
**Warning signs:** TypeScript error "Property 'socket' does not exist on type 'WebSocket'"

### Pitfall 2: Zustand v5 Requires React 18

**What goes wrong:** `import { create } from 'zustand'` on React 17 or older will fail at runtime or produce unexpected behavior.
**Why it happens:** Zustand v5 dropped support for React < 18 and uses native `useSyncExternalStore`.
**How to avoid:** The client currently has no React — it only has Vite + TypeScript. When React is added (Phase 6), pin to React 18+. For Phase 5, use the vanilla `create` API which works without React.
**Warning signs:** `use-sync-external-store not found` module error at startup.

### Pitfall 3: Version Gap Detection With Buffered Deltas

**What goes wrong:** The client applies deltas in order `v1, v2, v4` (gap at v3). If gap detection checks `graphStore.getState().version` against `msg.version`, it will miss the gap while v3 is still in the 500ms buffer (not applied yet).
**Why it happens:** Buffered deltas haven't updated the store's version counter.
**How to avoid:** Track `lastQueuedVersion` separately from the store's version. Gap = `msg.version !== lastQueuedVersion + 1`.
**Warning signs:** "Syncing..." banner flashes unexpectedly or gaps are silently ignored.

### Pitfall 4: Broadcast Inside Route Handler (Per-Connection Listener Leak)

**What goes wrong:** Subscribing to `graph.on('delta', broadcastFn)` inside the per-connection route handler causes N listeners to be registered for N connected clients. Each delta fires N broadcast functions, each trying to send to all N clients — O(N²) sends.
**Why it happens:** Route handler runs once per client connection.
**How to avoid:** Register `graph.on('delta', ...)` once in plugin registration, outside the route handler. The handler only manages connection lifecycle (add to Set, remove on close).

### Pitfall 5: Vite Dev Proxy WebSocket Path Must Match

**What goes wrong:** The WS route is registered at `/ws` but the client connects to `/websocket` or `/`. 404 on upgrade.
**Why it happens:** Path mismatch between server route and Vite proxy config.
**How to avoid:** The project's `vite.config.ts` already has `/ws` → `localhost:3100` with `ws: true`. Register the Fastify route at exactly `/ws`. Client connects to `new WebSocket('/ws')`.
**Warning signs:** Browser DevTools shows `101 Switching Protocols` not returned; console shows WebSocket connection failed.

### Pitfall 6: DependencyGraph Has No getSnapshot() Method

**What goes wrong:** The `GET /api/snapshot` endpoint needs to serialize the full in-memory graph, but `DependencyGraph` currently only exposes topology accessors (`getAllNodeIds()`, `getNodeMetadata()`, etc.), not a single `getSnapshot()` call.
**Why it happens:** Snapshot was not needed before Phase 5.
**How to avoid:** Add `getSnapshot(): { nodes: GraphNode[], edges: GraphEdge[] }` to `DependencyGraph` that iterates `getAllNodeIds()` and builds the response. Keep it focused — this is a read-only serialization method, not a state mutation.
**Warning signs:** Server snapshot route calls non-existent method at runtime; TypeScript error at compile time.

### Pitfall 7: Zod v4 vs v3 API Mismatch

**What goes wrong:** Installing `zod` gets v4 (now stable as of early 2026), but using v3 patterns like `z.string().email()` or `z.string().uuid()` which were removed in v4.
**Why it happens:** Zod v4 changed string validators to top-level functions (`z.email()`, `z.uuid()`).
**How to avoid:** For this phase, none of the message schemas use email/uuid validators — the risk is minimal. But pin to `zod@^3` in package.json if stability is preferred. Alternatively, note that Zod v4 also exports a compatibility subpath `"zod/v4"` and `"zod/v3"`.
**Warning signs:** TypeScript error "Property 'email' does not exist on type ZodString".

## Code Examples

Verified patterns from official sources:

### @fastify/websocket Route Handler (v11 — WebSocket direct)

```typescript
// Source: https://github.com/fastify/fastify-websocket README + v10 changelog
import fastifyWebsocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';

await fastify.register(fastifyWebsocket);

fastify.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
  // socket is the WebSocket directly in v10+
  socket.send(JSON.stringify({ type: 'hello' }));
  socket.on('message', (data) => { /* ... */ });
  socket.on('close', () => { /* remove from client set */ });
});
```

### Zustand Store — create with TypeScript (v5)

```typescript
// Source: https://github.com/pmndrs/zustand
import { create } from 'zustand';

interface State {
  count: number;
  increment: () => void;
}

// Note double parentheses: create<State>()((set) => ...) — required for TS middleware compatibility
const useStore = create<State>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Access outside React — same API, no hook needed in module scope
useStore.getState().increment();
useStore.setState({ count: 42 });
```

### Zod discriminatedUnion for ServerMessage

```typescript
// Source: https://zod.dev/basics
import { z } from 'zod';

const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('graph_delta'), version: z.number() /* ... */ }),
  z.object({ type: z.literal('initial_state'), version: z.number() /* ... */ }),
]);

const result = ServerMessageSchema.safeParse(JSON.parse(rawData));
if (!result.success) {
  console.error(result.error);
  return; // silent drop per user decision
}
// result.data is narrowed to the matched union member
```

### Exponential Backoff with Jitter

```typescript
// Source: common pattern, verified by multiple sources
const delay = Math.min(BASE_MS * Math.pow(2, attempt) + Math.random() * 1000, MAX_MS);
// BASE_MS = 500, MAX_MS = 30_000
// attempt 0: 500-1500ms, attempt 1: 1000-2000ms, attempt 5: ~16-17s, capped at 30s
```

### Vite Proxy for WS (already configured)

```typescript
// packages/client/vite.config.ts — ALREADY CONFIGURED, no changes needed
export default defineConfig({
  server: {
    proxy: {
      '/ws': { target: 'http://localhost:3100', ws: true, changeOrigin: false },
      '/api': { target: 'http://localhost:3100', changeOrigin: false },
    },
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @fastify/websocket `connection.socket` (SocketStream wrapper) | Handler receives WebSocket directly | v10.0.0 (2023) | Simpler typing; old blog posts are wrong |
| zustand `create(...)` | `create<T>()()` double parens for TS | v4+ stabilized | Middleware TS compat requires double-call |
| zustand equality fn in `create` | `createWithEqualityFn` from `zustand/traditional` | v5.0.0 (2024) | `create` no longer accepts equality fn |
| zod `z.string().email()` | `z.email()` top-level | Zod v4 (2025) | Breaking — avoid if using v3 schemas |
| WS client libraries (reconnecting-websocket) | Hand-rolled or `websocket-ts` | 2020 (abandoned) | Hand-roll 50 lines; avoid dead deps |

**Deprecated/outdated:**
- `SocketStream` import from `@fastify/websocket`: removed in v10, replaced by direct WebSocket type
- `fastify-websocket` (old package name): now `@fastify/websocket`
- Zustand default export: dropped in v5 — use named `{ create }` import
- `zustand/vanilla` `createStore` vs React `create`: both valid; for Phase 5 client the React `create` hook is preferred since Phase 6 will add React

## Open Questions

1. **@fastify/websocket handler signature — v11 exact API**
   - What we know: v10 changed from `SocketStream` wrapper to direct WebSocket. v11.2.0 is current.
   - What's unclear: Whether the handler receives `(socket: WebSocket, req: FastifyRequest)` or `(connection: SocketStream)` — sources are contradictory because many reference pre-v10 docs.
   - Recommendation: After installing v11, inspect the TypeScript type of the first argument. The installed types will be authoritative.

2. **graphStore in React vs Vanilla — Phase 5 vs 6 boundary**
   - What we know: Phase 5 has no React (client is currently `document.getElementById('app').innerHTML = '...'`). Phase 6 will add React.
   - What's unclear: Should the Phase 5 store be created with `create` (React hook) or `createStore` (vanilla)?
   - Recommendation: Use `create` from `'zustand'` for the React hook API — Phase 6 will use `useGraphStore(selector)` directly. The `wsClient.ts` can call `useGraphStore.getState()` outside React components without issue.

3. **InferenceResult messages over WebSocket**
   - What we know: `InferenceEngine` emits `inference` events with `InferenceResult` (zone updates, arch events, risks). The current `messages.ts` only defines `GraphDeltaMessage` and `InitialStateMessage`.
   - What's unclear: Should inference results be a third WS message type, or merged into the delta message?
   - Recommendation: Add a third `InferenceMessage` to `ServerMessage` union. This keeps transport clean and allows Phase 7 (activity feed, risk panel) to subscribe to a dedicated message type. Do NOT merge into delta — they're logically independent.

4. **500ms batch window interaction with version gap detection**
   - What we know: The 500ms batch window and version-based gap detection are both user decisions.
   - What's unclear: What happens when a version gap is detected mid-batch?
   - Recommendation: On gap detection, cancel the current batch, clear the pending queue, request snapshot via REST. After snapshot arrives, resume normal batching.

5. **"Project directory unavailable" signal from server**
   - What we know: The user wants a distinct error state in the connection banner for when the watched directory is unavailable.
   - What's unclear: How does the server signal this? The server-side `Pipeline` would detect the chokidar error, but it currently logs to console only.
   - Recommendation: Add a fourth WS message type `ErrorMessage` or an error field to the plugin. When `Pipeline` emits a watch error, broadcast an `{ type: 'error', code: 'DIRECTORY_UNAVAILABLE' }` message. Client maps this to the distinct banner state.

## Existing Codebase Integration Points

Key facts discovered during codebase analysis that the planner must know:

1. **`graph.on('delta', ...)` is the correct subscription point** — `DependencyGraph` already emits typed delta events with the monotonic `version` counter. The WS plugin subscribes here.

2. **`inferenceEngine.on('inference', ...)` is the second subscription point** — `InferenceEngine` emits typed `InferenceResult` events. These are separate from graph deltas and need their own WS message type.

3. **Vite proxy is already configured** — `vite.config.ts` has `/ws` → `localhost:3100` with `ws: true`. Register Fastify WS route at exactly `/ws`.

4. **`/api` proxy is also configured** — snapshot REST endpoint goes at `/api/snapshot` and will work through the proxy.

5. **Shared types in `messages.ts` are partially defined** — `GraphDeltaMessage`, `InitialStateMessage`, and `ServerMessage` union already exist but use `GraphNode`/`GraphEdge` from `graph.ts`. The `graph.ts` types (with `id`, `name`, `zone`, etc.) are the WS message format, distinct from the internal `NodeMetadata`/`EdgeMetadata` used by `DependencyGraph`. Plan 05-01 must map from internal types to the WS message types.

6. **`DependencyGraph.getVersion()` exists** — returns the current monotonic version counter. Use this in the snapshot endpoint and on-connect message.

7. **`DependencyGraph` has no `getSnapshot()` method** — must be added to serialize the current in-memory graph for the initial state message and recovery endpoint.

8. **`fastify.register(healthPlugin)` pattern** — existing plugin registration style. Follow the same pattern for `websocketPlugin` and `snapshotPlugin`.

9. **Server listens on port 3100** — confirmed in `index.ts`. Client connects to `/ws` which Vite proxies to `localhost:3100/ws`.

## Sources

### Primary (HIGH confidence)
- `packages/server/src/index.ts` — Fastify server setup, plugin registration pattern, graph/inference event subscription
- `packages/server/src/graph/DependencyGraph.ts` — `getVersion()`, `getAllNodeIds()`, `getNodeMetadata()` APIs; `delta` event emission
- `packages/server/src/inference/InferenceEngine.ts` — `inference` event emission with `InferenceResult`
- `packages/shared/src/types/messages.ts` — Existing `GraphDeltaMessage`, `InitialStateMessage`, `ServerMessage` types
- `packages/shared/src/types/graph-delta.ts` — `GraphDelta`, `GraphDeltaEdge`, `NodeMetadata` shapes
- `packages/client/vite.config.ts` — Confirmed `/ws` proxy with `ws: true`
- Official @fastify/websocket GitHub releases — v11.0.1 requires Fastify ^5.0.0; v10.0.0 changed handler signature

### Secondary (MEDIUM confidence)
- [Better Stack Fastify WebSocket guide](https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) — broadcasting pattern, connection lifecycle
- [xjavascript.com Fastify WebSocket TypeScript](https://www.xjavascript.com/blog/fastify-websocket-typescript/) — TypeScript handler pattern
- [Zustand GitHub - pmndrs/zustand](https://github.com/pmndrs/zustand) — `create`, `createStore`, subscribe, getState/setState APIs
- [Zustand v5 migration guide](https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5) — v5 breaking changes confirmed
- [Zod docs - basics](https://zod.dev/basics) — safeParse, discriminatedUnion, z.infer

### Tertiary (LOW confidence)
- WebSearch results on WS batching patterns — 500ms client-side batch window is a common recommendation but not from an authoritative single source
- WebSearch results on version-based recovery — general pattern confirmed by multiple sources but specific implementation is custom

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @fastify/websocket v11 confirmed via GitHub releases; zustand v5.0.11 confirmed as current; zod v3 in production use
- Architecture: HIGH — patterns derived from actual codebase analysis + confirmed library APIs
- Pitfalls: HIGH (v10 SocketStream change) / MEDIUM (batch+version interaction, v4 Zod) — confirmed from official releases and migration docs

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days — stable libraries, confirmed versions)
