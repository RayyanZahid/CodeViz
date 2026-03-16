# Phase 3: Dependency Graph Model - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

In-memory directed dependency graph that updates incrementally from parse results, computes typed deltas, detects circular dependencies, and persists state to SQLite. This is the central data structure consumed by inference (Phase 4) and WebSocket streaming (Phase 5). Creating posts, UI rendering, and architectural classification are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Node & edge data model
- Nodes represent files, but edges carry the specific imported symbols (file + key exports granularity)
- Each edge from A→B includes the list of symbol names imported (e.g., `['UserService', 'AuthMiddleware']`)
- Only static imports tracked as edge type — no dynamic import or re-export distinction needed
- Node metadata: Claude's discretion based on what downstream phases (inference, canvas, UI) need

### Delta format & consumers
- Deltas are three-state: added, removed, and modified (nodes whose exports changed but file still exists)
- Each delta carries a monotonic version counter for ordering and "give me changes since vN" replay
- Deltas include the list of trigger file paths that caused the update — useful for activity feed and debugging
- Downstream consumers (inference engine, WebSocket layer) subscribe via event emitter pattern — graph emits 'delta' events

### Circular dependency handling
- Cycles listed in a separate `cycles` field on the delta as ordered paths `[A → B → C → A]`
- Cycles reported only on change — when newly created or broken, not on every delta
- Severity tiers based on impact scope: cycles involving many dependents = high severity, isolated cycles between leaf files = low severity (graph centrality-based)

### Claude's Discretion
- Specific node metadata fields (path, language, size, exports — pick what downstream needs)
- Batching/consolidation debounce window and merge strategy for rapid file changes
- Exact severity tier boundaries and centrality algorithm for cycle classification
- SQLite write-through granularity and startup loading strategy

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

*Phase: 03-dependency-graph-model*
*Context gathered: 2026-03-15*
