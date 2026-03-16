# Pitfalls Research

**Domain:** Adding time-travel replay and intent inference to existing real-time architecture visualization (ArchLens v3.0)
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH (core pitfalls grounded in event sourcing literature, Redux DevTools implementation lessons, canvas animation experience, and direct inspection of the existing codebase)

> This document supersedes the v1.0 PITFALLS.md and focuses exclusively on the hazards introduced by adding temporal navigation and intent detection to the live ArchLens system. The system already ships correctly — the risk is breaking what works while adding what is new.

---

## Critical Pitfalls

### Pitfall 1: Live View Corrupted by Replay Mode — Missing Mode State Machine

**What goes wrong:**
When the user scrubs to a historical point, the system must stop applying incoming WebSocket deltas to the visible graph. Without an explicit, enforced mode state machine, incoming live events continue to arrive and get applied to the historical view — producing a hybrid "live-at-t=old + some new edges" graph that is neither the historical state nor the current state. The canvas shows a corrupted graph. Users cannot tell what time they are viewing.

**Why it happens:**
The existing `graphStore` has a single source of truth for nodes and edges. Adding a "historical view at time T" without freezing that store causes live `applyDelta` calls — still firing from `wsClient` — to mutate the displayed state. Developers often add a `paused` boolean to guard the UI but forget to update the `wsClient` logic or the `applyDelta` action itself, leaving partial paths that still write through. The error is silent: the graph looks plausible but is wrong.

**How to avoid:**
- Design a formal mode state machine: `{ mode: 'live' | 'replay', replayVersion: number | null }`. The mode must live in a dedicated `timelineStore`, not inside `graphStore`.
- In `wsClient`, check `timelineStore.mode` before calling `graphStore.applyDelta`. In replay mode: buffer incoming deltas in memory (or discard them) but never apply them to the visual state.
- On return to live mode: apply the buffered deltas to fast-forward, or re-request a full snapshot from the server for the current live state.
- The displayed graph (`graphStore.nodes`, `graphStore.edges`) should be a derived read from either live state or replay state — not the same mutable map used for both.
- Test explicitly: open time-travel, scrub to t-minus-5-minutes, then write a file, confirm the canvas does NOT change.

**Warning signs:**
- Newly-created nodes appear while scrubbing to a historical point
- Edge counts or risk badges fluctuate during replay without user interaction
- Returning to live mode from replay shows graph in an intermediate state
- `applyDelta` call count continues to tick upward in replay mode (check with debug logging)

**Phase to address:** Snapshot storage phase (the very first replay-related phase). The mode state machine must exist before any replay UI is built — it is the foundation everything else plugs into.

---

### Pitfall 2: Graph Snapshot Storage That Grows Without Bound

**What goes wrong:**
The naive implementation stores a full snapshot of the entire graph (all nodes, all edges, all zone assignments) at every architectural event. A medium-sized codebase watched for 8 hours might generate 2,000+ events. Each full snapshot at 300 nodes × ~500 bytes per node = 150KB per snapshot → 300MB of snapshot data in the SQLite file for one session. WAL file balloons. Queries against the snapshot table slow. The existing `changeEvents` table was already flagged in v1.0 research as requiring compaction.

**Why it happens:**
Full snapshots are the obvious first implementation: "store the whole graph at each interesting moment." The storage cost is invisible in development because developers test with small codebases and short sessions. In production with real agent workflows (8-hour sessions, large codebases), the cost compounds.

**How to avoid:**
- Use delta-based snapshot storage, not full snapshots. Store only what changed at each event: added nodes, removed nodes, changed edges, zone updates. This is already the shape of `GraphDelta` and `InferenceResult` — persist those directly.
- Store one full baseline snapshot per session start (when the watched directory is set), then deltas from that baseline.
- To reconstruct graph state at time T: load the baseline snapshot, then apply all deltas up to T in sequence.
- Add a compaction strategy: compact deltas older than 7 days into a new baseline. Run compaction on server start, not inline with writes.
- Add a `snapshot_versions` table with `(session_id, baseline_timestamp, version_count)` so the compaction trigger is data-driven.
- Monitor `changeEvents` table row count: add a startup log line that warns if it exceeds 10,000 rows without compaction.

**Warning signs:**
- SQLite database file exceeds 50MB after a single long session
- WAL file grows continuously and never checkpoints
- Server startup time increases as sessions accumulate (loading all events on boot)
- `SELECT COUNT(*) FROM change_events` returns more than 5,000 rows after a week

**Phase to address:** Snapshot storage schema phase. The delta-only storage model must be the design from the start — migrating from full-snapshot to delta-based storage after the fact requires a data migration and a rewrite of the reconstruction logic.

---

### Pitfall 3: Snapshot Reconstruction Becoming O(N) Events Every Scrub

**What goes wrong:**
The user drags the timeline scrubber. For every scrub position, the system reconstructs the graph state by replaying all events from the beginning up to that point. With 2,000 stored events, a scrub across the full timeline triggers up to 2,000 × scrub-position-count event replays. The UI freezes or stutters visibly. Dragging the scrubber feels sluggish. Users stop using the feature.

**Why it happens:**
The delta-only storage model (recommended in Pitfall 2) solves storage but introduces an O(N) reconstruction cost. This is the canonical event sourcing tradeoff. Developers who build the storage layer correctly often delay addressing the reconstruction performance until user testing, by which point it is a retrofit.

**How to avoid:**
- Pre-compute periodic "checkpoint" snapshots at every 50 events (configurable). Checkpoints are full graph state, stored alongside the delta log.
- Reconstruction = load the nearest checkpoint before T, then apply deltas from the checkpoint to T. Worst case: replay 49 deltas, not 2,000.
- Cache the most recently accessed checkpoint in memory on the server. Timeline scrubbing on a recent window (the last 10 minutes) should be instantaneous — no DB read required.
- Compute checkpoints asynchronously on write: after every 50th delta write, run checkpoint computation in the background (next event loop tick), not inline with the request.
- On the client, preload the checkpoint data for the visible window of the timeline slider before the user starts dragging — not on first drag.

**Warning signs:**
- Scrubbing the timeline slider causes visible frame drops or delayed canvas updates
- Server CPU spikes during timeline drag events
- Timeline response latency exceeds 200ms for scrub positions in old history
- DB query plans show full table scans on `change_events` during replay requests

**Phase to address:** Replay API phase. Checkpoint strategy must be designed at the same time as the replay endpoint — not added as a performance fix after the API ships.

---

### Pitfall 4: Node Layout Positions Absent from Snapshots — Replay Shows Wrong Positions

**What goes wrong:**
The snapshot includes node IDs, edge IDs, and zone assignments, but not the x/y canvas positions. When the user replays to a historical moment, the client receives the historical graph topology but uses current layout positions. Nodes that were in different positions historically are shown where they are today. Nodes that did not exist at the historical time have no position at all and appear at the canvas origin (0,0).

**Why it happens:**
Layout positions are stored in a separate `layoutPositions` table (decoupled from graph structure). Snapshot logic snapshots the graph topology but does not join with `layoutPositions`. Position persistence was designed for live-view session continuity, not for temporal replay. This is a subtle schema omission that only becomes visible when replay is implemented.

**How to avoid:**
- Include the `layoutPositions` table in the snapshot delta. Every time a node is first placed, record its `(nodeId, x, y)` as part of the snapshot event payload.
- For replay, send position data alongside node data in the reconstructed snapshot sent to the client.
- Extend the snapshot schema: add a `positions` field to the delta format. This is backward-compatible — live view ignores it, replay uses it.
- In the client's replay rendering path, use historical positions from the snapshot rather than the current `layoutPositions` map.
- When nodes that did not exist at time T are hidden (as they should be), their current position in the canvas must not "leak through" into the replay view.

**Warning signs:**
- Historical replay shows the current node layout, not the layout as it was at the historical moment
- Deleted nodes (that no longer exist) appear at origin (0,0) during replay
- Node clustering patterns look identical across all replay positions despite topology differences
- The canvas "jumps" as positions snap when returning from replay to live

**Phase to address:** Snapshot storage schema phase. Position inclusion must be part of the initial snapshot format design, not a second pass.

---

### Pitfall 5: Timeline UI Blocking Live Updates — Scrubber Pauses the Entire System

**What goes wrong:**
To implement "pause on scrub", the developer adds a global `isPaused` flag that also gates the backend pipeline (stops the file watcher, stops the inference engine, or stops WebSocket sends). The user can no longer see live updates while in replay mode. Returning from replay to live requires a full re-initialization. Alternatively, the scrub triggers synchronous server-side computation that blocks the main Fastify request handler during replay reconstruction, making all API requests fail.

**Why it happens:**
The simplest "pause" implementation is to stop everything. The distinction between "pause the DISPLAY" and "pause the PIPELINE" is subtle. Backend developers naturally implement a single pause point at the data source. The existing `Pipeline` and `InferenceEngine` are tightly integrated — adding a pause flag to them risks stopping writes to SQLite that are needed to reconstruct future replays.

**How to avoid:**
- The pipeline NEVER pauses during replay. It continues writing file-change events and graph deltas to SQLite regardless of client mode.
- Only the WebSocket SEND path for live graph deltas is paused on the client side (by discarding incoming messages, not by stopping the server).
- Replay reconstruction happens on a separate server endpoint (`GET /api/replay?version=N`) that is read-only and uses a separate SQLite read connection.
- Use Fastify's async plugin model: replay requests run in their own async context and never block the pipeline's synchronous SQLite writes.
- In the client: buffer incoming live WebSocket messages while in replay mode, then apply the buffer when returning to live mode (fast-forward).

**Warning signs:**
- File changes during replay are not detected when the user returns to live mode
- The pipeline status dot goes red during replay (watcher stops)
- Returning from replay requires refreshing the page
- Fastify request logs show pipeline-related requests queued behind replay reconstruction

**Phase to address:** Replay API and mode state machine phases. The separation between "display pause" and "pipeline pause" must be an explicit design constraint, not discovered during implementation.

---

### Pitfall 6: Intent Inference Pattern Window Too Narrow or Too Wide

**What goes wrong:**
The intent inference system groups file changes into "intent sessions" based on a time window. If the window is too narrow (30 seconds), every individual file save becomes its own "objective" — the inference engine reports 50 separate micro-objectives in a 5-minute coding session instead of 1-3 high-level goals. If the window is too wide (30 minutes), unrelated tasks collapse into a single objective — an agent that refactors auth and then adds a UI component appears to be doing one unified task.

**Why it happens:**
The temporal window is a hyperparameter that developers set once based on intuition or a single test case. AI coding agents have variable activity patterns: they burst many files in seconds, then pause, then burst again. A fixed window cannot handle this bimodal distribution. The error is that developers calibrate the window against their own workflow, not against real agent sessions.

**How to avoid:**
- Use activity-gap detection, not a fixed time window. A new intent session starts when there is a gap of N seconds with no file changes. This naturally handles agent pause patterns.
- Start with a 60-90 second inactivity gap as the session boundary.
- Within a session, require a minimum of 3 file changes before inferring any objective. Single-file saves are never enough signal.
- Layer the inference: micro-session (activity burst) → macro-session (multiple bursts toward one goal). Infer objectives at the macro level.
- Build a calibration path: log inferred objectives alongside actual change patterns, output to a debug panel. Review real agent sessions to tune the gap threshold.

**Warning signs:**
- Intent panel shows 20+ "objectives" for a 30-minute session
- Objectives like "edited one file" appear — minimum signal threshold not enforced
- Two clearly separate tasks (auth refactor, then UI work) appear as one combined objective
- The gap threshold was chosen without reviewing actual agent session timing data

**Phase to address:** Intent inference engine phase. The session-boundary logic is the first algorithm to implement and must be validated against real agent session data before the UI consumes it.

---

### Pitfall 7: Intent Classification Taxonomy Too Granular — Precision Without Coverage

**What goes wrong:**
The intent classifier distinguishes between 15+ objective categories: "refactor service", "add feature", "fix bug", "add tests", "update schema", "add API endpoint", etc. With a purely heuristic/pattern-based classifier (no LLM), most sessions get classified as "unknown" or "general refactor" because the heuristics are too specific to match the diversity of real agent workflows. The intent panel shows "Unknown objective" for 80% of sessions and provides no value.

**Why it happens:**
Developers design the taxonomy for the ideal case (perfectly structured, semantically labeled code changes) rather than for the messy real case (agents creating files in multiple unrelated zones, deleting and recreating files, changing config alongside source). The heuristics overfit to the training examples the developer had in mind. This mirrors the v1.0 inference noise pitfall but at a higher semantic level.

**How to avoid:**
- Start with 4-6 coarse categories only: "building new feature", "modifying existing code", "infrastructure/config work", "testing/validation". Add subcategories only when data supports them.
- For each category, require at least 3 independent signals (e.g., "building new feature" requires: new directory created + new entry point file + new test file within the same session).
- Provide a confidence score with every inference. Only display the objective if confidence > 0.6.
- Include "Uncertain — multiple patterns detected" as a valid first-class output, not a fallback. Display it without apology.
- Do not infer from a single zone or file type. Cross-zone activity (e.g., API zone + data zone + service zone changes in one session) is a strong signal for "new feature".

**Warning signs:**
- "Unknown objective" is the most common classification in real sessions
- Two visually different session types produce the same classification
- Single-file test additions get classified as "building new feature"
- Adding a `tsconfig.json` triggers "infrastructure/config work" classification (low signal-to-noise)

**Phase to address:** Intent inference engine phase. Classification taxonomy must be finalized before building the intent panel UI, because the UI must be designed around the actual output shape (including confidence and "uncertain" states).

---

### Pitfall 8: Timeline Slider Built on Absolute Timestamps — Dead Zones and Poor Navigability

**What goes wrong:**
The timeline slider maps scrub position to wall-clock time (e.g., 9:00am to 5:00pm). Large stretches of the slider represent periods of inactivity where nothing happened. Dragging across a 2-hour inactive period produces no graph changes. The user cannot tell if the scrubber is broken or if no changes occurred. Dense periods of activity (the last 10 minutes of an agent burst) are compressed into a tiny sliver of the slider.

This anti-pattern was flagged in the existing v1.0 research but was deferred. Now it must be addressed in the implementation.

**Why it happens:**
Mapping to wall-clock time is the obvious first implementation — timestamps are stored and wall-clock time is a natural domain. The problem only becomes visible during user testing with real session data (long idle gaps).

**How to avoid:**
- Primary scrub axis: event count, not wall-clock time. "Event 0 of 347" is always uniformly navigable regardless of when events occurred.
- Secondary display: show the wall-clock timestamp of the current event as a tooltip or label.
- Add a "density strip" above the slider showing where events cluster temporally — this visualizes activity bursts and dead zones without compromising scrub navigability.
- Consider two-zone display: a "zoom" mode that shows only the last N minutes at full resolution, and a "full history" mode for longer navigation.
- Keyboard controls: arrow keys step forward/backward one event at a time, not one time-unit at a time.

**Warning signs:**
- Users report "the slider doesn't seem to work" over stretches with no events
- Dense activity phases are hard to navigate because they occupy tiny slider fractions
- The slider end (current time) looks the same as 30 minutes ago if no changes occurred

**Phase to address:** Timeline UI phase. The scrub axis definition must be locked before any timeline component code is written — changing from time-axis to event-count-axis after the API contract is set requires breaking changes on both frontend and backend.

---

### Pitfall 9: Replay Requests Triggering Expensive Full-Scan Queries on `change_events`

**What goes wrong:**
The replay API reconstructs graph state at version N by querying `SELECT * FROM change_events WHERE id <= N ORDER BY id`. On a `change_events` table with 10,000 rows and no index on version, this is a full table scan on every scrub event. The user drags the slider across 100 positions → 100 full table scans → Fastify is overwhelmed → live view updates are delayed.

**Why it happens:**
The existing `changeEvents` table schema uses `id INTEGER PRIMARY KEY AUTOINCREMENT` and `timestamp INTEGER` but no version column indexed for replay range queries. Replay requires ordered event fetching that the current schema was not designed for.

**How to avoid:**
- Add a `session_id TEXT` column and a `sequence_in_session INTEGER` column to the `changeEvents` table (or a new `replay_events` table). Index on `(session_id, sequence_in_session)`.
- The replay endpoint uses `WHERE session_id = ? AND sequence_in_session <= ?` — an indexed range scan, not a full scan.
- Implement server-side caching of reconstructed states at checkpoint positions (see Pitfall 3). Cache lives in memory on the server, not in the DB, and is invalidated when a new delta arrives.
- Rate-limit the replay API to one request per 100ms per client to prevent slider-drag storms.
- Run replay reconstruction in a read-only SQLite connection separate from the write connection. SQLite WAL mode allows concurrent readers — use this to prevent replay queries from blocking pipeline writes.

**Warning signs:**
- Server logs show `change_events` table scans taking >100ms
- Live graph updates stall during timeline scrubbing
- DB read latency increases proportionally with event log length (linear growth pattern)
- `EXPLAIN QUERY PLAN` on the replay query shows "SCAN TABLE change_events" instead of index use

**Phase to address:** Replay API and snapshot storage schema phases. Indexing strategy must be part of the initial schema design for the new `replay_events` table.

---

### Pitfall 10: Intent Panel Showing Stale Inferred Objectives — Live vs. Historical Intent Conflict

**What goes wrong:**
The intent panel shows inferred objectives based on historical pattern analysis. When the user is in live mode, the panel displays the current inferred objective. When the user switches to replay mode and scrubs to time T, the intent panel should show the objective that was inferred at T — but instead shows the current (live) objective. The intent information is consistent with the wrong time slice.

**Why it happens:**
The `inferenceStore` holds live state. The intent panel reads from `inferenceStore`. Replay mode updates `graphStore` with historical data but does not update `inferenceStore` with historically-inferred objectives. The stores are not synchronized for the historical case. This is the same mode-confusion problem from Pitfall 1 but for the inference layer.

**How to avoid:**
- The `timelineStore` must hold both the historical graph state AND the historical inference state (objectives, risks, activity feed snapshot at time T).
- During replay, all UI panels (canvas, activity feed, risk panel, intent panel) read from `timelineStore.historicalState`, not from their live Zustand stores.
- Historical objective data must be included in the snapshot the server sends for replay at time T.
- The intent panel must be aware of the current mode: in replay mode, show "Intent at [timestamp]" with a visual indicator that this is historical data.
- Test: scrub to a historical point where objective X was inferred, then return to live where objective Y is current — confirm panels switch cleanly.

**Warning signs:**
- Returning from replay mode causes the intent panel to show stale historical data
- The intent panel shows today's objective while the canvas shows yesterday's graph
- "Reviewed" risk state from localStorage is used in historical replay view (reviewed state is live-only)

**Phase to address:** Intent panel UI phase. Historical intent state must be part of the timelineStore design before the intent panel component is written.

---

### Pitfall 11: Konva Canvas Rendering Freezes During Rapid Replay Animation

**What goes wrong:**
The user presses "play" on the timeline to auto-advance through history at 2x or 4x speed. Each step requires: loading a delta from the server, applying it to the graph store, re-rendering the Konva canvas. At high step frequencies (every 200ms), the canvas render callbacks fire faster than Konva's animation queue can process them. Multiple pending renders queue up, causing visible jank or temporary freezes. The animation appears to "skip" frames.

**Why it happens:**
Konva uses `requestAnimationFrame` internally. If state updates arrive faster than the 16ms frame budget, renders are queued. When replay steps fire every 200ms but each render takes 50ms (due to 300+ nodes), three renders are queued before the first completes. Zustand triggers re-renders synchronously on state change — multiple rapid `.setState()` calls can cause React batching to fail in edge cases.

**How to avoid:**
- Auto-play replay must throttle state updates to the Konva frame rate: compute the "maximum replay speed" as `1 / (renderTimeMs * 2)`. For a 300-node canvas rendering in 30ms, max safe auto-play speed is approximately one step every 60ms.
- Debounce canvas redraws during replay: accumulate incoming replay steps for one animation frame, then render the latest state only. Skip intermediate states during rapid scrubbing.
- During replay playback, disable the activity feed live updates, glow animations, and pulse effects. These animations fire their own `requestAnimationFrame` loops and compete with replay rendering.
- Use `Konva.Layer.batchDraw()` instead of `layer.draw()` during replay to let Konva coalesce multiple update requests into a single render pass.
- Cap auto-play speed in the UI at the measured safe rate (compute on first use, based on actual render time).

**Warning signs:**
- Canvas "stutters" or shows blank frames during auto-play
- CPU spikes to 100% during auto-play at speeds above 2x
- The Konva stage stops responding to interactions during replay (event listener queue backed up)
- FPS counter drops below 30 during auto-play even on a fast machine

**Phase to address:** Timeline UI (auto-play) and canvas rendering integration. Replay rendering path must be separate from live rendering path — different frame rate constraints apply.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full graph snapshot at every event (not delta-only) | Simpler reconstruction — just load the snapshot | Storage balloons to hundreds of MB; DB queries slow; compaction required as retrofit | Never — delta-only from day one |
| Single Zustand store for both live and replay state | No new store to design | Live updates corrupt historical view; mode bugs are subtle and hard to reproduce | Never — mode confusion is the critical failure mode |
| Wall-clock time axis for timeline slider | Maps directly to stored timestamps | Dead zones in sparse periods; dense periods unnavigable; users stop using feature | Acceptable for prototype only, must change before user testing |
| Inline synchronous replay reconstruction in Fastify handler | Simpler request handling | Blocks live pipeline during reconstruction; replay hangs live view | Never — read-only separate DB connection required |
| Intent taxonomy with 15+ categories from day one | Detailed classification looks sophisticated | Majority classified as "Unknown" due to heuristic over-specificity; panel provides no value | Never — start with 4-6 coarse categories |
| No checkpoint snapshots — full event replay every time | Simple storage model | O(N) reconstruction cost per scrub; linear slowdown as history grows | Acceptable for prototype up to ~200 events; add checkpoints before production |
| Pausing the pipeline during replay | Simplest pause implementation | File changes during replay are missed; user returns to stale live state | Never — pipeline and display are orthogonal |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Zustand graphStore + replay | Calling `applyDelta` during replay mode, corrupting historical view | Check `timelineStore.mode` before all `applyDelta` calls in `wsClient`; gate at the call site, not inside the action |
| SQLite WAL + replay read connection | Opening a second connection to SQLite without WAL mode on that connection | Both write and read connections must have `PRAGMA journal_mode=WAL` set on connection open |
| Konva animation + replay steps | Glow and pulse animations from `inferenceStore.activeNodeIds` firing during replay | Clear `activeNodeIds` on mode switch to replay; suppress animation triggers in replay mode |
| changeEvents table + replay queries | Full table scan on `id <= N` without session-scoped index | Add `(session_id, sequence)` composite index; always scope queries to session |
| Historical inference + localStorage reviewed state | Risk "reviewed" flags from localStorage applying to historical risks shown during replay | Reviewed state is live-only; replay must render risks without reviewing them; read from historical state only |
| WebSocket + replay buffer | Incoming live deltas during replay modify the `graphStore` through existing `onmessage` handlers | Add mode check at the `wsClient` `onmessage` entry point; buffer or discard, never apply directly |
| Intent inference + directory switch | Intent sessions from previous watch root bleeding into new root's timeline | Tag all events with `session_id` that encodes `watchRoot + startTimestamp`; filter timeline queries by session |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full table scan on `change_events` per scrub position | Server CPU spike on each slider drag; live view stalls | Composite index on `(session_id, sequence)`, server-side checkpoint cache | ~500 rows without index |
| O(N) event replay per scrub (no checkpoints) | Reconstruction time grows linearly with session length | Checkpoint every 50 events; cache recent checkpoint in memory | ~500 events (~30 min session) |
| Full graph snapshot storage (not delta) | DB file grows 150KB per event; WAL balloon | Delta-only storage with baseline per session | ~100 events (one session) |
| Konva full redraw on every replay step | Canvas freezes during auto-play; animation jank | `batchDraw()`, suppress live animations during replay, throttle step rate | >100 nodes, steps faster than render time |
| Storing layout positions separately from snapshots | Replay shows wrong positions; all nodes at origin | Include `layoutPositions` in delta payload; join in snapshot reconstruction | First replay attempt |
| Computing new intents on every file change event | Intent panel updates 10x per second during agent bursts | Infer intent on session boundaries only (activity-gap detection), not on every delta | Immediate — floods the inference path |
| Intent classification against 15+ granular categories | 80% "Unknown" classification; heuristics overfit to training examples | Start with 4-6 coarse categories with multi-signal requirements | Any real agent session outside training examples |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual indicator that replay mode is active | User edits file during replay thinking they are live; confusion when graph doesn't update | Prominent banner: "Viewing history — [timestamp] — Return to live" with high-contrast color |
| Timeline slider with wall-clock time axis | Dead zones are unnavigable; dense periods are too small to scrub accurately | Event-count axis with wall-clock timestamp tooltip; density strip above slider |
| Intent panel showing current objective during replay | Temporal inconsistency: historical graph + current intent = meaningless combination | Intent panel shows "Intent at [timestamp]" in replay mode with a distinct visual state |
| Auto-play with no speed control | Auto-play too fast to follow, or too slow to be useful | Configurable speed (0.5x, 1x, 2x, 4x); pause on any timeline event involving a new objective |
| Risk panel showing current risks during historical replay | Historical risks and current risks mixed; reviewed state is incorrect in historical context | In replay mode, risks panel shows risks that existed at time T, sourced from historical snapshot |
| Timeline scrubber with no context | User cannot distinguish "nothing happened" from "scrubber broken" | Density strip showing event count per time period; tooltip on hover showing event count at that position |
| Replay returning to live with layout jump | Re-snapping to live positions after replay feels disorienting | Animate position transitions when returning from replay; use Konva.Tween (already in use for pan) |
| Intent panel always visible even when no objective inferred | "Unknown" or empty state dominates UI when agent is idle | Collapse intent panel when no session is active; expand only when inference confidence > 0.6 |

---

## "Looks Done But Isn't" Checklist

- [ ] **Mode isolation:** Write a file while in replay mode; confirm the canvas does NOT update and no node is added or moved
- [ ] **Live resume after replay:** Return from replay to live; confirm all changes that occurred during replay are applied correctly within 2 seconds
- [ ] **Storage growth:** Run a 4-hour agent session; verify the SQLite file is under 20MB (delta-only, with checkpoints)
- [ ] **Scrub performance:** Drag the timeline slider across all events in a 500-event session; confirm all reconstructions complete within 200ms
- [ ] **Position accuracy:** Replay to a historical moment when node X existed; confirm X appears at its historical position, not its current position
- [ ] **Intent session boundaries:** Run two clearly separate tasks (e.g., auth refactor + then UI work with a 5-minute break); confirm they are classified as two separate objectives
- [ ] **Intent confidence display:** Confirm low-confidence inferences display uncertainty indicator; confirm "unknown" is shown without a placeholder fake objective
- [ ] **Auto-play:** Press play at 2x speed; confirm no canvas freeze, no frame drops below 30fps with 200 nodes
- [ ] **Replay API isolation:** Confirm that replay reconstruction queries do not block live WebSocket messages (measure live update latency during scrubbing)
- [ ] **Historical risks:** Scrub to a time when risk X existed but has since been resolved; confirm risk X appears in the risk panel during replay

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Live view corrupted by missing mode state machine (P1) | HIGH | Introduce `timelineStore`, audit every `applyDelta` and `applyInference` call site, add mode checks. Requires UI component refactor everywhere stores are read. |
| Full-snapshot storage (P2) | MEDIUM | Write data migration to convert existing snapshots to delta format; change write path to delta-only. Existing history is lost or incompatible without migration. |
| O(N) reconstruction (P3) | MEDIUM | Add checkpoint table and checkpoint computation; backfill checkpoints for existing events via one-time migration job. |
| Missing position data in snapshots (P4) | MEDIUM | Add `positions` field to delta schema; begin capturing positions in new sessions. Historical sessions before the fix cannot show correct positions. |
| Wall-clock time axis (P8) | LOW-MEDIUM | Change timeline slider axis to event-count; update API contract to accept `?version=N` instead of `?before=timestamp`. Requires coordinated frontend+backend change. |
| Intent taxonomy too granular (P7) | LOW | Reduce category count, raise signal thresholds. No data migration needed — re-classify from stored events. Requires re-running inference on existing history. |
| Konva replay freeze (P11) | LOW | Add `batchDraw()`, throttle auto-play step rate, suppress live animations during replay. Localized change to replay rendering path. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Missing mode state machine — live/replay corruption (P1) | Phase: Snapshot storage + mode state machine | Write file during replay; confirm canvas unchanged |
| Unbounded snapshot storage growth (P2) | Phase: Snapshot storage schema | 4-hour session; SQLite file < 20MB |
| O(N) reconstruction on every scrub (P3) | Phase: Replay API | 500-event session; each scrub < 200ms |
| Layout positions absent from snapshots (P4) | Phase: Snapshot storage schema | Replay to historical moment; nodes at historical positions |
| Pipeline pausing during replay (P5) | Phase: Mode state machine | File changes during replay visible on live-mode return |
| Intent window too narrow/wide (P6) | Phase: Intent inference engine | Two separate tasks → two separate objectives; one burst → one objective |
| Intent taxonomy too granular (P7) | Phase: Intent inference engine | Real session: < 20% "Unknown" classification rate |
| Wall-clock time axis dead zones (P8) | Phase: Timeline UI | Scrubber navigable across sparse and dense periods equally |
| Expensive replay queries — full table scan (P9) | Phase: Replay API + schema | Query plan shows index use; live view unaffected during scrubbing |
| Historical intent / live intent confusion (P10) | Phase: Intent panel UI | Intent panel shows historical objective during replay; live objective on return |
| Konva freeze during auto-play (P11) | Phase: Timeline UI auto-play | 300-node canvas at 2x auto-play speed; no freeze, >30fps |

---

## Sources

- Time-travel state management snapshot vs. delta tradeoffs, memory and reconstruction complexity: [Time-Travel Debugging in State Management: Part 1 — DEV Community](https://dev.to/eustatos/time-travel-debugging-in-state-management-part-1-foundations-patterns-2ml0)
- Event sourcing snapshots — measure before adding, lifecycle of event streams, checkpoint strategies: [Snapshots in Event Sourcing for Rehydrating Aggregates — CodeOpinion](https://codeopinion.com/snapshots-in-event-sourcing-for-rehydrating-aggregates/)
- SQLite WAL mode performance — concurrent readers, WAL file growth patterns, checkpoint timing: [SQLite Write-Ahead Logging — sqlite.org](https://sqlite.org/wal.html); [SQLite performance tuning — phiresky](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- Redux DevTools implementation lessons — separate DevTools store, action replay side effects, performance overhead of capturing all actions: [Time Travel in React Redux apps — Medium](https://medium.com/the-web-tub/time-travel-in-react-redux-apps-using-the-redux-devtools-5e94eba5e7c0)
- Intent classification pitfalls — overly granular taxonomies, contextual signal ignorance, confidence score limitations: [Intent Detection — shadecoder.com](https://www.shadecoder.com/topics/intent-detection-a-comprehensive-guide-for-2025)
- Real-time dashboard UX with historical replay — mode confusion, data freshness indicators, scrubber behavior: [From Data to Decisions: UX Strategies for Real-Time Dashboards — Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- Konva performance tips for animation — batchDraw(), layer separation, listening(false): [Konva Performance Tips — konvajs.org](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- Timeline slider map pattern (mini-map + detail pane, density strip): [Timeline Slider — Map UI Patterns](https://mapuipatterns.com/timeline-slider/)
- Event sourcing with SQLite — snapshot checkpoints for replay performance, WAL interactions: [Building Event Sourcing Systems with SQLite — sqliteforum.com](https://www.sqliteforum.com/p/building-event-sourcing-systems-with)
- Existing ArchLens codebase — direct inspection of `graphStore.ts`, `inferenceStore.ts`, `Pipeline.ts`, `GraphPersistence.ts`, `schema.ts`, `InferenceEngine.ts` for integration hazard analysis

---
*Pitfalls research for: ArchLens v3.0 — Time-travel replay and intent inference added to existing live visualization*
*Researched: 2026-03-16*
