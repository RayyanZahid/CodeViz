# Project Research Summary

**Project:** ArchLens v3.0 — Time-Travel Replay and AI Agent Intent Inference
**Domain:** Developer tooling — real-time architecture visualization with temporal navigation and heuristic intent detection
**Researched:** 2026-03-16
**Confidence:** MEDIUM-HIGH

## Executive Summary

ArchLens v3.0 adds two capabilities on top of a fully-validated foundation: time-travel replay of architecture evolution and heuristic inference of what an AI coding agent is trying to accomplish. The research is unambiguous on approach: both features are best built as thin layers over existing infrastructure, not as new subsystems. The `changeEvents` SQLite table already constitutes an event log; the `InferenceEngine` already emits the architectural event stream required for intent classification; `graphStore.applySnapshot()` already accepts any node/edge set. The implementation risk is not "can we build this" but "can we avoid breaking what already works."

The recommended stack additions are minimal: one new client dependency (`zundo@^2.3.0` for timeline state history, 700 bytes gzipped), two new SQLite tables (`graph_snapshots`, `intent_sessions`), and roughly 8 new TypeScript files across server and client. Intent inference is explicitly rule-based with no LLM, no ML model, and no network dependency — ArchLens's offline-only constraint makes this non-negotiable. The heuristic classifier consuming component names, zone distribution, and event-type ratios covers the practical AI agent workload at sub-millisecond cost.

The single highest-risk area is mode isolation: when the user enters replay mode, live WebSocket deltas must be completely blocked from mutating the displayed graph — and this guard must be enforced at the `wsClient` entry point, not inside individual store actions. Every other pitfall (unbounded snapshot growth, O(N) reconstruction, missing layout positions in snapshots, stale intent in replay mode) is recoverable mid-implementation. A broken mode state machine corrupts the core value proposition and is expensive to retrofit. The mode state machine must be the first piece of replay infrastructure built.

## Key Findings

### Recommended Stack

The base stack (Fastify v5, SQLite/WAL + Drizzle ORM, tree-sitter, graphlib, Konva + d3-force, React 19 + Zustand v5, WebSocket streaming, chokidar, Zod) is unchanged. v3.0 requires exactly one new npm dependency and two schema additions.

**Core technologies (new in v3.0):**
- `zundo@^2.3.0`: Timeline scrubber state history in Zustand — the only new client dependency; provides `partialize`, `limit`, and diff-based storage; officially supports Zustand v5 (released November 2024); ~700 bytes gzipped
- `graph_snapshots` SQLite table: Periodic graph checkpoints stored as JSON blob (nodes + edges + positions) using existing Drizzle tooling; one row per snapshot, ~8KB each at 50-component scale; includes `positions_json` from day one (required for correct replay layout)
- `intent_sessions` SQLite table: Inferred agent work sessions (label, confidence, version range); feeds the IntentPanel; cleared on watch-root switch
- HTML `<input type="range">`: Native range input for the timeline scrubber — no slider library needed for a single-thumb control with event-count axis
- Rule-based `IntentAnalyzer` in TypeScript: Heuristic classifier over `changeEvents` window; no LLM, no ML, no network; runs in <1ms; works offline

**Critical version constraint:** `zundo@^2.3.0` is required for Zustand v5 compatibility. Do not use zundo v2.2.x or earlier.

### Expected Features

The research identifies a clean v3.0 core set plus a validated set of enhancements for v3.x. No existing tool combines architecture-level time-travel with automatic intent inference from code change patterns — ArchLens v3.0 occupies an unoccupied competitive space.

**Must have (v3.0 table stakes):**
- Snapshot reconstruction endpoint (`GET /api/timeline` + `GET /api/snapshot/:id`) — the backend engine for all replay
- Timeline scrubber UI with event-count axis (not wall-clock), playback controls, timestamp labels
- Replay mode indicator — prominent banner preventing live/historical confusion (the most common UX failure for time-travel tools)
- Exit replay to live — single action restoring current live state via `wsClient.requestSnapshot()`
- Intent classifier (heuristic) — objective label, confidence score, and inferred subtasks from `ArchitecturalEvent` stream
- Intent panel UI — sidebar panel parallel to RiskPanel and ActivityFeed; collapses when confidence < 0.6

**Should have (v3.x competitive differentiators):**
- Activity feed synchronized with scrubber position — contextualizes the map replay
- Epoch/milestone markers on timeline — auto-detected significant moments (first component, first risk, zone migration)
- Architecture diff overlay — before/after delta coloring on the canvas
- Intent history log — review past objectives across a session
- Risk-correlated intent display — join inferred objective with concurrent risk detection
- Replay speed control (0.5x, 1x, 2x, 4x)

**Defer to v4+:**
- Cross-session comparison — requires session boundary persistence and multi-session query; high complexity for medium value
- Subtask completion indicators — "done" detection is inherently ambiguous without LLM; defer until intent baseline is proven
- LLM-enhanced intent descriptions — viable only after heuristic baseline is measurably accurate enough to fine-tune against

**Hard anti-features (do not build):**
- LLM/ML-based intent inference — violates offline constraint, adds latency/cost/API key management
- Full event-sourcing reconstruction of individual file changes — wrong abstraction level for ArchLens
- Video recording of architecture evolution — out of scope per PROJECT.md; replay mode is the interactive equivalent
- Manual intent labeling — creates hybrid human/machine inference model that complicates UX

### Architecture Approach

The architecture follows a clean layered extension model: a new `replay/` server module (`SnapshotRecorder`, `IntentAnalyzer`) subscribes to the existing `graph.on('delta')` event alongside the existing `InferenceEngine`; a new `timelinePlugin` exposes two REST endpoints; three new WebSocket message types extend the existing `ServerMessage` union; and a new `timelineStore` on the client mediates replay mode for all existing panels. The `ArchCanvas`, `NodeInspector`, `RiskPanel`, and `ActivityFeed` components remain completely unmodified — replay is achieved entirely through `graphStore` state substitution, not canvas-layer logic.

**Major components (new and modified):**
1. `SnapshotRecorder` (NEW, server) — subscribes to `graph.on('delta')`; persists snapshot every 5 deltas or on structural change; includes positions; broadcasts `snapshot_created` WS message
2. `IntentAnalyzer` (NEW, server) — reads 5-minute `changeEvents` window every 30s; clusters by 90-second activity gaps; applies ordered heuristics (4-6 coarse categories); persists `intent_sessions`; broadcasts `intent_update`
3. `timelinePlugin` (NEW, server) — `GET /api/timeline` (list snapshot metas) and `GET /api/snapshot/:id` (restore one snapshot; checkpoint-based O(50) reconstruction)
4. `timelineStore` (NEW, client) — Zustand store holding snapshot list, current replay position, `isReplaying` flag, historical intent sessions; owns the `scrubToSnapshot()` and `exitReplay()` actions
5. `TimelineSlider` (NEW, client) — bottom-bar `<input type="range">` over snapshot list; event-count axis; wall-clock timestamp tooltip; density strip; Live/Pause controls
6. `IntentPanel` (NEW, client) — sidebar panel showing inferred objective, confidence indicator, and subtask list; mode-aware (shows historical intent during replay; collapses when inactive)
7. `graphStore` + `inferenceStore` (MODIFIED) — each gains a `replayMode: boolean` flag; WsClient gates live delta application on this flag
8. `WsClient` (MODIFIED) — handles 3 new message types; checks `replayMode` before applying live messages; buffers live deltas during replay for seamless live-resume

**Build order is dependency-determined:** Schema + shared types (Phase A) → server replay layer (Phase B, parallel to Phase C after A) → client state layer (Phase C) → client UI (Phase D) → watch-root integration (Phase E).

### Critical Pitfalls

1. **Live view corrupted during replay — missing mode state machine (P1, CRITICAL)** — Without an enforced mode state machine, incoming live WebSocket deltas continue mutating the historical graph view, producing a corrupted hybrid graph. Prevention: `timelineStore` owns the `mode: 'live' | 'replay'` state machine; ALL `applyDelta` calls in `wsClient` are gated on this flag at the call site; the pipeline NEVER pauses — only the display path freezes. Must be the first piece of replay infrastructure built. Recovery cost is HIGH.

2. **Snapshot storage growing without bound (P2, CRITICAL)** — Full snapshots at every event balloon the SQLite file to hundreds of MB for long sessions. Prevention: delta-threshold snapshotting (every 5 deltas or structural change), not wall-clock intervals; component-level node/edge/position data only (no source content); checkpoint snapshots every 50 events for O(50-max) reconstruction. Must be designed in the schema phase — retrofitting is expensive.

3. **Layout positions absent from snapshots (P4, HIGH)** — Snapshots omitting `layoutPositions` cause replay to show current node positions, not historical positions; deleted nodes appear at canvas origin (0,0). Prevention: include `positions_json` in the `graph_snapshots` schema from day one and feed historical positions through `graphStore.applySnapshot()` during replay.

4. **Timeline slider with wall-clock time axis — dead zones (P8, HIGH)** — Mapping scrub position to wall-clock time creates unnavigable dead zones during idle periods; dense activity periods are compressed to tiny sliver fractions. Prevention: event-count axis (scrub position = snapshot index) as the primary axis; wall-clock as tooltip; density strip. Lock the API contract to `GET /api/snapshot/:id` (by index), not `?before=timestamp`, before building the slider.

5. **Intent taxonomy too granular — 80% "Unknown" output (P7, HIGH)** — Starting with 15+ fine-grained categories results in most real sessions classified as "Unknown" because heuristics cannot distinguish subtle variations in messy agent workflows. Prevention: start with 4-6 coarse categories only (building/modifying/infrastructure/testing); require 3+ corroborating signals for each; treat "Uncertain" as a valid first-class output.

6. **Historical intent showing live intent during replay (P10, MEDIUM)** — IntentPanel reads from `inferenceStore` (live state); during replay it shows today's objective while the canvas shows a historical graph. Prevention: `timelineStore` carries historical intent sessions; IntentPanel reads from `timelineStore.historicalState` in replay mode, not from `inferenceStore`.

7. **Pipeline pausing during replay (P5, CRITICAL)** — Stopping the file watcher or pipeline to "pause" the display causes file changes during replay to be missed; returning to live shows stale state. Prevention: the pipeline never pauses; only the client-side WS display path is frozen; replay reconstruction uses a read-only SQLite connection separate from the write connection.

## Implications for Roadmap

Based on the dependency chain documented in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md, the build order is well-determined. Five natural phases emerge with clear rationale.

### Phase 1: Schema Foundation and Shared Types

**Rationale:** Schema must exist before any server code can write to it; shared types must exist before both server and client can reference them. This is the hard constraint that blocks everything else. No UI work in this phase — pure infrastructure. Pitfalls P2, P4, and P9 (unbounded storage, missing positions, full table scans) must all be addressed here in the schema design because they are expensive to retrofit.
**Delivers:** `graph_snapshots` Drizzle table definition with `positions_json` included from day one; `intent_sessions` Drizzle table; Drizzle migration; `session_id` and `sequence_in_session` columns added to `changeEvents` with composite index for O(log N) replay queries; `shared/src/types/timeline.ts` with `SnapshotMeta`, `IntentSession`, `SnapshotCreatedMessage`, `IntentUpdateMessage`, `TimelineMetaMessage`; extended `ServerMessage` union in `messages.ts`
**Addresses:** Pre-conditions for all replay and intent infrastructure
**Avoids:** P2 (storage design locked in), P4 (positions in schema from day one), P9 (composite index prevents full table scans)

### Phase 2: Server Replay Layer

**Rationale:** Server must produce snapshots before the client can consume them. `SnapshotRecorder` and `timelinePlugin` are data producers; no end-to-end testing is possible until they exist. `IntentAnalyzer` is co-located in `server/src/replay/` and can be built in the same phase. This phase can be developed in parallel with Phase 3 (client state) once Phase 1 is complete.
**Delivers:** `SnapshotRecorder` (delta-threshold snapshot persistence with positions, checkpoint every 50 events); `timelinePlugin` (`GET /api/timeline`, `GET /api/snapshot/:id` with checkpoint-based reconstruction); `IntentAnalyzer` (activity-gap clustering at 90-second gaps, 4-6 coarse category heuristics with 3+ signal requirements, confidence scoring, "Uncertain" as first-class output); `index.ts` wiring for startup and `switchWatchRoot()` cleanup; `websocketPlugin` modification to send `timeline_meta` on WS connect
**Uses:** No new server dependencies — all existing `better-sqlite3`, Drizzle, Fastify plugin pattern
**Implements:** `SnapshotRecorder`, `IntentAnalyzer`, `timelinePlugin`
**Avoids:** P2 (delta-threshold not wall-clock intervals), P3 (checkpoint every 50 events for O(50-max) reconstruction), P5 (pipeline never pauses — read-only replay DB connection), P6 (activity-gap session boundaries, not fixed window), P7 (4-6 coarse categories)

### Phase 3: Client State Layer

**Rationale:** Client state infrastructure must exist before any UI component can be built. The mode state machine is the most critical deliverable — it is the foundational piece that prevents live/replay corruption (P1). This phase can be developed in parallel with Phase 2 after Phase 1 types are available.
**Delivers:** `timelineStore` (Zustand store: snapshot list, current replay position, `isReplaying` flag, historical intent sessions, `scrubToSnapshot()` action, `exitReplay()` action); `zundo@^2.3.0` installed and wired as middleware; `graphStore` modification (`replayMode: boolean`); `inferenceStore` modification (`replayMode: boolean`); `WsClient` modifications (3 new message type handlers, `replayMode` gate on ALL `applyDelta` calls at the wsClient entry point, live delta buffering during replay)
**Uses:** `zundo@^2.3.0` — install in this phase
**Avoids:** P1 (mode state machine is the centerpiece — live/replay isolation enforced at wsClient entry, not inside store actions), P10 (timelineStore carries historical intent state, IntentPanel reads from it during replay)

### Phase 4: Client UI — Timeline Slider and Intent Panel

**Rationale:** UI components are pure consumers of the state layer (Phase 3) and the API (Phase 2). Building UI before the state layer is complete leads to rework when mode isolation requirements surface. Both `TimelineSlider` and `IntentPanel` can be built in parallel within this phase since they read from different slices of `timelineStore`.
**Delivers:** `TimelineSlider` (bottom-bar `<input type="range">`, event-count axis, wall-clock timestamp tooltip, density strip above slider, Live/Pause/play controls, replay speed control); `IntentPanel` (sidebar panel: objective label, confidence indicator, subtask list, "Analyzing..." fallback state, collapses when confidence < 0.6); `App.tsx` layout additions (TimelineSlider below DirectoryBar, IntentPanel in sidebar panel list); replay mode visual indicator (prominent "VIEWING HISTORY — [timestamp] — Return to live" banner)
**Avoids:** P8 (event-count axis, not wall-clock), P10 (IntentPanel reads from timelineStore.historicalState in replay mode), P11 (Konva batchDraw, throttled auto-play step rate, suppressed live animations during replay)

### Phase 5: Watch-Root Integration and Validation

**Rationale:** `switchWatchRoot()` must clear snapshot and intent session data when the user changes the watched directory, matching the existing behavior for `graph_nodes` and `graph_edges`. Treating this as a separate phase ensures it is tested explicitly and not forgotten. End-to-end validation of the full v3.0 feature set also belongs here.
**Delivers:** `switchWatchRoot()` extension (destroy `SnapshotRecorder`, clear `graph_snapshots` + `intent_sessions` tables, create new `SnapshotRecorder` + `IntentAnalyzer` for new root); client-side `timelineStore.reset()` on watch-root switch; full "Looks Done But Isn't" checklist verification: mode isolation test (write file during replay, confirm no canvas change), live resume after replay, 4-hour session storage < 20MB, 500-event session scrub < 200ms, historical positions accurate, intent session boundaries, auto-play frame rate > 30fps at 200 nodes
**Avoids:** Anti-Pattern 5 from ARCHITECTURE.md (stale snapshot data across watch-root switches)

### Phase Ordering Rationale

- Phase 1 (schema + types) is a hard pre-condition for Phases 2 and 3; no server or client code can reference the new types until this exists
- Phase 2 (server) and Phase 3 (client state) can be developed in parallel after Phase 1 — they are decoupled during construction; their interface is the shared types from Phase 1 and the REST/WS contracts
- Phase 4 (UI) strictly follows Phase 3 because the mode state machine in Phase 3 is the foundation UI components plug into; building UI before the mode gate is in place creates rework when mode isolation bugs surface
- Phase 5 (watch-root + validation) must come last; it depends on all prior phases being stable enough to test the destroy/recreate lifecycle
- Pitfalls P1, P2, P4, P5, P9 are functional pre-conditions, not polish — they must be addressed in Phases 1-3, not deferred

### Research Flags

**Phases that may benefit from `/gsd:research-phase` during planning:**
- **Phase 2, `IntentAnalyzer` heuristics:** The activity-gap threshold (90 seconds) and coarse taxonomy categories are research-supported starting points but not validated against real ArchLens agent sessions. Inspecting actual `changeEvents` timing data from the existing database before implementing the classifier would improve the first implementation and avoid the P6 and P7 pitfalls in practice.
- **Phase 4, Konva auto-play performance:** The `batchDraw()` + throttle approach is the correct pattern, but the safe auto-play step interval depends on the actual render time of the canvas at production node counts. A brief spike measuring render time at 200+ nodes before building auto-play speed levels would prevent the P11 canvas freeze pitfall.

**Phases with standard, well-documented patterns (skip research-phase):**
- **Phase 1 (Schema Foundation):** Drizzle schema additions and SQLite table design are mechanical; composite index pattern is standard SQL
- **Phase 3 (Client State Layer):** Zustand store design, `zundo` middleware, and `replayMode` flag pattern are all well-documented with high-confidence official sources
- **Phase 5 (Watch-Root Integration):** Follows the existing `switchWatchRoot()` destroy/recreate pattern; no new patterns introduced

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (`zundo`); version compatibility confirmed from official release notes; all other technologies are the existing validated stack; no speculative choices |
| Features | MEDIUM | Table stakes derived from Redux DevTools, Replay.io, and session replay tool patterns (well-documented); intent inference UX patterns are from an emerging field with fewer direct precedents; competitor gap analysis is strong |
| Architecture | HIGH | Based on direct codebase inspection of all integration points; component boundaries are explicit; build order is dependency-determined, not speculative; minimal surface area principle (ArchCanvas unmodified) reduces integration risk |
| Pitfalls | MEDIUM-HIGH | Core pitfalls (mode state machine, unbounded storage, O(N) reconstruction) are grounded in event sourcing literature and Redux DevTools lessons; intent inference pitfalls follow general heuristic classifier lessons; some recovery costs are estimated, not empirically measured |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Intent session threshold calibration:** The 90-second activity-gap boundary and 60-second inference window are educated starting points, not empirically validated against real ArchLens agent session data. During Phase 2 planning, inspect actual `changeEvents` timing patterns from the existing database to validate or adjust these thresholds before committing to the implementation.
- **Konva auto-play frame budget:** The safe auto-play step interval (estimated at ~60ms for a 300-node canvas rendering in 30ms) needs measurement against the actual codebase before auto-play speed levels are built. Add a render-time measurement spike to Phase 4 planning.
- **`changeEvents` schema migration:** Adding `session_id` and `sequence_in_session` columns to the existing `changeEvents` table requires a Drizzle migration that handles pre-v3.0 rows. The strategy for existing rows (null session_id, or synthesized session_id from timestamp clustering) needs a decision before Phase 1 schema work begins.
- **Snapshot compaction TTL:** Research recommends a 30-day TTL for snapshot compaction but does not specify the trigger mechanism (server startup, scheduled timer, or API). The schema should be designed to support TTL from day one (e.g., a `createdAt` index on `graph_snapshots`), but the compaction implementation is a v3.x concern.

## Sources

### Primary (HIGH confidence)
- `zundo` GitHub (charkour/zundo) + releases page — v2.3.0 Zustand v5 support confirmed; partialize/limit/diff options; <700 bytes gzipped; November 2024 release
- Martin Fowler — Event Sourcing — foundational reference for event log reconstruction; state reconstruction by replaying events forward
- Konva official docs — batchDraw(), performance tips, undo/redo state-substitution pattern as idiomatic replay approach
- SQLite WAL official docs — concurrent reader behavior, WAL file growth patterns, PRAGMA journal_mode
- Drizzle ORM SQLite docs — text column with mode:'json', schema migration patterns
- ArchLens codebase direct inspection (`graphStore.ts`, `inferenceStore.ts`, `Pipeline.ts`, `schema.ts`, `InferenceEngine.ts`, `websocketPlugin.ts`) — all integration points identified from live code

### Secondary (MEDIUM confidence)
- AeonG temporal graph database (VLDB Journal 2025) — anchor+delta snapshot strategy and reconstruction algorithms
- Redux DevTools time-travel documentation — action-list navigation, slider monitor, state reconstruction pattern; separate DevTools store pattern
- CodeOpinion — snapshots in event sourcing for rehydrating aggregates; checkpoint strategies
- Replay.io time-travel documentation — record/replay architecture and temporal navigation UI patterns
- Smashing Magazine — UX strategies for real-time dashboards with historical replay (mode confusion, data freshness indicators)
- Augment Code Intent workspace blog — intent display UX patterns for agent orchestration tools
- SQLite event sourcing patterns (sqliteforum.com) — periodic snapshot + replay-from-checkpoint pattern
- MSR '26 on mining coding agent activity (arxiv, abstract only) — heuristic detection approaches for agent intent

### Tertiary (LOW confidence)
- Medium — intent detection for AI systems — confidence scoring approaches; single non-authoritative source; used for framing only
- Agentic UI patterns (agenticpathdesign.com) — emerging field with limited documentation; used for UX framing only

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
