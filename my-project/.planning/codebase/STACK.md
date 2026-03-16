# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript 5.8.0 - All application code across server, client, and shared packages
- JavaScript - Build configuration files (Vite, Drizzle config)

**Secondary:**
- SQL - SQLite schema and queries via Drizzle ORM

## Runtime

**Environment:**
- Node.js 22.x - Specified in `.nvmrc`

**Package Manager:**
- pnpm - Workspace monorepo manager
- Lockfile: Present (`pnpm-lock.yaml`)

## Frameworks

**Core:**
- Fastify 5.0.0 - HTTP/WebSocket server (`packages/server/src/index.ts`)
- React 19.1.0 - UI framework for client (`packages/client/src/main.tsx`)
- Vite 8.0.0 - Client dev server and build tool (`packages/client/vite.config.ts`)

**Server Networking:**
- @fastify/websocket 11.2.0 - WebSocket support for real-time graph streaming (`packages/server/src/plugins/websocket.ts`)

**Client Canvas & Visualization:**
- Konva 10.2.1 - Canvas rendering library for graph visualization
- react-konva 19.2.3 - React binding for Konva
- d3-force 3.0.0 - Force-directed layout simulation
- d3-force-boundary 0.0.1 - Force simulation boundary constraints
- @timohausmann/quadtree-js 1.2.6 - Spatial indexing for canvas performance

**State Management:**
- Zustand 5.0.11 - Lightweight state management for React (`packages/client/src/store/`)

**Validation:**
- Zod 3.25.67 - Schema validation for messages and types (`packages/client/src/schemas/`)

## Key Dependencies

**Critical:**
- better-sqlite3 11.0.0 - Embedded SQLite database (`packages/server/src/db/connection.ts`)
  - Configured with WAL mode and pragmas for concurrency
  - File: `./archlens.db` in working directory

- drizzle-orm 0.40.0 - Type-safe ORM for database access
  - Dialect: SQLite via better-sqlite3
  - Schema: `packages/server/src/db/schema.ts`

- drizzle-kit 0.30.0 - Database migration and schema tools

**Code Parsing & Analysis:**
- tree-sitter 0.21.1 - Grammar-based parser framework
- tree-sitter-javascript 0.23.1 - JavaScript grammar
- tree-sitter-typescript 0.23.2 - TypeScript grammar
- tree-sitter-python 0.23.6 - Python grammar

**File Watching & Processing:**
- chokidar 5.0.0 - Cross-platform file system watcher (`packages/server/src/watcher/`)
- micromatch 4.0.8 - Glob pattern matching for file filtering

**Concurrency & Threading:**
- piscina 5.1.4 - Worker thread pool for parse operations (`packages/server/src/parser/ParserPool.ts`)

**Graph Processing:**
- @dagrejs/graphlib 4.0.1 - Graph algorithms and utilities (`packages/server/src/graph/`)

**Logging:**
- pino-pretty 13.1.3 - Pretty-printed logging for development

## Configuration

**Environment:**
- `ARCHLENS_WATCH_ROOT` - Root directory to watch for file changes (defaults to `process.cwd()`)
  - Set in `packages/server/src/index.ts`

**Build:**
- `packages/server/tsconfig.json` - Server TypeScript config
  - Target: ES2022
  - Module: NodeNext
  - Output: `dist/` directory

- `packages/client/tsconfig.json` - Client TypeScript config
  - Target: ES2022
  - Module: ESNext
  - JSX: react-jsx
  - No emit (Vite handles output)

- `packages/shared/tsconfig.json` - Shared types package config
  - Exports: `./types` maps to `src/types/index.ts`

- `packages/server/tsconfig.workers.json` - Worker thread compilation config
  - Used for `pnpm build:workers` command

- `packages/client/vite.config.ts` - Vite dev server and build config
  - Dev proxy: `/ws` and `/api` routes to `http://localhost:3100`
  - React plugin enabled for JSX fast refresh

- `packages/server/drizzle.config.ts` - Database schema migration config
  - Dialect: SQLite
  - Database file: `./archlens.db`
  - Schema location: `packages/server/src/db/schema.ts`
  - Migrations output: `./drizzle` directory

## Platform Requirements

**Development:**
- Node.js 22.x
- pnpm 10+ (package manager with workspace support)
- SQLite 3+ (bundled with better-sqlite3)
- Native compilation tools for:
  - better-sqlite3 (requires build tools)
  - tree-sitter (requires C++ compiler)
  - esbuild (platform-specific binaries)

**Production:**
- Node.js 22.x
- SQLite 3+ (bundled database)
- Build output in `packages/server/dist/` and `packages/client/dist/`
- Pre-compiled worker threads at `packages/server/dist/parser/worker-cjs.cjs`

## Build Pipeline

**Scripts:**
```bash
pnpm dev                # Run server (watch mode) + client dev server concurrently
pnpm build:workers     # Compile tree-sitter workers to dist/parser/worker-cjs.cjs
pnpm typecheck         # Run TypeScript type checking across all packages
```

**Worker Build:**
- Compiles `packages/server/src/parser/worker.ts` to CommonJS for worker thread compatibility
- Output: `packages/server/dist/parser/worker-cjs.cjs`
- Must run before `pnpm dev` (handled by dev script)

## Special Dependencies

**pnpm onlyBuiltDependencies:**
- `better-sqlite3` - Native SQLite binding
- `esbuild` - Build tool with platform-specific binaries
- `tree-sitter` - Native grammar parser
- `tree-sitter-typescript` - Native TS grammar
- `tree-sitter-javascript` - Native JS grammar
- `tree-sitter-python` - Native Python grammar

These are configured to use pre-built binaries only (no recompilation during install).

---

*Stack analysis: 2026-03-16*
