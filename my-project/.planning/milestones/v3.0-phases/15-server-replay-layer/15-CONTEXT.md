# Phase 15: Server Replay Layer - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build server-side snapshot recording with checkpoint-based reconstruction and heuristic intent analysis. The server records graph snapshots automatically, can reconstruct any historical snapshot in O(50-max) operations, and emits inferred intent sessions over WebSocket. Exposes REST endpoints for timeline metadata, individual snapshot retrieval, and intent sessions.

</domain>

<decisions>
## Implementation Decisions

### Intent Categories
- Use 6 action-oriented coarse categories: Adding Feature, Refactoring, Bug Fix, Dependency Update, Test Coverage, Cleanup
- Track focus transitions — emit a "focus shifted" event when the classified category changes mid-session
- On focus shift, close the current intent session and open a new one with the new category (clean separation)
- Classification signals: file patterns (e.g., test files -> Test Coverage, package.json -> Dependency Update) combined with graph topology changes (new edges -> Adding Feature, removed edges -> Refactoring, cycle changes -> Cleanup)

### Checkpoint Strategy
- Fixed interval: every 50 snapshots becomes a full checkpoint (matches O(50-max) success criteria exactly)
- Checkpoint creation is synchronous — happens inline during the 50th snapshot write
- Retention: keep last N checkpoints (not indefinite); prune older checkpoints to bound storage

### Timeline API Shape
- `GET /api/timeline` returns all snapshot metadata at once (no pagination) — assumes <1000 snapshots per session
- Per-snapshot metadata is minimal: ID, sequence number, timestamp, node count
- `GET /api/snapshot/:id` returns a bundled response: nodes, edges, and positions in a single payload (one round trip)
- Intent sessions have a separate endpoint: `GET /api/intents` — decoupled from timeline data

### Intent Confidence & Surfacing
- Always emit all intents over WebSocket regardless of confidence level — client decides display threshold
- Confidence score is a 0-1 float (probability-style)
- IntentAnalyzer re-evaluates past classifications as more events arrive — confidence and category can update
- Focus shifts create new intent sessions (closed current + opened new) rather than updating the existing session

### Claude's Discretion
- Exact heuristic weights for file pattern vs topology signals
- Checkpoint retention count (N) — pick a reasonable default
- Internal data structures for delta replay
- Error handling for corrupted or missing checkpoints
- WebSocket message format for intent updates and re-evaluations

</decisions>

<specifics>
## Specific Ideas

- Intent categories should feel like what a developer would naturally say: "the agent is adding a feature" or "the agent is refactoring" — action-oriented language
- Re-evaluation means the client may receive updated confidence scores for the same intent session — the WebSocket protocol needs to handle "intent:updated" alongside "intent:started" and "intent:ended"
- Bundled snapshot response keeps the client simple for Phase 17: one fetch, one render

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-server-replay-layer*
*Context gathered: 2026-03-16*
