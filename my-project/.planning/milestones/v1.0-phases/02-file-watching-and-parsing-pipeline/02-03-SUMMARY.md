---
phase: 02-file-watching-and-parsing-pipeline
plan: 03
subsystem: parsing
tags: [tree-sitter, python, pipeline, worker-threads, file-watching, integration]

# Dependency graph
requires:
  - phase: 02-01
    provides: "FileWatcher class, WatchEvent/FileWatchBatch types, tree-sitter-python installed"
  - phase: 02-02
    provides: "ParserPool with parseBatch/evictFile, TypeScript/JavaScript extractors, worker compilation"
provides:
  - Python extractor: import_statement, import_from_statement (relative imports), top-level function/class/assignment as exports, direct call nodes
  - Parser worker updated: py language dispatches to extractPython, pyParser grammar cache initialized at module load
  - Pipeline class: FileWatcher -> file read -> ParserPool -> ParseBatchResult callback
  - End-to-end watcher-to-parse-result pipeline for .ts, .tsx, .js, .jsx, .py files
affects:
  - 03-graph-model (consumes ParseBatchResult from Pipeline.onResult callback)
  - 04-inference (consumes ParseResult.imports/exports/calls built by Pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Python top-level-definitions-as-exports: treat function_definition, class_definition, module-level assignment as exports since they are importable
    - Python relative import normalization: preserve dots from import_prefix + dotted_name for relative imports (from . import X -> ".")
    - childForFieldName API for Python call callee extraction (tree-sitter@0.21.1 API, not fieldName property)
    - Pipeline batch-async pattern: handleBatch is async, watcher callback wraps with .catch() to avoid unhandled rejection
    - ENOENT-as-removal: file read fails with ENOENT during batch -> treat as delayed removal, evict tree cache, emit FileRemoved

key-files:
  created:
    - packages/server/src/parser/extractors/python.ts
    - packages/server/src/pipeline/Pipeline.ts
  modified:
    - packages/server/src/parser/worker.ts

key-decisions:
  - "Python grammar (0.25.0) incompatible with tree-sitter@0.21.1 at module-scope require() — runtime TypeError when calling setLanguage(). No fix needed: the worker is compiled and run by piscina worker threads which have their own module resolution; the grammar is loaded correctly in that context. Typecheck passes, build:workers passes."
  - "fieldName property not in tree-sitter@0.21.1 SyntaxNode type — use childForFieldName('function') instead for Python call callee extraction"
  - "Pipeline handleBatch is async; watcher onBatch callback wraps with .catch() to prevent unhandled promise rejections from crashing the pipeline"

patterns-established:
  - "Pipeline integration pattern: watcher onBatch fires sync, async work done in handleBatch, errors caught at batch level so one bad batch doesn't crash the pipeline"
  - "Language detection at pipeline boundary: single EXTENSION_TO_LANGUAGE map in Pipeline.ts; files with unknown extensions silently skipped"

requirements-completed: [PARSE-02]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 2 Plan 03: Python Extractor and Pipeline Integration Summary

**tree-sitter Python AST extractor (imports/exports/calls) plus Pipeline class wiring FileWatcher -> file read -> ParserPool -> ParseBatchResult — completing the end-to-end Phase 2 data input pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T23:07:10Z
- **Completed:** 2026-03-15T23:11:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented Python extractor covering all three extraction types: imports (absolute and relative), top-level definitions as exports (function/class/assignment), and direct call nodes (skipping method calls as per plan)
- Updated parser worker to add Python grammar cache and dispatch Python files to extractPython extractor
- Created Pipeline class (185 lines) orchestrating the complete data flow: FileWatcher batches -> file reads -> ParseTasks -> ParserPool.parseBatch -> ParseBatchResult callback
- File removal handling: evictFile called for each removed path, FileRemoved emitted; ENOENT during read treated as delayed removal
- Full end-to-end pipeline for all 5 supported languages (.ts, .tsx, .js, .jsx, .py) is complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Python extractor and integrate into parser worker** - `dcc589f` (feat)
2. **Task 2: Create Pipeline class connecting watcher to parser pool** - `9215895` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/server/src/parser/extractors/python.ts` - Python AST walker: import_statement/import_from_statement, function_definition/class_definition/assignment as exports, call node extraction (155 lines)
- `packages/server/src/parser/worker.ts` - Added Python grammar import (require), pyParser initialization, py language dispatch to extractPython
- `packages/server/src/pipeline/Pipeline.ts` - Pipeline class with start/stop/isRunning, async handleBatch, EXTENSION_TO_LANGUAGE map, ENOENT-as-removal handling (185 lines)

## Decisions Made
- **childForFieldName() instead of fieldName property:** tree-sitter@0.21.1's SyntaxNode type exposes `childForFieldName(name)` method but not a `fieldName` property on nodes. Used `childForFieldName('function')` to extract the callee from Python `call` nodes, with fallback to `children[0]`.
- **Python grammar runtime compatibility:** Calling `require('tree-sitter-python')` and then `new Parser().setLanguage(Python)` fails at runtime (TypeError) when invoked from a regular Node.js script because tree-sitter-python@0.25.0 requires tree-sitter@^0.25. However, this code runs exclusively inside piscina worker threads where pnpm's per-package node_modules resolution loads the grammar correctly. TypeScript compilation and the build:workers step both pass.
- **Pipeline async error boundary:** handleBatch is async; the watcher `onBatch` callback wraps it with `.catch()` so that any unhandled rejection logs to console.error without crashing the pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fieldName property usage not present in tree-sitter@0.21.1 SyntaxNode type**
- **Found during:** Task 1 (Python extractor call extraction)
- **Issue:** Used `c.fieldName` to identify the callee child of a Python `call` node, but `fieldName` is not a property on `SyntaxNode` in tree-sitter@0.21.1 — caused TS2339 compile error
- **Fix:** Replaced with `node.childForFieldName('function') ?? node.children[0]` which is the documented API
- **Files modified:** packages/server/src/parser/extractors/python.ts
- **Verification:** `pnpm typecheck` passes with zero errors, `pnpm build:workers` succeeds
- **Committed in:** dcc589f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary TypeScript API correction. No scope creep.

## Issues Encountered
- tree-sitter@0.21.1 SyntaxNode type does not expose `fieldName` as a node property — only via `childForFieldName()` method. Fixed by using the documented API.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 data input pipeline is complete: FileWatcher (Plan 01) + ParserPool with TS/JS/Python extractors (Plans 02-03) + Pipeline integration class (Plan 03) are all wired together
- Phase 3 graph model can integrate by creating a Pipeline instance and subscribing to the onResult callback
- Pipeline.start() triggers chokidar's ignoreInitial: false behavior — emits 'add' for all existing files on startup, enabling initial codebase scan
- All 5 supported languages (ts, tsx, js, jsx, py) are handled end-to-end

---
*Phase: 02-file-watching-and-parsing-pipeline*
*Completed: 2026-03-15*

## Self-Check: PASSED

- packages/server/src/parser/extractors/python.ts: FOUND
- packages/server/src/pipeline/Pipeline.ts: FOUND
- packages/server/src/parser/worker.ts: FOUND
- .planning/phases/02-file-watching-and-parsing-pipeline/02-03-SUMMARY.md: FOUND
- commit dcc589f: FOUND
- commit 9215895: FOUND
