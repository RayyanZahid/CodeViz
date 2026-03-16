# Stack Research

**Domain:** ArchLens v3.0 — Time-travel replay and AI agent intent inference additions
**Researched:** 2026-03-16
**Confidence:** HIGH for persistence and state approaches; MEDIUM for intent inference (heuristic approach rationale is evidence-based but domain is novel)

> **Scope note:** This document covers ONLY the stack additions and changes required for v3.0.
> The base stack (Fastify v5, SQLite/WAL + Drizzle ORM, tree-sitter, graphlib, Konva + d3-force,
> React 19 + Zustand v5, WebSocket streaming, chokidar, Zod) is already validated and documented
> in the pre-v3.0 STACK.md. Do not re-add or re-justify those dependencies here.

---

## New Dependencies Required

### Server Package Additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| *(none required)* | — | — | All server-side time-travel and snapshot logic uses existing better-sqlite3, Drizzle ORM, and in-memory graphlib. No new server packages needed. |

The snapshot persistence strategy (see Architecture section below) stores component-level graph snapshots as JSON blobs in a new `graph_snapshots` SQLite table. This is a schema addition using existing Drizzle tooling, not a new dependency.

### Client Package Additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zundo` | `^2.3.0` | Timeline scrubbing state — snapshot history in Zustand | Provides a parallel temporal store alongside the existing graphStore. The `partialize` option lets us track only the fields relevant to replay (nodes, edges, version) and exclude UI state (connectionStatus, scanning). Adds ~700 bytes gzipped. Verified: v2.3.0 officially supports Zustand v5 (released November 2024). |

That is the only new client dependency. The timeline scrubber UI component uses HTML's native `<input type="range">` — no slider library needed. The intent panel is a plain React component like the existing Inspector and Risk panels.

---

## Recommended Stack for Each New Feature

### Feature 1: Time-Travel Replay — Server Side (Graph Snapshot Persistence)

**Approach:** Periodic snapshot writes to SQLite using existing Drizzle schema extension.

**New schema table** (add to `packages/server/src/db/schema.ts`):

```typescript
export const graphSnapshots = sqliteTable('graph_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  version: integer('version').notNull(),
  watchRoot: text('watch_root').notNull(),
  snapshotData: text('snapshot_data', { mode: 'json' })
    .$type<{ nodes: ComponentNode[]; edges: ComponentEdge[] }>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
```

**Trigger strategy:** Write a snapshot after every N graph deltas (configurable, default 5) OR after a time interval (e.g., 30 seconds of inactivity). This keeps snapshot count manageable (hundreds, not thousands) for a typical AI coding session.

**Why JSON blob in SQLite over row-per-node approach:** The component graph at any point in time has ~10-200 component nodes (not file-level). Serializing the full component-level snapshot as a single JSON blob is simpler, faster to read back for replay (one row fetch vs. JOIN across potentially thousands of node rows), and idiomatic for time-series snapshots in SQLite. A snapshot for a 200-node graph is approximately 40-80 KB — well within SQLite's practical limits.

**Why not a separate time-series database (InfluxDB, TimescaleDB, etc.):** ArchLens is a local single-user app. The overhead of running a time-series server defeats the "zero infrastructure" constraint. SQLite WAL handles this workload trivially.

**New REST endpoint** (extend existing snapshot plugin):
- `GET /api/snapshots` — returns list of `{ id, version, createdAt }` (no payload, for timeline scrubber)
- `GET /api/snapshots/:id` — returns full snapshot for replay

No new Fastify plugins or HTTP libraries needed — standard Fastify route handlers in the existing plugin pattern.

---

### Feature 2: Time-Travel Replay — Client Side (Timeline Scrubber UI)

**Approach:** HTML native `<input type="range">` for scrubbing + `zundo` for state history.

**Why zundo over manual history array in Zustand:**
The naive alternative is storing an array of past graph states in a custom Zustand slice. Zundo provides this with correct undo/redo semantics, configurable `partialize` to exclude irrelevant fields, a `limit` cap to prevent unbounded memory growth, and `diff`-based storage to avoid storing full state copies when only a few nodes changed. It is ~700 bytes gzipped and has no transitive dependencies.

**Why `<input type="range">` over a slider library:**
The timeline scrubber is a single-thumb slider that maps scrub position to a snapshot index. Native HTML range input handles this with zero dependencies, is fully keyboard-accessible, and is styleable with CSS. Libraries like `react-range` or `rc-slider` are warranted when you need multi-thumb ranges or complex tick rendering — neither applies here.

**Replay mode isolation:** During replay, the client must freeze incoming WebSocket updates to the graphStore (to prevent live changes overwriting the historical view). This is a state flag in the existing graphStore (`isReplaying: boolean`), not a new dependency. The wsClient already has the pattern for conditional dispatch from the watch-root switching feature.

**HTML overlay positioning:** The timeline panel renders as an absolutely positioned HTML div below the Konva canvas, following the same pattern as the existing Inspector panel and Risk panel. No `react-konva-utils` `<Html>` portal needed — the panel is a sibling DOM element, not embedded in the canvas.

---

### Feature 3: Intent Inference — No External ML/LLM Dependencies

**Approach:** Pure rule-based heuristic classification in TypeScript on the server.

**Why rule-based over LLM/ML:**
- ArchLens operates fully offline (localhost-only constraint in PROJECT.md)
- LLM inference requires either a remote API (violates offline constraint) or a local model (adds 1-10 GB dependency — inappropriate for a dev tool)
- The inference signal is structural (file zones changed, component types added, dependency patterns) not semantic (natural language). Rule-based classification of structural signals has sufficient precision for the use case.
- Research confirms rule-based approaches work well for tightly-scoped, structurally-defined domains. Code structure patterns (frontend files added, service layer expanded, test files created alongside implementation files) map cleanly to regex/heuristic rules.

**Intent classifier implementation** (no new packages):

The IntentClassifier is a new TypeScript class in `packages/server/src/inference/` that:
1. Consumes a rolling window of `ArchitecturalEvent` objects already produced by `InferenceEngine`
2. Applies rule sets against accumulated events (e.g., "3+ component_created events in frontend zone within 60s → likely building a new feature")
3. Emits a typed `AgentIntent` result: `{ objective: string; confidence: 'high'|'medium'|'low'; subtasks: string[]; activeZones: ZoneName[] }`

**Why this fits the existing pipeline:** `InferenceEngine` already emits typed `ArchitecturalEvent` objects at the right granularity. The IntentClassifier subscribes to the same `inference` event and accumulates a rolling window in memory (no additional DB writes needed for the classifier state itself — only the output `AgentIntent` is persisted/broadcast).

**New shared type** (add to `packages/shared/src/types/inference.ts`):

```typescript
export interface AgentIntent {
  objective: string;       // e.g. "Building new API layer", "Refactoring service boundaries"
  confidence: 'high' | 'medium' | 'low';
  subtasks: string[];      // e.g. ["Adding 3 frontend components", "Establishing API routes"]
  activeZones: ZoneName[];
  timestamp: number;
}

export interface IntentMessage {
  type: 'intent_update';
  intent: AgentIntent | null;
}
```

No new npm packages required. The existing Zod, TypeScript, and event-driven pattern handle all of this.

---

### Feature 4: Intent Panel — Client Side

**Approach:** Plain React component, same pattern as InspectorPanel and RiskPanel.

- New `intentStore.ts` in `packages/client/src/store/` (mirrors pattern of inferenceStore.ts)
- New `IntentPanel.tsx` component (mirrors pattern of existing panels in the UI)
- Receives `intent_update` WebSocket messages via existing wsClient dispatch
- No new React libraries, CSS frameworks, or animation libraries required

---

## New Schema Changes (Drizzle Migration Required)

The only schema change is adding the `graph_snapshots` table. Run `drizzle-kit generate` after updating `schema.ts` to produce the migration SQL.

```bash
# After adding graphSnapshots to schema.ts:
pnpm --filter @archlens/server exec drizzle-kit generate
```

No other migration changes are needed for intent inference (intent state is transient, broadcast over WebSocket, not persisted between sessions).

---

## Installation

```bash
# Client package — only new dependency
pnpm --filter @archlens/client add zundo@^2.3.0
```

All other v3.0 work is schema additions + new TypeScript files within existing packages.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Timeline scrubber state | `zundo` middleware | Custom history array in Zustand | Zundo handles diff storage, limits, partialize, and undo/redo semantics correctly. Custom array re-implements this less robustly. |
| Timeline scrubber UI | Native `<input type="range">` | `rc-slider`, `react-range` | Single-thumb slider with CSS styling covers the use case. No reason to add a library dependency. |
| Snapshot persistence | JSON blob in `graph_snapshots` table | Row-per-node snapshot | JSON blob is 1 row per snapshot vs. N×200 rows; simpler replay query; appropriate for component-level granularity. |
| Snapshot persistence | SQLite (existing) | Separate time-series DB | ArchLens is localhost-only, zero-infrastructure. Adding a time-series server contradicts the deployment constraint. |
| Intent inference | Rule-based TypeScript classifier | LLM API (OpenAI, Anthropic) | Requires remote API — violates offline constraint. Adds latency, cost, and API key management. |
| Intent inference | Rule-based TypeScript classifier | Local LLM (llama.cpp, Ollama) | Adds 1-10GB dependency; startup time; GPU requirement. Inappropriate for a dev tool. |
| Intent inference | Rule-based TypeScript classifier | Trained ML classifier (BERT, etc.) | Requires a Python runtime or WASM model. Structural signals are well-defined enough that rules suffice. |
| Intent persistence | Persist to SQLite | Keep transient (WebSocket only) | Intent inference represents the current moment's agent objective, not historical state. Replaying intent from snapshots can be re-computed from snapshot events. Transient is simpler. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any LLM/ML library (transformers.js, llama-node, openai SDK) | Offline constraint, binary size, latency | Rule-based TypeScript classifier |
| `rc-slider`, `react-timeline-range-slider`, GSAP | Unnecessary for a single-thumb range input | Native `<input type="range">` with CSS |
| `immer` | Not needed for the new stores — the existing graphStore/inferenceStore patterns use explicit Map copies which is correct for this data shape | Explicit Map copies (existing pattern) |
| A separate event sourcing library (EventStore, Eventide, etc.) | The `changeEvents` table already provides an append-only event log; time-travel uses periodic snapshots, not full event replay | Existing `changeEvents` table + new `graph_snapshots` table |
| IndexedDB / localStorage for snapshot storage | Snapshots belong server-side (they capture server graph state); client-side storage would require pushing all snapshot data to the browser | SQLite `graph_snapshots` table on the server |
| `@melfore/konva-timeline` | Canvas-based Gantt/scheduler library — far heavier than needed for a simple horizontal scrubber bar | HTML range input with CSS |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `zundo@2.3.0` | `zustand@5.0.x` | v2.3.0 explicitly added Zustand v5 support (November 2024). Do not use zundo v2.2.x or earlier with Zustand v5. |
| `zundo@2.3.0` | `react@19.x` | No direct React dependency; works via Zustand which already supports React 19 |
| `drizzle-orm@0.40.x` | `better-sqlite3@11.x` | Existing versions already installed in server package; schema addition requires `drizzle-kit generate`, no version bumps |

---

## Sources

- [zundo GitHub (charkour/zundo)](https://github.com/charkour/zundo) — v2.3.0 Zustand v5 support confirmed, partialize/limit/diff options, <700 bytes gzipped — HIGH confidence
- [zundo releases page](https://github.com/charkour/zundo/releases) — v2.3.0 released November 17, 2024, "officially supports zustand v5" — HIGH confidence
- [SQLite sqlite3_snapshot API](https://sqlite.org/c3ref/snapshot.html) — SQLite WAL snapshot capability — HIGH confidence
- [Drizzle ORM SQLite column types](https://orm.drizzle.team/docs/column-types/sqlite) — text with mode:'json' for blob storage — HIGH confidence
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) — synchronous WAL write patterns — HIGH confidence
- [Conventional Commits spec](https://www.conventionalcommits.org/en/v1.0.0/) — commit type taxonomy for intent classifier rule design — HIGH confidence
- [LLM vs rule-based for code change classification (ÉTS Montréal)](https://www.etsmtl.ca/en/news/grands-modeles-langage-classification-intentions-changement-code) — LLM outperforms rules for semantic commit classification, but structural signal classification (zone changes, component creation patterns) is different domain — MEDIUM confidence
- [react-konva-utils Html component](https://github.com/konvajs/react-konva-utils) — HTML overlay positioning over Konva canvas — HIGH confidence (confirmed existing app uses this pattern for edge tooltips)
- [Konva performance tips](https://konvajs.org/docs/performance/All_Performance_Tips.html) — listening:false for non-interactive layers — HIGH confidence

---

*Stack research for: ArchLens v3.0 — Time-travel replay and intent inference additions*
*Researched: 2026-03-16*
