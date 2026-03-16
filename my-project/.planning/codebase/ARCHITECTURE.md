# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Monorepo with client-server architecture for real-time architectural visualization. Server watches source files, parses dependencies, builds a live graph, infers architectural zones, and streams deltas via WebSocket. Client renders the live graph on a canvas with interactive inspection and risk visualization.

**Key Characteristics:**
- Reactive delta-streaming pattern: File changes → Parse → Graph update → Inference → WebSocket broadcast → Client render
- Three-package monorepo: `@archlens/server` (Node/Fastify), `@archlens/client` (React/Konva), `@archlens/shared` (TypeScript types)
- Persistent graph state in SQLite with atomic delta transactions
- Worker thread pool for parsing (tree-sitter) to avoid blocking
- Konva canvas rendering with incremental layout and viewport culling
- Zustand store for client-side graph state and WebSocket connection management

## Layers

**File Watching & Event Stream:**
- Purpose: Detect source file changes, normalize events, batch them, and emit to the pipeline
- Location: `packages/server/src/watcher/FileWatcher.ts`
- Contains: Chokidar file watcher with debounce, ignore patterns (node_modules, .git, etc.), event batching
- Depends on: Chokidar, Node.js fs/path
- Used by: `Pipeline`

**Parsing & Language Extraction:**
- Purpose: Parse source files in worker threads, extract imports/exports, build syntax trees
- Location: `packages/server/src/parser/ParserPool.ts`, `packages/server/src/parser/worker.ts`, `packages/server/src/parser/extractors/*`
- Contains: Piscina worker pool, tree-sitter grammars for JS/TS/Python, language-specific extractors
- Depends on: Piscina, tree-sitter, tree-sitter-* language grammars
- Used by: `Pipeline`

**Graph Model & Persistence:**
- Purpose: Maintain in-memory directed graph of file-level dependencies, compute deltas, persist atomically to SQLite
- Location: `packages/server/src/graph/DependencyGraph.ts`, `packages/server/src/graph/GraphPersistence.ts`, `packages/server/src/db/`
- Contains: @dagrejs/graphlib graph, delta builder, cycle detection, SQLite schema (nodes, edges, events, positions)
- Depends on: @dagrejs/graphlib, Drizzle ORM, better-sqlite3
- Used by: `Pipeline`, `InferenceEngine`, `WebSocket Plugin`, `ComponentAggregator`

**Inference & Architecture Analysis:**
- Purpose: Classify file nodes into semantic zones, detect cycles, boundary violations, fan-out risks
- Location: `packages/server/src/inference/InferenceEngine.ts`, `packages/server/src/inference/ZoneClassifier.ts`, `packages/server/src/inference/RiskDetector.ts`, `packages/server/src/inference/EventCorroborator.ts`
- Contains: Zone classification (path-first, override-second), cycle severity tiers, risk detector with thresholds, event correlation
- Depends on: Graph traversal, .archlens.json config loading, SQLite event logging
- Used by: Server index, WebSocket plugin

**WebSocket & Streaming:**
- Purpose: Broadcast graph deltas and inference results to connected clients in real-time
- Location: `packages/server/src/plugins/websocket.ts`, `packages/client/src/ws/wsClient.ts`
- Contains: Fastify WebSocket handler, client set management, delta diffing, exponential backoff reconnect, 500ms batch window
- Depends on: @fastify/websocket, Zod for message validation
- Used by: All connected clients

**Client Graph Store & State:**
- Purpose: Maintain client-side graph state, apply deltas atomically, track connection status
- Location: `packages/client/src/store/graphStore.ts`, `packages/client/src/store/inferenceStore.ts`
- Contains: Zustand stores, delta application (add/remove nodes/edges), snapshot restore, connection status
- Depends on: Zustand, shared type definitions
- Used by: Canvas renderers, panels, UI components

**Canvas Rendering & Layout:**
- Purpose: Render graph nodes/edges/zones on Konva canvas with performance-optimized viewport culling
- Location: `packages/client/src/canvas/ArchCanvas.tsx`, `packages/client/src/canvas/NodeRenderer.ts`, `packages/client/src/canvas/EdgeRenderer.ts`, `packages/client/src/layout/IncrementalPlacer.ts`
- Contains: Konva Stage/Layer, imperative renderers, d3-force sticky layout, quadtree culling index, animation queue (30s glow decay)
- Depends on: Konva, react-konva, d3-force, d3-force-boundary, @timohausmann/quadtree-js
- Used by: App root, viewport controller

**Viewport Control & Navigation:**
- Purpose: Handle zoom-to-pointer, pan, fit-to-view, and viewport state persistence
- Location: `packages/client/src/canvas/ViewportController.ts`, `packages/client/src/utils/viewport.ts`
- Contains: Scale and position transformation, localStorage persistence (zoom + pan), keyboard/mouse handlers
- Depends on: Konva Stage math, browser localStorage
- Used by: ArchCanvas, App navigation controls

**UI Panels & Inspection:**
- Purpose: Display node details, risks, activity feed, and enable cross-panel navigation
- Location: `packages/client/src/panels/NodeInspector.tsx`, `packages/client/src/panels/RiskPanel.tsx`, `packages/client/src/panels/ActivityFeed.tsx`
- Contains: React components for sidebar, node metadata display, risk rows with severity colors, event timeline
- Depends on: React hooks, graphStore, inferenceStore, Zustand subscriptions
- Used by: App root layout

**Shared Types & Contracts:**
- Purpose: Define wire formats, type safety across client-server, serialization schemas
- Location: `packages/shared/src/types/`
- Contains: GraphNode, GraphEdge, GraphDelta, ParseResult, ServerMessage, InferenceResult, Zod schemas
- Depends on: Zod (server validation), TypeScript
- Used by: All server and client code

## Data Flow

**Graph Update Cycle:**

1. FileWatcher detects file changes (add/modify/remove)
2. Pipeline batches events, reads file contents, identifies language by extension
3. ParserPool dispatches to worker threads (tree-sitter parsing)
4. Workers extract imports/exports, return ParseResult objects
5. Pipeline emits ParseBatchResult to DependencyGraph.onParseResult()
6. DependencyGraph updates in-memory graph, computes GraphDelta (added/removed/modified nodes/edges, cycles)
7. GraphPersistence atomically writes delta to SQLite in a transaction
8. DependencyGraph emits 'delta' event (EventEmitter pattern)
9. InferenceEngine subscribes to delta events, runs ZoneClassifier + RiskDetector, emits 'inference' event
10. WebSocket plugin subscribes to both delta and inference events, broadcasts to all clients
11. WsClient receives messages, applies delta to graphStore (Map updates), triggers canvas re-render

**Session Initialization:**

1. Client mounts, WsClient connects to /ws endpoint
2. Server's WebSocket handler sends `initial_state` message with full snapshot
3. Client's graphStore.applySnapshot() populates nodes and edges Maps
4. ArchCanvas mounts, subscribes to graphStore via Zustand, renders initial graph with layout
5. Subsequent delta messages are queued in a 500ms batch window before applying to store

**Inference & Risk Detection:**

1. ZoneClassifier categorizes nodes into zones (frontend, backend, database, etc.) based on path patterns and .archlens.json overrides
2. EventCorroborator collects signals (zone changes, new cycles) over a threshold window
3. RiskDetector identifies:
   - Circular dependencies (cycle severity: HIGH if > 10 nodes, MEDIUM if > 4 nodes)
   - Boundary violations (cross-zone edges that break architecture)
   - Excessive fan-out (incoming/outgoing edge counts > configurable threshold)
4. InferenceResult includes zoneUpdates, architecturalEvents, and risks
5. Results are broadcast to clients via inference message, stored in inferenceStore

**State Management:**

- **In-memory graph**: DependencyGraph holds nodes, edges, and metadata (via dagrejs/graphlib)
- **Persistent state**: SQLite stores graph state (graph_nodes, graph_edges) and events (changeEvents)
- **Client state**: Zustand stores maintain nodes/edges Maps, version counter, connection status
- **Viewport state**: localStorage persists zoom and pan position per browser session

## Key Abstractions

**DependencyGraph:**
- Purpose: In-memory directed graph with typed delta events
- Examples: `packages/server/src/graph/DependencyGraph.ts`
- Pattern: EventEmitter<GraphDelta>, debounced delta flushing, cycle detection via Tarjan's algorithm, atomic delta transactions

**ParseBatchResult & Pipeline:**
- Purpose: Pipeline chunks file events into parse tasks, dispatches to worker pool, collects results
- Examples: `packages/server/src/pipeline/Pipeline.ts`, `packages/shared/src/types/parser.ts`
- Pattern: Callback-based streaming, type-safe task definition, language detection by extension

**ComponentAggregator:**
- Purpose: Groups file-level nodes into directory/component-level abstractions for WebSocket streaming
- Examples: `packages/server/src/graph/ComponentAggregator.ts`
- Pattern: Snapshot diffing to compute component-level deltas (reduces message volume)

**NodeRenderer & EdgeRenderer:**
- Purpose: Imperative Konva renderers that maintain Maps of shapes (not React components)
- Examples: `packages/client/src/canvas/NodeRenderer.ts`, `packages/client/src/canvas/EdgeRenderer.ts`
- Pattern: Direct Konva shape manipulation (no React state), subscription to graphStore, selective update on delta

**CullingIndex:**
- Purpose: Quadtree spatial index for viewport-based rendering optimization
- Examples: `packages/client/src/canvas/CullingIndex.ts`
- Pattern: Fast rejection of off-screen nodes/edges, 60fps target at 300+ nodes

**ZoneClassifier:**
- Purpose: Semantic classification of file nodes into architectural zones
- Examples: `packages/server/src/inference/ZoneClassifier.ts`
- Pattern: Rule-based classification (path patterns first, then topology, then config overrides)

## Entry Points

**Server:**
- Location: `packages/server/src/index.ts`
- Triggers: `pnpm dev` or node server process
- Responsibilities: Initialize Fastify, load graph from SQLite, start FileWatcher + Pipeline, register plugins, listen on port 3100

**Client:**
- Location: `packages/client/src/main.tsx`
- Triggers: Vite dev server or build output
- Responsibilities: Create WsClient singleton, connect to server, mount React App, initialize canvas + stores

## Error Handling

**Strategy:** Multi-layer graceful degradation

**Patterns:**
- **File read errors**: Log warning, skip file, continue pipeline
- **Parser worker errors**: Return error result with file path, trigger re-parse on next change
- **WebSocket disconnection**: Client reconnects with exponential backoff (500ms, 1s, 2s, ..., 30s max)
- **Version gap detection**: Client detects missing delta version, triggers REST snapshot recovery via /api/snapshot
- **Cycle detection**: Logged at graph level, included in delta as cyclesAdded/cyclesRemoved
- **Invalid WebSocket messages**: Zod validation rejects, messages logged, connection stays open

## Cross-Cutting Concerns

**Logging:** Console-based (pino on server with color pretty-print, browser console on client). Structured logging at:
- `[ArchLens]` - server startup
- `[Pipeline]` - file watching, batching
- `[Parser]` - language detection, worker dispatch
- `[Graph]` - delta events, cycle detection
- `[Inference]` - zone updates, risks
- `[WS]` - connection, message counts, reconnect attempts
- Canvas layer updates, viewport changes logged on demand

**Validation:**
- Server side: Zod schemas for incoming WebSocket messages (ServerMessageSchema)
- Client side: Zod safeParse before applying deltas, graceful drop on invalid
- Type safety: Shared types in `@archlens/shared` enforced at compile time

**Authentication:** None (single-machine analysis tool, assumes trusted local network)

**Concurrency:**
- Server: Async Pipeline + ParserPool with worker threads, synchronous graph updates and SQLite transactions
- Client: React rendering with Zustand store (no race conditions via atomic Map updates), Konva RAF loop
- Race condition prevention: SQLite transactions guarantee graph consistency, version tracking ensures delta ordering

---

*Architecture analysis: 2026-03-16*
