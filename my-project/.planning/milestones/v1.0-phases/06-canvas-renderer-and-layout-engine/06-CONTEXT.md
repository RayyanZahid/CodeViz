# Phase 6: Canvas Renderer and Layout Engine - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The architecture map renders on an HTML5 Canvas at 60fps with stable semantic zone layout, viewport culling, zoom and pan navigation, and activity overlays. This is the visual core of ArchLens — nodes grouped into semantic zones with glow effects showing where the agent is working. Creating UI panels (activity feed, risk panel, inspector) is Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Node & edge visuals
- Rounded rectangle nodes — clean boxes with rounded corners, label inside
- Color-coded fills per zone type — each node type (frontend, API, services, data stores, infrastructure) gets a distinct background color
- Node size scaled by connection count — nodes with more dependencies are slightly larger, highlighting hub components
- Curved bezier edges with arrowheads showing dependency direction

### Zone layout presentation
- Subtle background shading behind each zone — zones visible but don't compete with nodes
- Zone labels (e.g., "Frontend", "Services") visible at low zoom levels, hidden when zoomed in
- Compact layout — nodes close together, maximize visible nodes for big-picture view
- Fixed zone proportions — zones occupy fixed canvas regions regardless of node count, predictable layout

### Activity glow & overlays
- Glow color matches a brighter version of the node's own zone color — stays cohesive with palette
- Static glow + decay — solid bright glow that slowly dims over 30 seconds, no pulsing
- Edges glow too — when a node glows, its dependency edges also light up showing ripple of activity
- All active nodes glow simultaneously during burst activity (e.g., large refactor) — shows full scope

### Navigation & interaction
- Zoom via scroll wheel + explicit +/− buttons in corner for keyboard users
- Toggleable minimap — small minimap showing full graph with viewport indicator, can be hidden
- Click to select + highlight — clicking a node selects it and highlights its direct dependencies (Phase 7 inspector hooks into this)
- Fit-to-view button + auto-fit on initial load — canvas fits the entire graph when first loaded, button to reset

### Claude's Discretion
- Exact color palette for zone fills and node types
- Edge curve tension and routing to avoid overlaps
- Label font sizing and truncation at different zoom levels
- Minimap size, position, and styling
- Glow intensity and exact decay curve
- Node border styling and selection highlight appearance
- Keyboard shortcuts for navigation (if any)

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches for canvas graph visualization. Key constraints are performance (60fps at 300 nodes) and layout stability (sticky positions for existing nodes).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-canvas-renderer-and-layout-engine*
*Context gathered: 2026-03-15*
