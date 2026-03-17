# Phase 16: Client State Layer and Mode Isolation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can enter and exit replay mode, and live WebSocket deltas are completely blocked from mutating the displayed graph while in replay mode. This phase delivers the client-side state layer (mode management, delta buffering, snapshot rendering) and the UI chrome for mode indication. The timeline slider and intent panel UI are Phase 17 — this phase provides the programmatic entry point and the exit UX.

</domain>

<decisions>
## Implementation Decisions

### Mode Indicator
- Full-width amber/yellow banner across the top of the app when in replay mode
- Banner text: "REPLAY MODE" + the timestamp of the point being viewed (e.g., "REPLAY MODE — Mar 16, 2:30 PM")
- "Return to Live" button right-aligned inside the banner
- Button has a subtle pulse/glow animation to draw attention
- Live event counter displayed in the banner showing buffered events (e.g., "3 live events pending")

### Enter/Exit Replay
- Replay mode entered programmatically only (store action) — no UI entry point in Phase 16; Phase 17 adds timeline slider
- Exit is instant — no confirmation dialog
- Escape key as keyboard shortcut to exit replay
- Switching watch directory during replay auto-exits replay mode first, then switches
- Selected node preserved on exit if the node still exists in the live graph; cleared if removed
- Replay mode accessible even when disconnected — works with locally cached snapshot data
- All incoming data during replay is buffered (including reconnection recovery + new deltas) — nothing mutates the displayed graph

### Transition Behavior
- **Enter replay:** Nodes morph/animate from live positions to historical positions; added/removed nodes fade in/out
- **Exit replay:** Same morph animation back to live positions (consistent both directions)
- Full morph on exit: new nodes fade in, removed nodes fade out, existing nodes animate to new positions
- Viewport auto-zooms (smooth animated, ~500ms) to fit the historical graph on entry
- If snapshot includes stored node positions, use those exact positions (authentic historical view)
- Dragged positions during replay remembered for the current session but not persisted
- Nodes that don't exist at the replay point are hidden — no ghost/overlay
- Subtle cool blue tint on nodes/edges during replay to visually distinguish from live view
- If historical graph has 0 nodes, show empty canvas with centered message: "No architecture at this point in time"
- Smooth animated viewport zoom on replay entry (~500ms)

### Sidebar Behavior During Replay
- Activity feed filtered to show only events up to the replayed moment
- Risk panel filtered to show only risks that existed at the replay point
- Node inspector shows historical metadata (file stats as they were at the replay point, if snapshot data includes it)
- Minimap updates to reflect the historical graph

### Catch-up on Exit
- Buffered live events applied instantly (no animated catch-up) — graph jumps to current live state
- Activity feed shows both: a highlighted separator with summary ("12 events during replay") followed by individual events
- Events capped at 50 (matching existing feed cap) — summary shows total count if more
- Highlighted divider line with "Events during replay" label provides clear visual break

### Claude's Discretion
- Exact animation timing and easing curves for morph transitions
- Cool blue tint intensity and CSS implementation
- Pulse animation style for the "Return to Live" button
- Buffer data structure for holding live events during replay
- Zustand store architecture for mode state (new store vs extending existing)
- How to intercept WebSocket messages at the entry point during replay

</decisions>

<specifics>
## Specific Ideas

- Amber banner inspired by GitHub's "you're viewing a fork" pattern — full-width, clear, non-dismissible
- Cool blue tint on replay graph to create a "looking at the past" feeling — contrasts with amber banner (warm indicator, cool content)
- Morph animation should feel like watching the architecture evolve/devolve — nodes smoothly moving, appearing, disappearing
- The buffered event counter in the banner creates urgency/awareness without being intrusive

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-client-state-layer-and-mode-isolation*
*Context gathered: 2026-03-17*
