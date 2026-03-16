---
phase: 02-file-watching-and-parsing-pipeline
plan: 01
subsystem: file-watching
tags: [chokidar, tree-sitter, piscina, file-watcher, typescript, debounce]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: shared types pattern (const objects + derived types), NodeNext module resolution, pnpm native addon whitelist pattern
provides:
  - FileWatcher class with chokidar v5, debounce, coalesce, batch emission
  - WatchEvent, FileWatchBatch, FileEventType types in @archlens/shared/types
  - SupportedLanguage, ParseTask, ParseResult, ParseBatchResult, FileRemoved types in @archlens/shared/types
  - chokidar@5, tree-sitter@0.21.1, piscina@5 installed in @archlens/server
affects:
  - 02-02-parsing-pipeline (uses ParseTask, ParseResult, FileRemoved, SupportedLanguage)
  - 02-03-pipeline-integration (integrates FileWatcher with parsing pipeline)
  - 04-inference (consumes ParseBatchResult for graph inference)

# Tech tracking
tech-stack:
  added:
    - chokidar@5.0.0 (file watching with v5 FSWatcher API)
    - tree-sitter@0.21.1 (native Node.js binding for incremental parsing)
    - tree-sitter-typescript@0.23.2 (TypeScript/TSX grammar)
    - tree-sitter-javascript@0.23.1 (JavaScript/JSX grammar — also handles JSX)
    - tree-sitter-python@0.25.0 (Python grammar)
    - piscina@5.1.4 (worker thread pool for Plan 02)
  patterns:
    - Extension filtering at watcher level — non-parseable files never reach application code
    - Map-based debounce coalescing — last event per path wins within 200ms window
    - Monotonic sequence counter per FileWatcher instance for strict ordering
    - Project-relative path normalization with forward slashes at watcher boundary
    - Explicit FileRemoved type in batch results — no inference required downstream

key-files:
  created:
    - packages/shared/src/types/watcher.ts
    - packages/shared/src/types/parser.ts
    - packages/server/src/watcher/FileWatcher.ts
  modified:
    - package.json (pnpm.onlyBuiltDependencies extended for tree-sitter packages)
    - packages/server/package.json (added chokidar, tree-sitter, piscina dependencies)
    - packages/shared/src/types/index.ts (added watcher and parser re-exports)
    - pnpm-lock.yaml (updated lockfile)

key-decisions:
  - "tree-sitter@0.21.1 used instead of 0.25.0 — v0.25 fails native compilation on Node 24 with MSVC due to C++17/C++20 conflict; v0.21.1 ships prebuilt binaries compatible with Node 24"
  - "Import path @archlens/shared/types (not @archlens/shared) — shared package only exports the ./types subpath per its package.json exports field"
  - "chokidar v5 ignoreInitial: false — emit 'add' for existing files on startup to enable initial directory scan by Plan 03"

patterns-established:
  - "Native addon whitelist pattern: extend pnpm.onlyBuiltDependencies in root package.json for each new native package"
  - "Watcher-level filtering: extension and directory filtering happens in ignored function, not in application event handlers"

requirements-completed: [WATCH-01, WATCH-02, WATCH-03, WATCH-04]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 2 Plan 01: File Watcher Dependencies and Types Summary

**chokidar v5 FileWatcher with 200ms debounce, Map coalescing, extension filtering, and typed batch emission — plus full tree-sitter/piscina native dependency stack installed**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T22:52:52Z
- **Completed:** 2026-03-15T22:56:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed all Phase 2 native dependencies (chokidar@5, tree-sitter@0.21.1, all grammar packages, piscina) with successful native builds
- Defined complete watcher/parser type contracts in shared package: FileEventType, WatchEvent, FileWatchBatch, SupportedLanguage, ParseTask, ParseResult, ParseBatchResult, FileRemoved
- Implemented FileWatcher class with chokidar v5, 200ms debounce window, Map-based coalescing, extension filtering at watcher level, symlink exclusion, and monotonic sequence numbers

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and define watcher/parser types** - `e9ec417` (feat)
2. **Task 2: Implement FileWatcher with chokidar v5, debounce, and batch emission** - `b52a2ca` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/shared/src/types/watcher.ts` - FileEventType const, WatchEvent interface, FileWatchBatch interface (18 lines)
- `packages/shared/src/types/parser.ts` - SupportedLanguage const, ParseTask, ImportInfo, ExportInfo, CallInfo, ParseResult, FileRemoved, ParseBatchResult types (54 lines)
- `packages/server/src/watcher/FileWatcher.ts` - Full FileWatcher class implementation (186 lines)
- `packages/shared/src/types/index.ts` - Added re-exports for watcher.js and parser.js
- `package.json` - Extended pnpm.onlyBuiltDependencies with four tree-sitter packages
- `packages/server/package.json` - Added chokidar, tree-sitter, grammar packages, piscina as dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **tree-sitter version pinned to 0.21.1:** tree-sitter@0.25.0 failed native compilation on Node.js 24 / MSVC because node-gyp overrides C++ standard to C++17 but Node 24's v8config.h requires C++20. Version 0.21.1 ships prebuilt binaries via node-gyp-build and works without compilation.
- **Import path is @archlens/shared/types:** The shared package's package.json exports map only defines the `./types` subpath. Using `@archlens/shared` alone causes a TS2307 module-not-found error.
- **ignoreInitial: false:** Keeps existing files emitting 'add' events on startup, enabling initial codebase scan in Plan 03 integration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed @archlens/shared import path**
- **Found during:** Task 2 (FileWatcher implementation)
- **Issue:** Import `from '@archlens/shared'` caused TS2307 — shared package only exports `./types` subpath
- **Fix:** Changed import to `from '@archlens/shared/types'`
- **Files modified:** packages/server/src/watcher/FileWatcher.ts
- **Verification:** pnpm typecheck passes with zero errors
- **Committed in:** b52a2ca (Task 2 commit)

**2. [Rule 3 - Blocking] Pinned tree-sitter to 0.21.1**
- **Found during:** Task 1 (dependency installation)
- **Issue:** tree-sitter@0.25.0 (latest) failed native compilation — node-gyp set /std:c++17 but Node 24 headers require C++20; no prebuilt binaries available for the platform
- **Fix:** Installed tree-sitter@0.21.1 which ships prebuilt binaries (node-gyp-build) compatible with Node 24/x64/Windows
- **Files modified:** packages/server/package.json, pnpm-lock.yaml
- **Verification:** `node -e "require('./packages/server/node_modules/tree-sitter')"` succeeds; `pnpm typecheck` passes
- **Committed in:** e9ec417 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct module resolution and native compilation. No scope creep.

## Issues Encountered
- tree-sitter@0.25.0 native build failure on Node 24/Windows: MSVC C++ standard version conflict resolved by pinning to 0.21.1 with prebuilt binaries
- tree-sitter-javascript and tree-sitter-python have conflicting peer requirements (0.23.x wants tree-sitter@^0.21, 0.25.x wants tree-sitter@^0.25) — pnpm resolves both versions; grammar packages use their own bundled tree-sitter copy for parsing

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FileWatcher is ready for integration in Plan 02 and Plan 03
- All tree-sitter grammar packages installed — Plan 02 can implement parsing logic directly
- piscina installed — Plan 02 can implement worker thread pool
- Type contracts fully defined and importable from @archlens/shared/types
- Concern: tree-sitter grammar peer dependency mismatch (both 0.23.x and 0.25.x installed) — verify grammar package initialization in Plan 02

---
*Phase: 02-file-watching-and-parsing-pipeline*
*Completed: 2026-03-15*
