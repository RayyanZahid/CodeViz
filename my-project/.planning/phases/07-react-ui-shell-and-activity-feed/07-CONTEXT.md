# Phase 7: React UI Shell and Activity Feed - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Three React UI panels — activity feed, node inspector, and risk panel — that connect inference output to readable user-facing interfaces. Completes the MVP: a developer can glance at the screen and instantly understand what the agent is building. Canvas rendering is done (Phase 6); this phase adds the surrounding UI shell and panels.

</domain>

<decisions>
## Implementation Decisions

### Activity Feed Narration
- Batch rapid successive changes into summaries (e.g., "5 components updated in AuthModule") rather than showing each individually
- Terse technical tone: short, precise descriptions like "AuthService created → depends on UserRepo, TokenStore"
- Color-coded icons per event type (green for creation, orange for risk, blue for dependency change)
- Keep last ~50 events visible, auto-prune older entries for performance

### Panel Layout & Arrangement
- Right sidebar stack: all three panels stacked vertically, canvas takes the main area
- All panels independently collapsible to give more canvas space
- Fixed sidebar width (no drag-to-resize)
- Panel order top to bottom: Inspector → Risk → Feed

### Risk Panel Presentation
- Color-coded severity levels: red/orange/yellow for critical/warning/info
- Reviewed risks collapse into a "3 reviewed" counter (expandable if needed), rather than staying visible
- Clicking a risk highlights affected node(s) on the canvas and pans to them
- Badge count on collapsed panel header shows unreviewed risk count

### Node Inspector
- Shows three sections: affected files, dependency list (depends on / depended by), and recent changes
- Opens by expanding the inspector section in the sidebar (not a floating popover)
- Single-node mode: clicking a different node replaces the current inspector view
- Selecting a node highlights its dependency edges on the canvas

### Claude's Discretion
- Exact color palette and icon choices for event types and severity
- Sidebar width value
- Panel collapse/expand animation style
- Empty state messaging for each panel
- Glow/pulse animation implementation for active components (UI-03, UI-04)

</decisions>

<specifics>
## Specific Ideas

- Activity feed should feel like a build log — scannable, not chatty
- Risk panel reviewed-state collapse keeps the panel compact while preserving access to history
- Cross-panel interaction is important: risk items link to canvas nodes, inspector highlights dependency edges

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-react-ui-shell-and-activity-feed*
*Context gathered: 2026-03-15*
