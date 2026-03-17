# Phase 14: Schema Foundation and Shared Types - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Persist graph snapshots with layout positions to SQLite using Drizzle, define intent session tables, and wire shared TypeScript types for all replay and intent messages across server and client. This phase creates the data foundation and type contracts that phases 15-18 build on. No UI, no replay logic, no intent analysis — just schema and types.

</domain>

<decisions>
## Implementation Decisions

### Snapshot data shape
- Full state snapshots: every snapshot contains the complete graph (nodes, edges, positions) — not deltas
- Exact canvas positions: store pixel-level x,y per node so replay shows the exact layout the user saw
- Everything on the node: all attributes including type, label, filePath, metrics, connections
- Full edge metadata: dependency type, weight, and all edge attributes stored
- Include inferred patterns: layers, clusters, risk scores captured per snapshot for pattern evolution replay
- Store human-readable summary per snapshot (e.g., "15 nodes, 22 edges, 3 layers") for quick timeline browsing
- Store trigger files: record which file paths changed to trigger the snapshot, for "what happened" context
- Single JSON blob column for graph data (nodes, edges, positions) — not normalized tables
- Session-scoped: each snapshot tagged with watch-root path and session ID
- Sequence number + timestamp: monotonically increasing integer for deterministic ordering, timestamp for display

### Delta threshold strategy
- Hybrid trigger: structural changes (new/removed nodes or edges) trigger immediate snapshot; minor changes (metric updates, attribute changes) accumulate until 10-event threshold
- Debounce 2-5 seconds between snapshots to prevent burst flooding during bulk operations
- Hardcoded defaults: threshold values are internal, not user-configurable
- Always capture initial snapshot after initial scan completes (full graph built) when a watch session starts
- Storage cap with FIFO pruning: auto-remove oldest snapshots when total exceeds size threshold
- Initial snapshot timing: captured after initial scan completes, not on empty state

### Intent session model
- Continuous objective model: one intent session = one detected objective, ends when focus shifts
- Two-level hierarchy: top-level objective contains sub-tasks (JSON array within session row)
- Evidence-based confidence: confidence score represents strength of supporting evidence (many matching events = high)
- Linked to snapshot range: each intent session has start_snapshot_id and end_snapshot_id
- Clean transitions: focus shift closes old session and opens new one — at most one active intent at a time
- Store evidence: list of contributing event IDs/files for classification drill-down
- Store risk snapshot: active risk scores captured at intent session time for historical context
- Session-scoped: same watch-root/session scoping as snapshots
- Predefined intent categories: fixed enum of 4-6 coarse categories (Claude determines specific categories based on AI agent behavior patterns)
- Keep all intent sessions within a watch session — no pruning until watch-root switch

### Message protocol design
- Extend existing protocol: new timeline/replay message types added to current WebSocket message union
- Data + API types: shared timeline.ts exports both domain types (SnapshotMeta, IntentSession) and request/response wrapper types for API endpoints
- Push for live, request for replay: server pushes new snapshot/intent notifications in real-time; client requests specific snapshots during replay
- Lightweight push: notifications include metadata only (ID, timestamp, summary) — client fetches full data when needed

### Claude's Discretion
- Exact debounce timing within the 2-5 second range
- Storage cap size threshold (guided by 20MB/4hr budget)
- Specific 4-6 intent category enum values
- Drizzle table column types and index choices
- TypeScript type naming conventions (following existing project patterns)
- Compression strategy for JSON blob if needed

</decisions>

<specifics>
## Specific Ideas

- Snapshots should be self-contained: reading a single snapshot row should give you everything needed to render the full architecture view at that point in time
- The success criteria explicitly mention O(50-max) reconstruction in Phase 15 — the full-state approach in Phase 14 means reconstruction is trivially O(1) per snapshot, giving Phase 15 flexibility to add checkpointing on top if needed
- Intent sessions should tell a story: "the agent was building auth (high confidence, 12 matching events), then shifted to fixing tests (medium confidence, 5 events)"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-schema-foundation-and-shared-types*
*Context gathered: 2026-03-16*
