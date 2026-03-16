---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [pnpm, typescript, monorepo, vite, better-sqlite3, drizzle-orm, fastify, esm]

# Dependency graph
requires: []
provides:
  - pnpm workspace with 3 packages (server, client, shared) wired via workspace:* protocol
  - Shared type contracts: NodeType, EdgeType, GraphNode, GraphEdge, ChangeEvent, ServerMessage
  - TypeScript ESM config: NodeNext for server/shared, Bundler for client
  - Vite client skeleton with /ws (WebSocket) and /api proxy to localhost:3100
  - better-sqlite3 native bindings compiled for Node 24 on Windows
affects: [02-server-foundation, 03-client-foundation, 04-inference, 05-realtime, 06-visualization]

# Tech tracking
tech-stack:
  added:
    - pnpm 10.32.1 (workspace manager)
    - typescript 5.9.3
    - concurrently 9.2.1
    - vite ^8.0.0 (client bundler)
    - fastify ^5.0.0 (server, declared)
    - drizzle-orm ^0.40.0 (ORM, declared)
    - better-sqlite3 ^11.10.0 (native SQLite, compiled)
    - tsx ^4.x (TypeScript runner)
  patterns:
    - Live types: shared package exports raw .ts source via exports field (no compile step)
    - NodeNext module resolution for server/shared; Bundler for client
    - pnpm onlyBuiltDependencies to permit native build scripts in pnpm 10

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json (root)
    - tsconfig.base.json
    - .nvmrc
    - .npmrc
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/src/types/graph.ts
    - packages/shared/src/types/events.ts
    - packages/shared/src/types/messages.ts
    - packages/shared/src/types/index.ts
    - packages/server/package.json
    - packages/server/tsconfig.json
    - packages/client/package.json
    - packages/client/tsconfig.json
    - packages/client/vite.config.ts
    - packages/client/index.html
    - packages/client/src/main.ts
  modified: []

key-decisions:
  - "pnpm 10 requires onlyBuiltDependencies field in root package.json to permit native build scripts (better-sqlite3, esbuild)"
  - "Live types pattern: shared package exports ./src/types/index.ts directly — no compilation step in dev"
  - "NodeNext module resolution requires .js extensions in all imports within server and shared packages"
  - "Shared types use const objects + derived types (not enums) for full enum-like ergonomics with string values"
  - "ChangeEventPayload uses discriminated union with type field matching ChangeEventType string values"

patterns-established:
  - "Pattern: All packages have type: module for full ESM"
  - "Pattern: tsconfig.base.json provides shared options; packages extend and add module/moduleResolution"
  - "Pattern: workspace:* protocol links packages without publishing"

requirements-completed: [FOUND-01]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 1 Plan 01: Monorepo Scaffold and Shared Types Summary

**pnpm monorepo with 3 workspace packages (server/client/shared), TypeScript ESM config, shared graph/event/message types, and Vite client skeleton with WebSocket proxy**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T20:58:23Z
- **Completed:** 2026-03-15T21:02:37Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Full pnpm workspace with server, client, and shared packages wired via workspace:* protocol — better-sqlite3 native bindings compiled successfully on Windows/Node 24
- Shared type package exporting NodeType, EdgeType, GraphNode, GraphEdge, ChangeEventType, ChangeEvent, GraphDeltaMessage, InitialStateMessage, and ServerMessage as live TypeScript source
- Vite 8 client skeleton with /ws (WebSocket proxy, ws:true) and /api proxy to localhost:3100
- TypeScript compiles cleanly (tsc --noEmit passes in shared and client packages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Monorepo scaffold with pnpm workspaces and TypeScript ESM** - `a3c9ddf` (feat)
2. **Task 2: Shared types package and Vite client skeleton** - `b349368` (feat)

## Files Created/Modified
- `pnpm-workspace.yaml` - Workspace package glob (packages/*)
- `package.json` - Root: private, ESM, concurrently dev script, pnpm.onlyBuiltDependencies
- `tsconfig.base.json` - Shared TS options: ES2022 target, strict, skipLibCheck, sourceMap
- `.nvmrc` - Node.js 22 LTS pin
- `.npmrc` - pnpm build approval config
- `packages/shared/package.json` - @archlens/shared, exports: ./types -> ./src/types/index.ts
- `packages/shared/tsconfig.json` - NodeNext module resolution
- `packages/shared/src/types/graph.ts` - NodeType, EdgeType, GraphNode, GraphEdge
- `packages/shared/src/types/events.ts` - ChangeEventType, ChangeEventPayload, ChangeEvent
- `packages/shared/src/types/messages.ts` - GraphDeltaMessage, InitialStateMessage, ServerMessage
- `packages/shared/src/types/index.ts` - Barrel re-export of all three type files
- `packages/server/package.json` - @archlens/server with workspace:* shared dep, fastify, drizzle-orm, better-sqlite3
- `packages/server/tsconfig.json` - NodeNext, outDir: dist, rootDir: src
- `packages/client/package.json` - @archlens/client with workspace:* shared dep, vite ^8
- `packages/client/tsconfig.json` - ESNext/Bundler, lib DOM, noEmit: true
- `packages/client/vite.config.ts` - Proxy /ws (ws:true) and /api to localhost:3100
- `packages/client/index.html` - Minimal HTML5 with div#app and module script
- `packages/client/src/main.ts` - Placeholder: sets #app innerHTML to ArchLens heading

## Decisions Made
- pnpm 10 changed the security model for native build scripts — added `pnpm.onlyBuiltDependencies` field to root package.json to explicitly permit better-sqlite3 and esbuild to run build scripts. This is the correct pnpm 10 pattern.
- Chose const objects with derived type aliases over TypeScript enums for NodeType/EdgeType/ChangeEventType — gives string literal values (not numeric), better JSON serialization, and works correctly with discriminated unions.
- ChangeEventPayload includes a `node_updated` variant not in the research examples — added to match the `NODE_UPDATED` constant in ChangeEventType for completeness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added pnpm.onlyBuiltDependencies to permit native builds**
- **Found during:** Task 1 (pnpm install)
- **Issue:** pnpm 10 blocks native build scripts by default. better-sqlite3 and esbuild require native compilation. Without approval, better-sqlite3 bindings would not be built.
- **Fix:** Added `"pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "esbuild"] }` to root package.json. Re-ran pnpm install — native bindings compiled successfully.
- **Files modified:** package.json
- **Verification:** better-sqlite3 build succeeded with MSBuild on Windows; `gyp info ok` in output
- **Committed in:** a3c9ddf (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added node_updated variant to ChangeEventPayload**
- **Found during:** Task 2 (shared types creation)
- **Issue:** ChangeEventType const includes NODE_UPDATED but the ChangeEventPayload union did not include a matching discriminant — the discriminated union would be incomplete.
- **Fix:** Added `{ type: 'node_updated'; nodeId: string; name: string; nodeType: string }` to ChangeEventPayload.
- **Files modified:** packages/shared/src/types/events.ts
- **Verification:** tsc --noEmit passes in shared package
- **Committed in:** b349368 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Node.js v24.12.0 has no prebuilt better-sqlite3 binaries — compiled from source using MSVC (Visual Studio 2022 Build Tools) and Python 3.14. Build succeeded with only a harmless C4018 signed/unsigned comparison warning.
- pnpm 10 `approve-builds` is interactive; used `onlyBuiltDependencies` in package.json instead — this is the non-interactive equivalent and the recommended approach for CI/automated environments.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo structure complete — Plan 02 can add server source files (src/index.ts, db/, plugins/)
- Shared types define the full graph data contract — all phases can import from @archlens/shared/types
- better-sqlite3 native bindings built and ready — Drizzle schema can be defined in Plan 02
- Vite proxy configured — frontend WebSocket connection to backend will work without CORS

---
*Phase: 01-foundation*
*Completed: 2026-03-15*

## Self-Check: PASSED

- SUMMARY.md: FOUND at .planning/phases/01-foundation/01-01-SUMMARY.md
- Task 1 commit a3c9ddf: FOUND
- Task 2 commit b349368: FOUND
- Metadata commit e86f5ce: FOUND
- All 18 created files verified present on disk
