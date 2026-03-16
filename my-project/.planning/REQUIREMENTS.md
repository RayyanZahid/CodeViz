# Requirements: ArchLens

**Defined:** 2026-03-15
**Core Value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: System uses a TypeScript monorepo with shared types between backend and frontend
- [x] **FOUND-02**: SQLite database with WAL mode stores graph nodes, edges, change events, and layout positions
- [x] **FOUND-03**: Drizzle ORM manages database schema and migrations
- [x] **FOUND-04**: Fastify v5 serves as the backend HTTP and WebSocket server

### File Watching

- [x] **WATCH-01**: System detects file changes in a watched directory using chokidar v5
- [x] **WATCH-02**: File change events are debounced (200ms window) and batched before processing
- [x] **WATCH-03**: Duplicate events for the same file within a batch window are coalesced
- [x] **WATCH-04**: System watches for create, modify, and delete events across the project tree

### Parsing

- [x] **PARSE-01**: System parses TypeScript and JavaScript files using tree-sitter with incremental parsing
- [x] **PARSE-02**: System parses Python files using tree-sitter with incremental parsing
- [x] **PARSE-03**: Parser extracts imports, exports, and call relationships from ASTs
- [x] **PARSE-04**: Parsing runs in worker threads to avoid blocking the main event loop
- [x] **PARSE-05**: Parse trees are explicitly disposed after extraction to prevent memory leaks
- [x] **PARSE-06**: Incremental parsing reuses previous tree state for modified files (tree.edit API)

### Dependency Graph

- [x] **GRAPH-01**: System maintains an in-memory directed dependency graph using @dagrejs/graphlib
- [x] **GRAPH-02**: Graph updates are incremental — only changed nodes and edges are recomputed
- [x] **GRAPH-03**: System computes graph deltas (added/removed nodes and edges) after each parse batch
- [x] **GRAPH-04**: Graph state is persisted to SQLite via write-through on every update
- [x] **GRAPH-05**: System detects circular dependencies in the graph

### Architectural Inference

- [x] **ARCH-01**: System classifies components into semantic zones (frontend, API, services, data stores, infrastructure, external) using multi-signal heuristics
- [x] **ARCH-02**: Zone classification uses file path patterns, import topology, and framework-specific signals
- [x] **ARCH-03**: System detects architectural events: component created, component split, component merged, dependency added, dependency removed
- [x] **ARCH-04**: Architectural events require multiple corroborating signals before firing (confidence threshold)
- [x] **ARCH-05**: System detects risk signals: circular dependencies, boundary violations (e.g., controller accessing DB directly), excessive fan-out
- [x] **ARCH-06**: User can override zone assignments via a configuration file (.archlens.json)

### WebSocket Streaming

- [x] **WS-01**: Backend streams graph deltas to frontend via WebSocket in real-time
- [x] **WS-02**: WebSocket messages contain only deltas (added/removed/updated nodes and edges), not full graph state
- [x] **WS-03**: Messages include version tags for ordering and deduplication
- [x] **WS-04**: Client reconnects automatically and recovers state from last known version without re-layout

### Canvas Rendering

- [x] **REND-01**: Architecture map renders on an HTML5 Canvas using Konva
- [x] **REND-02**: User can zoom and pan the architecture map smoothly
- [x] **REND-03**: Rendering uses viewport culling — only visible nodes are drawn
- [x] **REND-04**: Canvas uses layer separation: static graph layer and animation overlay layer
- [x] **REND-05**: Renderer subscribes to state store imperatively, not through React re-renders
- [x] **REND-06**: Map renders at 60fps with 300 nodes and active animations on mid-range hardware

### Layout

- [x] **LAYOUT-01**: Nodes are positioned in semantic zones: frontend (left), API (center-left), services (center), data stores (right), external (outer ring), infrastructure (bottom)
- [x] **LAYOUT-02**: Existing nodes maintain their coordinates when the graph updates (sticky positions)
- [x] **LAYOUT-03**: New nodes are placed near related nodes within their assigned zone
- [x] **LAYOUT-04**: The graph never performs a full reshuffle — only local adjustments for new nodes

### Activity & Interaction

- [x] **UI-01**: Activity feed displays architectural changes in natural language (e.g., "Created AuthService", "API now depends on AuthService")
- [x] **UI-02**: Activity feed shows architectural-level events only, not individual file changes
- [x] **UI-03**: Active components glow or pulse to indicate where the agent is currently working
- [x] **UI-04**: Glow/pulse animations decay after 30 seconds of inactivity
- [x] **UI-05**: User can click any node to inspect details: affected files, dependencies, recent changes
- [x] **UI-06**: Risk panel displays architectural warnings (circular deps, boundary violations, fan-out)
- [x] **UI-07**: Risk panel shows only new risks prominently; reviewed risks are dimmed

### Persistence

- [x] **PERS-01**: Graph state persists across process restarts
- [x] **PERS-02**: Layout positions are cached in the database and restored on startup
- [x] **PERS-03**: Change events are logged in an append-only table for future time-travel support

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Time-Travel Replay

- **REPLAY-01**: User can scrub through architecture evolution over time via a slider control
- **REPLAY-02**: System creates periodic graph snapshots to bound replay reconstruction time
- **REPLAY-03**: Replay restores both graph state and layout positions at any point in time

### Intent Inference

- **INTENT-01**: System infers agent objectives from patterns in code changes (file groupings, commit messages)
- **INTENT-02**: Intent panel displays inferred goal and active subtasks
- **INTENT-03**: Intent inference provides confidence levels for inferred objectives

### Additional Languages

- **LANG-01**: System parses Go files using tree-sitter
- **LANG-02**: System parses Rust files using tree-sitter

### Export

- **EXPORT-01**: User can export the current architecture map as SVG or PNG screenshot

## Out of Scope

| Feature | Reason |
|---------|--------|
| Manual node drag-and-drop | Conflicts with semantic zone layout; creates position override complexity |
| IDE extensions (VS Code, Cursor) | Agent-agnostic file watcher approach is more durable; no IDE lock-in |
| AI-generated architectural suggestions | LLM calls add latency/cost; observation is the core value, not prescription |
| Cloud deployment / SaaS | Source code must not leave developer's machine |
| Multi-user collaboration | Single-user local app; scope explosion for v1 |
| Mobile app | Desktop-only local web app |
| OAuth / user authentication | Single-user local app; no auth needed |
| Plugin/extension API | Internal event system must stabilize first |
| Go and Rust language support | Tree-sitter grammars exist; add in v2 on demand |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| WATCH-01 | Phase 2 | Complete |
| WATCH-02 | Phase 2 | Complete |
| WATCH-03 | Phase 2 | Complete |
| WATCH-04 | Phase 2 | Complete |
| PARSE-01 | Phase 2 | Complete |
| PARSE-02 | Phase 2 | Complete |
| PARSE-03 | Phase 2 | Complete |
| PARSE-04 | Phase 2 | Complete |
| PARSE-05 | Phase 2 | Complete |
| PARSE-06 | Phase 2 | Complete |
| GRAPH-01 | Phase 3 | Complete |
| GRAPH-02 | Phase 3 | Complete |
| GRAPH-03 | Phase 3 | Complete |
| GRAPH-04 | Phase 3 | Complete |
| GRAPH-05 | Phase 3 | Complete |
| ARCH-01 | Phase 4 | Complete |
| ARCH-02 | Phase 4 | Complete |
| ARCH-03 | Phase 4 | Complete |
| ARCH-04 | Phase 4 | Complete |
| ARCH-05 | Phase 4 | Complete |
| ARCH-06 | Phase 4 | Complete |
| WS-01 | Phase 5 | Complete |
| WS-02 | Phase 5 | Complete |
| WS-03 | Phase 5 | Complete |
| WS-04 | Phase 5 | Complete |
| REND-01 | Phase 6 | Complete |
| REND-02 | Phase 6 | Complete |
| REND-03 | Phase 6 | Complete |
| REND-04 | Phase 6 | Complete |
| REND-05 | Phase 6 | Complete |
| REND-06 | Phase 6 | Complete |
| LAYOUT-01 | Phase 6 | Complete |
| LAYOUT-02 | Phase 6 | Complete |
| LAYOUT-03 | Phase 6 | Complete |
| LAYOUT-04 | Phase 6 | Complete |
| UI-01 | Phase 7 | Complete |
| UI-02 | Phase 7 | Complete |
| UI-03 | Phase 7 | Complete |
| UI-04 | Phase 7 | Complete |
| UI-05 | Phase 7 | Complete |
| UI-06 | Phase 7 | Complete |
| UI-07 | Phase 7 | Complete |
| PERS-01 | Phase 1 | Complete |
| PERS-02 | Phase 1 | Complete |
| PERS-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
