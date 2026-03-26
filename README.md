# CodeViz (ArchLens)

> "Real-time architecture visualization — see your codebase breathe"

**Live Site:** [https://codeviz-iota.vercel.app](https://codeviz-iota.vercel.app)

**Real-time architecture visualization for AI coding agents — like air traffic control for software architecture.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Node](https://img.shields.io/badge/node-22%20LTS-green.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.8-blue.svg)]()
[![pnpm](https://img.shields.io/badge/pnpm-10-orange.svg)]()

---

## The Problem

AI coding agents write code faster than humans can read. When an agent is building or refactoring a system, a human supervisor has no way to understand:

- **What** the agent is trying to accomplish
- **Where** in the system it's working
- **How** the architecture is evolving
- **Whether** risky structural changes are happening

Reading raw file diffs at machine speed is impossible. Developers need **architectural situational awareness**, not line-by-line code review.

## The Solution

**ArchLens** watches your codebase in real time, parses every change, builds a live dependency graph, infers architectural meaning, and renders an interactive 2D architecture map — all within ~2 seconds of a file save.

It transforms low-level code edits into high-level architectural events that humans can understand at a glance.

```
File Change → Watch → Parse → Graph → Inference → WebSocket → Canvas + Panels
```

---

## Demo

```
┌─────────────────────────────────────────────┬──────────────────────────┐
│                                             │  Activity Feed           │
│        ┌──────────┐    ┌──────────┐         │  ● Created AuthService   │
│        │ Frontend │───▶│   API    │         │  ● API → AuthService     │
│        └──────────┘    └────┬─────┘         │  ● Split PaymentService  │
│                             │               │                          │
│                        ┌────▼─────┐         ├──────────────────────────┤
│                        │ Services │         │  Risk Panel              │
│                        └────┬─────┘         │  🔴 Circular dependency  │
│                             │               │  🟠 Boundary violation   │
│                        ┌────▼─────┐         │                          │
│                        │  Data    │         ├──────────────────────────┤
│                        │  Stores  │         │  Node Inspector          │
│                        └──────────┘         │  AuthService             │
│                                             │  Zone: services          │
│        [infrastructure / queues / workers]   │  Files: 3                │
│                                             │  Dependencies: 5         │
└─────────────────────────────────────────────┴──────────────────────────┘
```

---

## Key Features

### Real-Time Architecture Map
- **2D canvas** rendered with Konva at 60fps
- **Semantic zones**: Frontend → API → Services → Data Stores → Infrastructure
- **Sticky layout**: nodes maintain position — the map never reshuffles
- **Zoom, pan, and minimap** for navigating large architectures
- **Viewport culling** via quadtree spatial indexing for smooth performance at scale

### Live Activity Feed
- Natural language narration of architectural changes
- "Claude created AuthMiddleware"
- "API now depends on PaymentGateway"
- "Split PaymentService into BillingService"

### Architectural Risk Detection
Three categories of risk, detected automatically:
| Risk | Severity | Description |
|------|----------|-------------|
| **Circular Dependency** | Critical | Cycle detected in the dependency graph |
| **Boundary Violation** | Warning | Layer-skipping imports (e.g., frontend directly accessing data stores) |
| **Excessive Fan-Out** | Warning | A module with > 8 internal dependencies |

### Intelligent Zone Classification
Every module is automatically classified into an architectural zone using a multi-signal approach:

1. **Config override** (`.archlens.json`) — highest priority, user-defined
2. **Path patterns** — regex matching against common conventions (`/components/` → frontend, `/routes/` → api, etc.)
3. **Topology voting** — unclassified nodes inherit the majority zone of their neighbors

### Incremental Everything
- **Parsing**: Tree-sitter incremental parse trees — only re-parses what changed (~70% faster than full parse)
- **Graph updates**: Delta computation with 50ms consolidation window
- **WebSocket**: Delta-only push with version tracking — no full-state retransmission
- **Layout**: D3-force with pinned existing nodes — only new nodes are placed

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Your Codebase                │
                    │   (watched by chokidar v5)           │
                    └──────────────┬──────────────────────┘
                                   │ file events (200ms debounce)
                    ┌──────────────▼──────────────────────┐
                    │          Parser Pool                  │
                    │  (tree-sitter in piscina workers)     │
                    │  TypeScript · JavaScript · Python     │
                    └──────────────┬──────────────────────┘
                                   │ imports, exports, calls
                    ┌──────────────▼──────────────────────┐
                    │       Dependency Graph                │
                    │  (graphlib, cycle detection,          │
                    │   50ms consolidation, delta emit)     │
                    └──────────────┬──────────────────────┘
                                   │ GraphDelta v.N
              ┌────────────────────┼────────────────────┐
              │                    │                     │
  ┌───────────▼──────┐  ┌─────────▼────────┐  ┌────────▼─────────┐
  │ Zone Classifier   │  │ Event Corroborator│  │  Risk Detector   │
  │ (path + topology  │  │ (threshold=2,     │  │  (cycles,        │
  │  + config)        │  │  multi-signal)    │  │   boundaries,    │
  │                   │  │                   │  │   fan-out)       │
  └───────────┬──────┘  └─────────┬────────┘  └────────┬─────────┘
              │                    │                     │
              └────────────────────┼────────────────────┘
                                   │ InferenceResult
                    ┌──────────────▼──────────────────────┐
                    │      SQLite Persistence               │
                    │  (WAL mode, append-only events,       │
                    │   graph state, layout positions)       │
                    └──────────────┬──────────────────────┘
                                   │ WebSocket broadcast
                    ┌──────────────▼──────────────────────┐
                    │      Fastify Server (:3100)           │
                    │  /ws      — WebSocket streaming       │
                    │  /snapshot — Full state recovery       │
                    │  /health  — Health check               │
                    └──────────────┬──────────────────────┘
                                   │ ws://localhost:3100/ws
                    ┌──────────────▼──────────────────────┐
                    │        React Frontend                 │
                    │                                       │
                    │  ┌─────────┐ ┌──────────────────┐    │
                    │  │ Konva   │ │ Zustand Stores    │    │
                    │  │ Canvas  │ │ (graph + inference)│    │
                    │  └─────────┘ └──────────────────┘    │
                    │                                       │
                    │  ┌──────────┬──────────┬───────────┐ │
                    │  │Activity  │  Risk    │  Node     │ │
                    │  │Feed     │  Panel   │  Inspector│ │
                    │  └──────────┴──────────┴───────────┘ │
                    └──────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Monorepo** | pnpm workspaces | Package management |
| **Server** | Node.js 22, Fastify 5 | HTTP + WebSocket server |
| **Parsing** | tree-sitter 0.21.1, piscina | Incremental AST parsing in worker threads |
| **Graph** | @dagrejs/graphlib | In-memory dependency graph with cycle detection |
| **Inference** | Custom engine | Zone classification, event corroboration, risk detection |
| **Database** | better-sqlite3, Drizzle ORM | Persistent state with WAL mode |
| **Frontend** | React 19, Vite 8 | UI framework and dev server |
| **Canvas** | Konva, react-konva | Hardware-accelerated 2D rendering |
| **Layout** | D3-force | Force-directed graph layout with zone constraints |
| **State** | Zustand | Lightweight reactive state management |
| **Validation** | Zod | Runtime message validation |
| **Language** | TypeScript 5.8 | End-to-end type safety |

---

## Project Structure

```
my-project/
├── packages/
│   ├── server/                    # Backend — the brain
│   │   └── src/
│   │       ├── index.ts           # Entry point, Fastify setup
│   │       ├── watcher/           # File system change detection (chokidar)
│   │       │   └── FileWatcher.ts
│   │       ├── parser/            # Tree-sitter incremental parsing
│   │       │   ├── ParserPool.ts  # Piscina worker pool manager
│   │       │   ├── worker.ts      # Worker thread (tree-sitter runtime)
│   │       │   └── extractors/    # Language-specific AST extractors
│   │       │       ├── typescript.ts
│   │       │       ├── javascript.ts
│   │       │       └── python.ts
│   │       ├── graph/             # Dependency graph engine
│   │       │   ├── DependencyGraph.ts   # In-memory graph + delta computation
│   │       │   └── GraphPersistence.ts  # SQLite read/write
│   │       ├── inference/         # Architectural intelligence
│   │       │   ├── InferenceEngine.ts   # Orchestrator
│   │       │   ├── ZoneClassifier.ts    # Multi-signal zone assignment
│   │       │   ├── EventCorroborator.ts # Architectural event detection
│   │       │   ├── RiskDetector.ts      # Risk signal analysis
│   │       │   └── ConfigLoader.ts      # .archlens.json live reload
│   │       ├── pipeline/          # Watcher → Parser → Graph orchestration
│   │       │   └── Pipeline.ts
│   │       ├── db/                # SQLite persistence layer
│   │       │   ├── connection.ts  # better-sqlite3 + Drizzle setup
│   │       │   ├── schema.ts      # Table definitions
│   │       │   └── repository/    # CRUD operations per table
│   │       └── plugins/           # Fastify route plugins
│   │           ├── health.ts      # GET /health
│   │           ├── snapshot.ts    # GET /snapshot (full state recovery)
│   │           └── websocket.ts   # WebSocket upgrade + broadcast
│   │
│   ├── client/                    # Frontend — the eyes
│   │   └── src/
│   │       ├── main.tsx           # Entry point, WsClient singleton
│   │       ├── App.tsx            # Root layout (canvas + sidebar)
│   │       ├── canvas/            # Konva rendering engine
│   │       │   ├── ArchCanvas.tsx       # Main canvas orchestrator
│   │       │   ├── NodeRenderer.ts      # Node shapes + colors by zone
│   │       │   ├── EdgeRenderer.ts      # Dependency arrows
│   │       │   ├── ZoneRenderer.ts      # Background zone rectangles
│   │       │   ├── AnimationQueue.ts    # 30s glow decay for active nodes
│   │       │   ├── CullingIndex.ts      # Quadtree viewport culling
│   │       │   └── ViewportController.ts# Zoom, pan, fit-to-view
│   │       ├── layout/            # Graph layout engine
│   │       │   ├── IncrementalPlacer.ts # D3-force with sticky positions
│   │       │   └── ZoneConfig.ts        # Zone bounds and canvas dimensions
│   │       ├── panels/            # React UI panels
│   │       │   ├── ActivityFeed.tsx      # Natural language event stream
│   │       │   ├── RiskPanel.tsx         # Architectural warnings
│   │       │   └── NodeInspector.tsx     # Click-to-drill node details
│   │       ├── minimap/           # Overview minimap
│   │       │   └── MinimapStage.tsx
│   │       ├── store/             # Zustand state
│   │       │   ├── graphStore.ts        # Nodes, edges, version
│   │       │   └── inferenceStore.ts    # Activity feed, risks, active nodes
│   │       ├── ws/                # WebSocket client
│   │       │   └── wsClient.ts          # Reconnect, batching, validation
│   │       ├── schemas/           # Zod message validation
│   │       │   └── serverMessages.ts
│   │       └── utils/             # Helpers
│   │           ├── eventSentence.ts     # Event → natural language
│   │           └── viewport.ts          # localStorage persistence
│   │
│   └── shared/                    # Shared type definitions
│       └── src/types/
│           ├── index.ts           # Re-export barrel
│           ├── graph.ts           # GraphNode, GraphEdge, NodeType, EdgeType
│           ├── graph-delta.ts     # GraphDelta, CycleSeverity, NodeMetadata
│           ├── events.ts          # ChangeEvent, ChangeEventType
│           ├── inference.ts       # ZoneName, RiskType, ArchitecturalEventType
│           ├── messages.ts        # WebSocket message schemas
│           ├── parser.ts          # ParseTask, ParseResult, SupportedLanguage
│           └── watcher.ts         # FileWatchBatch types
│
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── idea.md                        # Original project vision document
```

---

## Getting Started

### Prerequisites

- **Node.js 22 LTS** (required for chokidar v5 and native modules)
- **pnpm 10** (`npm install -g pnpm`)
- A C++ toolchain for native module compilation (tree-sitter, better-sqlite3):
  - **Windows**: `npm install -g windows-build-tools` or install Visual Studio Build Tools
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt install build-essential python3`

### Installation

```bash
# Clone the repository
git clone https://github.com/RayyanZahid/CodeViz.git
cd CodeViz/my-project

# Install dependencies
pnpm install

# Build the worker threads (required before first run)
pnpm build:workers
```

### Running

```bash
# Start both server and client in development mode
pnpm dev
```

This launches:
- **Backend** on `http://localhost:3100` (Fastify + WebSocket)
- **Frontend** on `http://localhost:5173` (Vite dev server)

By default, ArchLens watches the current working directory. To watch a different project:

```bash
ARCHLENS_WATCH_ROOT=/path/to/your/project pnpm dev
```

Then open `http://localhost:5173` in your browser.

---

## Configuration

### Zone Overrides (`.archlens.json`)

Place an `.archlens.json` file in the root of the watched project to override automatic zone classification:

```json
{
  "zones": [
    { "glob": "src/auth/**", "zone": "api" },
    { "glob": "src/db/**", "zone": "data-stores" },
    { "glob": "src/workers/**", "zone": "infrastructure" },
    { "glob": "lib/external/**", "zone": "external" }
  ]
}
```

Available zones: `frontend`, `api`, `services`, `data-stores`, `infrastructure`, `external`

The config file is live-reloaded — changes take effect on the next file change event.

### Zone Classification Rules

ArchLens uses a priority-based classification system:

| Priority | Method | Example |
|----------|--------|---------|
| 1 (highest) | `.archlens.json` glob | `"src/auth/**" → api` |
| 2 | Path pattern matching | `/components/` → frontend, `/routes/` → api |
| 3 (lowest) | Topology voting | Majority zone of connected neighbors |

**Built-in path patterns:**

| Zone | Matched Paths |
|------|--------------|
| `frontend` | components, pages, views, ui, screens, layouts, hooks, contexts, `.tsx`/`.jsx` files |
| `api` | routes, controllers, handlers, endpoints, api, middleware |
| `services` | services, use-cases, business, domain, application |
| `data-stores` | repositories, models, entities, schemas, migrations, db, database, prisma, drizzle |
| `infrastructure` | config, infra, setup, bootstrap, server, workers, jobs, queues, cron, plugins, utils, helpers, lib |

---

## Data Model

### Database Schema (SQLite)

```sql
-- Architectural components (one per source file)
graph_nodes (
  id            TEXT PRIMARY KEY,    -- file path
  name          TEXT,                -- display name
  node_type     TEXT,                -- SERVICE_MODULE | COMPONENT_PAGE | DATA_STORE | EXTERNAL_API
  zone          TEXT,                -- frontend | api | services | data-stores | infrastructure | external
  file_list     JSON,                -- affected file paths
  incoming_edge_count  INTEGER,
  outgoing_edge_count  INTEGER,
  last_modified TIMESTAMP,
  created_at    TIMESTAMP
)

-- Dependencies between components
graph_edges (
  id        TEXT PRIMARY KEY,        -- "sourceId->targetId"
  sourceId  TEXT REFERENCES graph_nodes,
  targetId  TEXT REFERENCES graph_nodes,
  edge_type TEXT,                    -- IMPORTS_DEPENDS_ON | CALLS_INVOKES | READS_WRITES | PUBLISHES_SUBSCRIBES
  created_at TIMESTAMP
)

-- Append-only audit log (foundation for time-travel replay)
change_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT,                   -- NODE_ADDED | NODE_REMOVED | NODE_UPDATED | EDGE_ADDED | EDGE_REMOVED | ZONE_CHANGED
  payload    JSON,
  timestamp  TIMESTAMP
)

-- Sticky node positions for layout stability
layout_positions (
  node_id    TEXT PRIMARY KEY REFERENCES graph_nodes,
  x          REAL,
  y          REAL,
  zone       TEXT,
  updated_at TIMESTAMP
)
```

---

## How It Works — End to End

Here's what happens when an AI agent (or any developer) saves a file:

```
1. FILE SAVED
   └─▶ chokidar detects the change
       └─▶ 200ms debounce window collects related changes

2. BATCH DISPATCHED
   └─▶ Pipeline reads file contents from disk
       └─▶ Creates ParseTasks with detected language
           └─▶ Sends to piscina worker pool

3. PARSED
   └─▶ Tree-sitter incrementally parses the AST
       └─▶ Extractors pull: imports, exports, function calls
           └─▶ Returns ParseResult to main thread

4. GRAPH UPDATED
   └─▶ DependencyGraph applies changes to graphlib
       └─▶ 50ms consolidation window batches rapid changes
           └─▶ Computes delta: added/removed/modified nodes & edges
               └─▶ Detects cycle changes
                   └─▶ Persists to SQLite

5. INFERENCE RUN
   ├─▶ ZoneClassifier assigns zones (path → topology → config)
   ├─▶ EventCorroborator detects architectural events (threshold=2)
   └─▶ RiskDetector checks for violations

6. BROADCAST
   └─▶ WebSocket sends GraphDeltaMessage + InferenceMessage
       └─▶ Version-tagged for gap detection

7. RENDERED
   ├─▶ Zustand stores updated (graph + inference)
   ├─▶ Konva canvas redraws affected nodes/edges
   ├─▶ New nodes placed by D3-force (existing nodes pinned)
   ├─▶ Active nodes glow (30s decay)
   ├─▶ Activity feed shows natural language description
   └─▶ Risk panel surfaces any warnings

Total: file save → visual update in < 2 seconds
```

---

## Supported Languages

| Language | Extensions | Parser |
|----------|-----------|--------|
| TypeScript | `.ts`, `.tsx` | tree-sitter-typescript |
| JavaScript | `.js`, `.jsx` | tree-sitter-javascript |
| Python | `.py` | tree-sitter-python |

Additional languages can be added by creating a new extractor in `packages/server/src/parser/extractors/` and registering it in the worker.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ws` | WebSocket | Real-time delta streaming |
| `/snapshot` | GET | Full graph state for reconnect recovery |
| `/health` | GET | Server health check → `{ status: "ok" }` |

### WebSocket Messages

**Server → Client:**

| Type | Description |
|------|-------------|
| `graph_delta` | Incremental graph changes (added/removed/modified nodes & edges, cycles) |
| `inference` | Zone updates, architectural events, risk signals |
| `initial_state` | Full snapshot (sent on connect or version gap) |
| `error` | Error notification |

---

## Design Principles

1. **Never visualize raw file changes.** Transform code edits into architectural events.
2. **Stability over dynamism.** The map should feel like a stable reference, not a jittery animation.
3. **Clarity in seconds.** A human must understand the system state within seconds of looking at it.
4. **Incremental everything.** Parse, graph, layout, and transmit only what changed.
5. **Semantic zones.** Organize by architectural role, not file structure.
6. **Corroborate before alerting.** A single file edit never triggers an architectural event — require multiple signals.

---

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1. Foundation | Monorepo setup, SQLite schema, Fastify server, shared types | Done |
| 2. File Watching & Parsing | Chokidar watcher, tree-sitter parser pool, language extractors | Done |
| 3. Dependency Graph | Graphlib integration, delta computation, cycle detection, persistence | Done |
| 4. Architectural Inference | Zone classifier, event corroborator, risk detector, config loader | Done |
| 5. WebSocket Streaming | Delta broadcast, snapshot endpoint, client reconnect | In Progress |
| 6. Canvas Renderer | Konva canvas, zone rendering, node/edge rendering, culling, animations | Done |
| 7. React UI Shell | Activity feed, risk panel, node inspector, minimap, cross-panel navigation | Done |

---

## Performance

| Metric | Target | Implementation |
|--------|--------|---------------|
| File → visual feedback | < 2s | 200ms debounce + 50ms consolidation + delta-only updates |
| Canvas framerate | 60fps | Konva layers, quadtree culling, imperative rendering |
| Parse latency | < 50ms/file | Tree-sitter incremental parsing in worker threads |
| Graph consolidation | 50ms window | Batches rapid changes into single delta |
| Inference | < 100ms | Synchronous, O(edges) complexity |
| Max nodes (smooth) | 300+ | Viewport culling, spatial indexing |

---

## Roadmap

- [ ] **Time-travel replay** — scrub through architecture evolution over time using the append-only event log
- [ ] **Agent intent panel** — display current agent goal and subtask progress
- [ ] **Additional language support** — Go, Rust, Java, C#
- [ ] **Architecture export** — SVG/PNG snapshots, Mermaid diagram generation
- [ ] **Multi-agent tracking** — color-code changes by agent identity
- [ ] **Custom risk rules** — user-defined architectural constraints via config
- [ ] **CI integration** — architecture diff reports on pull requests

---

## Contributing

Contributions are welcome! The codebase is modular by design — each system (watcher, parser, graph, inference, renderer) can be worked on independently.

```bash
# Type-check the entire monorepo
pnpm typecheck

# Run the server in watch mode
cd packages/server && pnpm dev

# Run the client in watch mode
cd packages/client && pnpm dev
```

---

## License

MIT

---

<p align="center">
  <strong>ArchLens</strong> — See what your AI is building.
</p>
