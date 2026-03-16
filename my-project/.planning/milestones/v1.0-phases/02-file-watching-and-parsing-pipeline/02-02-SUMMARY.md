---
phase: 02-file-watching-and-parsing-pipeline
plan: 02
subsystem: parsing
tags: [tree-sitter, piscina, worker-threads, typescript, javascript, incremental-parsing, ast-extraction]

# Dependency graph
requires:
  - phase: 02-01
    provides: "ParseTask, ParseResult, ImportInfo, ExportInfo, CallInfo types in @archlens/shared/types; tree-sitter, tree-sitter-typescript, tree-sitter-javascript, piscina installed"
provides:
  - TypeScript/TSX extractor: walks import_statement, export_statement, call_expression AST nodes
  - JavaScript/JSX extractor: delegates to TS extractor, strips isTypeOnly flags
  - Parser worker: piscina handler with per-thread grammar cache, per-file tree cache for incremental parsing
  - ParserPool class: typed wrapper over piscina with parseFile, parseBatch, evictFile, destroy, stats
  - tsconfig.workers.json: builds parser/** to dist/parser/ for worker thread loading
  - build:workers script in server and root package.json
affects:
  - 02-03-pipeline-integration (imports ParserPool, passes ParseTask batches from FileWatcher)
  - 04-inference (consumes ParseResult.imports/exports/calls for graph construction)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Grammar cache per worker thread: parsers initialized at module top-level, not per-call (avoids Pitfall 5)
    - Tree cache per worker: Map<filePath, Tree> for incremental parsing — worker-local, never crosses thread boundary
    - Pass-oldTree incremental strategy: parser.parse(source, oldTree) without tree.edit() — simpler, correct for file-level changes
    - Plain-object extraction: Tree stays in worker cache only, all cross-thread results are plain JS objects (PARSE-05)
    - Named piscina export for eviction: evictFile exported by name, called via pool.run(path, { name: 'evictFile' })
    - Worker file compiled to .js: tsconfig.workers.json builds parser/** to dist/; piscina loads compiled JS

key-files:
  created:
    - packages/server/src/parser/extractors/typescript.ts
    - packages/server/src/parser/extractors/javascript.ts
    - packages/server/src/parser/worker.ts
    - packages/server/src/parser/ParserPool.ts
    - packages/server/tsconfig.workers.json
  modified:
    - packages/server/package.json (added build:workers script)
    - package.json (added build:workers script, updated dev to run build:workers first)

key-decisions:
  - "Named { Piscina } import used instead of default import — under NodeNext resolution, default import of piscina resolves to the module object (from esm-wrapper.mjs), not the class; named export works correctly"
  - "Pass-oldTree incremental strategy (no tree.edit()): file watcher reads full file contents on change, making byte-offset computation for tree.edit() unnecessary; parser.parse(source, oldTree) achieves incremental reuse"
  - "Require() for grammar imports in worker.ts: tree-sitter grammar packages (tree-sitter-typescript, tree-sitter-javascript) are CJS native addons; require() is correct over ESM import for these"

patterns-established:
  - "Grammar cache at module top-level: always initialize tree-sitter parsers once per worker on module load, not inside the task handler"
  - "Worker-local tree cache: Parser.Tree objects cannot cross thread boundaries via structured clone; the cache must live inside the worker module"
  - "build:workers before dev: root dev script runs build:workers as prerequisite, ensuring compiled JS exists before server starts"

requirements-completed: [PARSE-01, PARSE-03, PARSE-04, PARSE-05, PARSE-06]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 2 Plan 02: Parsing Worker Pool Summary

**tree-sitter parsing worker pool with TypeScript/JavaScript AST extractors, per-thread grammar cache, per-file incremental tree cache, and piscina-backed ParserPool class compiled to dist/parser/worker.js**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T22:59:52Z
- **Completed:** 2026-03-15T23:03:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Implemented TypeScript/JSX extractor that walks tree-sitter AST nodes to produce typed ImportInfo[], ExportInfo[], CallInfo[] arrays
- Implemented JavaScript extractor delegating to TS extractor and stripping type-only flags
- Implemented piscina worker with module-level grammar cache and per-file tree cache for incremental parsing (PARSE-05, PARSE-06)
- Implemented ParserPool wrapping piscina with parseFile/parseBatch/evictFile/destroy/stats API (PARSE-04)
- Set up worker compilation build step (tsconfig.workers.json + build:workers scripts) so compiled JS is available for piscina worker threads

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript/JavaScript extractors and parser worker** - `57c2c2b` (feat)
2. **Task 2: Create ParserPool with piscina and worker compilation build step** - `98963e4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/server/src/parser/extractors/typescript.ts` - TypeScript/TSX AST walker for imports, exports, direct call_expression nodes (113 lines)
- `packages/server/src/parser/extractors/javascript.ts` - JavaScript/JSX extractor delegating to TS extractor with isTypeOnly stripped (28 lines)
- `packages/server/src/parser/worker.ts` - Piscina task handler with grammar cache, tree cache, incremental parsing, evictFile (109 lines)
- `packages/server/src/parser/ParserPool.ts` - Typed piscina pool wrapper with worker existence check on construction (92 lines)
- `packages/server/tsconfig.workers.json` - TypeScript config targeting parser/** for worker compilation
- `packages/server/package.json` - Added build:workers script
- `package.json` - Added root build:workers script, updated dev script to build workers first

## Decisions Made
- **Named { Piscina } import:** Default `import Piscina from 'piscina'` fails under NodeNext module resolution — the esm-wrapper.mjs does `export default mod` where `mod` is the CJS module object (not the class). The named export `export const Piscina = mod.Piscina` resolves correctly.
- **Pass-oldTree incremental parsing (no tree.edit()):** FileWatcher provides full file contents on every change event. Computing precise byte offsets for tree.edit() would require diffing, which adds complexity with marginal gain at typical source file sizes. Passing oldTree to parser.parse() still achieves incremental subtree reuse.
- **require() for grammar imports:** tree-sitter-typescript and tree-sitter-javascript are CJS native addons (node-gyp-build). Using require() inside the worker module ensures correct loading in compiled worker.js.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Piscina named import for NodeNext ESM/CJS interop**
- **Found during:** Task 2 (ParserPool.ts implementation)
- **Issue:** `import Piscina from 'piscina'` resolved to the module namespace object under NodeNext, not the class — TS2351 "not constructable" and TS2709 "cannot use namespace as type"
- **Fix:** Changed to `import { Piscina } from 'piscina'` to use the named class export from esm-wrapper.mjs
- **Files modified:** packages/server/src/parser/ParserPool.ts
- **Verification:** `pnpm typecheck` passes with zero errors
- **Committed in:** 98963e4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct TypeScript compilation. No scope creep.

## Issues Encountered
- Piscina default import incompatibility with NodeNext module resolution — fixed by using named export (documented above as deviation)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ParserPool is ready for integration in Plan 03 (pipeline integration)
- FileWatcher (Plan 01) + ParserPool (Plan 02) are independent components ready to be wired together
- Worker file compiles and loads correctly; `pnpm build:workers` must be run before starting the dev server
- Concern resolved: piscina named task (`pool.run(path, { name: 'evictFile' })`) is the correct API for calling named exports from workers

## Self-Check: PASSED

- packages/server/src/parser/extractors/typescript.ts: FOUND
- packages/server/src/parser/extractors/javascript.ts: FOUND
- packages/server/src/parser/worker.ts: FOUND
- packages/server/src/parser/ParserPool.ts: FOUND
- packages/server/tsconfig.workers.json: FOUND
- packages/server/dist/parser/worker.js: FOUND
- .planning/phases/02-file-watching-and-parsing-pipeline/02-02-SUMMARY.md: FOUND
- commit 57c2c2b: FOUND
- commit 98963e4: FOUND

---
*Phase: 02-file-watching-and-parsing-pipeline*
*Completed: 2026-03-15*
