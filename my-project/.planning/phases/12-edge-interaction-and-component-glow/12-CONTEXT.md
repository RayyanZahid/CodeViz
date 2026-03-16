# Phase 12: Edge Interaction and Component Glow - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can interact with edges to understand dependencies (hover tooltip, click-to-highlight endpoints), a thickness legend explains edge weight, and changed components pulse visually to draw attention. Requirements: EDGE-01, EDGE-02, EDGE-03, GLOW-01, GLOW-02.

</domain>

<decisions>
## Implementation Decisions

### Edge tooltip design
- Tooltip follows the cursor position along the edge (tracks mouse)
- Shows: source component, target component, dependency count, import symbols
- Import symbols displayed as comma-separated list (e.g. "parseFile, buildGraph, NodeType")
- If 5+ imports, show first 5 then "+ N more" (e.g. "parseFile, buildGraph, NodeType, + 8 more")

### Click-to-highlight behavior
- Clicking an edge highlights both endpoint components AND dims non-connected nodes to low opacity
- The clicked edge itself gets thicker and changes to an accent color
- Smooth 200-300ms transition for the highlight/dim effect
- Dismiss via: clicking canvas background, clicking a different edge (switches highlight), or pressing Escape

### Thickness legend
- Positioned in the bottom-left corner of the canvas
- Always visible (no toggle needed)
- Format: three horizontal line samples (thin, medium, thick) with descriptive text labels like "1-3 deps", "4-8 deps", "9+ deps"
- Semi-transparent card background so underlying graph is partially visible

### Glow and fade visuals
- When a component's files change, the node pulses/glows for 2-3 seconds
- If multiple files change in rapid succession, each new change resets the pulse timer (keeps glowing while actively changing)
- After the pulse, a bright border remains and fades opacity over 30 seconds
- Pulse and 30-second fade border use the same color (visually linked)

### Claude's Discretion
- Tooltip visual style (dark background vs light card — match existing UI)
- Glow/pulse color choice (fit the existing palette)
- Exact thickness breakpoints for thin/medium/thick
- Pulse animation easing and exact timing
- Edge hit-target width for hover/click detection

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

*Phase: 12-edge-interaction-and-component-glow*
*Context gathered: 2026-03-16*
