# Feature Research

**Domain:** Time-travel replay and AI agent intent inference (v3.0 additions to ArchLens)
**Researched:** 2026-03-16
**Confidence:** MEDIUM (time-travel UX patterns verified from Redux DevTools, temporal graph DB literature; intent inference from code patterns is emerging territory with fewer direct precedents; ArchLens-specific integration details derived from codebase analysis)

---

## Context: What's Already Built

ArchLens v1.0–v2.2 shipped all foundational features: real-time architecture map, semantic zones, Inspector/Risk/Activity panels, edge tooltips, component glow, watch-any-project. The v3.0 milestone adds two capabilities on top of this foundation:

1. **Time-travel replay** — scrub through architecture evolution captured during a live session
2. **Intent inference** — detect what the AI agent is trying to accomplish from code change patterns

This document covers ONLY these two new feature domains, their expected behavior, table stakes vs differentiators, and their dependencies on existing ArchLens infrastructure.

---

## Existing Infrastructure Available for v3.0

Understanding what's already built determines which features are LOW vs HIGH complexity:

| Existing Component | How v3.0 Can Reuse It |
|--------------------|----------------------|
| `changeEvents` SQLite table | Already stores every `node_added / node_removed / node_updated / edge_added / edge_removed / zone_changed` event with timestamp; this IS the event log for time-travel |
| `eventsRepository.findAll()` / `findSince()` | Queries already exist to fetch the full event history or events since a given sequence ID |
| `graph_nodes` + `graph_edges` tables | Current "live" graph state; time-travel replays deltas against a baseline to reconstruct past states |
| `graphStore` (Zustand) | `applyDelta()` and `applySnapshot()` already exist; time-travel just needs to feed snapshots from the past into the same interface |
| `inferenceStore` (Zustand) | `activityFeed` with all architectural events already accumulates the signal stream needed for intent inference |
| `InferenceEngine` (`ArchitecturalEvent[]`) | Already classifies component_created, component_split, component_merged, dependency_added, dependency_removed events — the raw material for intent classification |
| `ArchCanvas` (Konva) | Renders the graph map; time-travel replay just changes the data feeding into it via graphStore |
| WebSocket `InferenceMessage` type | Already carries `architecturalEvents[]`; intent output can reuse this transport or add a new message type |

**Key insight**: The event sourcing foundation exists. Time-travel replay is primarily a new API endpoint + scrubber UI consuming stored events. Intent inference is a new analysis layer over the already-accumulated architectural event stream.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any time-travel or intent system must have. Missing these = the feature feels broken or unusable.

#### Time-Travel Replay: Table Stakes

| Feature | Why Expected | Complexity | Dependencies on Existing ArchLens |
|---------|--------------|------------|----------------------------------|
| Scrubber UI (timeline slider) | Every time-travel tool (Redux DevTools, Temporal dashboard, browser session replay) uses a timeline slider as the primary control; users have a strong mental model for "scrub through history" from video players | LOW | Reads timestamp range from `changeEvents` table via new REST endpoint; feeds reconstructed states into existing `graphStore.applySnapshot()` |
| Playback controls (play/pause/step) | Redux DevTools action list + slider; session replay tools (LogRocket, Replay.io) all offer step-by-step and continuous play; users expect both granular stepping and sweep-play | LOW-MEDIUM | Same endpoint + a client-side interval loop to auto-advance the scrubber position |
| Architecture map updates during replay | The map must reflect the state at the current scrubber position; without this, the scrubber is a useless decoration | MEDIUM | Reconstruct graph snapshot at each timestamp, push into existing `graphStore` state; `ArchCanvas` re-renders automatically via Zustand subscription |
| Timestamp labels on the timeline | Users need temporal context ("12 minutes ago", "2:34 PM"); a scrubber with no time labels is disorienting | LOW | `changeEvents.timestamp` already stored; format with relative + absolute labels |
| Clear visual indication of "replay mode" | Users must know they are viewing historical state, not live state; confusing live vs replay is a critical UX failure | LOW | Add a "REPLAY" badge / darkened border on the map; disable live WebSocket updates during replay |
| Return to live ("exit replay") | After exploring history, users expect a single action to jump back to the live current state | LOW | Re-enable WebSocket, call `GET /api/snapshot` to restore current state |
| Session scoping (current watch root only) | Replay shows events for the currently watched directory, not all directories ever watched | MEDIUM | Filter `changeEvents` by watching metadata; needs a session/watchRoot column added to changeEvents OR a separate session table |

#### Intent Inference: Table Stakes

| Feature | Why Expected | Complexity | Dependencies on Existing ArchLens |
|---------|--------------|------------|----------------------------------|
| Inferred objective label | The core deliverable: "Building authentication system" or "Refactoring data layer"; without a label, there is no intent inference product | MEDIUM | Heuristic classifier over `ArchitecturalEvent` stream; component names (auth, payment, route, user) are already extracted by `ComponentAggregator` |
| Confidence indicator on inferred intent | Intent inference is probabilistic; showing a bare label without confidence misleads users; all supervised AI tools (Wayfound, Zenity AIDR) show confidence or certainty metrics | LOW | Simple scoring: number of corroborating signals / total signals; already available from `EventCorroborator` pattern |
| Intent panel UI component | Users need a dedicated panel, not inference buried in the activity feed; a panel parallel to the existing RiskPanel / ActivityFeed panels is expected | LOW | New React panel component; reuses existing panel layout patterns from `NodeInspector.tsx`, `RiskPanel.tsx` |
| Inferred subtasks list | A single objective may decompose into: "Added auth module", "Created token service", "Added middleware"; each subtask = a cluster of architectural events; users expect to see progress breakdown | MEDIUM | Group `ArchitecturalEvent[]` by inferred theme using component name heuristics; no ML required |
| Auto-update as agent works | Intent panel must update as new events stream in; a static snapshot is useless for real-time supervision | LOW | Subscribe to `inferenceStore.activityFeed` updates; re-classify whenever new architectural events arrive |
| "Agent is working on X" status | Current objective prominently visible, not just historical summary; the supervising developer's primary question is "what is the agent doing right now?" | LOW | Derived from the most recent N architectural events; weight recent events more heavily in classification |

---

### Differentiators (Competitive Advantage)

Features that set ArchLens apart in time-travel and intent inference specifically. Not required for minimal function, but deliver real value.

#### Time-Travel Replay: Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Architecture diff overlay ("before vs after") | Show added nodes in green, removed nodes in red, modified edges highlighted — not just "here is the old state" but "here is what changed between these two moments"; no existing architecture tool offers this | HIGH | Requires two graph snapshots; compute set difference; feed diff coloring through existing NodeRenderer color system |
| Activity feed synchronized with scrubber position | As the user scrubs, the activity feed shows only events up to that point — the narrative of what the agent did matches the map state; gives context that the map alone cannot | MEDIUM | Filter `inferenceStore.activityFeed` by timestamp <= currentScrubberPosition; existing feed rendering unchanged |
| Epoch/milestone markers on the timeline | Auto-detect significant moments in the timeline (first component created, first circular dep detected, first major zone migration) and show bookmarks on the scrubber; helps users navigate to interesting moments quickly | MEDIUM | Analyze `changeEvents` at load time; mark events where `node_added` count spikes, `zone_changed` occurs, or a `circular_dependency` risk first appears |
| Replay speed control (0.5x, 1x, 2x, 4x) | Fast-forward through low-activity periods; slow down during bursts of changes; standard in all media players and some session replay tools (LogRocket) | LOW | Client-side: adjust the setInterval delay multiplier; no backend change |
| Snapshot export at any point in time | Freeze the map at a past state and export it as SVG/PNG for documentation; no competitor offers "export the architecture as it looked during development" | MEDIUM | Reuse existing canvas export logic (when built) on the reconstructed snapshot state |

#### Intent Inference: Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pattern-based objective taxonomy | Classify into actionable categories: "Building new feature (auth/payment/user)", "Refactoring existing module", "Adding infrastructure (database/cache/queue)", "Fixing dependencies (resolving cycles)"; taxonomy makes inference legible, not just a bag of names | MEDIUM | Heuristic decision tree: zone distribution + component naming patterns + event type ratios; see Implementation Notes below |
| Temporal objective tracking ("switched from X to Y") | Detect when the agent's focus shifts — "Was building auth, now pivoting to payment processing"; enables the developer to notice agent scope creep or unexpected tangents | MEDIUM | Sliding window over architectural events; detect when dominant component cluster changes; new intent label replaces old in panel |
| Risk-correlated intent ("building X but introducing risk Y") | Link inferred intent with simultaneously detected risks; "Building data layer — circular dependency detected between DataService and CacheService"; elevates risk panel from isolated warnings to contextual alerts | MEDIUM | Join `inferenceStore.risks` with active intent classification; display in intent panel if overlap detected |
| Subtask completion indicators | Show which inferred subtasks appear complete vs in-progress vs not-started; "Auth module: done, Session management: in progress, Middleware: not started"; gives developer a progress model | HIGH | Requires sequencing logic: a subtask is "done" when no further events touch that component cluster for N seconds; HIGH complexity because "done" is inherently ambiguous |
| Intent history log | List of past inferred intents with timestamps: "12:04 — Built auth system", "12:47 — Refactored data layer"; connects to time-travel replay as navigation anchors | MEDIUM | Persist intent labels in a new `intent_log` table or derive from changeEvents at query time; integrates naturally with time-travel epoch markers |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like natural extensions but create disproportionate complexity or contradict ArchLens's design principles.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| LLM-based intent inference (call GPT/Claude to analyze changes) | LLM would give richer, more nuanced intent descriptions; feels like the "right" way to do AI inference | Adds latency (100ms-2s per inference vs <1ms heuristic), adds cost per user, requires network connectivity, creates API key management complexity, creates reliability risk; ArchLens is a local app with <2s latency requirements | Heuristic classifier using component names + zone distribution + event type ratios achieves 80% of the value at zero cost/latency; LLM can be added as an optional enhancement post-v3 |
| Full event sourcing reconstruction (replay every individual file change) | Users want to see every single file edit animated, not just architectural-level changes | Individual file changes are below the abstraction level ArchLens operates at; file-level replay produces noise, not insight; `changeEvents` already stores only architectural-level events, not raw file edits | Architectural-level scrubbing (node/edge add/remove) is the correct granularity; the activity feed already provides narration of each event |
| Cross-session comparison (compare architecture at session 1 vs session 5) | Power users want to see architectural drift across multiple work sessions | Requires session boundary detection, cross-session graph merging, and UI for selecting two sessions — HIGH complexity for MEDIUM user value; risks confusing users who already have difficulty with single-session replay | Single-session time-travel covers 90% of the use case; multi-session comparison is a v4+ consideration only after time-travel proves valuable |
| Video recording of architecture evolution | Some users request a literal video export of the architecture map evolving | Screen recording is out of scope (PROJECT.md); replay mode IS the interactive equivalent; static video loses interactivity; canvas-to-video is complex (requires MediaRecorder + canvas capture at correct fps) | Replay mode at controlled speed is the better interaction model; users can screen-record themselves if they want video |
| Predictive intent ("what will the agent do next") | Seems like a natural extension of inference | Requires ML or LLM, has low accuracy without deep training data, and shifts the product from observation to prediction — a fundamentally different value proposition that distracts from the core supervision mission | Stick to detection of current/past intent; prediction is out of scope |
| Manual intent labeling ("let me tell the system what the agent is doing") | Power users want to annotate their sessions | Creates a hybrid human/machine inference model that complicates the UX; raises the question of which label to show when human and machine disagree | Let the heuristic inference run; users can annotate externally (notes, comments) without ArchLens managing that state |
| Per-node time-travel (see history of one specific component) | Users want to drill down into one component's history specifically | Requires component-scoped event queries and a separate timeline UI; `findSince()` returns all events, not per-component; significant query and UI complexity | The activity feed already provides per-node event history; the Inspector panel shows lastModified; this use case is addressed without per-node replay |

---

## Feature Dependencies

```
[changeEvents SQLite table] (already exists — stores all graph mutations with timestamp)
    └──enables──> [Time-Travel Replay]
                      ├──requires──> [Snapshot Reconstruction API]  (new: GET /api/history?at=<timestamp>)
                      │                   └──reads──> [graph_nodes + graph_edges] (already exist)
                      ├──requires──> [Replay Scrubber UI]           (new React component)
                      │                   └──writes──> [graphStore.applySnapshot()] (already exists)
                      ├──enhances──> [Activity Feed sync]           (filter feed by timestamp)
                      └──enhances──> [Architecture Diff Overlay]    (compare two reconstructed snapshots)

[inferenceStore.activityFeed] (already exists — accumulates ArchitecturalEvent[] stream)
    └──enables──> [Intent Inference]
                      ├──requires──> [Intent Classifier]            (new: heuristic engine over event stream)
                      │                   └──reads──> [ComponentAggregator names + zones] (already exists)
                      ├──requires──> [Intent Panel UI]              (new React component)
                      │                   └──parallel──> [RiskPanel, ActivityFeed] (same panel layout pattern)
                      └──enhances──> [Risk-correlated Intent]       (join with inferenceStore.risks)

[Time-Travel Replay] ──enhances──> [Intent Inference]
    (scrubbing to a past point shows intent state at that time — natural integration)

[Intent History Log] ──requires──> [Intent Inference]
    └──integrates with──> [Time-Travel epoch markers]
```

### Dependency Notes

- **Snapshot Reconstruction API requires changeEvents + current graph tables:** Reconstruction works by taking the current live graph state and walking backwards through changeEvents to undo mutations, OR by replaying forward from an empty graph to a target timestamp. Walking backward ("undo-log style") is simpler given the existing schema.
- **Replay Scrubber UI requires graphStore.applySnapshot():** The scrubber must drive the canvas state; `applySnapshot()` already exists and accepts any node/edge set — time-travel feeds historical snapshots through this same API.
- **Intent Classifier requires ComponentAggregator names:** The classifier uses component names (auth, payment, user, route, cache) as the primary classification signal; these are already extracted by `ComponentAggregator.aggregateSnapshot()`.
- **Intent Panel is non-blocking:** Can be added as a new panel tab without touching any existing panel code; follows the `RiskPanel`/`ActivityFeed`/`NodeInspector` pattern.
- **Risk-correlated intent requires both inferenceStore.risks and active intent classification:** The combination is additive; each feature delivers value independently; the correlation is an enhancement, not a prerequisite.

---

## MVP Definition for v3.0

### Launch With (v3.0 core)

Minimum viable v3.0 — validates temporal awareness and intent concepts.

- [ ] **Snapshot reconstruction endpoint** (`GET /api/history?at=<timestamp>`) — reconstruct graph state at any past point from changeEvents; this is the backend engine for all time-travel features
- [ ] **Replay scrubber UI** — timeline slider showing the session duration; scrubbing calls the reconstruction endpoint and feeds `graphStore.applySnapshot()`; timestamp labels; play/pause button
- [ ] **Replay mode indicator** — clear visual state showing the user is viewing a historical snapshot, not live data; "REPLAY" badge; pause live WebSocket updates during replay
- [ ] **Exit replay to live** — one button returns to current live state; reconnects WebSocket event stream
- [ ] **Intent classifier (heuristic)** — analyze accumulating `ArchitecturalEvent[]` stream; classify into objective label + confidence score using component name matching and zone distribution
- [ ] **Intent panel UI** — display current inferred intent, confidence, and inferred subtasks list; auto-updates as events stream in; panel parallel to existing RiskPanel/ActivityFeed

### Add After Validation (v3.x)

Features to add once core time-travel + intent concepts are confirmed useful.

- [ ] **Activity feed synchronized with scrubber** — trigger: users find map replay disorienting without context; feed narration should match what was happening at the scrubbed moment
- [ ] **Epoch/milestone markers on timeline** — trigger: users report difficulty navigating to "interesting moments" in long sessions
- [ ] **Architecture diff overlay** — trigger: users want to see what changed between two specific moments, not just see one moment at a time
- [ ] **Intent history log** — trigger: users want to review what objectives the agent pursued across a session, not just current intent
- [ ] **Risk-correlated intent display** — trigger: users report that risks and intent feel disconnected; linking them reduces cognitive overhead

### Future Consideration (v4+)

- [ ] **Cross-session comparison** — requires session boundary persistence and multi-session query support; defer until time-travel proves valuable enough to warrant the complexity
- [ ] **Subtask completion indicators** — "done" detection logic is inherently ambiguous; defer until intent inference is stable enough to reason about completion
- [ ] **LLM-enhanced intent descriptions** — optional enhancement for richer labels; only worth adding once heuristic baseline is proven accurate enough to fine-tune against

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Snapshot reconstruction API | HIGH | MEDIUM | P1 — v3.0 core |
| Replay scrubber UI | HIGH | MEDIUM | P1 — v3.0 core |
| Replay mode indicator + exit | HIGH | LOW | P1 — v3.0 core |
| Intent classifier (heuristic) | HIGH | MEDIUM | P1 — v3.0 core |
| Intent panel UI | HIGH | LOW | P1 — v3.0 core |
| Activity feed sync with scrubber | MEDIUM | LOW | P2 — v3.x |
| Epoch/milestone markers | MEDIUM | MEDIUM | P2 — v3.x |
| Architecture diff overlay | MEDIUM | HIGH | P2 — v3.x |
| Intent history log | MEDIUM | MEDIUM | P2 — v3.x |
| Risk-correlated intent | MEDIUM | LOW | P2 — v3.x |
| Replay speed control | LOW | LOW | P2 — v3.x |
| Cross-session comparison | LOW | HIGH | P3 — v4+ |
| Subtask completion indicators | MEDIUM | HIGH | P3 — v4+ |
| LLM-enhanced intent descriptions | MEDIUM | HIGH | P3 — v4+ |

---

## Implementation Notes: Intent Classifier Design

The intent classifier must work purely with signals already available from existing ArchLens infrastructure. No LLM, no network, no ML model. The following heuristic approach covers the majority of real-world cases:

### Signal Sources (all already available)

| Signal | Source | How Used |
|--------|--------|---------|
| Component names | `ComponentAggregator` extracts names from file paths | Keyword matching: "auth/login/session/token" → Authentication; "payment/billing/invoice/stripe" → Payment; "user/profile/account" → User Management; "route/router/api/endpoint" → API Layer; "db/database/repo/store/cache/redis" → Data Layer |
| Zone distribution of recent events | `ArchitecturalEvent.zone` field on each event | If 70%+ of recent events touch `services` zone → backend feature work; if 70%+ touch `frontend` zone → UI work; mixed zones → cross-cutting concern |
| Event type ratios | `ArchitecturalEvent.type` (component_created vs dependency_added vs component_merged) | High `component_created` ratio → building new feature; high `dependency_added` ratio → integrating/connecting; high `component_merged/split` ratio → refactoring |
| Event velocity | Count of events per 30-second window | High velocity → agent actively building; low velocity → agent paused or done |
| Component count change | Net delta of nodes in recent events | Net positive (more nodes created than removed) → expansion; net negative → consolidation/refactoring |

### Objective Taxonomy

```
PRIMARY OBJECTIVES:
  Building: New Feature (sub-type: auth / payment / user-management / api / data-layer / infrastructure)
  Refactoring: Existing Modules (sub-type: splitting / merging / reorganizing)
  Fixing: Architecture Issues (sub-type: circular-deps / boundary-violations / excessive-fan-out)
  Connecting: Integrating Components (sub-type: adding-dependencies / creating-interfaces)
  Initializing: Project Setup (sub-type: scaffolding / bootstrapping)

CONFIDENCE SCORING:
  HIGH (>70%): Multiple corroborating signals from name + zone + event-type
  MEDIUM (40-70%): Name or zone matches but event-type is ambiguous
  LOW (<40%): Conflicting signals or insufficient event count (<5 events in window)
```

### Classification Algorithm

```
1. Gather last N architectural events (window: sliding 60-second window, minimum 3 events)
2. Extract component names from all events in window
3. Match names against keyword taxonomy → candidate objectives with name-match score
4. Compute zone distribution → zone-match score for each candidate
5. Compute event-type ratio → event-type score (creating vs connecting vs refactoring)
6. Combine scores: total = (name_score × 0.5) + (zone_score × 0.3) + (event_type_score × 0.2)
7. Select objective with highest total score
8. Confidence = total score normalized to 0-100%
9. If confidence < 40%, output "Analyzing..." state, not a low-confidence guess
```

This design is HIGH confidence for the most common AI agent tasks (building new features, refactoring) because component names are extremely informative. It is MEDIUM confidence for infrastructure work (where names like "middleware" and "config" are more generic).

---

## Implementation Notes: Snapshot Reconstruction

The existing `changeEvents` table stores the event log but NOT point-in-time snapshots. Two reconstruction strategies:

### Strategy A: Replay Forward (recommended for v3.0)
Start from empty graph, replay all `changeEvents` up to timestamp T in order of `changeEvents.id`.

- **Pros**: Simple to implement; uses existing `eventsRepository.findAll()` + filter by timestamp; no schema changes
- **Cons**: Slow for late-in-session scrubbing (must replay 1000s of events to reach timestamp 2 hours in)
- **Mitigation**: Cache snapshots at regular intervals (every 100 events) in memory on the server after first replay request

### Strategy B: Undo-log Backwards (complex, skip for v3.0)
Start from current live state, walk backwards through changeEvents undoing each mutation.

- **Pros**: Fast for recent history (most common case)
- **Cons**: Requires implementing "undo" semantics for each event type; `node_removed` undo requires re-fetching the original node data which is not stored in the undo-log
- **Skip for v3.0**: Schema does not preserve enough data in changeEvents to undo reliably (node metadata only stored in `graph_nodes`, which reflects current state)

### Practical Implementation for v3.0

```
GET /api/history?at=<timestamp>
  1. Load all changeEvents WHERE timestamp <= at, ORDER BY id ASC
  2. Start with empty graph state (nodes: {}, edges: {})
  3. Apply each event in order:
     - node_added → add node to in-memory graph (use graph_nodes row for current metadata)
     - node_removed → remove node from in-memory graph
     - edge_added → add edge
     - edge_removed → remove edge
     - zone_changed → update node zone in in-memory graph
  4. Return reconstructed graph as InitialStateMessage format
  5. Cache result at 10-event granularity in memory (Map<eventId, snapshot>) to avoid re-replay on scrub
```

**Note on node metadata in reconstruction:** `changeEvents` stores `nodeId` but not the full node metadata (name, fileList, exports). The reconstruction must look up node metadata from `graph_nodes` for the current best-known values. This is "good enough" — the node names and zones are stable across the session; only edges and zone assignments change materially during agent work.

**Schema gap:** The `changeEvents` table currently lacks a `watchRoot` column, which means cross-directory contamination is possible if the user has watched multiple directories. Add a `watchRoot` column (or a session tracking mechanism) as part of the v3.0 schema migration.

---

## Competitor Context (Time-Travel and Intent)

| Tool | Time-Travel Capability | Intent Inference |
|------|----------------------|-----------------|
| Redux DevTools | Action-list navigation + optional slider; jumps between discrete Redux state snapshots | None (shows raw state, not intent) |
| Replay.io | Full browser session replay with DevTools integration; not architecture-level | None |
| CodeScene | Trend charts over git history; no scrubbing of graph state | Code health trends, hotspot forecasting; not real-time intent |
| Temporal.io dashboard | Workflow execution replay with retry/failure visualization | Workflow definition is the intent; not inferred |
| Augment Code Intent | Shows agent task decomposition and parallel progress | Explicit spec-driven (user writes intent); not inferred from code |
| AppMap | Runtime session replay (function calls, not architecture) | None |
| Gource | Git history video; architecture evolution as animation | None |
| **ArchLens v3.0** | Architecture-level scrubbing of live session using changeEvents event log | Heuristic inference from component name + zone + event patterns |

**The gap**: No existing tool combines architecture-level time-travel (not runtime trace, not git history) with automatic intent inference from code change patterns. ArchLens v3.0 occupies an unoccupied space.

---

## Sources

- **Redux DevTools time-travel documentation**: https://medium.com/the-web-tub/time-travel-in-react-redux-apps-using-the-redux-devtools-5e94eba5e7c0 — Action-list navigation, slider monitor, state reconstruction pattern (MEDIUM confidence — older source but describes stable pattern)
- **Temporal graph database patterns (AeonG)**: https://link.springer.com/article/10.1007/s00778-025-00932-w — Anchor+delta strategy for temporal graph storage; snapshot reconstruction algorithms (HIGH confidence — VLDB Journal 2025)
- **SQLite event sourcing patterns**: https://www.sqliteforum.com/p/building-event-sourcing-systems-with — CQRS + temporal queries with SQLite; reconstruction from event log (MEDIUM confidence — community source verified against event sourcing fundamentals)
- **Promises, Perils, and Heuristics for Mining Coding Agent Activity (MSR '26)**: https://arxiv.org/abs/2601.18345 — Coding agents leave observable patterns in commits, file changes, PR metadata; heuristic detection approaches (MEDIUM confidence — abstract only accessible, paper referenced for direction)
- **Augment Code Intent workspace**: https://www.augmentcode.com/blog/intent-a-workspace-for-agent-orchestration — Parallel agent coordination, living spec, task decomposition; reference for intent display UX patterns (MEDIUM confidence — official product blog)
- **Replay.io time-travel debugger**: https://docs.replay.io/time-travel-intro/intro-to-time-travel — Record/replay architecture for browser sessions; UI patterns for temporal navigation (MEDIUM confidence — official docs)
- **Event sourcing (Martin Fowler)**: https://martinfowler.com/eaaDev/EventSourcing.html — Foundational reference for event log reconstruction; state reconstruction by replaying events forward (HIGH confidence — canonical source)
- **Intent Detection for AI Systems (Medium)**: https://medium.com/@tombastaner/intent-detection-for-ai-systems-understanding-what-users-really-want-2399064e3cf4 — Behavioral pattern-based intent inference; confidence scoring approaches (LOW confidence — single non-authoritative source; used for framing only)
- **Agentic UI patterns**: https://www.agenticpathdesign.com/resources/-emerging-ui-patterns-for-communicating-agentic-states — Emerging patterns for surfacing agent state to supervisors (LOW confidence — emerging field with limited documentation)
- **Codebase analysis (ArchLens source)**: `packages/server/src/db/schema.ts`, `packages/server/src/db/repository/events.ts`, `packages/server/src/inference/InferenceEngine.ts`, `packages/client/src/store/inferenceStore.ts` — Direct inspection of existing infrastructure; HIGH confidence for what is already built

---

*Feature research for: ArchLens v3.0 — Time-travel replay and intent inference additions*
*Researched: 2026-03-16*
