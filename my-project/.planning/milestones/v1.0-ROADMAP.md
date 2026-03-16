# Roadmap: ArchLens

## Overview

ArchLens is built as a sequential pipeline: schema and project scaffold first, then the data input layer (file watching and parsing), then the graph and inference intelligence, then the real-time streaming layer, then the visual output (canvas renderer and layout), then the UI panels that complete the MVP. Each phase delivers a coherent, testable capability. The critical path is Foundation → Parser → Graph → Inference → WebSocket → Canvas + Layout → UI Shell, reflecting strict component dependencies where each phase's output shapes the interface contract consumed by the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - TypeScript monorepo scaffold with SQLite persistence layer and shared types (completed 2026-03-15)
- [x] **Phase 2: File Watching and Parsing Pipeline** - Agent-agnostic file change detection with incremental tree-sitter parsing (completed 2026-03-15)
- [x] **Phase 3: Dependency Graph Model** - In-memory directed graph with incremental delta computation and persistence (completed 2026-03-15)
- [x] **Phase 4: Architectural Inference Engine** - Zone classification, event detection, and risk heuristics (completed 2026-03-16)
- [ ] **Phase 5: WebSocket Streaming and Client State** - Delta streaming from backend to browser with reconnect-safe client state
- [x] **Phase 6: Canvas Renderer and Layout Engine** - High-performance Konva canvas with stable semantic zone layout (completed 2026-03-16)
- [x] **Phase 7: React UI Shell and Activity Feed** - Activity feed, risk panel, and node inspector completing the MVP (completed 2026-03-16)

## Phase Details

### Phase 1: Foundation
**Goal**: A working monorepo scaffold with shared TypeScript types, SQLite database with full schema, and a Fastify server skeleton — the foundation every other phase writes to and reads from
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. Developer can run a single command to start the backend server and it responds on localhost
  2. SQLite database is created with all tables (graph_nodes, graph_edges, change_events, layout_positions) and WAL mode is enabled
  3. Shared TypeScript types for graph events and WebSocket messages are importable from both backend and frontend packages
  4. Graph state (nodes, edges, layout positions) persists across process restarts — data written in one run is readable after restarting the server
  5. Drizzle migrations run cleanly and schema matches the defined types
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold with pnpm workspaces, TypeScript ESM config, shared types package (graph/events/messages), Vite client skeleton
- [x] 01-02-PLAN.md — SQLite connection with WAL mode, Drizzle schema for all 4 tables, repository layer with typed CRUD
- [x] 01-03-PLAN.md — Fastify v5 server entry point, health endpoint, database init on startup, pnpm dev workflow

### Phase 2: File Watching and Parsing Pipeline
**Goal**: The system detects file changes in a watched directory and produces typed parse results (imports, exports, call relationships) using incremental tree-sitter parsing — the data input layer for all downstream components
**Depends on**: Phase 1
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04, PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06
**Success Criteria** (what must be TRUE):
  1. When a file is modified in the watched directory, the system detects it and produces a parse result within 2 seconds
  2. Rapid successive edits to the same file produce exactly one parse event (debouncing and deduplication work)
  3. TypeScript, JavaScript, and Python files all parse successfully and return extracted imports, exports, and call relationships
  4. Modifying one file in a 500-file project triggers parsing of only that file — not a full re-parse of the project
  5. The main event loop remains unblocked during parsing — parsing runs in worker threads
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Install dependencies (chokidar, tree-sitter, piscina), define watcher/parser types, implement FileWatcher with debounce and batch emission
- [x] 02-02-PLAN.md — Tree-sitter parser worker with TS/JS extractors, piscina pool, incremental parse cache, worker compilation build step
- [x] 02-03-PLAN.md — Python grammar extraction, Pipeline class connecting watcher to parser pool end-to-end

### Phase 3: Dependency Graph Model
**Goal**: The system maintains an in-memory directed dependency graph that updates incrementally from parse results, computes deltas, detects circular dependencies, and persists state to SQLite — the central data structure consumed by inference and WebSocket layers
**Depends on**: Phase 2
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05
**Success Criteria** (what must be TRUE):
  1. After a file change triggers parsing, the in-memory graph updates with only the changed nodes and edges — no full rebuild
  2. The system produces a typed graph delta (added/removed nodes and edges) after each parse batch
  3. Circular dependencies in the graph are detected and flagged in the delta output
  4. Graph state is written through to SQLite on every update and can be loaded back on startup
  5. Simulating 10 rapid file changes results in a single consolidated graph diff, not 10 separate updates
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Install @dagrejs/graphlib, shared GraphDelta types, DependencyGraph class with incremental updates, delta computation, cycle detection, event emission
- [ ] 03-02-PLAN.md — GraphPersistence write-through and startup load, Pipeline-to-DependencyGraph wiring in server entry point

### Phase 4: Architectural Inference Engine
**Goal**: The system classifies file-level graph nodes into semantic zones, detects meaningful architectural events with corroboration thresholds, and identifies risk signals — the intelligence layer that transforms raw dependency data into architectural understanding
**Depends on**: Phase 3
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06
**Success Criteria** (what must be TRUE):
  1. Components in a standard Express+React project are classified into the correct semantic zones (frontend, API, services, data stores) with fewer than 20% landing in "unknown"
  2. An architectural event (component created, dependency added) fires only after multiple corroborating signals — a single file edit does not trigger an architectural event
  3. Risk signals (circular dependencies, boundary violations, excessive fan-out) are detected and included in inference output
  4. A developer can override zone assignments for misclassified components via a .archlens.json file, and the override is respected on the next analysis
  5. The inference engine produces consistent results across Next.js and Python FastAPI project structures
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Shared inference types (ZoneName, ArchitecturalEvent, RiskSignal, InferenceResult), DependencyGraph public accessors, micromatch install
- [ ] 04-02-PLAN.md — ZoneClassifier (path-first, topology-second) and ConfigLoader (.archlens.json overrides with glob matching and live reload)
- [ ] 04-03-PLAN.md — EventCorroborator (signal counter, threshold=2, 5 event types) and RiskDetector (cycle enrichment, boundary violations, fan-out)
- [ ] 04-04-PLAN.md — InferenceEngine orchestrator (delta processing pipeline) and server entry point wiring

### Phase 5: WebSocket Streaming and Client State
**Goal**: The backend streams graph deltas to the browser over WebSocket using delta-only messages with version tags, and the client applies patches to a Zustand state store with automatic reconnect recovery — the real-time connection between pipeline and visualization
**Depends on**: Phase 4
**Requirements**: WS-01, WS-02, WS-03, WS-04
**Success Criteria** (what must be TRUE):
  1. A file change in the watched directory results in a WebSocket delta message arriving in the browser within 2 seconds
  2. WebSocket messages contain only changed nodes and edges, not the full graph state
  3. Closing the browser tab mid-session and reopening it restores the full graph state from the server without triggering a re-layout
  4. The client Zustand store correctly applies delta patches and downstream consumers see an up-to-date graph after each update
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Server-side WebSocket plugin with @fastify/websocket, delta/inference broadcast, snapshot REST endpoint, shared type updates
- [ ] 05-02-PLAN.md — Client-side Zustand graphStore, WsClient with exponential backoff reconnect and 500ms batch window, Zod message validation, viewport localStorage helpers

### Phase 6: Canvas Renderer and Layout Engine
**Goal**: The architecture map renders on an HTML5 Canvas at 60fps with stable semantic zone layout, viewport culling, zoom and pan navigation, and activity overlays — the visual core of ArchLens
**Depends on**: Phase 5
**Requirements**: REND-01, REND-02, REND-03, REND-04, REND-05, REND-06, LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04
**Success Criteria** (what must be TRUE):
  1. The architecture map renders 300 nodes at 60fps with active glow animations on mid-range hardware
  2. User can zoom and pan the canvas smoothly without frame drops
  3. When the graph updates with new nodes, existing nodes stay in their positions — only new nodes are placed
  4. Nodes are visually grouped into semantic zones: frontend on the left, API center-left, services center, data stores right, infrastructure bottom
  5. Active components glow or pulse to show where the agent is working, and the glow decays after 30 seconds of inactivity
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Install React/Konva/d3-force deps, React JSX toolchain, two-layer Konva Stage, App shell, ZoneConfig constants
- [ ] 06-02-PLAN.md — NodeRenderer, EdgeRenderer, ZoneRenderer (imperative Konva shapes), CullingIndex with quadtree spatial queries
- [ ] 06-03-PLAN.md — IncrementalPlacer layout engine with d3-force, zone-constrained sticky positions, boundary forces
- [ ] 06-04-PLAN.md — AnimationQueue (glow decay), ViewportController (zoom/pan/fit), MinimapStage, full ArchCanvas integration wiring

### Phase 7: React UI Shell and Activity Feed
**Goal**: The React UI panels — activity feed, risk panel, and node inspector — connect inference output to readable user-facing interfaces, completing the MVP: a developer can glance at the screen and instantly understand what the agent is building
**Depends on**: Phase 6
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. The activity feed displays architectural changes in natural language (e.g., "Created AuthService", "API now depends on UserService") — not individual file names
  2. Clicking any node on the canvas opens an inspector panel showing affected files, dependencies, and recent changes for that node
  3. The risk panel displays active architectural warnings (circular deps, boundary violations, fan-out) and allows marking warnings as reviewed
  4. The full application runs end-to-end: point it at a TypeScript or Python project, make code changes, and watch the architecture map update in real time within 2 seconds
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — InferenceStore, WsClient wiring, eventSentence utility, and ActivityFeed panel
- [ ] 07-02-PLAN.md — NodeInspector and RiskPanel panel components
- [ ] 07-03-PLAN.md — App shell layout restructure, sidebar integration, cross-panel navigation wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-15 |
| 2. File Watching and Parsing Pipeline | 3/3 | Complete   | 2026-03-15 |
| 3. Dependency Graph Model | 2/2 | Complete   | 2026-03-15 |
| 4. Architectural Inference Engine | 4/4 | Complete   | 2026-03-16 |
| 5. WebSocket Streaming and Client State | 1/2 | In Progress|  |
| 6. Canvas Renderer and Layout Engine | 4/4 | Complete   | 2026-03-16 |
| 7. React UI Shell and Activity Feed | 3/3 | Complete   | 2026-03-16 |
