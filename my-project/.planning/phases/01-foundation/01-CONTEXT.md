# Phase 1: Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

TypeScript monorepo scaffold with SQLite persistence layer, shared types package, and Fastify server skeleton. This phase delivers the project structure, database schema, and server foundation that every subsequent phase builds on. No file watching, parsing, graph logic, or visualization — just the scaffold and persistence.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- pnpm workspaces as package manager
- 3 packages: `packages/server`, `packages/client`, `packages/shared`
- `packages/shared` contains TypeScript types and constants used by both server and client
- Full ESM throughout — `"type": "module"` in all package.json files (required by chokidar v5)
- Plain pnpm scripts for build orchestration — no Turborepo or other build tool
- Single `pnpm dev` command starts both backend and frontend concurrently

### Database Schema
- Store both architectural nodes AND file-level nodes — file nodes grouped under architectural nodes
- Typed events in the append-only change event log — each event has a type (node_added, edge_removed, zone_changed) with a typed JSON payload
- Per-node x/y layout positions — each node has its own x, y, zone columns, not a serialized blob
- Drizzle push for development (`drizzle-kit push`), Drizzle generate for production migrations

### Server & Dev Workflow
- Backend runs on port 3100
- tsx watch for backend hot reload during development
- Vite dev server proxies WebSocket connections to backend — single origin, no CORS configuration needed
- Frontend Vite dev server on its own port (Vite default), proxy config points `/ws` to backend port 3100

### Graph Data Model
- **Node types:** Service/Module, Component/Page, Data Store, External API
- **Edge types:** imports/depends-on, calls/invokes, reads/writes, publishes/subscribes
- **Node metadata:** file list (which files belong to this node), zone assignment (semantic zone), last modified timestamp, dependency count (incoming/outgoing edge counts)
- **Grouping heuristic:** Directory-based — each directory at a configurable depth becomes an architectural node (e.g., `src/services/auth/` → AuthService)

### Claude's Discretion
- Exact Drizzle schema column types and indexes
- SQLite WAL mode configuration details
- Fastify plugin registration order
- pnpm workspace configuration specifics
- Vite proxy configuration details
- tsconfig.json settings for ESM + path aliases

</decisions>

<specifics>
## Specific Ideas

- The shared types package must define the graph delta message schema early — this is the contract between server (Phase 5) and client (Phase 5/6)
- Node types and edge types should be TypeScript enums or union types in the shared package so both sides stay in sync
- The event log schema should be designed with time-travel replay in mind (v2) — include sequence numbers and timestamps

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-15*
