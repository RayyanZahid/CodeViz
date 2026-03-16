# Phase 8: Data Pipeline Repair - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the data plumbing so component fields (fileCount, keyExports, dependencyCount) and component-level IDs flow correctly from backend to frontend. This is infrastructure that unblocks all v2.0 sidebar panels (Inspector, Risk, Activity Feed).

Requirements: PIPE-01, PIPE-02, PIPE-03, PIPE-04

</domain>

<decisions>
## Implementation Decisions

### ID mapping strategy
- Translation happens in the **WebSocket plugin layer** — inference emits file-level IDs, WebSocket plugin maps them to component IDs before broadcasting to client
- File-to-component mapping is an **in-memory map** rebuilt from the current graph state on startup, updated as components change — no SQLite table needed
- **1:1 strict mapping** — each file belongs to exactly one component, no many-to-many
- **Unmapped files are skipped** — don't broadcast events for files not yet mapped to a component; they appear after the next inference cycle

### Error visibility
- Client-side: **console warning + skip** when a WebSocket message fails Zod validation — log to browser console, don't show in UI
- **Show nodes with fallbacks** for missing fields — render immediately with placeholders ("0 files", "No exports") rather than waiting for complete data
- **Small status dot** in UI corner showing pipeline health (green/yellow/red for connected/reconnecting/error)
- Server-side: **log + continue** on pipeline errors (parse failures, graph issues) — one bad file doesn't block the whole pipeline

### Claude's Discretion
- Exact Zod schema field definitions and types
- How to rebuild the in-memory file→component map from graph state
- Where to place the status dot in the UI layout
- Schema strictness mode (strip unknown fields vs. passthrough)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The idea doc provides detailed technical guidance on which files and schemas need fixing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-data-pipeline-repair*
*Context gathered: 2026-03-16*
