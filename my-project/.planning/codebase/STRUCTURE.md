# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
my-project/
├── packages/
│   ├── server/                 # Fastify server, file watching, parsing, graph analysis
│   │   ├── src/
│   │   │   ├── db/             # SQLite schema, connection, repositories
│   │   │   ├── graph/          # DependencyGraph, GraphPersistence, ComponentAggregator
│   │   │   ├── inference/      # InferenceEngine, ZoneClassifier, RiskDetector, ConfigLoader
│   │   │   ├── parser/         # ParserPool, worker.ts, language extractors
│   │   │   ├── pipeline/       # Pipeline orchestrator
│   │   │   ├── plugins/        # Fastify plugins: health, websocket, snapshot
│   │   │   ├── watcher/        # FileWatcher using chokidar
│   │   │   └── index.ts        # Server entry point
│   │   ├── dist/               # Compiled output and worker bundles
│   │   └── package.json
│   │
│   ├── client/                 # React/Konva app, canvas renderers, UI panels
│   │   ├── src/
│   │   │   ├── canvas/         # Konva rendering (ArchCanvas, NodeRenderer, EdgeRenderer, etc.)
│   │   │   ├── layout/         # IncrementalPlacer, zone configuration
│   │   │   ├── minimap/        # MinimapStage component
│   │   │   ├── panels/         # UI panels: NodeInspector, RiskPanel, ActivityFeed
│   │   │   ├── store/          # Zustand stores: graphStore, inferenceStore
│   │   │   ├── utils/          # viewport.ts (localStorage), eventSentence.ts
│   │   │   ├── ws/             # WsClient WebSocket manager
│   │   │   ├── schemas/        # Zod validation schemas (serverMessages)
│   │   │   ├── types/          # TypeScript ambient declarations
│   │   │   ├── App.tsx         # Root component (two-column layout)
│   │   │   └── main.tsx        # Entry point (WsClient singleton)
│   │   └── package.json
│   │
│   └── shared/                 # Shared type definitions and constants
│       ├── src/types/          # TypeScript types (graph, parser, inference, messages, etc.)
│       └── package.json
│
├── .planning/                  # Phase documentation and codebase analysis
│   ├── codebase/               # Architecture, structure, conventions, testing, concerns
│   └── phases/                 # Individual phase implementation plans
│
└── package.json                # Root monorepo config (pnpm workspaces)
```

## Directory Purposes

**`packages/server/src/`:**
- Purpose: Server-side logic for file watching, parsing, graph building, and inference
- Contains: TypeScript source files
- Key files: `index.ts` (entry), `pipeline/Pipeline.ts` (orchestrator), `graph/DependencyGraph.ts` (core model)

**`packages/server/src/db/`:**
- Purpose: SQLite schema, connection management, and typed data repositories
- Contains: `schema.ts` (Drizzle schema), `connection.ts` (better-sqlite3 setup), `repository/*` (typed queries)
- Tables: graph_nodes, graph_edges, changeEvents, layoutPositions

**`packages/server/src/graph/`:**
- Purpose: In-memory graph model and persistence layer
- Contains: `DependencyGraph.ts` (main graph logic), `GraphPersistence.ts` (atomic delta writes), `ComponentAggregator.ts` (component-level snapshots)
- Depends on: @dagrejs/graphlib, Drizzle ORM

**`packages/server/src/inference/`:**
- Purpose: Architectural analysis and risk detection
- Contains: Zone classifier, cycle/boundary/fan-out detectors, event corroborator, config loader
- Pattern: Stateless analyzers that read from graph and SQLite

**`packages/server/src/parser/`:**
- Purpose: Parse source files and extract dependencies
- Contains: `ParserPool.ts` (worker pool wrapper), `worker.ts` (tree-sitter worker), `extractors/*` (language-specific)
- Workers run in separate threads via Piscina

**`packages/server/src/watcher/`:**
- Purpose: File system monitoring and event batching
- Contains: `FileWatcher.ts` (chokidar wrapper with debounce and ignore patterns)
- Ignored: node_modules, .git, dist, __pycache__, etc.

**`packages/server/src/plugins/`:**
- Purpose: Fastify plugin modules
- Contains: `health.ts` (liveness check), `websocket.ts` (streaming), `snapshot.ts` (reconnect recovery)

**`packages/client/src/`:**
- Purpose: React application with interactive canvas
- Contains: React components, Konva renderers, Zustand stores, WebSocket client

**`packages/client/src/canvas/`:**
- Purpose: Low-level Konva rendering and viewport management
- Contains: `ArchCanvas.tsx` (orchestrator), imperative renderers (NodeRenderer, EdgeRenderer, ZoneRenderer), `CullingIndex.ts` (viewport optimization), `AnimationQueue.ts` (glow effects)
- Pattern: Imperative Konva shapes with Zustand subscriptions (not React re-renders)

**`packages/client/src/layout/`:**
- Purpose: Layout algorithms and zone configuration
- Contains: `IncrementalPlacer.ts` (d3-force sticky layout), `ZoneConfig.ts` (constants: canvas size, zone positions)

**`packages/client/src/store/`:**
- Purpose: Client state management via Zustand
- Contains: `graphStore.ts` (nodes/edges/version/connection), `inferenceStore.ts` (risks/events/active nodes)

**`packages/client/src/panels/`:**
- Purpose: Right sidebar UI components
- Contains: `NodeInspector.tsx` (node details + dependencies), `RiskPanel.tsx` (risks + thresholds), `ActivityFeed.tsx` (events timeline)

**`packages/shared/src/types/`:**
- Purpose: Shared type definitions and wire format contracts
- Contains: `graph.ts`, `parser.ts`, `messages.ts`, `inference.ts`, `events.ts`, `watcher.ts`
- Pattern: Zod schemas for validation, TypeScript types for compile-time safety

## Key File Locations

**Entry Points:**
- `packages/server/src/index.ts`: Server initialization (Fastify setup, graph load, plugin registration)
- `packages/client/src/main.tsx`: Client initialization (WsClient singleton, React mount)

**Configuration:**
- `packages/server/package.json`: Dev/build scripts, dependencies
- `packages/client/vite.config.ts`: Vite bundler configuration
- `packages/server/drizzle.config.ts`: Drizzle ORM migrations config
- `.archlens.json`: Project root config (zone overrides, ignored paths) — loaded by InferenceEngine

**Core Logic:**
- `packages/server/src/graph/DependencyGraph.ts`: In-memory graph model, delta computation
- `packages/server/src/pipeline/Pipeline.ts`: Orchestrator (FileWatcher → Parser → Graph)
- `packages/server/src/inference/InferenceEngine.ts`: Zone classification, risk detection
- `packages/client/src/canvas/ArchCanvas.tsx`: Konva canvas orchestrator
- `packages/client/src/store/graphStore.ts`: Client-side graph state

**Testing:**
- Not detected (no test files found)

## Naming Conventions

**Files:**
- PascalCase for classes and component exports: `DependencyGraph.ts`, `ArchCanvas.tsx`, `NodeRenderer.ts`
- camelCase for utilities and modules: `pipeline.ts`, `viewport.ts`, `wsClient.ts`
- `.d.ts` for TypeScript declarations
- `.schema.ts` for Zod schema definitions

**Directories:**
- Lowercase, plural for feature areas: `parser/`, `extractors/`, `panels/`, `repositories/`
- Descriptive names matching primary export: `canvas/` contains ArchCanvas and related renderers

**Imports:**
- Absolute imports with path aliases (e.g., `import { DependencyGraph } from '../graph/DependencyGraph.js'`)
- Explicit `.js` extensions in import statements (ESM compatibility)
- Namespace imports for enums/types: `import type { GraphNode } from '@archlens/shared/types'`

**Types:**
- PascalCase for types: `GraphNode`, `GraphDelta`, `ParseResult`
- Interface prefix rarely used; prefer plain type names
- Enum values: `NodeType.SERVICE_MODULE`, `ChangeEventType.ZONE_CHANGED`

## Where to Add New Code

**New Feature (e.g., cycle detection visualization):**
- Primary code: `packages/server/src/inference/` (analysis logic) + `packages/client/src/canvas/` (rendering)
- Tests: Not established; would go in parallel `*.test.ts` files
- Types: Add to `packages/shared/src/types/inference.ts`
- Example: New risk detector goes in `RiskDetector.ts`, new canvas layer goes in new renderer class

**New Component/Module:**
- React components: `packages/client/src/panels/` or `packages/client/src/canvas/` depending on purpose
- Server features: `packages/server/src/{feature}/` following the layer pattern
- Worker/parsing logic: `packages/server/src/parser/extractors/{language}.ts`
- Example: New sidebar panel goes in `packages/client/src/panels/NewPanel.tsx`

**Utilities & Helpers:**
- Shared helpers: `packages/shared/src/` (types only; no runtime code)
- Server utilities: `packages/server/src/utils/` (if created; currently logic is layer-specific)
- Client utilities: `packages/client/src/utils/` (viewport.ts, eventSentence.ts patterns)
- Example: New viewport utility goes in `packages/client/src/utils/newHelper.ts`

**New Language Support:**
- Add extractor: `packages/server/src/parser/extractors/{language}.ts`
- Register in Pipeline.detectLanguage(): `packages/server/src/pipeline/Pipeline.ts` (EXTENSION_TO_LANGUAGE map)
- Tree-sitter grammar: Add to `packages/server/package.json` dependencies

## Special Directories

**`packages/server/dist/`:**
- Purpose: Compiled JavaScript and type declarations
- Generated: Yes (via `tsc` and `build:workers`)
- Committed: No (git-ignored)
- Worker bundles: `dist/parser/worker-cjs.cjs` (CommonJS wrapper for tree-sitter worker thread)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via pnpm install)
- Committed: No (git-ignored)

**`.planning/`:**
- Purpose: GSD documentation and phase plans
- Committed: Yes (shared with team)
- Subdirs: `codebase/` (ARCHITECTURE.md, STRUCTURE.md, etc.), `phases/` (implementation plans)

**`.auto-gsd/`:**
- Purpose: GSD orchestrator logs and telemetry
- Generated: Yes (at runtime)
- Committed: No (git-ignored)

## Import Patterns

**Server:**
```typescript
// Absolute paths with .js extensions
import { DependencyGraph } from '../graph/DependencyGraph.js';
import type { GraphDelta, NodeMetadata } from '@archlens/shared/types';
import { db } from '../db/connection.js';
```

**Client:**
```typescript
// Absolute paths, mix of .tsx and .ts
import { ArchCanvas } from './canvas/ArchCanvas.js';
import { graphStore } from './store/graphStore.js';
import type { GraphNode } from '@archlens/shared/types';
```

**Shared:**
```typescript
// Only type definitions, no runtime exports
export type GraphNode = { id: string; zone?: string | null; /* ... */ };
export const NodeType = { /* ... */ } as const;
```

---

*Structure analysis: 2026-03-16*
