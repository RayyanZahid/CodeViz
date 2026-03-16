# Phase 1: Foundation - Research

**Researched:** 2026-03-15
**Domain:** TypeScript monorepo scaffold, SQLite persistence, Fastify server skeleton
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Monorepo Structure**
- pnpm workspaces as package manager
- 3 packages: `packages/server`, `packages/client`, `packages/shared`
- `packages/shared` contains TypeScript types and constants used by both server and client
- Full ESM throughout — `"type": "module"` in all package.json files (required by chokidar v5)
- Plain pnpm scripts for build orchestration — no Turborepo or other build tool
- Single `pnpm dev` command starts both backend and frontend concurrently

**Database Schema**
- Store both architectural nodes AND file-level nodes — file nodes grouped under architectural nodes
- Typed events in the append-only change event log — each event has a type (node_added, edge_removed, zone_changed) with a typed JSON payload
- Per-node x/y layout positions — each node has its own x, y, zone columns, not a serialized blob
- Drizzle push for development (`drizzle-kit push`), Drizzle generate for production migrations

**Server & Dev Workflow**
- Backend runs on port 3100
- tsx watch for backend hot reload during development
- Vite dev server proxies WebSocket connections to backend — single origin, no CORS configuration needed
- Frontend Vite dev server on its own port (Vite default), proxy config points `/ws` to backend port 3100

**Graph Data Model**
- Node types: Service/Module, Component/Page, Data Store, External API
- Edge types: imports/depends-on, calls/invokes, reads/writes, publishes/subscribes
- Node metadata: file list (which files belong to this node), zone assignment (semantic zone), last modified timestamp, dependency count (incoming/outgoing edge counts)
- Grouping heuristic: Directory-based — each directory at a configurable depth becomes an architectural node (e.g., `src/services/auth/` → AuthService)

### Claude's Discretion

- Exact Drizzle schema column types and indexes
- SQLite WAL mode configuration details
- Fastify plugin registration order
- pnpm workspace configuration specifics
- Vite proxy configuration details
- tsconfig.json settings for ESM + path aliases

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | System uses a TypeScript monorepo with shared types between backend and frontend | pnpm workspaces with `workspace:*` protocol; shared package exporting raw `.ts` files via `exports` field; tsconfig project references or path aliases |
| FOUND-02 | SQLite database with WAL mode stores graph nodes, edges, change events, and layout positions | better-sqlite3 with `sqlite.pragma('journal_mode = WAL')` at connection init; WAL must be set on the connection object, not in migrations |
| FOUND-03 | Drizzle ORM manages database schema and migrations | `drizzle-orm` + `drizzle-kit`; `drizzle-kit push` for dev iteration; `drizzle-kit generate` + `drizzle-kit migrate` for production |
| FOUND-04 | Fastify v5 serves as the backend HTTP and WebSocket server | `fastify@^5`; `FastifyPluginAsync` for typed plugins; `@fastify/websocket` for WS support (Phase 5, but register-ready now) |
| PERS-01 | Graph state persists across process restarts | Drizzle write-through on every graph update; repository layer abstracts DB access; server reads from DB on startup |
| PERS-02 | Layout positions are cached in the database and restored on startup | `layout_positions` table with per-node x, y, zone columns; loaded at server start and sent to client on initial connection |
| PERS-03 | Change events are logged in an append-only table for future time-travel support | `change_events` table with sequence number, timestamp, event type, typed JSON payload; no UPDATE/DELETE on this table |
</phase_requirements>

---

## Summary

Phase 1 establishes a pnpm workspace monorepo with three packages (`server`, `client`, `shared`), a Drizzle ORM + better-sqlite3 persistence layer with WAL mode, and a Fastify v5 server skeleton. Every library in this phase is stable and production-ready as of March 2026. Vite 8 (Rolldown-based) reached stable release on March 12 2026 — it is safe to use for the client package but migration from Vite 7 is straightforward if any issues arise.

The key architectural decisions are: full ESM across all packages, WAL mode enabled at the connection level (not via migration files), and the shared package exporting raw TypeScript source (no compilation step in dev). The `pnpm dev` script uses `concurrently` at the root to run both `tsx watch` on the server and Vite's dev server on the client simultaneously.

**Primary recommendation:** Use `better-sqlite3` as the SQLite driver (not Node's built-in `node:sqlite`, which Drizzle does not yet officially support). Enable WAL mode immediately after opening the database connection. Export TypeScript source directly from `packages/shared` for zero-compilation shared types in development.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 9.x / 10.x | Package manager + workspace manager | Built-in workspace support, fastest installs, `workspace:*` protocol |
| TypeScript | 5.x | Type system | Required for type-safe shared contracts |
| fastify | ^5.0 | HTTP + future WebSocket server | Lowest overhead Node.js framework, native TypeScript support, plugin DAG |
| drizzle-orm | ^0.40+ | ORM + query builder | Type-safe SQL, no hidden magic, supports SQLite push workflow |
| drizzle-kit | ^0.30+ | Schema migrations CLI | Paired toolchain for drizzle-orm; push for dev, generate/migrate for prod |
| better-sqlite3 | ^11 / ^12 | SQLite driver | Synchronous API (correct for write-heavy event logging), native bindings |
| tsx | ^4.x | TypeScript runner + watch mode | Built on esbuild, zero-config ESM execution, replaces ts-node |
| vite | ^8.0 | Frontend bundler + dev server | Rolldown-based (stable March 12, 2026), fast HMR, built-in proxy |
| concurrently | ^9.x | Run multiple scripts in parallel | Standard tool for `pnpm dev` starting server + client simultaneously |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/better-sqlite3 | ^7.x | TypeScript types for better-sqlite3 | Required — better-sqlite3 has no bundled types |
| @types/node | ^22 | Node.js type declarations | Required for all Node.js API usage |
| fastify-plugin | ^5.x | Break Fastify encapsulation for shared decorators | Use when a plugin must expose decorators to sibling plugins |
| @fastify/cors | ^10.x | CORS headers | Not needed for Phase 1 (Vite proxy handles origin), but register-ready for production |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | node:sqlite (Node built-in) | Drizzle has no official `node:sqlite` support as of 2026; `better-sqlite3` is the correct choice |
| better-sqlite3 | libsql | libsql is for Turso/remote SQLite; better-sqlite3 is correct for local file-based SQLite |
| tsx | ts-node + nodemon | tsx is faster (esbuild-based), simpler config, native ESM; ts-node+nodemon requires extra config |
| concurrently | pnpm recursive scripts | pnpm has no built-in parallel-with-output script runner; `concurrently` is the ecosystem standard |
| Vite 8 | Vite 7 | Vite 8 stable as of 2026-03-12; use 8 unless blockers found |

**Installation:**
```bash
# Root
pnpm add -D concurrently typescript

# packages/server
pnpm add fastify
pnpm add -D tsx @types/node drizzle-kit
pnpm add drizzle-orm better-sqlite3
pnpm add -D @types/better-sqlite3

# packages/shared
pnpm add -D typescript @types/node

# packages/client
pnpm add -D vite typescript @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
archlens/                          # workspace root
├── pnpm-workspace.yaml            # packages: ['packages/*']
├── package.json                   # "private": true, dev script with concurrently
├── tsconfig.base.json             # shared TS config (target, module, moduleResolution)
├── packages/
│   ├── shared/
│   │   ├── package.json           # "type": "module", exports: {"./types": "./src/types/index.ts"}
│   │   ├── tsconfig.json          # extends tsconfig.base.json
│   │   └── src/
│   │       └── types/
│   │           ├── index.ts       # re-exports all shared types
│   │           ├── graph.ts       # NodeType, EdgeType, GraphNode, GraphEdge
│   │           ├── events.ts      # ChangeEvent, EventType, typed payloads
│   │           └── messages.ts    # WebSocket message schema (graph delta contract)
│   ├── server/
│   │   ├── package.json           # "type": "module", main: "src/index.ts"
│   │   ├── tsconfig.json          # extends tsconfig.base.json
│   │   ├── drizzle.config.ts      # dialect: sqlite, schema path, db credentials
│   │   └── src/
│   │       ├── index.ts           # server entry point
│   │       ├── db/
│   │       │   ├── connection.ts  # open Database, pragma WAL, export drizzle(db)
│   │       │   ├── schema.ts      # Drizzle table definitions
│   │       │   └── repository/   # one file per domain entity
│   │       │       ├── nodes.ts
│   │       │       ├── edges.ts
│   │       │       ├── events.ts
│   │       │       └── positions.ts
│   │       └── plugins/
│   │           └── health.ts      # GET /health route
│   └── client/
│       ├── package.json           # "type": "module"
│       ├── vite.config.ts         # server.proxy: { '/ws': { target, ws: true } }
│       ├── tsconfig.json          # extends tsconfig.base.json
│       └── src/
│           └── main.ts
```

### Pattern 1: pnpm Workspace Configuration

**What:** `pnpm-workspace.yaml` defines which directories are workspace packages; `workspace:*` protocol links them locally.

**When to use:** Always — enables `pnpm install` to wire local packages without publishing.

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// packages/server/package.json (dependency on shared)
{
  "dependencies": {
    "@archlens/shared": "workspace:*"
  }
}
```

```json
// packages/shared/package.json
{
  "name": "@archlens/shared",
  "type": "module",
  "exports": {
    "./types": "./src/types/index.ts"
  }
}
```

**Key insight for ESM monorepos:** Export raw `.ts` files from the shared package during development. TypeScript resolves `.ts` source directly via the `exports` field — no compilation step is needed in dev. This is the "live types" pattern. The `exports` field path must be used in imports (`import type { ... } from '@archlens/shared/types'`).

### Pattern 2: TypeScript ESM Configuration

**What:** `moduleResolution: "NodeNext"` (or `"Bundler"` for client) + `"module": "NodeNext"` for server packages. Clients using Vite can use `"moduleResolution": "Bundler"` which does not require `.js` extensions.

**When to use:** NodeNext for server (Node.js runtime requires explicit extensions); Bundler for client (Vite handles resolution).

```json
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```json
// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```json
// packages/client/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src"]
}
```

**Warning:** With `NodeNext` module resolution, import paths in `.ts` files must use `.js` extension (e.g., `import { foo } from './bar.js'` even though the file is `bar.ts`). This is a Node.js ESM requirement, not TypeScript behavior.

### Pattern 3: SQLite Connection + WAL Mode

**What:** Open `better-sqlite3` Database, immediately enable WAL pragma, pass to Drizzle.

**When to use:** Always — WAL mode must be set on the connection object at startup, not in migration SQL (migration-file pragma may be ignored).

```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
// packages/server/src/db/connection.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database('./archlens.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');  // safe with WAL, better write performance

export const db = drizzle(sqlite, { schema });
```

### Pattern 4: Drizzle Schema Definition

**What:** Define all four tables using Drizzle's `sqliteTable` builder. The schema file is the single source of truth for both types and database structure.

```typescript
// Source: https://orm.drizzle.team/docs/column-types/sqlite
// packages/server/src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const graphNodes = sqliteTable('graph_nodes', {
  id: text('id').primaryKey(),                    // UUID or directory-hash
  name: text('name').notNull(),
  nodeType: text('node_type').notNull(),           // 'service_module' | 'component_page' | 'data_store' | 'external_api'
  zone: text('zone'),                              // semantic zone (set in Phase 4)
  fileList: text('file_list', { mode: 'json' }).$type<string[]>().notNull().default([]),
  incomingEdgeCount: integer('incoming_edge_count').notNull().default(0),
  outgoingEdgeCount: integer('outgoing_edge_count').notNull().default(0),
  lastModified: integer('last_modified', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const graphEdges = sqliteTable('graph_edges', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => graphNodes.id),
  targetId: text('target_id').notNull().references(() => graphNodes.id),
  edgeType: text('edge_type').notNull(),           // 'imports_depends_on' | 'calls_invokes' | 'reads_writes' | 'publishes_subscribes'
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const changeEvents = sqliteTable('change_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),  // sequence number
  eventType: text('event_type').notNull(),          // 'node_added' | 'edge_removed' | 'zone_changed' etc.
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
});

export const layoutPositions = sqliteTable('layout_positions', {
  nodeId: text('node_id').primaryKey().references(() => graphNodes.id),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  zone: text('zone'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
```

### Pattern 5: Drizzle Kit Configuration

**What:** `drizzle.config.ts` tells drizzle-kit where the schema is and where to write migrations.

```typescript
// Source: https://orm.drizzle.team/docs/drizzle-kit-push
// packages/server/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: './archlens.db',
  },
});
```

Development workflow: `npx drizzle-kit push` (reads schema, diffs against live DB, applies). Production workflow: `npx drizzle-kit generate` then `npx drizzle-kit migrate`.

### Pattern 6: Fastify Server Entry Point

**What:** Create Fastify instance, register plugins, listen on port 3100. All functionality lives in plugins registered via `fastify.register()`.

```typescript
// Source: https://fastify.dev/docs/latest/Guides/Getting-Started/
// packages/server/src/index.ts
import Fastify from 'fastify';
import { healthPlugin } from './plugins/health.js';
import { db } from './db/connection.js';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

// Register plugins
await fastify.register(healthPlugin);

// Start server
try {
  await fastify.listen({ port: 3100, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
```

### Pattern 7: Fastify Plugin (typed)

**What:** Use `FastifyPluginAsync` for all plugins. Route plugins do NOT need `fastify-plugin` wrapping (they should remain encapsulated). Decorator/service plugins DO need `fp()` wrapping to escape encapsulation.

```typescript
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/
// packages/server/src/plugins/health.ts
import type { FastifyPluginAsync } from 'fastify';

export const healthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};
```

### Pattern 8: Vite Proxy for WebSocket

**What:** Vite's `server.proxy` config with `ws: true` routes `/ws` requests to the backend port.

```typescript
// packages/client/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:3100',
        ws: true,
        changeOrigin: false,  // same origin after proxy — no CORS needed
      },
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: false,
      },
    },
  },
});
```

### Pattern 9: Root dev Script

**What:** Root `package.json` dev script uses `concurrently` to start both packages in parallel. Named processes for readable output.

```json
// package.json (root)
{
  "private": true,
  "scripts": {
    "dev": "concurrently -n server,client -c cyan,yellow \"pnpm --filter @archlens/server dev\" \"pnpm --filter @archlens/client dev\"",
    "build": "pnpm --filter @archlens/shared build && pnpm --filter @archlens/server build && pnpm --filter @archlens/client build"
  },
  "devDependencies": {
    "concurrently": "^9.x",
    "typescript": "^5.x"
  }
}
```

Each package's `dev` script:
```json
// packages/server/package.json
{ "scripts": { "dev": "tsx watch src/index.ts" } }

// packages/client/package.json
{ "scripts": { "dev": "vite" } }
```

### Anti-Patterns to Avoid

- **Setting WAL mode in a migration file:** The pragma must be set on the connection object at runtime. Setting it in an SQL migration file may appear to succeed but the database may revert. Always use `sqlite.pragma('journal_mode = WAL')` in connection setup code.
- **Using CJS require() with "type": "module":** All packages have `"type": "module"`. Never use `require()`, `__dirname`, or `__filename`. Use `import.meta.url` and `fileURLToPath` for path operations.
- **Compiling the shared package during development:** Export raw `.ts` source from the `exports` field. Compilation is only needed for publishing. Adding a build step to `packages/shared` during dev adds latency and breaks hot reload.
- **Using `fs.appendFileSync` for persistent state:** All state goes through Drizzle. No ad-hoc file writes.
- **Wrapping route plugins with `fp()`:** Only decorator/service plugins need `fastify-plugin`. Route plugins should remain encapsulated in their own scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite schema migrations | Custom SQL migration runner | `drizzle-kit push` / `drizzle-kit migrate` | Handles table diffing, column additions, data preservation warnings |
| TypeScript execution with ESM | ts-node + nodemon configuration | `tsx watch` | tsx handles ESM natively with zero config; ts-node requires `--esm` flag and extra setup |
| Cross-package type sharing | Copy-pasting types | pnpm `workspace:*` + shared package | Workspace protocol prevents drift; single source of truth |
| Running server + client together | Shell `&` backgrounding | `concurrently` | Handles process groups, ctrl+C kills all, colored output labels |
| SQLite WAL checkpoint management | Manual PRAGMA WAL_CHECKPOINT calls | SQLite auto-checkpoint at 1000 pages | Default behavior is correct; only tune if you measure a problem |
| JSON column type safety | Manual JSON.parse/stringify | `text({ mode: 'json' }).$type<T>()` | Drizzle handles serialization and provides TypeScript types |

**Key insight:** The combination of drizzle-kit push + WAL pragma on connection handles the entire "schema-as-code" workflow. There is no need for a separate migration tool, ORM configuration layer, or custom schema synchronization logic.

---

## Common Pitfalls

### Pitfall 1: WAL Mode Not Persisting

**What goes wrong:** Database starts in rollback (delete) journal mode despite code setting WAL.
**Why it happens:** `PRAGMA journal_mode = WAL` added to a migration `.sql` file instead of the connection initialization code. Some SQLite drivers silently ignore pragma statements in migration files.
**How to avoid:** Set `sqlite.pragma('journal_mode = WAL')` directly on the `Database` instance before creating the Drizzle client. Verify with a test: `db.get(sql\`PRAGMA journal_mode\`)` should return `{ journal_mode: 'wal' }`.
**Warning signs:** Database file has no `-wal` or `-shm` sibling files after writes.

### Pitfall 2: better-sqlite3 Native Binding Mismatch

**What goes wrong:** `Error: Could not locate the bindings file` or `NODE_MODULE_VERSION mismatch` at startup.
**Why it happens:** better-sqlite3 is a native module (compiled C++). If the Node.js version changes (e.g., nvm switch or CI uses different Node), the pre-compiled bindings are invalid.
**How to avoid:** Pin Node.js version in `.nvmrc` or `.node-version`. Run `npm rebuild better-sqlite3` if the error occurs. Use `node -e "require('better-sqlite3')"` to verify bindings before first server run.
**Warning signs:** Works locally but fails in CI; fails after `nvm use`.

### Pitfall 3: ESM Import Extensions in NodeNext Mode

**What goes wrong:** TypeScript compiles but Node.js throws `ERR_MODULE_NOT_FOUND` at runtime.
**Why it happens:** With `moduleResolution: "NodeNext"`, Node.js ESM requires explicit file extensions in import paths. TypeScript does not add extensions automatically.
**How to avoid:** Always write `.js` extensions in import paths within `packages/server` (e.g., `import { db } from './db/connection.js'`). The `.js` extension resolves to the `.ts` file when running through `tsx`, and to the compiled `.js` file in production.
**Warning signs:** Server starts with `tsx` (which is lenient) but fails when running compiled `node dist/index.js`.

### Pitfall 4: Shared Package "exports" Field Not Resolved

**What goes wrong:** `Cannot find module '@archlens/shared/types'` despite the package being installed.
**Why it happens:** TypeScript's module resolver looks at the `exports` field in `package.json`. If the path is not listed, resolution fails regardless of what files exist on disk.
**How to avoid:** Every import path that consumers use must be explicitly listed in the `exports` map of `packages/shared/package.json`. Add `"typesVersions": { "*": { "types": ["./src/types/index.ts"] } }` as a fallback for TypeScript versions that don't fully support `exports`.
**Warning signs:** Import works in IDE (which may use a broader resolver) but fails in `tsc` or `tsx`.

### Pitfall 5: Vite WebSocket Proxy Falling Back to HTTP

**What goes wrong:** WebSocket connections from the frontend fail with HTTP 400 or get downgraded to HTTP long-polling.
**Why it happens:** Vite's proxy requires `ws: true` explicitly. Without it, the upgrade request is not proxied.
**How to avoid:** Include `ws: true` in the proxy config for the `/ws` path. Verify with browser devtools: the connection should show `101 Switching Protocols`, not `200 OK`.
**Warning signs:** WebSocket works when connecting directly to port 3100 but not through Vite's dev server.

### Pitfall 6: pnpm Workspace Package Not Found

**What goes wrong:** `pnpm install` succeeds but `import from '@archlens/shared/types'` fails at runtime.
**Why it happens:** The `name` field in `packages/shared/package.json` must match exactly what is used in `dependencies` (e.g., `"@archlens/shared"`). Scoped package names require the `@scope/` prefix to be consistent.
**How to avoid:** Verify `package.json` name fields, then run `pnpm install` from the workspace root. Check that `node_modules/@archlens/shared` is a symlink pointing to `packages/shared`.
**Warning signs:** `ls node_modules/@archlens/` shows nothing after install.

---

## Code Examples

Verified patterns from official sources:

### Drizzle Query with Type Inference

```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
import { db } from './connection.js';
import { graphNodes } from './schema.js';
import { eq } from 'drizzle-orm';

// Insert
await db.insert(graphNodes).values({
  id: 'node-uuid-1',
  name: 'AuthService',
  nodeType: 'service_module',
  fileList: ['src/services/auth/index.ts', 'src/services/auth/handlers.ts'],
  lastModified: new Date(),
  createdAt: new Date(),
});

// Query
const node = await db.select().from(graphNodes).where(eq(graphNodes.id, 'node-uuid-1'));

// Type is inferred: typeof node === Array<typeof graphNodes.$inferSelect>
```

### Repository Pattern (one per entity)

```typescript
// packages/server/src/db/repository/nodes.ts
import { db } from '../connection.js';
import { graphNodes } from '../schema.js';
import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

type GraphNode = InferSelectModel<typeof graphNodes>;
type NewGraphNode = InferInsertModel<typeof graphNodes>;

export const nodesRepository = {
  findById: (id: string): Promise<GraphNode | undefined> =>
    db.select().from(graphNodes).where(eq(graphNodes.id, id)).then(r => r[0]),

  upsert: (node: NewGraphNode): Promise<void> =>
    db.insert(graphNodes).values(node).onConflictDoUpdate({
      target: graphNodes.id,
      set: { name: node.name, lastModified: node.lastModified, fileList: node.fileList },
    }).then(() => undefined),

  findAll: (): Promise<GraphNode[]> =>
    db.select().from(graphNodes),
};
```

### Shared Types Package Structure

```typescript
// packages/shared/src/types/graph.ts
export const NodeType = {
  SERVICE_MODULE: 'service_module',
  COMPONENT_PAGE: 'component_page',
  DATA_STORE: 'data_store',
  EXTERNAL_API: 'external_api',
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];

export const EdgeType = {
  IMPORTS_DEPENDS_ON: 'imports_depends_on',
  CALLS_INVOKES: 'calls_invokes',
  READS_WRITES: 'reads_writes',
  PUBLISHES_SUBSCRIBES: 'publishes_subscribes',
} as const;

export type EdgeType = typeof EdgeType[keyof typeof EdgeType];

export interface GraphNode {
  id: string;
  name: string;
  nodeType: NodeType;
  zone: string | null;
  fileList: string[];
  incomingEdgeCount: number;
  outgoingEdgeCount: number;
  lastModified: Date;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
}
```

```typescript
// packages/shared/src/types/events.ts
export const ChangeEventType = {
  NODE_ADDED: 'node_added',
  NODE_REMOVED: 'node_removed',
  NODE_UPDATED: 'node_updated',
  EDGE_ADDED: 'edge_added',
  EDGE_REMOVED: 'edge_removed',
  ZONE_CHANGED: 'zone_changed',
} as const;

export type ChangeEventType = typeof ChangeEventType[keyof typeof ChangeEventType];

// Typed payload union — discriminated by eventType
export type ChangeEventPayload =
  | { type: 'node_added'; nodeId: string; name: string; nodeType: string }
  | { type: 'node_removed'; nodeId: string }
  | { type: 'edge_added'; edgeId: string; sourceId: string; targetId: string; edgeType: string }
  | { type: 'edge_removed'; edgeId: string }
  | { type: 'zone_changed'; nodeId: string; oldZone: string | null; newZone: string };

export interface ChangeEvent {
  id: number;           // sequence number — monotonically increasing
  eventType: ChangeEventType;
  payload: ChangeEventPayload;
  timestamp: Date;
}
```

```typescript
// packages/shared/src/types/messages.ts
// Graph delta WebSocket message contract — designed early for Phase 5
export interface GraphDeltaMessage {
  type: 'graph_delta';
  version: number;        // server-side sequence counter for ordering
  addedNodes: GraphNode[];
  removedNodeIds: string[];
  updatedNodes: GraphNode[];
  addedEdges: GraphEdge[];
  removedEdgeIds: string[];
}

export interface InitialStateMessage {
  type: 'initial_state';
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layoutPositions: Record<string, { x: number; y: number; zone: string | null }>;
}

export type ServerMessage = GraphDeltaMessage | InitialStateMessage;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node + nodemon | tsx watch | 2023+ | Zero config ESM execution, faster restarts via esbuild |
| Rollup/esbuild dual-bundler Vite | Rolldown-based Vite 8 | March 12, 2026 | 10-30x faster builds; stable for new projects |
| Turborepo for monorepo scripts | Plain pnpm scripts + concurrently | Ongoing | Turborepo is valuable for large caches; overkill for 3-package monorepo |
| `@types/sqlite3` + async sqlite3 | `better-sqlite3` (synchronous) | 2020+ | Sync API is correct for event-loop-blocking workloads; easier error handling |
| Custom migration scripts | drizzle-kit push (dev) / migrate (prod) | 2023+ | Schema-as-code with zero custom SQL files needed in dev |

**Deprecated/outdated:**
- `ts-node`: Replaced by `tsx` for new projects. ts-node requires extra `--esm` flags and `loader` configuration for ESM.
- `import-esm` / `esm` packages: No longer needed with Node 18+ and `"type": "module"`.
- `@types/node-sqlite3` (the async sqlite3 package): Async driver is slower and harder to use than better-sqlite3 for this use case.

---

## Open Questions

1. **better-sqlite3 Windows native bindings**
   - What we know: better-sqlite3 requires native compilation. On Windows, this requires node-gyp and build tools (MSVC or Python).
   - What's unclear: Whether the development machine (Windows 11 based on project env) has node-gyp prerequisites installed.
   - Recommendation: Verify with `npm list -g node-gyp` and `python --version`. If missing, plan for `pnpm add -g node-gyp` and Visual Studio Build Tools installation. Document in README.

2. **drizzle-kit push compatibility with WAL mode**
   - What we know: `drizzle-kit push` introspects the live database and applies diffs. WAL mode affects concurrent access but not schema introspection.
   - What's unclear: Whether drizzle-kit push works correctly when the DB has WAL mode active (i.e., `-wal` file present).
   - Recommendation: WAL mode should be transparent to drizzle-kit. Validate with a test push after enabling WAL. This is LOW risk.

3. **Shared package TypeScript resolution in strict mode**
   - What we know: Exporting raw `.ts` from shared package works with tsx. It may require `"allowImportingTsExtensions": true` or specific `exports` configuration in tsconfig.
   - What's unclear: Whether strict `tsc --noEmit` type-checking of server/client packages that import from shared will require additional tsconfig options.
   - Recommendation: Add `"references"` to tsconfig files (TypeScript project references) as a fallback if simple `exports`-field resolution has issues. Test with `tsc --noEmit` early in plan 01-01.

4. **Vite 8 stability on project start**
   - What we know: Vite 8 reached stable on March 12, 2026 (3 days before this research). Initial reports from migration are positive.
   - What's unclear: Edge-case plugins or configurations that may not yet be compatible with Rolldown.
   - Recommendation: Use Vite 8. If issues are found during Phase 1, downgrade to Vite 7 is straightforward. Document the pinned version.

---

## Sources

### Primary (HIGH confidence)
- `https://orm.drizzle.team/docs/get-started-sqlite` — Drizzle ORM SQLite setup, WAL mode, basic schema
- `https://orm.drizzle.team/docs/column-types/sqlite` — All Drizzle SQLite column types and modes
- `https://orm.drizzle.team/docs/drizzle-kit-push` — drizzle-kit push workflow and warnings
- `https://fastify.dev/docs/latest/Guides/Getting-Started/` — Fastify v5 getting started, ESM setup
- `https://fastify.dev/docs/latest/Reference/TypeScript/` — FastifyPluginAsync, type extensions, schema validation
- `https://pnpm.io/workspaces` — workspace: protocol, pnpm-workspace.yaml format, filter scripts

### Secondary (MEDIUM confidence)
- `https://vite.dev/blog/announcing-vite8` — Vite 8 stable release (March 12, 2026), Rolldown integration
- `https://vite.dev/config/server-options` — Vite proxy configuration, ws: true for WebSocket
- `https://tsx.is/` — tsx watch mode documentation
- `https://tsx.is/watch-mode` — tsx watch behavior and file tracking
- `https://colinhacks.com/essays/live-types-typescript-monorepo` — Live types pattern (raw .ts exports from shared package)
- `https://www.typescriptlang.org/tsconfig/moduleResolution.html` — NodeNext vs Bundler module resolution

### Tertiary (LOW confidence)
- Community answers on WAL mode in Drizzle migration files (GitHub issues, answeroverflow) — recommend verifying WAL is set at connection level, not migration level

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs and confirmed stable/released
- Architecture patterns: HIGH — patterns derived from official docs with code examples
- Pitfalls: MEDIUM-HIGH — WAL pitfall verified; native binding and ESM extension pitfalls verified; proxy pitfall from official Vite issue tracker
- Schema design: MEDIUM — column types verified, but exact indexes and constraints are Claude's discretion

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable ecosystem; Vite 8 and Drizzle active development but stable APIs)
