# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

**No External Third-Party APIs:**
This codebase does not integrate with external cloud services, SaaS APIs, or third-party services. All functionality is self-contained.

## Data Storage

**Databases:**
- SQLite 3+ (embedded database)
  - File location: `./archlens.db` (relative to working directory)
  - ORM/Client: Drizzle ORM via better-sqlite3
  - Connection: `packages/server/src/db/connection.ts`
  - WAL mode enabled for concurrent read/write
  - Foreign keys disabled
  - Synchronous mode: NORMAL (performance tuning)

**Schema Tables:**
- `graph_nodes` - Stores file/module nodes in dependency graph
  - Columns: id, name, nodeType, zone, fileList, incomingEdgeCount, outgoingEdgeCount, lastModified, createdAt
  - Location: `packages/server/src/db/schema.ts`

- `graph_edges` - Stores dependencies between nodes
  - Columns: id, sourceId, targetId, edgeType, createdAt

- `changeEvents` - Event log for audit trail
  - Columns: id, eventType, payload (JSON), timestamp

- `layoutPositions` - Persists canvas node positions
  - Columns: nodeId, x, y, zone, updatedAt

**Migrations:**
- Drizzle migrations stored in `./drizzle` directory
- Config: `packages/server/drizzle.config.ts`
- Run migrations: `drizzle-kit push:sqlite` (manual)

**File Storage:**
- Local filesystem only
  - Watches directory specified by `ARCHLENS_WATCH_ROOT` env var (defaults to current working directory)
  - File watcher: `packages/server/src/watcher/` uses chokidar
  - Parsed files: No persistent storage (in-memory graph)
  - Build artifacts: `packages/client/dist/` (client output)

**Caching:**
- None (no Redis, Memcached, etc.)
- In-memory graph: `packages/server/src/graph/DependencyGraph.ts`
- Tree-sitter incremental parsing cache (in worker threads)

## Authentication & Identity

**Auth Provider:**
- None - No user authentication or authorization system
- Open access to WebSocket and HTTP endpoints
- No API keys, tokens, or credentials required

**Health Check Endpoint:**
- GET `/health` - Simple health status check
  - Response: `{ status: "ok", timestamp, uptime }`
  - Location: `packages/server/src/plugins/health.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, etc.)

**Logs:**
- Pino-based logging via Fastify
  - Pretty printing in development (pino-pretty)
  - Format: Console output
  - Log levels: Standard (debug, info, warn, error)
  - Location: Fastify logging configured in `packages/server/src/index.ts`

**Application Logging:**
- Graph delta events: Logged at `packages/server/src/index.ts`
- Inference results: Logged at `packages/server/src/index.ts`
- WebSocket client: Logs to browser console
  - Location: `packages/client/src/ws/wsClient.ts`

## CI/CD & Deployment

**Hosting:**
- Not specified (self-hosted or local development)
- Server listens on: `0.0.0.0:3100`
- Client dev server: Port 3000 (via Vite, configurable)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)

**Build Process:**
- Manual build: `pnpm build:workers` then `pnpm dev`
- No automated deployment pipeline

## Environment Configuration

**Required env vars:**
- `ARCHLENS_WATCH_ROOT` (optional) - Directory to watch for file changes
  - Defaults to `process.cwd()` if not set
  - Location used: `packages/server/src/index.ts:30`

**Optional configs:**
- SQLite file location: Hardcoded to `./archlens.db`
- Server port: Hardcoded to 3100
- Client dev server port: Configurable via Vite (default 3000)

**Secrets location:**
- No secrets required
- No `.env` file present in repository
- No API keys, tokens, or credentials used

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Real-Time Communication

**WebSocket Connection:**
- Protocol: Standard WebSocket (`ws://` or `wss://`)
- Server endpoint: `/ws`
- Location: `packages/server/src/plugins/websocket.ts`
- Message types: Defined in `@archlens/shared/types`
  - `InitialStateMessage` - Full graph snapshot on connect
  - `GraphDeltaMessage` - Incremental changes
  - `InferenceMessage` - Architectural analysis results
  - Schema validation: `packages/client/src/schemas/serverMessages.ts`

**Client Connection:**
- Connects to `/ws` at server location
- Location: `packages/client/src/ws/wsClient.ts`
- Features:
  - Exponential backoff reconnect (500ms base, 30s max)
  - Version gap detection with snapshot recovery
  - 500ms batch window for delta application
  - Singleton instance in `packages/client/src/main.tsx`

**REST Endpoints:**
- GET `/health` - Server health check
- GET `/api/snapshot` - Full graph snapshot for reconnect recovery
  - Location: `packages/server/src/plugins/snapshot.ts`
  - Response format: `InitialStateMessage` from shared types

## File System Integration

**File Watching:**
- Tool: chokidar 5.0.0
- Watch root: Configured via `ARCHLENS_WATCH_ROOT` env var
- Patterns: Filtered via micromatch glob patterns
  - Location: `packages/server/src/watcher/` for filtering logic
  - Location: `packages/server/src/pipeline/Pipeline.ts` for pipeline integration

**Supported Languages:**
- JavaScript (via tree-sitter-javascript)
- TypeScript (via tree-sitter-typescript)
- Python (via tree-sitter-python)

**Parser:**
- Tool: Tree-sitter grammar-based parser
- Execution: Worker thread pool (Piscina)
- Location: `packages/server/src/parser/ParserPool.ts`
- Worker: `packages/server/src/parser/worker.ts` → compiled to `dist/parser/worker-cjs.cjs`

## Inter-Process Communication

**Internal Message Types:**
All types defined in `@archlens/shared/types/`:
- `GraphNode` - File/module representation
- `GraphEdge` - Dependency representation
- `GraphDelta` - Change notification
- `InferenceResult` - Architectural analysis
- Schema validation: Zod schemas in `packages/client/src/schemas/`

---

*Integration audit: 2026-03-16*
