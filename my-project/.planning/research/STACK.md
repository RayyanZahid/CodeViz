# Stack Research

**Domain:** Real-time architecture visualization (local web app, code parsing, graph analysis, 2D canvas)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (core libraries verified via npm/official sources; version numbers spot-checked)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS | Backend runtime | Required by chokidar v5, Fastify v5, better-sqlite3 v12; minimum v20 for the whole stack |
| TypeScript | 5.x | End-to-end type safety | Fastify v5, Drizzle ORM, and Zustand v5 all have first-class TS support; prevents mismatched graph event shapes between backend and frontend |
| Fastify | 5.8.x | HTTP + WebSocket server | 2-4x faster than Express; first-class TS; `@fastify/websocket` plugin is official and maintained; low overhead matters for sub-2s latency target |
| @fastify/websocket | 11.x | WebSocket streaming to frontend | Built on `ws@8`; route-scoped WebSocket handlers; integrates with Fastify's plugin model; no extra wrapper needed |
| React | 19.x | Frontend UI framework | Standard choice; react-konva v19.x requires React 19; concurrent features help with streaming updates |
| Vite | 8.x | Frontend build tool | Rolldown-based (v8); replaces Create React App; instant HMR critical for development; `npm create vite@latest -- --template react-ts` |
| TypeScript | 5.x | Frontend type safety | Shared types between backend graph events and frontend canvas state |

### Parsing Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tree-sitter | 0.25.x | Node.js binding for incremental parsing | Native Node.js addon; synchronous API; built-in incremental parse via `tree.edit()` — no full re-parse on file change |
| web-tree-sitter | 0.26.x | WASM fallback (if needed in browser) | Not needed for this stack (parsing stays on backend); noted for reference only |
| tree-sitter-typescript | 0.23.x | TypeScript + TSX grammar | Official grammar maintained by tree-sitter org; covers both `.ts` and `.tsx` dialects |
| tree-sitter-python | 0.25.x | Python grammar | Official grammar; matches tree-sitter core version |

**Rationale for tree-sitter over alternatives:** tree-sitter is the only parser that provides incremental re-parsing (supply only changed byte ranges via `tree.edit()`), error recovery on broken code, and a query language (`tree-sitter queries`) for structural pattern matching. Babel/TypeScript compiler API parse whole files on every change — fatal for the 1-2 second latency target with 500-5000 file codebases.

### File Watching

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| chokidar | 5.x | Cross-platform file system watcher | ESM-only in v5; requires Node 20+; uses native `fs.watch` (not polling); handles debouncing, rename detection, and atomic write patterns from editors; ~88M downloads/week; used in Vite/webpack |

**Rationale:** Node's built-in `fs.watch` is unreliable cross-platform (especially on Windows and network drives). chokidar normalizes events and handles the common AI-agent write patterns (atomic replace, temp file swap) correctly. chokidar v5 drops glob support — use explicit path arrays or handle glob expansion separately.

### Graph Data Structure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @dagrejs/graphlib | 3.0.x | In-memory directed multigraph | The actively maintained fork (not the legacy `graphlib` package); node/edge CRUD with adjacency queries; cycles detection; serializable to JSON for SQLite persistence |
| @dagrejs/dagre | 2.0.x | Hierarchical directed graph layout | Supports incremental layout by passing prior node positions; produces stable left-to-right or top-to-bottom layered layouts; compatible with semantic zone constraints |

**Rationale for graphlib + dagre over alternatives:** This pair is the standard for dependency/architecture graphs in JS tooling. graphlib provides the raw graph model with algorithms (topological sort, cycle detection, shortest path); dagre provides a layout algorithm tuned for directed graphs — exactly what architecture dependency graphs are. Cytoscape.js bundles both visualization and graph model together (hard to separate); graphlib lets us own the graph model independently and render with Konva separately.

### Rendering Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Konva | 10.2.x | 2D Canvas rendering engine | HTML5 Canvas (not DOM); handles 20,000+ interactive nodes with hitgraph optimization; layer system for animation isolation; built-in pan/zoom via `Stage.draggable()` and scale transforms |
| react-konva | 19.2.x | React bindings for Konva | Declarative canvas components in React; matches React 19; most downloaded React canvas library; allows mixing React state with Canvas rendering |

**Rationale for Konva over alternatives:**
- **Over PixiJS v8:** PixiJS targets WebGL/WebGPU game rendering. Konva's strength is interactive node-and-edge diagrams with click/hover event handling built in. PixiJS requires manual hit detection implementation for custom shapes.
- **Over Cytoscape.js:** Cytoscape is DOM-based by default (SVG renderer) and bundles its own graph data model, making it hard to separate from our graphlib model. Its WebGL preview (v3.31+) is not production-ready. Konva gives us full control.
- **Over D3.js:** D3 manipulates SVG DOM nodes — doesn't meet the Canvas/WebGL rendering constraint from PROJECT.md. DOM-based graphs degrade badly past ~500 nodes.
- **Over native Canvas API:** react-konva gives declarative React components, event delegation, and layer caching without sacrificing performance. The hitgraph renderer handles hit detection automatically.

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | 5.0.x | Frontend graph state | `useSyncExternalStore`-based in v5; ~3KB bundle; no provider boilerplate; suited for the graph model + UI state (selected node, zoom level, panel visibility) that needs to sync with WebSocket streams |

### Persistence Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-sqlite3 | 12.8.x | Synchronous SQLite driver for Node.js | Fastest synchronous SQLite in Node.js; synchronous API is the right fit for a write-heavy event log (no async callback hell); full transaction support for atomic graph snapshots; local-only |
| Drizzle ORM | 0.40.x | Schema definition + typed queries | TypeScript-first; `drizzle-kit push` for dev-time schema evolution; generates SQL migrations for schema changes; works with better-sqlite3 driver natively |
| drizzle-kit | 0.30.x | Migration tooling for Drizzle | CLI for schema push/generate/migrate; required alongside drizzle-orm |

**Rationale for SQLite + Drizzle over alternatives:**
- Local-only deployment eliminates need for PostgreSQL/MySQL server
- better-sqlite3's synchronous API means graph events can be written in-line with processing (no async queuing needed)
- Drizzle's TypeScript schema gives compile-time safety on the event log schema
- Time-travel replay is a first-class SQLite use case: append-only event table with indexed timestamps

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` | Run TypeScript in Node.js without compile step | Faster than `ts-node`; uses esbuild; for backend dev server |
| `vitest` | Unit + integration testing | Co-located with Vite; same config; fast with ESM; test tree-sitter queries and graph algorithms in isolation |
| `eslint` + `@typescript-eslint` | Linting | Standard for TS projects; catches unsafe graph mutation patterns |
| `prettier` | Formatting | Single style across backend + frontend |

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.x | Runtime validation of WebSocket message shapes | Validate graph event payloads from backend before entering Zustand store; prevents bad state from malformed events |
| `immer` | 10.x | Immutable graph state updates in Zustand | When graph state updates involve nested node/edge mutations; use with Zustand's `immer` middleware |
| `ws` | 8.x | WebSocket client in tests / scripting | `@fastify/websocket` wraps ws; use directly only for integration test harnesses |
| `tsup` | 8.x | Bundle backend TypeScript for distribution | If packaging the backend as a standalone binary later; not needed for dev |

---

## Installation

```bash
# Backend — Node.js server
npm install fastify @fastify/websocket tree-sitter tree-sitter-typescript tree-sitter-python chokidar @dagrejs/graphlib @dagrejs/dagre better-sqlite3 drizzle-orm zod

# Backend — types and dev
npm install -D typescript @types/node @types/better-sqlite3 drizzle-kit tsx vitest eslint @typescript-eslint/eslint-plugin prettier

# Frontend — React + Canvas
npm install react react-dom konva react-konva zustand immer zod

# Frontend — types and build tools
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react eslint prettier
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| File watching | chokidar v5 | Node.js `fs.watch` natively | `fs.watch` is unreliable on Windows and macOS; AI agents often use atomic file writes that `fs.watch` misses |
| File watching | chokidar v5 | `@parcel/watcher` | More complex API; less ecosystem adoption for this use case; chokidar is battle-tested at 88M/week downloads |
| Parsing | tree-sitter | Babel parser | Babel parses whole files (no incremental); errors halt parsing; JS/TS only (no Python) |
| Parsing | tree-sitter | TypeScript compiler API (tsc) | Full compile on every change; too slow for 1-2s latency target; no Python support |
| Graph model | @dagrejs/graphlib | Cytoscape.js | Cytoscape bundles visualization with model, making it hard to use Konva for rendering; over-engineered for pure data model use |
| Graph model | @dagrejs/graphlib | Custom adjacency map | Re-inventing cycle detection, topological sort, serialization; not worth it |
| Rendering | Konva + react-konva | PixiJS v8 | PixiJS is game-oriented (sprites, shaders); lacks built-in hit detection for custom shapes; requires manual event handling; steeper learning curve for diagram use cases |
| Rendering | Konva + react-konva | Cytoscape.js | DOM/SVG renderer by default; WebGL preview is experimental; forces its own graph data model |
| Rendering | Konva + react-konva | D3.js | SVG/DOM manipulation; fails the Canvas/WebGL rendering constraint; degrades past ~500 DOM nodes |
| Rendering | Konva + react-konva | React Flow | Excellent for small graphs; DOM-based under the hood; will struggle with hundreds of nodes at real-time update frequency |
| Backend framework | Fastify v5 | Express | Express WebSocket support is bolted on; no native HTTP/2; 2-4x slower; no first-class TypeScript |
| Backend framework | Fastify v5 | Hono | Hono is edge-first; overkill complexity for local app; smaller ecosystem for WebSocket patterns |
| Database | better-sqlite3 + Drizzle | PostgreSQL | No server process needed for local app; PostgreSQL is over-engineering for a single-user local tool |
| Database | better-sqlite3 + Drizzle | lowdb / JSON files | No transaction support; no indexed queries; time-travel replay would require loading entire JSON file |
| State management | Zustand v5 | Redux Toolkit | Redux boilerplate is excessive for a single-page visualization tool; Zustand's store slices work well for graph + UI state separation |
| State management | Zustand v5 | React Context | Context re-renders entire subtrees on any state change; fatal for a canvas that updates every 1-2 seconds |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `graphlib` (legacy, not `@dagrejs/graphlib`) | Unmaintained; last published years ago; the DagreJS org fork is the only actively maintained version | `@dagrejs/graphlib@3.0.x` |
| `dagre` (legacy) | Same issue — the non-scoped package is not maintained | `@dagrejs/dagre@2.0.x` |
| Create React App (CRA) | Officially deprecated; webpack-based; no longer receives updates | Vite 8 |
| `react-flow` / `reactflow` | DOM-based rendering; will degrade at hundreds of real-time updating nodes; not built for the Canvas rendering constraint in PROJECT.md | react-konva + custom layout |
| `socket.io` | Large dependency with its own protocol overhead (polling fallback, namespaces); unnecessary for a local app where WebSocket reliability is guaranteed | `@fastify/websocket` (raw ws) |
| `ts-node` | Slower than `tsx` for development; requires separate compilation for some ESM edge cases | `tsx` |
| `chokidar@3.x` / `chokidar@4.x` | Older versions; v5 (ESM-only, Node 20+) is the current stable; v3 has more dependencies | `chokidar@5.x` |
| DOM-based graph renderers (Cytoscape default, D3 SVG) | PROJECT.md explicitly requires Canvas/WebGL rendering for performance at hundreds of nodes | Konva + react-konva |
| `web-tree-sitter` (WASM) | Parsing happens on the backend (Node.js); WASM bindings are for browser environments; adds WASM loading overhead unnecessarily | `tree-sitter` (native Node.js binding) |

---

## Stack Patterns by Variant

**If adding WebGPU/WebGL acceleration later:**
- PixiJS v8 can replace Konva for the rendering layer
- The graph model (@dagrejs/graphlib) and layout (@dagrejs/dagre) are renderer-agnostic and do not need to change
- WebGPU becomes relevant only if benchmarks show Konva struggling past ~1000 nodes

**If parsing more languages (Go, Rust in future):**
- tree-sitter has grammars for both (`tree-sitter-go`, `tree-sitter-rust`)
- The parsing pipeline is language-agnostic by design — add grammar + query file per language
- No architectural changes needed; this is a data concern only

**If exposing an HTTP API for external tools:**
- Fastify's plugin system handles REST routes alongside WebSocket routes in the same server
- Add `@fastify/cors` for cross-origin access from external tools

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-konva@19.2.x` | `react@19.x`, `konva@10.x` | react-konva version mirrors React major version (19.x = React 19); do not mix |
| `tree-sitter@0.25.x` | `tree-sitter-typescript@0.23.x`, `tree-sitter-python@0.25.x` | Grammar packages should be at or near core version; version mismatch causes ABI errors |
| `@fastify/websocket@11.x` | `fastify@5.x` | v11 explicitly targets Fastify v5; do not use v9/v10 with Fastify v5 |
| `chokidar@5.x` | `node@20+` | ESM-only; requires `"type": "module"` or `.mjs` extensions in Node.js backend |
| `better-sqlite3@12.x` | `node@20+` | Native addon; requires Node.js ABI to match; use `node-gyp` rebuild after Node.js version changes |
| `vite@8.x` | `node@18+`, `react@19.x` | Vite 8 uses Rolldown; `@vitejs/plugin-react@6` recommended (Oxc-based, no Babel) |
| `drizzle-orm@0.40.x` | `better-sqlite3@12.x`, `drizzle-kit@0.30.x` | drizzle-orm and drizzle-kit minor versions should be kept in sync |

---

## Sources

- [tree-sitter npm](https://www.npmjs.com/package/tree-sitter) — v0.25.0, native Node.js binding — MEDIUM confidence
- [tree-sitter Node.js docs](https://tree-sitter.github.io/node-tree-sitter/) — v0.25.0 API, incremental parsing via `tree.edit()` — MEDIUM confidence
- [tree-sitter-typescript npm](https://www.npmjs.com/package/tree-sitter-typescript) — v0.23.2 — MEDIUM confidence
- [tree-sitter-python npm](https://www.npmjs.com/package/tree-sitter-python) — v0.25.0 — MEDIUM confidence
- [chokidar GitHub](https://github.com/paulmillr/chokidar) — v5 ESM-only, Node 20+ minimum — HIGH confidence (search + GitHub README)
- [Fastify npm / OpenJS Foundation announcement](https://openjsf.org/blog/fastifys-growth-and-success) — v5.8.x current stable — HIGH confidence
- [@fastify/websocket npm](https://www.npmjs.com/package/@fastify/websocket) — v11.x, built on ws@8 — HIGH confidence
- [konva npm](https://www.npmjs.com/package/konva) — v10.2.1 — HIGH confidence
- [react-konva npm](https://www.npmjs.com/package/react-konva) — v19.2.3 — HIGH confidence
- [Konva 20,000 nodes demo](https://konvajs.org/docs/sandbox/20000_Nodes.html) — Canvas performance at scale — HIGH confidence
- [@dagrejs/graphlib npm](https://www.npmjs.com/package/@dagrejs/graphlib) — v3.0.2, actively maintained — HIGH confidence
- [@dagrejs/dagre npm](https://www.npmjs.com/package/@dagrejs/dagre) — v2.0.4, incremental layout — HIGH confidence
- [Cytoscape.js WebGL preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/) — confirms WebGL renderer is preview-only, not production — MEDIUM confidence
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — v12.8.0, Node 20+ — HIGH confidence
- [Drizzle ORM SQLite docs](https://orm.drizzle.team/docs/get-started/sqlite-new) — better-sqlite3 driver, TypeScript schema — HIGH confidence
- [Zustand npm](https://www.npmjs.com/package/zustand) — v5.0.11 — HIGH confidence
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite6) / [releasebot](https://releasebot.io/updates/vite) — v8.x with Rolldown — MEDIUM confidence (Vite 8 is very recent; verify on project start)
- [PixiJS v8 Canvas renderer discussion](https://github.com/pixijs/pixijs/discussions/10682) — Canvas renderer in v8 is experimental — MEDIUM confidence

---

*Stack research for: ArchLens — Real-Time Architecture Visualization*
*Researched: 2026-03-15*
