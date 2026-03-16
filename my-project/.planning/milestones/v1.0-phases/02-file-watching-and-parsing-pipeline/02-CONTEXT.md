# Phase 2: File Watching and Parsing Pipeline - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The system detects file changes in a watched directory and produces typed parse results (imports, exports, call relationships) using incremental tree-sitter parsing. This is the data input layer for all downstream components. File watcher setup, tree-sitter parsing with worker threads, and the output contract are in scope. Graph construction, inference, and visualization are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Watch scope and filtering
- Smart defaults with override: ship with sensible ignore patterns (node_modules, .git, dist, build, coverage, etc.), user can customize via .archlens.json
- Extension filter at the watcher level: only emit events for parseable extensions (.ts, .tsx, .js, .jsx, .py) — ignore all others before they reach the parser
- Skip config files: don't watch package.json, tsconfig.json, .env, etc. — only source code files that produce parse results
- Ignore symlinks: only watch real files within the watched directory tree, do not follow or resolve symlinks

### Output contract shape
- Per-file results grouped in a batch: one batch event containing an array of per-file parse results, preserving the context of what changed together within the debounce window
- Project-relative paths from the start: normalize file paths to project-relative immediately (e.g., 'src/auth/service.ts') rather than passing raw absolute paths downstream
- Explicit removal events: watcher emits a typed 'file-removed' result in the batch so the graph model receives an explicit deletion signal — no inference required
- Per-result monotonic sequence number: each parse result carries a monotonic ID for strict ordering, even within a batch

### Claude's Discretion
- Parse extraction depth (direct calls vs method chains vs decorators)
- Error handling strategy for syntax errors, binary files, and huge files
- Worker thread pool sizing and task distribution
- Tree-sitter grammar initialization and caching strategy
- Exact debounce implementation details within the 200ms window

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-file-watching-and-parsing-pipeline*
*Context gathered: 2026-03-15*
