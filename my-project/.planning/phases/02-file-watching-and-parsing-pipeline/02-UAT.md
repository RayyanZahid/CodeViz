---
status: complete
phase: 02-file-watching-and-parsing-pipeline
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md
started: 2026-03-15T23:20:00Z
updated: 2026-03-15T23:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. TypeScript Compilation
expected: Running `pnpm typecheck` completes with zero errors across all packages.
result: pass

### 2. Worker Build Step
expected: Running `pnpm build:workers` succeeds and produces `packages/server/dist/parser/worker.js`.
result: pass

### 3. FileWatcher Class Structure
expected: `packages/server/src/watcher/FileWatcher.ts` exports a FileWatcher class with start(), stop(), and onBatch() methods. Uses chokidar v5, has 200ms debounce, extension filtering, and monotonic sequence numbering.
result: pass

### 4. Shared Type Contracts
expected: `packages/shared/src/types/index.ts` re-exports watcher types (FileEventType, WatchEvent, FileWatchBatch) and parser types (SupportedLanguage, ParseTask, ParseResult, ParseBatchResult, FileRemoved, ImportInfo, ExportInfo, CallInfo).
result: pass

### 5. TypeScript/JavaScript Extractors
expected: `packages/server/src/parser/extractors/typescript.ts` exports an extractor function that walks tree-sitter AST for import_statement, export_statement, and call_expression nodes. `javascript.ts` delegates to the TS extractor and strips isTypeOnly flags.
result: pass

### 6. Python Extractor
expected: `packages/server/src/parser/extractors/python.ts` exports an extractor for Python ASTs covering import_statement, import_from_statement (with relative imports), top-level function/class/assignment as exports, and call nodes.
result: pass

### 7. Parser Worker with Caching
expected: `packages/server/src/parser/worker.ts` initializes grammar parsers at module top-level (not per-call), maintains a per-file tree cache Map for incremental parsing, and exports both a default parse handler and a named evictFile function.
result: pass

### 8. ParserPool API
expected: `packages/server/src/parser/ParserPool.ts` exports a ParserPool class wrapping piscina with parseFile(), parseBatch(), evictFile(), destroy(), and stats() methods.
result: pass

### 9. Pipeline Integration
expected: `packages/server/src/pipeline/Pipeline.ts` exports a Pipeline class that wires FileWatcher batches to ParserPool, with start(), stop(), onResult callback, EXTENSION_TO_LANGUAGE map, and ENOENT-as-removal handling.
result: pass

### 10. Native Dependencies Load
expected: tree-sitter@0.21.1 loads without error. All grammar packages (tree-sitter-typescript, tree-sitter-javascript, tree-sitter-python) are installed. piscina@5 is available.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
