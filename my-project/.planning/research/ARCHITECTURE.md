# Architecture Research

**Domain:** Real-time code analysis and architecture visualization system
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (core pipeline patterns well-established; some ArchLens-specific inference patterns are novel territory)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (Browser)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Canvas/WebGL │  │  UI Shell    │  │  Activity    │  │  Intent/Risk   │  │
│  │  Renderer    │  │  (React)     │  │   Feed       │  │   Panels       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                  │                  │           │
│  ┌──────┴─────────────────┴──────────────────┴──────────────────┴────────┐  │
│  │                    Client State Store                                  │  │
│  │         (graph state, layout coords, animation queue)                 │  │
│  └──────────────────────────────┬─────────────────────────────────────── ┘  │
│                                 │  WebSocket (ws://)                        │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                          BACKEND (Node.js)                                  │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                                 │                                           │
│  ┌──────────────────────────────┴──────────────────────────────────────┐    │
│  │                    WebSocket Server (Fastify)                        │    │
│  │             (delta push, session state, message routing)             │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                           │
│  ┌──────────────────────────────┴──────────────────────────────────────┐    │
│  │                    Event Bus (EventEmitter / in-process)             │    │
│  │              (decouples pipeline stages from transport)              │    │
│  └────────┬───────────────────────────────────────────────┬────────────┘    │
│           │                                               │                 │
│  ┌────────┴────────┐                          ┌──────────┴─────────────┐    │
│  │  Analysis       │                          │  Persistence Layer      │    │
│  │  Pipeline       │                          │  (SQLite + better-     │    │
│  │                 │                          │   sqlite3)              │    │
│  │ ┌─────────────┐ │                          │                        │    │
│  │ │File Watcher │ │                          │ ┌────────────────────┐ │    │
│  │ │(chokidar v5)│ │                          │ │  graph_nodes       │ │    │
│  │ └──────┬──────┘ │                          │ │  graph_edges       │ │    │
│  │        │        │                          │ │  change_events     │ │    │
│  │ ┌──────┴──────┐ │                          │ │  layout_positions  │ │    │
│  │ │  Debounce / │ │                          │ └────────────────────┘ │    │
│  │ │  Batch      │ │                          └────────────────────────┘    │
│  │ └──────┬──────┘ │                                                        │
│  │        │        │                                                        │
│  │ ┌──────┴──────┐ │                                                        │
│  │ │Tree-sitter  │ │  (Worker Thread)                                       │
│  │ │  Parser     │ │                                                        │
│  │ └──────┬──────┘ │                                                        │
│  │        │        │                                                        │
│  │ ┌──────┴──────┐ │                                                        │
│  │ │Dependency   │ │                                                        │
│  │ │Graph Builder│ │                                                        │
│  │ └──────┬──────┘ │                                                        │
│  │        │        │                                                        │
│  │ ┌──────┴──────┐ │                                                        │
│  │ │Architectural│ │                                                        │
│  │ │Inference    │ │                                                        │
│  │ └─────────────┘ │                                                        │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| File Watcher | Detect file system changes with debouncing | chokidar v5 (ESM, Node 20+), 400ms debounce |
| Parse Scheduler | Batch changed files, manage parse queue, priority ordering | Worker thread queue with backpressure |
| Tree-sitter Parser | Incremental AST generation per changed file | tree-sitter Node.js native bindings (not WASM for perf) |
| Dependency Graph Builder | Maintain in-memory graph of imports/exports/calls | In-process graph (Map of nodes/edges), write-through to SQLite |
| Architectural Inference | Map file-level deps to architectural concepts (services, containers, zones) | Heuristic rule engine: path patterns + import topology |
| Event Bus | Decouple pipeline stages; fan-out change events | Node.js EventEmitter or mitt (tiny typed alternative) |
| WebSocket Server | Push delta updates to browser clients | Fastify + @fastify/websocket |
| Persistence Layer | Store graph state, layout positions, change history | better-sqlite3 (synchronous, fast, embedded) |
| Client State Store | Maintain graph state, layout coords, animation queue | Zustand or lightweight plain store |
| Canvas Renderer | Render nodes/edges at 60fps with animations | Pixi.js v8 (WebGL, Canvas fallback) |
| Layout Engine | Assign stable positions to nodes; add new nodes without reshuffling | Constrained force-directed with pinned existing nodes |
| UI Shell | React panels: activity feed, intent panel, risk panel | React 19 + minimal UI library |

## Recommended Project Structure

```
archlens/
├── packages/
│   ├── server/                    # Node.js backend (Fastify + pipeline)
│   │   ├── src/
│   │   │   ├── watcher/           # File system watching
│   │   │   │   ├── FileWatcher.ts         # chokidar wrapper with debounce
│   │   │   │   └── ChangeQueue.ts         # Batching and priority queue
│   │   │   ├── parser/            # Tree-sitter parsing layer
│   │   │   │   ├── ParserPool.ts          # Worker thread pool for parsing
│   │   │   │   ├── TreeSitterParser.ts    # Incremental parse + cache
│   │   │   │   ├── grammars/              # TS/JS and Python grammar configs
│   │   │   │   └── extractors/
│   │   │   │       ├── typescript.ts      # Import/export/call extraction
│   │   │   │       └── python.ts          # Import/call extraction
│   │   │   ├── graph/             # Dependency graph management
│   │   │   │   ├── DependencyGraph.ts     # In-memory graph (nodes + edges)
│   │   │   │   ├── GraphDiff.ts           # Compute deltas between versions
│   │   │   │   └── GraphStore.ts          # Write-through persistence
│   │   │   ├── inference/         # Architectural concept mapping
│   │   │   │   ├── ZoneClassifier.ts      # Assign nodes to semantic zones
│   │   │   │   ├── BoundaryDetector.ts    # Infer service/module boundaries
│   │   │   │   ├── EventDetector.ts       # Detect architectural change events
│   │   │   │   ├── RiskAnalyzer.ts        # Circular deps, fan-out heuristics
│   │   │   │   └── IntentInferrer.ts      # Infer agent objectives from patterns
│   │   │   ├── transport/         # WebSocket server
│   │   │   │   ├── WebSocketServer.ts     # Fastify WS plugin, message routing
│   │   │   │   └── DeltaSerializer.ts     # Serialize graph deltas for wire
│   │   │   ├── db/                # SQLite persistence
│   │   │   │   ├── Database.ts            # better-sqlite3 setup, migrations
│   │   │   │   ├── GraphRepository.ts     # Node/edge CRUD
│   │   │   │   ├── EventRepository.ts     # Change event log (for time-travel)
│   │   │   │   └── LayoutRepository.ts    # Persist node positions
│   │   │   ├── events/            # Internal event bus
│   │   │   │   └── EventBus.ts            # Typed event emitter
│   │   │   └── index.ts           # Server entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── client/                    # Browser frontend (React + Pixi.js)
│       ├── src/
│       │   ├── canvas/            # Pixi.js rendering layer
│       │   │   ├── ArchCanvas.ts          # Main Pixi Application setup
│       │   │   ├── NodeRenderer.ts        # Draw nodes (zones, types, glow)
│       │   │   ├── EdgeRenderer.ts        # Draw edges (calls, deps, owns)
│       │   │   ├── AnimationQueue.ts      # Smooth transitions and pulses
│       │   │   └── ViewportController.ts  # Zoom, pan, hit-testing
│       │   ├── layout/            # Layout computation
│       │   │   ├── LayoutEngine.ts        # Constrained force-directed layout
│       │   │   ├── ZonePositioner.ts      # Zone-based initial placement
│       │   │   └── IncrementalPlacer.ts   # Add nodes without reshuffling
│       │   ├── store/             # Client-side state
│       │   │   ├── graphStore.ts          # Graph nodes/edges state
│       │   │   ├── uiStore.ts             # Panel states, selection
│       │   │   └── replayStore.ts         # Time-travel replay state
│       │   ├── ws/                # WebSocket client
│       │   │   ├── WSClient.ts            # Connection management, reconnect
│       │   │   └── MessageHandler.ts      # Apply delta patches to store
│       │   ├── components/        # React UI components
│       │   │   ├── App.tsx                # Root layout
│       │   │   ├── ActivityFeed.tsx       # Natural-language event stream
│       │   │   ├── IntentPanel.tsx        # Inferred agent objectives
│       │   │   ├── RiskPanel.tsx          # Architectural warnings
│       │   │   ├── NodeInspector.tsx      # Click-to-inspect details
│       │   │   └── ReplayControls.tsx     # Time-travel scrubber
│       │   └── main.tsx           # Entry point
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                   # Workspace root
└── tsconfig.base.json
```

### Structure Rationale

- **packages/server/src/watcher/:** File watching isolated so debounce/batch strategies can evolve independently of parsing
- **packages/server/src/parser/:** Worker thread pool encapsulated here; rest of server doesn't know parsing is async
- **packages/server/src/inference/:** The "brain" — all heuristic rule logic co-located for easy iteration
- **packages/server/src/transport/:** WebSocket layer separated from business logic; swap to SSE later if needed
- **packages/client/src/canvas/:** Pixi.js layer fully isolated from React; React manages state, Pixi renders it imperatively
- **packages/client/src/layout/:** Layout computation separated from rendering; can move to Web Worker later

## Architectural Patterns

### Pattern 1: Pipeline with Event Bus Decoupling

**What:** Each stage in the analysis pipeline (watcher → parser → graph → inference → transport) communicates via a typed internal event bus rather than direct function calls.

**When to use:** Always — this is the core structural pattern. Enables stages to be tested independently, replaced, and run at different rates.

**Trade-offs:** Slight added complexity vs. direct calls; prevents tight coupling that would make the pipeline brittle as it grows.

**Example:**
```typescript
// EventBus.ts — typed events for each stage transition
interface PipelineEvents {
  'file:changed': { path: string; mtime: number };
  'parse:complete': { path: string; tree: SyntaxTree; imports: Import[] };
  'graph:updated': { diff: GraphDiff };
  'arch:event': { type: ArchEventType; payload: ArchEvent };
  'risk:detected': { risks: Risk[] };
}

const bus = new TypedEventEmitter<PipelineEvents>();

// Watcher emits, parser subscribes — no direct coupling
bus.on('file:changed', ({ path }) => parserPool.enqueue(path));
bus.on('parse:complete', (result) => graphBuilder.apply(result));
bus.on('graph:updated', (diff) => inferenceEngine.analyze(diff));
bus.on('arch:event', (event) => wsServer.broadcast(event));
```

### Pattern 2: Incremental Parse Cache + Diff

**What:** Keep the previous syntax tree for each file in memory. When a file changes, pass the edit range to Tree-sitter's incremental parser. Compare the new dependency list against the cached list to compute only what changed.

**When to use:** Always — this is what keeps latency under 1 second for large codebases. Full re-parse on every change is 10-20x slower (verified: Tree-sitter benchmarks show 70% reduction in parse time with incremental updates).

**Trade-offs:** Memory overhead for caching trees. For a 5000-file codebase with average 10KB files, tree cache ~50MB — acceptable.

**Example:**
```typescript
// TreeSitterParser.ts
class IncrementalParser {
  private treeCache = new Map<string, SyntaxTree>();
  private contentCache = new Map<string, string>();

  async parse(filePath: string, newContent: string): Promise<ParseResult> {
    const prevTree = this.treeCache.get(filePath);
    const prevContent = this.contentCache.get(filePath);

    let tree: SyntaxTree;
    if (prevTree && prevContent) {
      const edit = computeEdit(prevContent, newContent);
      prevTree.edit(edit);  // Tree-sitter edit in-place
      tree = this.parser.parse(newContent, prevTree);  // Incremental
    } else {
      tree = this.parser.parse(newContent);  // Full parse (first time)
    }

    this.treeCache.set(filePath, tree);
    this.contentCache.set(filePath, newContent);
    return extractDependencies(tree, filePath);
  }
}
```

### Pattern 3: Graph Delta + Version-Tagged WebSocket Push

**What:** The server maintains a versioned graph state. When the graph changes, it computes a diff (added nodes, removed nodes, changed edges). Only the diff is pushed to the browser over WebSocket. The client applies patches to its local copy.

**When to use:** Always — sending full graph state on every change would be wasteful and would cause the client to re-render everything.

**Trade-offs:** Requires server to maintain version counter and client to track its version. Reconnection must re-send full state or missed deltas.

**Example:**
```typescript
// GraphDiff.ts
interface GraphDelta {
  version: number;
  timestamp: number;
  addedNodes: ArchNode[];
  removedNodeIds: string[];
  updatedNodes: Partial<ArchNode>[];
  addedEdges: ArchEdge[];
  removedEdgeIds: string[];
  archEvents: ArchEvent[];  // Detected architectural changes
}

// DeltaSerializer.ts
function serializeDelta(prev: GraphState, next: GraphState): GraphDelta {
  return {
    version: next.version,
    timestamp: Date.now(),
    addedNodes: next.nodes.filter(n => !prev.nodeIndex.has(n.id)),
    removedNodeIds: [...prev.nodeIndex.keys()].filter(id => !next.nodeIndex.has(id)),
    updatedNodes: computeChangedNodes(prev, next),
    addedEdges: next.edges.filter(e => !prev.edgeIndex.has(e.id)),
    removedEdgeIds: [...prev.edgeIndex.keys()].filter(id => !next.edgeIndex.has(id)),
    archEvents: next.pendingEvents,
  };
}
```

### Pattern 4: Stable Layout with Zone-Constrained Force Simulation

**What:** Use a force-directed layout algorithm where existing nodes have their positions pinned (frozen), and only newly added nodes are simulated to find position. Nodes are constrained to their semantic zone (frontend left, API center-left, etc.) to enforce zone semantics.

**When to use:** Always — avoids the catastrophic full-reshuffle problem that destroys user's mental map.

**Trade-offs:** Layout is not globally optimal for the whole graph; it's locally optimal per addition. Acceptable tradeoff for stability.

**Example:**
```typescript
// IncrementalPlacer.ts
function placeNewNode(
  newNode: ArchNode,
  existingNodes: ArchNode[],
  zone: SemanticZone
): Position {
  // Pin all existing nodes — they won't move
  const pinnedNodes = existingNodes.map(n => ({ ...n, fx: n.x, fy: n.y }));

  // Zone constraint: restrict starting position and force walls
  const zoneBox = ZONE_BOUNDS[zone];
  const startPos = randomInBox(zoneBox);

  // Run limited simulation with only new node free to move
  const sim = forceSimulation([...pinnedNodes, { ...newNode, x: startPos.x, y: startPos.y }])
    .force('link', forceLink(getRelevantEdges(newNode, existingNodes)))
    .force('collide', forceCollide(NODE_RADIUS))
    .force('zone', zoneWallForce(zoneBox))
    .stop();

  sim.tick(50);  // Limited ticks — enough to settle new node
  return { x: newNode.x!, y: newNode.y! };
}
```

### Pattern 5: Event Sourcing for Time-Travel Replay

**What:** Every architectural change event is appended to an immutable log in SQLite. The current graph state is a materialized view derived from replaying all events. Time-travel scrubs back by replaying events up to a given timestamp.

**When to use:** Required for the time-travel replay feature. Also provides audit trail and resilience — graph state is always recoverable from events.

**Trade-offs:** Replay from origin gets slow for long-lived sessions. Mitigate with periodic snapshots (store full graph state at checkpoint, replay only events after snapshot).

**Example:**
```typescript
// EventRepository.ts — append-only event log
interface ChangeEvent {
  id: number;          // Auto-increment, serves as version
  timestamp: number;
  event_type: string;  // 'node_added' | 'edge_added' | 'node_removed' etc.
  payload: string;     // JSON
  snapshot_id?: number; // If snapshot taken at this point
}

// GraphRepository.ts — snapshots for fast replay
interface Snapshot {
  id: number;
  timestamp: number;
  event_id: number;   // Latest event included in this snapshot
  graph_state: string; // Full JSON of graph at this point
}

// Replay to timestamp T:
// 1. Find latest snapshot before T
// 2. Deserialize snapshot graph state
// 3. Replay events from snapshot.event_id+1 to T
```

## Data Flow

### Primary Flow: File Change → Architecture Update

```
[File System]
    │ change event (add/modify/delete)
    ↓
[File Watcher — chokidar v5]
    │ debounced (400ms window, batch)
    ↓
[Change Queue]
    │ (path, change type, priority)
    ↓
[Parse Scheduler — Worker Thread Pool]
    │ concurrent parse of changed files
    ↓
[Tree-sitter Parser — per-language]
    │ incremental AST → extracted imports/exports/calls
    ↓
[Dependency Graph Builder]
    │ in-memory graph delta (nodes+edges added/removed)
    ↓
[Architectural Inference Engine]
    │ zone classification, boundary detection, event detection
    │ risk analysis, intent inference
    ↓
[Event Bus: 'arch:event' emitted]
    │ GraphDelta + ArchEvents
    ↓
[Persistence Layer — SQLite]
    │ write-through: persist graph state + events
    ↓
[WebSocket Server]
    │ JSON delta message pushed
    ↓
[Browser WebSocket Client]
    │ apply patch to client state store
    ↓
[Client State Store → Canvas Renderer]
    │ animate changes (Pixi.js tweens, glow, pulse)
    ↓
[User Sees Updated Architecture Map]
```

### Secondary Flow: Initial Load / Reconnect

```
[Browser Opens / Reconnects]
    │ WebSocket connect + send { type: 'sync_request', clientVersion: N }
    ↓
[WebSocket Server]
    │ If clientVersion == 0: send full graph state
    │ If clientVersion < current: send events since clientVersion
    ↓
[Browser MessageHandler]
    │ Populate store from full state OR apply missed deltas
    ↓
[Layout Engine]
    │ Run zone-constrained layout for all nodes (first load only)
    │ or restore persisted positions (subsequent loads)
    ↓
[Canvas Renderer]
    │ Render full graph, then switch to delta mode
```

### State Management Flow

```
[SQLite (source of truth — server)]
    │ read on startup → populate in-memory GraphState
    ↓
[In-Memory GraphState (server)]
    │ versioned, compare-and-swap updates
    ↓ WebSocket delta push
[Client GraphStore (Zustand)]
    │ applyDelta() patches nodes/edges
    ↓ (subscribe)
[Canvas Renderer] ← imperative Pixi.js calls (NOT React re-render)
[React UI Panels] ← React re-render on panel data changes only
```

**Key insight:** The Canvas renderer must NOT go through React's render cycle. React manages UI panels (activity feed, risk panel, inspector). Pixi.js manages the canvas directly, subscribing to store changes imperatively. This separation is what enables 60fps rendering.

### Key Data Flows

1. **Incremental parse flow:** Only changed files are re-parsed. Previous syntax trees are edited in-place using Tree-sitter's edit API. Parse time per changed file: ~2-10ms for typical files.

2. **Delta push flow:** Server computes diff between previous and current GraphState. Only diff (typically <5 nodes/edges per file change) pushed over WebSocket. Wire payload ~500 bytes per change vs. full graph at ~50KB.

3. **Layout update flow:** When new node arrives at client, IncrementalPlacer runs a 50-tick force simulation with all existing nodes pinned. New node finds stable position within its zone. No existing node coordinates change.

4. **Time-travel replay flow:** User scrubs scrubber to timestamp T. Client sends replay request. Server loads nearest snapshot, replays subsequent events in order, streams resulting graph states to client.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 files | Single-threaded pipeline fine; no worker threads needed; SQLite in WAL mode |
| 500-5000 files (target) | Worker thread pool for parsing (2-4 workers); debounce and batch file changes; incremental tree cache; zone-constrained layout runs in <100ms |
| 5000+ files | Partition graph into sub-graphs per directory boundary; lazy-load off-screen nodes; stream results progressively; consider background indexing on startup |

### Scaling Priorities

1. **First bottleneck:** Parsing throughput on initial codebase scan. 5000 files × 5ms/file = 25 seconds single-threaded. Fix: worker thread pool (4 workers → ~7 seconds).
2. **Second bottleneck:** Force layout convergence with hundreds of nodes. Fix: limit simulation to new nodes only (Pattern 4). Existing node positions are frozen.
3. **Third bottleneck:** WebSocket message size on first connect with large graph. Fix: compress full-state message; use gzip/brotli on Fastify responses.

## Anti-Patterns

### Anti-Pattern 1: Full Graph Rebuild on Every File Change

**What people do:** Re-scan all files, rebuild the entire dependency graph, and push the full state to the client on each change.

**Why it's wrong:** For a 2000-file codebase, full rebuild takes 10-30 seconds and pushes 50-100KB per change. The 1-2 second latency target becomes impossible. Canvas re-renders all nodes causing jank.

**Do this instead:** Maintain an incremental in-memory graph. When a file changes, update only the nodes/edges affected by that file. Compute a delta. Push only the delta.

### Anti-Pattern 2: Rendering Graph State Through React's DOM

**What people do:** Store graph nodes as React state. Use SVG or CSS-positioned divs for each node. Let React manage re-renders when graph changes.

**Why it's wrong:** React re-render + SVG DOM updates cannot sustain 60fps with hundreds of animated nodes. SVG and Canvas (DOM-rendered) performance degrades sharply above 1000 elements. The constraint says "hundreds of nodes with smooth animations" — that requires GPU.

**Do this instead:** Keep Pixi.js canvas entirely outside React's lifecycle. React mounts a single `<canvas>` element. Pixi.js takes over that canvas imperatively. Graph store changes trigger imperative Pixi.js calls, not React re-renders.

### Anti-Pattern 3: Full Force-Directed Relayout on Every Update

**What people do:** Run a complete force simulation over all nodes when any node is added or removed.

**Why it's wrong:** A full force simulation with 200+ nodes takes 200-500ms and moves every node, destroying the user's mental map. With frequent AI agent changes, this causes constant visual churn.

**Do this instead:** Pin all existing nodes with fixed coordinates. Run simulation for only the new node(s) within their zone boundary. 50 ticks with only 1-2 free nodes takes <5ms.

### Anti-Pattern 4: Synchronous Parsing on the Event Loop

**What people do:** Call Tree-sitter parser synchronously in the main Node.js event loop.

**Why it's wrong:** Parsing a 1000-line file takes ~5-15ms. During an AI agent burst (20 files changed in 2 seconds), synchronous parsing blocks the WebSocket server from processing client messages, causing apparent freezes.

**Do this instead:** Run Tree-sitter parsing in Node.js worker threads. The main thread stays free for WebSocket I/O. Use a bounded queue to prevent memory growth during bursts.

### Anti-Pattern 5: Visualizing File-Level Relationships Directly

**What people do:** Create one graph node per file, one edge per import. Show the raw dependency graph.

**Why it's wrong:** A 500-file codebase produces a hairball graph with 500 nodes and potentially thousands of edges. This is visually incomprehensible and defeats the purpose of architectural visualization.

**Do this instead:** Apply architectural inference to group files into higher-level concepts (services, modules, containers). 500 files might map to 20-50 architectural nodes. Edges represent service-level relationships, not file imports.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| File System (OS) | chokidar v5 wrapping Node.js fs.watch / FSEvents / inotify | Platform-specific watchers; chokidar abstracts OS differences |
| Browser | WebSocket over ws:// (localhost) | No auth needed for local single-user app; Fastify handles |
| SQLite | better-sqlite3 (synchronous bindings, faster than async) | Single file on disk; WAL mode for concurrent reads during writes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| File Watcher ↔ Parse Scheduler | EventBus 'file:changed' event | Decoupled; scheduler controls parse rate |
| Parse Scheduler ↔ Tree-sitter Workers | Worker thread message passing (structured clone) | Parse trees are NOT transferable; return extracted data (plain objects) only |
| Tree-sitter Workers ↔ Graph Builder | EventBus 'parse:complete' event | Workers post results back to main thread |
| Graph Builder ↔ Inference Engine | EventBus 'graph:updated' event with GraphDiff | Inference runs asynchronously after graph updates |
| Inference Engine ↔ WebSocket Server | EventBus 'arch:event' with GraphDelta | Server serializes and broadcasts |
| WebSocket Server ↔ SQLite | Direct (persistence is synchronous write-through) | better-sqlite3 sync API fits server's async model cleanly |
| Client WebSocket ↔ Client Store | MessageHandler applies patches to Zustand store | Store is the single source of truth on client |
| Client Store ↔ Canvas Renderer | Direct imperative subscription (not React) | Critical: bypass React for canvas updates |
| Client Store ↔ React Panels | React component subscription via Zustand hooks | Normal React data flow for non-canvas UI |

## Build Order Implications

The component dependency graph defines the natural build sequence:

1. **SQLite schema + repositories** — foundation; everything persists here
2. **File Watcher + Change Queue** — simplest pipeline stage; no dependencies
3. **Tree-sitter Parser + Worker Pool** — can be built/tested independently
4. **Dependency Graph Builder + GraphDiff** — depends on parser output shape
5. **Architectural Inference Engine** — depends on graph structure being stable
6. **WebSocket Server + Delta Serialization** — depends on GraphDelta schema
7. **Client WebSocket client + State Store** — depends on wire protocol being defined
8. **Pixi.js Canvas Renderer + Layout Engine** — depends on node/edge schema
9. **React UI Panels** — depends on store shape; can be built in parallel with canvas
10. **Time-travel Replay** — layered on top of event log; defer to later phase

The critical path is: Schema → Parser → Graph → Inference → WebSocket → Canvas. The UI panels and time-travel features are parallelizable after step 6.

## Sources

- Tree-sitter incremental parsing benchmarks (70% parse time reduction, 100ms/10k lines): [Incremental Parsing with Tree-sitter: Enhancing Code Analysis Performance](https://dasroot.net/posts/2026/02/incremental-parsing-tree-sitter-code-analysis/) — HIGH confidence (2026)
- Tree-sitter Node.js WASM vs native bindings (WASM slower): [tree-sitter GitHub](https://github.com/tree-sitter/tree-sitter) — HIGH confidence (official)
- Graph rendering: Canvas/WebGL threshold ~5000 nodes; WebGL holds to 10k+: [Graph visualization efficiency of popular web-based libraries](https://pmc.ncbi.nlm.nih.gov/articles/PMC12061801/) — HIGH confidence (peer reviewed)
- D3 + Pixi.js decoupled rendering pattern: [Scale Up D3 Graph Visualization with PIXI.js](https://graphaware.com/blog/scale-up-your-d3-graph-visualisation-webgl-canvas-with-pixi-js/) — HIGH confidence (established pattern)
- Force layout web worker pattern (layout off main thread): Same GraphAware article — MEDIUM confidence
- Sticky nodes / incremental layout for mental map preservation: [Static and sticky force-directed layout in D3](https://kkschick.wordpress.com/2016/04/01/static-and-sticky-force-directed-layout-in-d3/) + [Cambridge Intelligence force layout docs](https://cambridge-intelligence.com/automatic-graph-layouts/) — MEDIUM confidence
- WebSocket delta sync with JSON Patch: [Synchronizing state with WebSockets and JSON Patch](https://cetra3.github.io/blog/synchronising-with-websocket/) — MEDIUM confidence
- Fastify performance (70-80k req/s vs Express 20-30k): [Express or Fastify in 2025](https://medium.com/codetodeploy/express-or-fastify-in-2025-whats-the-right-node-js-framework-for-you-6ea247141a86) — MEDIUM confidence
- chokidar v5 ESM-only, Node 20+: [chokidar npm](https://www.npmjs.com/package/chokidar) — HIGH confidence (official)
- Event sourcing for time-travel: [Time Travel using Event Sourcing Pattern](https://medium.com/@sudipto76/time-travel-using-event-sourcing-pattern-603a0551d2ff) + [Martin Fowler EventSourcing](https://martinfowler.com/eaaDev/EventSourcing.html) — HIGH confidence
- WebSocket best practices (backpressure, message ordering): [Ably WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices) — MEDIUM confidence

---
*Architecture research for: real-time code analysis and architecture visualization*
*Researched: 2026-03-15*
