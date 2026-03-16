# Architecture Research

**Domain:** Time-travel replay + intent inference integration with ArchLens v2.2
**Researched:** 2026-03-16
**Confidence:** HIGH — based on direct codebase inspection of all existing components

> This file supersedes the prior v1.0 architecture research. It focuses exclusively
> on how the v3.0 features (time-travel replay, intent inference) integrate with the
> existing codebase. The original system architecture notes are preserved at the bottom
> of this file for reference.

---

## Standard Architecture

### System Overview — v3.0 Target State

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React 19 + Zustand)                      │
├──────────────────┬───────────────────────────────┬────────────────────────┤
│   Canvas Layer   │        Sidebar (280px)         │    NEW: Bottom Bar     │
│                  │                                │                        │
│  ArchCanvas      │  NodeInspector (existing)      │  TimelineSlider        │
│  (Konva/d3)      │  RiskPanel (existing)          │  (HTML range input     │
│  UNMODIFIED      │  ActivityFeed (existing)       │   + playback controls) │
│                  │  IntentPanel (NEW)             │                        │
├──────────────────┴───────────────────────────────┴────────────────────────┤
│                         State Layer (Zustand stores)                      │
│  graphStore (MODIFIED) │  inferenceStore (MODIFIED) │  timelineStore (NEW) │
│  +replayMode flag       │  +replayMode flag           │  snapshots[], pos   │
│                         │                             │  isReplaying, mode  │
│                         │                             │  intentSessions[]   │
├─────────────────────────────────────────────────────────────────────────┬─┤
│                        WsClient (MODIFIED)                              │ │
│  +handles: snapshot_created, intent_update, timeline_meta messages      │ │
│  +respects replayMode: buffers (not drops) live messages during replay  │ │
└─────────────────────────────────────────────────────────────────────────┴─┘
                                    │ WebSocket + REST
┌───────────────────────────────────┴───────────────────────────────────────┐
│                          SERVER (Fastify 5)                               │
├──────────────────┬────────────────────────┬───────────────────────────────┤
│  Existing        │  NEW: Replay Layer     │  NEW: Intent Layer            │
│                  │                        │                                │
│  Pipeline        │  SnapshotRecorder      │  IntentAnalyzer               │
│  DependencyGraph │  (graph.on('delta')    │  (reads changeEvents window   │
│  ComponentAgg.   │   → periodic persist   │   every 30s OR on snapshot;   │
│  InferenceEngine │   to graph_snapshots)  │   writes intent_sessions)     │
│  websocketPlugin │                        │                                │
│  snapshotPlugin  │  timelinePlugin        │  intent_update broadcast via  │
│                  │  GET /api/timeline     │  existing broadcast()         │
│                  │  GET /api/snapshot/:id │                                │
│                  │                        │                                │
└──────────────────┴────────────────────────┴───────────────────────────────┘
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                           SQLite (Drizzle ORM)                            │
│                                                                           │
│  graph_nodes (existing)    │  graph_edges (existing)                     │
│  change_events (existing)  │  layout_positions (existing)                │
│                            │                                              │
│  graph_snapshots (NEW)     │  intent_sessions (NEW)                      │
│  id, version, timestamp,   │  id, startVersion, endVersion,              │
│  nodes_json, edges_json,   │  label, confidence, detectedAt,             │
│  positions_json            │  filePatterns_json                          │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Status | Responsibility |
|-----------|--------|----------------|
| `SnapshotRecorder` | NEW (server) | Subscribes to `graph.on('delta')`, persists snapshot every 5 deltas or on structural change |
| `IntentAnalyzer` | NEW (server) | Reads 5-minute `changeEvents` window, clusters by 90-second gap, applies heuristics, emits `intent_update` broadcasts |
| `timelinePlugin` | NEW (server) | Fastify plugin — `GET /api/timeline` (list all metas), `GET /api/snapshot/:id` (restore one) |
| `timelineStore` | NEW (client) | Zustand store — snapshot list, current replay position, `isReplaying` flag, intent sessions |
| `TimelineSlider` | NEW (client) | Bottom bar `<input type="range">` over snapshot list; Live/Pause controls; timestamp labels |
| `IntentPanel` | NEW (client) | Sidebar panel showing inferred agent objective + subtask list for current session window |
| `graphStore` | MODIFIED | Add `replayMode: boolean` — WsClient skips live `graph_delta` application when true |
| `inferenceStore` | MODIFIED | Add `replayMode: boolean` — ActivityFeed/RiskPanel show historical data during replay |
| `WsClient` | MODIFIED | Handle 3 new WS message types; check `replayMode` before applying live messages |
| `db/schema.ts` | MODIFIED | Add `graphSnapshots` and `intentSessions` Drizzle table definitions + migration |
| `index.ts` | MODIFIED | Wire `SnapshotRecorder` + `IntentAnalyzer` into startup and `switchWatchRoot()` |
| `ArchCanvas` | UNMODIFIED | Already reads from graphStore; replay works by substituting store data — no canvas changes |
| `NodeInspector` | UNMODIFIED | No changes needed |
| `RiskPanel` | UNMODIFIED | No changes needed |
| `ActivityFeed` | UNMODIFIED | No changes needed (replayMode handled in inferenceStore, not the panel) |

---

## Recommended Project Structure

New files only (existing folder structure unchanged):

```
packages/
├── server/src/
│   ├── replay/                        # NEW folder — temporal intelligence layer
│   │   ├── SnapshotRecorder.ts        # Persists periodic graph snapshots
│   │   └── IntentAnalyzer.ts         # Infers agent objectives from change patterns
│   └── plugins/
│       └── timeline.ts               # NEW — GET /api/timeline, GET /api/snapshot/:id
│
├── client/src/
│   ├── store/
│   │   └── timelineStore.ts          # NEW — Zustand store: snapshots, replay, intents
│   ├── panels/
│   │   └── IntentPanel.tsx           # NEW — sidebar panel (intent + subtask display)
│   └── timeline/                     # NEW folder — bottom bar components
│       └── TimelineSlider.tsx        # NEW — scrubber + playback controls
│
└── shared/src/types/
    └── timeline.ts                   # NEW — SnapshotMeta, IntentSession, new WS msgs
```

### Structure Rationale

- **`server/src/replay/`**: Separates temporal intelligence from real-time inference (`inference/`). The `inference/` folder owns zone/risk/event detection per-delta. `replay/` owns periodic persistence and pattern analysis across time. Mixing them would bloat `inference/`.
- **`client/src/timeline/`**: The slider lives below the canvas in `App.tsx` layout, not inside the sidebar panel area. It warrants its own folder separate from `panels/`, which is the sidebar-only zone.
- **`shared/src/types/timeline.ts`**: New domain, new type file — follows the existing `graph.ts` / `inference.ts` / `messages.ts` per-domain convention.

---

## Architectural Patterns

### Pattern 1: Periodic Snapshot on Delta Threshold (not wall-clock interval)

**What:** `SnapshotRecorder` subscribes to `graph.on('delta')` with an internal counter. Every 5 deltas OR when a structural change occurs (component added/removed), it calls `aggregator.aggregateSnapshot()` + `positionsRepository.findAll()` and persists one row to `graph_snapshots`.

**When to use:** Always. Delta-threshold snapshotting is correct because the graph version counter is the natural clock for architecture evolution. Wall-clock intervals create empty snapshots during idle periods that pollute the timeline with noise.

**Trade-offs:** Storage grows linearly with graph activity. At ~8KB per snapshot (JSON of 50-component graph), 100 file saves per session produces ~20 snapshots = ~160KB. SQLite handles this trivially. No pruning needed initially; add TTL (30-day expiry) in a future phase.

**Example:**
```typescript
// server/src/replay/SnapshotRecorder.ts
export class SnapshotRecorder {
  private deltaCount = 0;
  private readonly SNAPSHOT_INTERVAL = 5;

  constructor(
    private readonly graph: DependencyGraph,
    private readonly aggregator: ComponentAggregator,
  ) {
    graph.on('delta', (delta) => this.onDelta(delta));
  }

  private onDelta(delta: GraphDelta): void {
    const isStructural =
      delta.addedNodes.length > 0 || delta.removedNodeIds.length > 0;
    this.deltaCount++;

    if (isStructural || this.deltaCount >= this.SNAPSHOT_INTERVAL) {
      this.deltaCount = 0;
      this.persist(delta.version);
    }
  }

  private persist(version: number): void {
    const { nodes, edges } = this.aggregator.aggregateSnapshot(graph, db);
    const positions = positionsRepository.findAll();
    const id = db.insert(graphSnapshots).values({
      version,
      timestamp: new Date(),
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
      positionsJson: JSON.stringify(positions),
    }).run().lastInsertRowid;

    broadcast({ type: 'snapshot_created', snapshot: { id, version, timestamp: Date.now() } });
  }

  destroy(): void {
    this.graph.off('delta', this.deltaHandler);
  }
}
```

### Pattern 2: Replay Mode via Store Flag (not canvas-side logic)

**What:** `graphStore` gains a `replayMode: boolean` flag. When `true`, WsClient stops applying live `graph_delta` and `inference` messages to the stores. The timeline slider drives graph state by calling `graphStore.getState().applySnapshot()` with data fetched from `GET /api/snapshot/:id`. Exiting replay clears the flag and calls the existing `GET /api/snapshot` recovery endpoint to resync to live state.

**When to use:** Always for replay. The critical design principle: the canvas is unmodified. `ArchCanvas` reads from graphStore regardless of whether the source was a live WS message or a historical fetch. Replay is achieved entirely by graphStore state substitution.

**Trade-offs:** ActivityFeed and RiskPanel continue receiving live WS messages unless `inferenceStore.replayMode` is also set. Both flags must be set together. Live messages received during replay should be buffered (not dropped) so the transition back to live is seamless — but buffering is an optimization; V1 can simply trigger a fresh snapshot fetch on exit.

**Example:**
```typescript
// client/src/store/timelineStore.ts — replay actions
async function scrubToSnapshot(snapshotId: number): Promise<void> {
  graphStore.setState({ replayMode: true });
  inferenceStore.setState({ replayMode: true });

  const res = await fetch(`/api/snapshot/${snapshotId}`);
  const data = await res.json() as HistoricalSnapshot;

  // Re-use the existing applySnapshot — no canvas changes needed
  graphStore.getState().applySnapshot({
    type: 'initial_state',
    version: data.version,
    nodes: data.nodes,
    edges: data.edges,
    layoutPositions: data.positions,
  });

  timelineStore.setState({ currentSnapshotId: snapshotId });
}

function exitReplay(): void {
  graphStore.setState({ replayMode: false });
  inferenceStore.setState({ replayMode: false });
  // Trigger existing recovery path to resync to live state
  wsClient.requestSnapshot();
}
```

### Pattern 3: Intent Inference by File Co-Change Clustering (heuristic, no LLM)

**What:** `IntentAnalyzer` runs every 30 seconds (or on each `snapshot_created` event). It queries `changeEvents` for the last 5 minutes, then clusters events by 90-second temporal gaps. For each cluster it applies ordered heuristics to produce a labeled `IntentSession`.

**Heuristics (ordered by priority):**
1. `component_created` dominates + single zone → "Adding [ComponentName] to [zone]"
2. `dependency_added` chain A→B→C + no new components → "Wiring [zone] dependencies"
3. `component_merged` or `component_split` events → "Refactoring [zone] structure"
4. Files span multiple zones + `dependency_added` → "Connecting [zone1] to [zone2]"
5. Fallback → "Working in [zone]" (confidence 0.5 — always produces output)

**When to use:** Always. No LLM. Heuristics run in <1ms, work offline, are deterministic, and cover the patterns developers actually care about. ArchLens is a local observation tool with no cloud dependency requirement (PROJECT.md constraint).

**Trade-offs:** Heuristics miss unusual agent behaviors. Confidence score surfaces uncertainty. Fallback label prevents empty panel.

**Example:**
```typescript
// server/src/replay/IntentAnalyzer.ts
export function inferSession(events: ChangeEvent[]): IntentSession {
  const zones = [...new Set(events.map(e => getZoneFromPayload(e.payload)))];
  const hasCreated = events.some(e => e.eventType === 'component_created');
  const hasDepsAdded = events.some(e => e.eventType === 'dependency_added');
  const hasRefactor = events.some(
    e => e.eventType === 'component_merged' || e.eventType === 'component_split'
  );

  if (hasRefactor) {
    return { label: `Refactoring ${zones.join(' + ')} structure`, confidence: 0.75 };
  }
  if (hasCreated && zones.length === 1) {
    const createdEvent = events.find(e => e.eventType === 'component_created');
    const name = getComponentNameFromPayload(createdEvent?.payload);
    return { label: `Adding ${name ?? 'component'} in ${zones[0]}`, confidence: 0.85 };
  }
  if (hasDepsAdded && !hasCreated) {
    return { label: `Wiring dependencies in ${zones.join(' + ')}`, confidence: 0.70 };
  }
  if (zones.length > 1 && hasDepsAdded) {
    return { label: `Connecting ${zones[0]} to ${zones[1]}`, confidence: 0.65 };
  }
  return { label: `Working in ${zones.join(' + ')}`, confidence: 0.50 };
}
```

---

## Data Flow

### Time-Travel Replay Flow

```
[User drags timeline scrubber]
    ↓
TimelineSlider → timelineStore.scrubToSnapshot(snapshotId)
    ↓
graphStore.setState({ replayMode: true })
inferenceStore.setState({ replayMode: true })
    ↓
fetch GET /api/snapshot/:id        [NEW REST endpoint]
    ↓
SnapshotRow from graph_snapshots table
    ↓
graphStore.applySnapshot(historicalData)
    ↓
ArchCanvas re-renders via Zustand subscription (no canvas code changes)
    ↓
IntentPanel reads timelineStore.sessionsAtVersion(snapshotVersion)

[User clicks "Live" button]
    ↓
graphStore.setState({ replayMode: false })
inferenceStore.setState({ replayMode: false })
    ↓
WsClient.requestSnapshot() → GET /api/snapshot → live state restored
```

### Snapshot Creation Flow (Server)

```
[File change detected]
    ↓
Pipeline → DependencyGraph → graph.emit('delta')
    ↓                              ↓
[InferenceEngine                [SnapshotRecorder      ← NEW listener
 existing listener]              onDelta() counter]
    ↓                              ↓
[existing broadcast]           [every 5 deltas OR structural]
                                   ↓
                               aggregator.aggregateSnapshot()
                               positionsRepository.findAll()
                                   ↓
                               db.insert(graphSnapshots)
                                   ↓
                               broadcast({ type: 'snapshot_created', ... })
                                   ↓
                           WsClient → timelineStore.addSnapshot(meta)
```

### Intent Analysis Flow

```
[30-second timer OR snapshot_created event]
    ↓
IntentAnalyzer.analyze()
    ↓
SELECT from change_events WHERE timestamp > (now - 5 minutes)
    ↓
Cluster events by 90-second temporal gaps → sessions[]
    ↓
inferSession(session) for each cluster
    ↓
db.upsert(intent_sessions)
    ↓
broadcast({ type: 'intent_update', sessions })
    ↓
WsClient → timelineStore.setIntentSessions(sessions)
    ↓
IntentPanel re-renders with latest inferred objective
```

### WS Connection Bootstrap (Modified)

```
[Client connects to /ws]
    ↓
websocketPlugin sends existing: initial_state
    ↓
websocketPlugin also sends NEW: timeline_meta  ← add to same connect handler
  { snapshots: SnapshotMeta[], sessions: IntentSession[] }
    ↓
WsClient handles timeline_meta:
  → timelineStore.initialize(snapshots, sessions)
  → TimelineSlider renders with full history from first paint
```

**Why `timeline_meta` over HTTP:** The existing pattern sends `initial_state` over WS on connect (websocket.ts line 183). Sending `timeline_meta` in the same handler eliminates a second HTTP roundtrip and keeps bootstrap atomic — the client has graph state and timeline state simultaneously.

---

## New SQLite Tables

```sql
-- graph_snapshots: one row per periodic graph checkpoint
-- Add to packages/server/src/db/schema.ts as Drizzle table definition
CREATE TABLE graph_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  version       INTEGER NOT NULL,
  timestamp     INTEGER NOT NULL,   -- timestamp_ms
  nodes_json    TEXT NOT NULL,      -- JSON: GraphNode[]
  edges_json    TEXT NOT NULL,      -- JSON: GraphEdge[]
  positions_json TEXT NOT NULL      -- JSON: Record<nodeId, {x,y,zone}>
);

-- intent_sessions: one row per inferred agent work session
CREATE TABLE intent_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  start_version  INTEGER NOT NULL,
  end_version    INTEGER NOT NULL,
  label          TEXT NOT NULL,     -- e.g. "Adding Parser to api"
  confidence     REAL NOT NULL,     -- 0.0–1.0
  detected_at    INTEGER NOT NULL,  -- timestamp_ms
  file_patterns  TEXT NOT NULL      -- JSON: string[] of matched file paths
);
```

**Why SQLite (not separate JSON files):**
- Drizzle ORM is already configured with migrations; two more tables require only schema additions
- Transactional writes prevent partial snapshots corrupting replay
- Version range queries (`WHERE version BETWEEN ? AND ?`) are idiomatic SQL
- Consistent with the existing model — all state in one DB file
- Storage estimate: 100 saves/session → ~20 rows × ~8KB = 160KB/session. Negligible.

---

## New WebSocket Message Types

Add to `packages/shared/src/types/timeline.ts` and include in `ServerMessage` union in `messages.ts`:

```typescript
// shared/src/types/timeline.ts

export interface SnapshotMeta {
  id: number;
  version: number;
  timestamp: number;
}

export interface IntentSession {
  id: number;
  startVersion: number;
  endVersion: number;
  label: string;        // Human-readable objective description
  confidence: number;   // 0.0–1.0; shown as indicator in IntentPanel
  detectedAt: number;
}

// Server → Client: new snapshot available (real-time update to timeline)
export interface SnapshotCreatedMessage {
  type: 'snapshot_created';
  snapshot: SnapshotMeta;
}

// Server → Client: updated intent analysis result
export interface IntentUpdateMessage {
  type: 'intent_update';
  sessions: IntentSession[];
}

// Server → Client: sent on WS connect alongside initial_state
export interface TimelineMetaMessage {
  type: 'timeline_meta';
  snapshots: SnapshotMeta[];
  sessions: IntentSession[];
}
```

Add `SnapshotCreatedMessage | IntentUpdateMessage | TimelineMetaMessage` to the `ServerMessage` union in `messages.ts`.

---

## Integration Points with Existing Components

### Server Integration

| Existing Component | Integration Point | Change Required |
|-------------------|-------------------|-----------------|
| `DependencyGraph` | `graph.on('delta')` | No change — `SnapshotRecorder` subscribes as an additional listener, same pattern as `InferenceEngine` constructor |
| `ComponentAggregator` | `aggregator.aggregateSnapshot()` | No change — `SnapshotRecorder` calls it; already called by websocketPlugin on every delta |
| `websocketPlugin` | WS connect handler (line 183) | Add `timeline_meta` send after `initial_state`; add `snapshot_created` and `intent_update` to `broadcast()` callers |
| `index.ts` `switchWatchRoot()` | Stop/start sequence | Add: `snapshotRecorder.destroy()`, clear `graph_snapshots` + `intent_sessions` tables, create new `SnapshotRecorder` + `IntentAnalyzer` |
| `db/schema.ts` | Drizzle table definitions | Add `graphSnapshots` and `intentSessions` table exports + run Drizzle migration |
| `eventsRepository` | Existing `changeEvents` table | `IntentAnalyzer` reads existing rows — no schema change, no repository change |

### Client Integration

| Existing Component | Integration Point | Change Required |
|-------------------|-------------------|-----------------|
| `graphStore` | Store interface + implementation | Add `replayMode: boolean` field and `setReplayMode(v: boolean)` action |
| `inferenceStore` | Store interface + implementation | Add `replayMode: boolean` field; panels should not update during replay |
| `WsClient.handleMessage()` | Switch statement | Add 3 new `case` branches following existing pattern |
| `App.tsx` layout | Render structure | Add `<TimelineSlider />` between DirectoryBar and canvas+sidebar content; add `<IntentPanel />` to sidebar panel list |
| `ArchCanvas` | **No change** | Reads from graphStore subscriptions; replay populates graphStore identically to live mode |
| `NodeInspector` | **No change** | |
| `RiskPanel` | **No change** | |
| `ActivityFeed` | **No change** | |

### Minimal Surface Area Principle

`ArchCanvas`, `NodeRenderer`, `EdgeRenderer`, `ZoneRenderer`, `NodeInspector`, `RiskPanel`, and `ActivityFeed` remain completely unmodified. The replay illusion is achieved entirely through graphStore state substitution. This avoids brittle canvas-layer replay logic and keeps the diff surface small for testing.

---

## Anti-Patterns

### Anti-Pattern 1: Wall-Clock Snapshot Intervals

**What people do:** `setInterval(() => takeSnapshot(), 60_000)` — snapshot every 60 seconds.

**Why it's wrong:** Creates identical snapshots during idle periods (user away from keyboard). Timeline fills with noise: 8 hours of inactivity = 480 empty snapshot slots. Scrubber becomes unusable.

**Do this instead:** Snapshot on delta threshold (every 5 deltas) or structural change (component added/removed). Only persist when state actually changed.

### Anti-Pattern 2: Replay Logic Inside ArchCanvas

**What people do:** Build a replay controller inside `ArchCanvas` or `NodeRenderer` that directly feeds historical node/edge arrays to Konva layers.

**Why it's wrong:** ArchCanvas already subscribes to Zustand. Adding a second control path creates two sources of truth. Konva tween animations conflict between the live subscription and the replay feed, causing visual glitches.

**Do this instead:** Replay by writing historical data into graphStore via the existing `applySnapshot()`. The canvas observes graphStore and re-renders exactly as it does for live data. Zero canvas changes required.

### Anti-Pattern 3: LLM for Intent Inference

**What people do:** Send the `changeEvents` log to an LLM API with a prompt asking "what is the agent working on?"

**Why it's wrong:** ArchLens is a local tool. An LLM call introduces: network latency (300–2000ms), API key management, cost per inference, and offline failure mode. The project constraint ("observation is the core value, not prescription") means simple heuristics describing what happened are preferable to probabilistic predictions.

**Do this instead:** Heuristic pattern matching on `changeEvents`. The structural patterns that matter (adding a component, wiring dependencies, refactoring a zone) are detectable from event types and zone labels. Heuristics run in <1ms, work offline, are deterministic.

### Anti-Pattern 4: Storing File Source Content in Snapshots

**What people do:** Include file AST data or source content in snapshot rows to enable "diff what changed between snapshots."

**Why it's wrong:** Snapshot rows balloon from ~8KB to megabytes each. The value (source diff) is out of scope (PROJECT.md explicitly excludes "Video/screen recording of architecture evolution"). For file-level diffs, the files are on disk.

**Do this instead:** Snapshots store component-level node/edge/position data only — the same shape as `InitialStateMessage`. This is the minimal necessary for timeline replay.

### Anti-Pattern 5: Shared Snapshot Table Across Watch Roots

**What people do:** Keep `graph_snapshots` rows across watch-root switches, adding a `watchRoot` column to filter by project.

**Why it's wrong:** The timeline scrubber is per-session per-project. Snapshots from a previous project on the current scrubber are meaningless and confusing. The `switchWatchRoot()` flow already clears `graph_nodes` and `graph_edges`; not clearing snapshots creates a state inconsistency.

**Do this instead:** `switchWatchRoot()` deletes all rows from `graph_snapshots` and `intent_sessions` in the same pass that clears `graph_nodes` and `graph_edges`. Timeline starts fresh for each watched directory.

---

## Build Order (Dependency-Aware)

The time-travel and intent systems have a clear dependency chain that determines implementation order:

```
Phase A: Foundation (no UI dependencies — can ship independently)
  1. db/schema.ts — add graphSnapshots + intentSessions Drizzle tables + migration
  2. shared/src/types/timeline.ts — SnapshotMeta, IntentSession, new message types
  3. shared/src/types/messages.ts — extend ServerMessage union with 3 new types

Phase B: Server replay layer (depends on Phase A)
  4. SnapshotRecorder — subscribe to graph delta, persist to graph_snapshots table
  5. timelinePlugin — GET /api/timeline (list), GET /api/snapshot/:id (restore)
  6. IntentAnalyzer — read changeEvents, cluster, heuristics, write intent_sessions, broadcast
  7. index.ts modifications — wire SnapshotRecorder + IntentAnalyzer into startup and switchWatchRoot
  8. websocketPlugin modification — send timeline_meta on connect

Phase C: Client state layer (depends on Phase A types; can start parallel with Phase B)
  9. timelineStore — Zustand store for snapshot list, replay position, intent sessions
  10. graphStore modification — add replayMode field
  11. inferenceStore modification — add replayMode field
  12. WsClient modifications — handle 3 new message types, check replayMode flag

Phase D: Client UI (depends on Phase C being complete)
  13. TimelineSlider — scrubber + Live/Pause controls (reads/writes timelineStore)
  14. IntentPanel — intent label + confidence indicator (reads timelineStore)
  15. App.tsx layout — add TimelineSlider below DirectoryBar, IntentPanel to sidebar

Phase E: Watch-root integration (depends on Phase B server + Phase C client)
  16. switchWatchRoot() — extend with snapshot/intent table clear + SnapshotRecorder/IntentAnalyzer recreation
```

**Rationale for this order:**
- Schema must exist before any server code can write to it (Phase A blocks Phase B)
- Shared types must exist before both server and client reference them (Phase A blocks Phase B and C)
- SnapshotRecorder must be running before timelinePlugin has data to serve
- timelineStore must exist before TimelineSlider has state to read
- UI components come last because they are pure consumers of the store layer
- Phase B and Phase C can be built in parallel after Phase A completes — the server and client are decoupled during construction

---

## Scaling Considerations

| Scale | Concern | Approach |
|-------|---------|---------|
| Single session (100 saves) | Snapshot storage | ~160KB — no action needed |
| Long session (1000 saves) | Scrubber density | Group by session if snapshot count exceeds 100; show coarse then fine scrubbing |
| Very large project (5000 files) | Snapshot row size | `nodes_json` grows proportionally; for >200 components, apply zlib compression on write (optional optimization) |
| Multiple watch-root switches | Stale snapshot data | Clear on switch (see Anti-Pattern 5) |

---

## Sources

- [Konva Undo/Redo — State History Pattern](https://konvajs.org/docs/react/Undo-Redo.html) — confirmed: store-substitution is the idiomatic Konva replay approach; no canvas layer changes required — HIGH confidence (official docs)
- [LangGraph SQLite Checkpointing](https://deepwiki.com/langchain-ai/langgraph/4.2-checkpoint-implementations) — reference for snapshot schema design; two-table approach (snapshots + sessions) validated — MEDIUM confidence (third-party analysis)
- [Event Sourcing with SQLite](https://www.sqliteforum.com/p/building-event-sourcing-systems-with) — periodic snapshot + replay-from-checkpoint pattern — MEDIUM confidence
- [Time Travel via Event Sourcing — Medium](https://medium.com/@sudipto76/time-travel-using-event-sourcing-pattern-603a0551d2ff) — temporal query approach confirmed — MEDIUM confidence
- [Martin Fowler — Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) — foundational pattern reference — HIGH confidence
- Direct codebase inspection of `packages/server/src/`, `packages/client/src/`, `packages/shared/src/` — all integration points identified from live code — HIGH confidence

---

## Reference: Prior Architecture Notes (v1.0)

The original architecture research (2026-03-15) documented the full system design including file watcher, tree-sitter parser, dependency graph, inference engine, WebSocket streaming, and Konva canvas patterns. Those components are unchanged in v3.0. Key decisions from that research that remain relevant:

- **Agent-agnostic via file watchers** — time-travel captures the same change stream; no agent integration needed
- **Canvas/WebGL rendering (not DOM)** — replay works by store substitution; no canvas changes needed (confirmed)
- **SQLite WAL + Drizzle ORM** — two new tables extend the existing model cleanly
- **Zustand for client state** — `replayMode` flag is a natural Zustand store addition; lightweight imperative access from WsClient works as designed
- **WebSocket delta-only streaming** — three new message types extend the union; existing switch/case pattern accommodates them

---

*Architecture research for: ArchLens v3.0 — time-travel replay + intent inference*
*Researched: 2026-03-16*
