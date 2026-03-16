# Phase 5: WebSocket Streaming and Client State - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Stream graph deltas from backend to browser over WebSocket using delta-only messages with version tags. Client applies patches to a Zustand state store with automatic reconnect recovery. This phase delivers the real-time transport layer between the pipeline (Phase 4) and the visualization (Phase 6). It does not include canvas rendering, layout, or UI panels.

</domain>

<decisions>
## Implementation Decisions

### Reconnection experience
- Top banner across the screen when connection drops (like GitHub's offline banner), persistent until reconnected
- Canvas remains fully interactive during disconnection — pan, zoom, inspect all work; data is frozen at last known state
- Silent recovery on reconnect — banner disappears, missed updates apply instantly, no toast or summary
- Keep retrying forever with exponential backoff — never give up; user can browse stale data indefinitely

### State recovery behavior
- Instant snapshot on reconnect/reopen — server sends full graph state, graph appears fully formed with no animation
- Viewport (zoom level, pan position) restored from browser localStorage on reconnect
- Brief change summary when significant changes occurred while away — small indicator like "+12 nodes, +8 edges since last visit"

### Update delivery feel
- Batched updates — collect changes over a short window (~500ms) and apply as one batch for smoother visual transitions
- No visual highlighting at the delta/transport level — Phase 6's activity overlay handles all visual emphasis
- Version tags are internal only — used for reconnect recovery, not exposed to UI components
- Client-side throttle — Zustand store accepts all updates but downstream subscribers are throttled to ~60fps render rate

### Error and stale data handling
- Malformed/unrecognized messages: silent drop, log to console only
- Version gap detected (out of sync): show brief "Syncing..." indicator while auto-requesting full snapshot from server, then dismiss
- Server restart: treat identically to reconnection flow — same banner, same recovery path
- Project directory unavailable: distinct error state in banner — "Project directory unavailable" rather than generic connection loss

### Claude's Discretion
- WebSocket message serialization format
- Exact exponential backoff timing parameters
- Zustand store internal structure and selector patterns
- Version tagging scheme implementation
- Batch window tuning

</decisions>

<specifics>
## Specific Ideas

- Connection banner should be distinct from the "Syncing..." stale-data indicator and the "Project directory unavailable" error — three distinct states
- The transport layer should be a clean data pipe: no visual concerns, no rendering decisions — just deliver deltas to the store
- Change summary on reconnect ("+X nodes") is informational only, not interactive

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-websocket-streaming-and-client-state*
*Context gathered: 2026-03-15*
