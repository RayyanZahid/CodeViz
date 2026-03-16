# Phase 9: Inspector Panel - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Click any component node on the canvas to see its full architectural details in a sidebar panel — component name, zone, files, key exports, and dependencies in/out. This phase delivers the inspector panel UI and wiring; it does not add new data to the pipeline (Phase 8 already delivers all needed fields).

</domain>

<decisions>
## Implementation Decisions

### Interaction Model
- Click a node to open the inspector; click a different node to **swap instantly** (no close/reopen animation)
- Close via **X button, ESC key, or click on empty canvas** — all three dismissal methods
- Dependency names in the inspector are **clickable navigation links** — clicking one selects that component, swaps inspector content, and **pans/centers the canvas** on the newly selected node
- Single-click only — no double-click or long-press interactions

### Content Layout and Density
- Sections: **Component Name + Zone**, **Files**, **Key Exports**, **Dependencies Out**, **Dependencies In**
- All sections are **collapsible with toggles, all open by default** — user can close what they don't need
- File list: show first 5 files, then a **"Show N more" expand toggle** for components with 10+ files
- Dependency display: **component name + count badge** (e.g., "Database (4 imports)") — no individual symbol listing
- Visual style: **dark card with subtle section dividers** matching the existing app theme — not IDE/monospace

### Claude's Discretion
- Panel placement (right sidebar vs. other) and width
- Selection highlight style on the selected canvas node
- Exact animation/transition when swapping between nodes
- Empty state if no component is selected
- Scroll behavior within the panel

</decisions>

<specifics>
## Specific Ideas

- Dependency links should feel like navigating a wiki — click a dependency name, you're instantly looking at that component
- Pan-to-component on dependency click should be a smooth animation, not a jump
- The inspector should feel lightweight — not a heavy modal, just a panel that's always available when you click

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-inspector-panel*
*Context gathered: 2026-03-16*
