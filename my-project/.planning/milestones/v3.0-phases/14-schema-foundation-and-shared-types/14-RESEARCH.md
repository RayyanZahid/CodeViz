# Phase 14: Schema Foundation and Shared Types - Research

**Researched:** 2026-03-16
**Domain:** Drizzle ORM SQLite schema extension, TypeScript shared type authoring, WebSocket message protocol extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snapshot data shape**
- Full state snapshots: every snapshot contains the complete graph (nodes, edges, positions) — not deltas
- Exact canvas positions: store pixel-level x,y per node so replay shows the exact layout the user saw
- Everything on the node: all attributes including type, label, filePath, metrics, connections
- Full edge metadata: dependency type, weight, and all edge attributes stored
- Include inferred patterns: layers, clusters, risk scores captured per snapshot for pattern evolution replay
- Store human-readable summary per snapshot (e.g., "15 nodes, 22 edges, 3 layers") for quick timeline browsing
- Store trigger files: record which file paths changed to trigger the snapshot, for "what happened" context
- Single JSON blob column for graph data (nodes, edges, positions) — not normalized tables
- Session-scoped: each snapshot tagged with watch-root path and session ID
- Sequence number + timestamp: monotonically increasing integer for deterministic ordering, timestamp for display

**Delta threshold strategy**
- Hybrid trigger: structural changes (new/removed nodes or edges) trigger immediate snapshot; minor changes (metric updates, attribute changes) accumulate until 10-event threshold
- Debounce 2-5 seconds between snapshots to prevent burst flooding during bulk operations
- Hardcoded defaults: threshold values are internal, not user-configurable
- Always capture initial snapshot after initial scan completes (full graph built) when a watch session starts
- Storage cap with FIFO pruning: auto-remove oldest snapshots when total exceeds size threshold
- Initial snapshot timing: captured after initial scan completes, not on empty state

**Intent session model**
- Continuous objective model: one intent session = one detected objective, ends when focus shifts
- Two-level hierarchy: top-level objective contains sub-tasks (JSON array within session row)
- Evidence-based confidence: confidence score represents strength of supporting evidence (many matching events = high)
- Linked to snapshot range: each intent session has start_snapshot_id and end_snapshot_id
- Clean transitions: focus shift closes old session and opens new one — at most one active intent at a time
- Store evidence: list of contributing event IDs/files for classification drill-down
- Store risk snapshot: active risk scores captured at intent session time for historical context
- Session-scoped: same watch-root/session scoping as snapshots
- Predefined intent categories: fixed enum of 4-6 coarse categories (Claude determines specific categories based on AI agent behavior patterns)
- Keep all intent sessions within a watch session — no pruning until watch-root switch

**Message protocol design**
- Extend existing protocol: new timeline/replay message types added to current WebSocket message union
- Data + API types: shared timeline.ts exports both domain types (SnapshotMeta, IntentSession) and request/response wrapper types for API endpoints
- Push for live, request for replay: server pushes new snapshot/intent notifications in real-time; client requests specific snapshots during replay
- Lightweight push: notifications include metadata only (ID, timestamp, summary) — client fetches full data when needed

### Claude's Discretion
- Exact debounce timing within the 2-5 second range
- Storage cap size threshold (guided by 20MB/4hr budget)
- Specific 4-6 intent category enum values
- Drizzle table column types and index choices
- TypeScript type naming conventions (following existing project patterns)
- Compression strategy for JSON blob if needed

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Graph snapshots are persisted to SQLite with layout positions included | `graph_snapshots` table with `positions_json` blob column via Drizzle; insert verified with `drizzle-kit push` workflow |
| INFRA-02 | Snapshot storage uses delta-threshold triggering (not wall-clock) to control growth | SnapshotManager class with structural change detection + minor-change counter; debounce via setTimeout; FIFO pruning query |
</phase_requirements>

## Summary

Phase 14 adds two new SQLite tables (`graph_snapshots`, `intent_sessions`) to the existing Drizzle schema and creates a new `shared/src/types/timeline.ts` file exporting domain types (`SnapshotMeta`, `IntentSession`) and three WebSocket message types. The project already uses Drizzle ORM 0.40.1 with `better-sqlite3` 11.10.0 and employs `drizzle-kit push` (not migrate) as the schema management workflow — the live DB was built with push, not migrations, as confirmed by an empty `__drizzle_migrations` table.

The codebase follows clear patterns: const-object + derived type for enums (e.g., `NodeType`, `EdgeType`, `RiskType`), `InferSelectModel`/`InferInsertModel` for repository row types, synchronous Drizzle transactions for atomic writes, and flat repository objects per table. The `shared/src/types/` module exports `.ts` source directly (the shared package's `exports` field points to `.ts` files, not compiled `.js`). The `ServerMessage` discriminated union in `shared/src/types/messages.ts` is the extension point for new WebSocket message types.

The delta threshold logic (INFRA-02) belongs in a new `SnapshotManager` class that subscribes to `DependencyGraph`'s `'delta'` event. It must distinguish structural changes (added/removed nodes or edges from the `GraphDelta`) from minor changes and implement the 10-event minor threshold, 2-5 second debounce, and FIFO pruning. This is the most complex piece of Phase 14 — everything else is additive schema and type work.

**Primary recommendation:** Add two Drizzle table definitions to `schema.ts`, run `drizzle-kit push`, create `shared/src/types/timeline.ts` following the existing const-object + interface pattern, extend `ServerMessage` union in `messages.ts`, update `shared/src/types/index.ts` to re-export timeline types, and build `SnapshotManager` subscribing to graph delta events with threshold logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.40.1 (installed) | SQLite table definitions, typed queries | Already the project ORM; `sqliteTable`, `InferSelectModel`, `InferInsertModel` pattern is established |
| better-sqlite3 | 11.10.0 (installed) | Synchronous SQLite driver | Already used; matches sync transaction pattern in `persistDelta` |
| drizzle-kit | 0.30.6 (installed) | Schema push workflow | Project uses `drizzle-kit push`, NOT `migrate` |
| TypeScript | 5.8.x | Type authoring across packages | Project-wide; strict mode enabled |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.25.x (client only) | Schema validation | Client-side: add Zod schemas in `serverMessages.ts` for new message types AFTER TypeScript types are added to shared |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drizzle-kit push | drizzle-kit migrate | push is already the workflow; migrate won't work because existing tables are not in `__drizzle_migrations` |
| Single JSON blob for graph data | Normalized node/edge/position rows | Blob is the locked decision; self-contained, O(1) read per snapshot |
| Extending messages.ts union | Separate message file | messages.ts is the single union definition; extending it keeps the discriminated union coherent |

**Installation:** No new packages required. Everything is already installed.

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── db/
│   ├── schema.ts           # ADD: graph_snapshots, intent_sessions table defs
│   ├── connection.ts       # No change
│   └── repository/
│       ├── snapshots.ts    # NEW: snapshotsRepository (following positions.ts pattern)
│       └── intentSessions.ts  # NEW: intentSessionsRepository
├── snapshot/
│   └── SnapshotManager.ts  # NEW: subscribes to graph delta, threshold logic

packages/shared/src/types/
├── timeline.ts             # NEW: SnapshotMeta, IntentSession, 3 WS message types
├── messages.ts             # EXTEND: add snapshot_saved + intent_updated to ServerMessage union
└── index.ts                # EXTEND: add `export * from './timeline.js'`
```

### Pattern 1: Drizzle Table Definition (following schema.ts)

**What:** Add table definitions to `packages/server/src/db/schema.ts` using existing column type patterns.
**When to use:** Every new persisted table in the project.

```typescript
// packages/server/src/db/schema.ts (additions)
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const graphSnapshots = sqliteTable('graph_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  graphJson: text('graph_json', { mode: 'json' })
    .$type<{ nodes: unknown[]; edges: unknown[]; positions: Record<string, { x: number; y: number }> }>()
    .notNull(),
  summary: text('summary').notNull(),        // "15 nodes, 22 edges, 3 layers"
  triggerFiles: text('trigger_files', { mode: 'json' }).$type<string[]>().notNull(),
  riskSnapshot: text('risk_snapshot', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
});

export const intentSessions = sqliteTable('intent_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  category: text('category').notNull(),       // IntentCategory enum value
  objective: text('objective').notNull(),     // human-readable label
  confidence: real('confidence').notNull(),   // 0.0–1.0
  subtasks: text('subtasks', { mode: 'json' }).$type<string[]>().notNull().default([]),
  evidence: text('evidence', { mode: 'json' }).$type<string[]>().notNull().default([]),
  riskSnapshot: text('risk_snapshot', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  startSnapshotId: integer('start_snapshot_id'),
  endSnapshotId: integer('end_snapshot_id'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
});
```

### Pattern 2: Repository Object (following positions.ts)

**What:** Flat repository object with typed insert/select rows using `InferSelectModel`/`InferInsertModel`.
**When to use:** Every new table gets its own repository file.

```typescript
// packages/server/src/db/repository/snapshots.ts
import { eq, asc, desc, sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphSnapshots } from '../schema.js';

export type GraphSnapshotRow = InferSelectModel<typeof graphSnapshots>;
export type GraphSnapshotInsert = InferInsertModel<typeof graphSnapshots>;

export const snapshotsRepository = {
  insert(snapshot: Omit<GraphSnapshotInsert, 'id'>): number {
    const result = db.insert(graphSnapshots).values(snapshot).run();
    return Number(result.lastInsertRowid);
  },

  findById(id: number): GraphSnapshotRow | undefined {
    return db.select().from(graphSnapshots).where(eq(graphSnapshots.id, id)).get();
  },

  findBySession(sessionId: string): GraphSnapshotRow[] {
    return db.select().from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .orderBy(asc(graphSnapshots.sequenceNumber))
      .all();
  },

  getCount(sessionId: string): number {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .get();
    return result?.count ?? 0;
  },

  deleteOldest(sessionId: string): void {
    // FIFO pruning: delete the single oldest row for this session
    const oldest = db.select({ id: graphSnapshots.id })
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .orderBy(asc(graphSnapshots.sequenceNumber))
      .limit(1)
      .get();
    if (oldest) {
      db.delete(graphSnapshots).where(eq(graphSnapshots.id, oldest.id)).run();
    }
  },

  deleteBySession(sessionId: string): void {
    db.delete(graphSnapshots).where(eq(graphSnapshots.sessionId, sessionId)).run();
  },
};
```

### Pattern 3: Shared Type File (following inference.ts, graph.ts)

**What:** New `timeline.ts` in `shared/src/types/` following the const-object + derived type convention.
**When to use:** All new domain types and message types shared between server and client.

```typescript
// packages/shared/src/types/timeline.ts

// ---------------------------------------------------------------------------
// IntentCategory — const object + derived type (project convention)
// ---------------------------------------------------------------------------

export const IntentCategory = {
  FEATURE_BUILDING: 'feature_building',
  BUG_FIXING: 'bug_fixing',
  REFACTORING: 'refactoring',
  TEST_WRITING: 'test_writing',
  INFRASTRUCTURE: 'infrastructure',
  UNCERTAIN: 'uncertain',
} as const;

export type IntentCategory = typeof IntentCategory[keyof typeof IntentCategory];

// ---------------------------------------------------------------------------
// Domain types — read by both server (persistence) and client (display)
// ---------------------------------------------------------------------------

/** Lightweight snapshot descriptor for timeline browsing (no graph payload). */
export interface SnapshotMeta {
  id: number;
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  summary: string;          // "15 nodes, 22 edges, 3 layers"
  triggerFiles: string[];   // which files changed to trigger this snapshot
}

/** A single intent detection session — one contiguous objective. */
export interface IntentSession {
  id: number;
  sessionId: string;
  category: IntentCategory;
  objective: string;        // human-readable, e.g. "Building authentication module"
  confidence: number;       // 0.0–1.0
  subtasks: string[];       // sub-tasks within the objective
  startSnapshotId: number | null;
  endSnapshotId: number | null;
  startedAt: number;        // ms timestamp
  endedAt: number | null;   // null = still active
}

// ---------------------------------------------------------------------------
// WebSocket push message types (metadata-only — client fetches full data)
// ---------------------------------------------------------------------------

/** Server pushes after writing a new snapshot — lightweight metadata only. */
export interface SnapshotSavedMessage {
  type: 'snapshot_saved';
  meta: SnapshotMeta;
}

/** Server pushes when intent session opens or updates. */
export interface IntentUpdatedMessage {
  type: 'intent_updated';
  session: IntentSession;
}

/** Server pushes when intent session closes (focus shifted). */
export interface IntentClosedMessage {
  type: 'intent_closed';
  sessionId: string;
  endSnapshotId: number | null;
}
```

### Pattern 4: Extending ServerMessage Union (following messages.ts)

**What:** Add new message types to the `ServerMessage` discriminated union in `messages.ts`.
**When to use:** Any new WebSocket message type pushed from server to client.

```typescript
// packages/shared/src/types/messages.ts (additions)
import type { SnapshotSavedMessage, IntentUpdatedMessage, IntentClosedMessage } from './timeline.js';

// Add to existing ServerMessage union:
export type ServerMessage =
  | GraphDeltaMessage
  | InitialStateMessage
  | InferenceMessage
  | ErrorMessage
  | WatchRootChangedMessage
  | SnapshotSavedMessage     // NEW
  | IntentUpdatedMessage     // NEW
  | IntentClosedMessage;     // NEW
```

### Pattern 5: SnapshotManager — Delta Threshold Logic (INFRA-02)

**What:** New class subscribing to `DependencyGraph`'s `'delta'` event; implements hybrid threshold.
**When to use:** This is the core of INFRA-02 — encapsulates all snapshot-triggering logic.

```typescript
// packages/server/src/snapshot/SnapshotManager.ts
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { GraphDelta } from '@archlens/shared/types';
import { snapshotsRepository } from '../db/repository/snapshots.js';
import { broadcast } from '../plugins/websocket.js';

const MINOR_THRESHOLD = 10;       // minor changes before forced snapshot
const DEBOUNCE_MS = 3000;         // 3s within the 2-5s discretion window
const MAX_SNAPSHOTS = 500;        // FIFO cap (~20MB @ ~40KB/snapshot)

export class SnapshotManager {
  private minorEventCount = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private sequenceNumber = 0;

  constructor(
    private readonly graph: DependencyGraph,
    private readonly sessionId: string,
    private readonly watchRoot: string,
  ) {
    graph.on('delta', (delta) => this.onDelta(delta));
  }

  private onDelta(delta: GraphDelta): void {
    const isStructural =
      delta.addedNodes.length > 0 ||
      delta.removedNodeIds.length > 0 ||
      delta.addedEdges.length > 0 ||
      delta.removedEdgeIds.length > 0;

    if (isStructural) {
      // Structural change — schedule immediate (debounced) snapshot
      this.scheduleSnapshot();
      this.minorEventCount = 0;
    } else {
      this.minorEventCount++;
      if (this.minorEventCount >= MINOR_THRESHOLD) {
        this.scheduleSnapshot();
        this.minorEventCount = 0;
      }
    }
  }

  private scheduleSnapshot(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.captureSnapshot([]);
    }, DEBOUNCE_MS);
  }

  captureInitialSnapshot(triggerFiles: string[]): void {
    // Called explicitly after initial scan completes
    this.captureSnapshot(triggerFiles);
  }

  private captureSnapshot(triggerFiles: string[]): void {
    // Build full graph payload, write to DB, push metadata, prune if needed
    // ... (implementation in task)
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.graph.removeAllListeners('delta'); // or targeted removeListener
  }
}
```

### Anti-Patterns to Avoid

- **Using `drizzle-kit migrate` instead of `push`:** The live DB has tables NOT in `__drizzle_migrations`. Running migrate against the current DB fails with "table already exists". Always use `drizzle-kit push` for this project.
- **Importing from `@archlens/shared/types` as `.ts` without the `.js` extension in server imports:** Server uses `NodeNext` module resolution — imports MUST use `.js` extension even for `.ts` source files (e.g., `import type { Foo } from './timeline.js'`).
- **Adding snapshot writes inside `DependencyGraph.onDeltaComputed`:** That hook already has `persistDelta` for graph state. Snapshot logic belongs in a dedicated `SnapshotManager` class that subscribes to the `'delta'` event externally, keeping concerns separated.
- **Normalizing graph data into relational tables for snapshots:** The locked decision is a single JSON blob. Normalization was already rejected.
- **Creating `GraphDelta.triggerFiles` in the snapshot blob:** triggerFiles is a top-level column (`trigger_files TEXT`), not buried in the JSON blob, for queryability.
- **Wall-clock triggering:** INFRA-02 explicitly forbids wall-clock; only delta-event counts and structural changes trigger snapshots.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization of graph blob | Custom serializer | Native `JSON.stringify` + Drizzle `{ mode: 'json' }` column | Drizzle handles the string ↔ JS object round-trip automatically |
| Schema diffing | Manual ALTER TABLE | `drizzle-kit push` | Detects column additions, generates correct SQLite ALTER statements |
| Typed insert/select row types | Manual interface duplication | `InferSelectModel` / `InferInsertModel` from drizzle-orm | Already the project pattern; stays in sync with schema automatically |
| FIFO deletion query | Custom cursor logic | Simple `ORDER BY sequence_number ASC LIMIT 1` + delete by ID | SQLite handles this efficiently with the sequence_number column |

**Key insight:** The project's schema-as-code approach with `drizzle-kit push` means adding two table definitions to `schema.ts` and running one command is all that's needed for DB schema changes. No SQL files to write or maintain.

## Common Pitfalls

### Pitfall 1: drizzle-kit push vs migrate confusion
**What goes wrong:** Running `drizzle-kit migrate` on this project fails because the existing tables are not tracked in `__drizzle_migrations` (they were created via push). The migrate command tries to re-create existing tables and errors.
**Why it happens:** The project established its schema with `drizzle-kit push` early in development; the empty `__drizzle_migrations` table proves this.
**How to avoid:** Always use `drizzle-kit push` for schema changes in this project.
**Warning signs:** "table already exists" errors from drizzle-kit.

### Pitfall 2: Module resolution with `.js` extension
**What goes wrong:** TypeScript file `timeline.ts` must be imported as `./timeline.js` in server code (NodeNext module resolution). Using `.ts` extension or no extension causes runtime module not found errors.
**Why it happens:** Server uses `"moduleResolution": "NodeNext"` in `tsconfig.json` which requires explicit `.js` extensions in import specifiers.
**How to avoid:** Follow the existing pattern — every import in server code uses `.js` extension (e.g., `import { db } from '../db/connection.js'`).
**Warning signs:** Module not found errors at runtime even though the file exists.

### Pitfall 3: Snapshot write blocking the delta event loop
**What goes wrong:** If `captureSnapshot()` is slow (large graph serialization), it blocks the synchronous delta event handler, delaying downstream consumers (WebSocket broadcast, inference engine).
**Why it happens:** Node.js event emission is synchronous; `graph.emit('delta', ...)` calls all listeners before returning.
**How to avoid:** The debounce (3 second timeout before writing) naturally decouples snapshot writes from the hot path. The snapshot write happens in a `setTimeout` callback, not inline in the delta listener.
**Warning signs:** Observable lag in WebSocket broadcasts after adding SnapshotManager.

### Pitfall 4: `foreign_keys = OFF` in connection.ts
**What goes wrong:** The SQLite connection has `foreign_keys = OFF`. This means FK constraints between `intent_sessions` and `graph_snapshots` (via `start_snapshot_id`, `end_snapshot_id`) will NOT be enforced at the DB level.
**Why it happens:** `connection.ts` explicitly disables foreign keys (see `sqlite.pragma('foreign_keys = OFF')`).
**How to avoid:** Do NOT define FK constraints in the Drizzle schema for `start_snapshot_id`/`end_snapshot_id` — they are plain integers, not FK references. Enforce referential integrity in application code only.
**Warning signs:** Drizzle schema with `.references()` on snapshot ID columns will generate FK SQL that is silently unenforced.

### Pitfall 5: Session ID generation — no UUID library available
**What goes wrong:** `uuid` is not installed in the project. Generating session IDs requires an alternative.
**Why it happens:** The project has no UUID dependency in any package.json.
**How to avoid:** Use Node's built-in `crypto.randomUUID()` (available in Node 16.7+; project uses Node 22+ based on `@types/node: ^22`). No new dependency needed.
**Warning sign:** Importing `uuid` at runtime throws "Cannot find module 'uuid'".

### Pitfall 6: Snapshot triggers on empty graph (initial state timing)
**What goes wrong:** If SnapshotManager subscribes to delta events before the initial scan completes, it might capture a snapshot of an empty or partial graph.
**Why it happens:** The pipeline starts processing files immediately; the first delta may fire before the graph is fully populated.
**How to avoid:** The locked decision is clear: "captured after initial scan completes, not on empty state." The SnapshotManager must expose a `captureInitialSnapshot()` method called explicitly by the pipeline/server after scan completion, not triggered by the delta event.
**Warning signs:** Snapshot with 0 nodes captured at sequence 1.

## Code Examples

Verified patterns from existing codebase:

### Drizzle JSON column with typed content
```typescript
// From schema.ts — existing pattern
fileList: text('file_list', { mode: 'json' }).$type<string[]>().notNull().default([]),
payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),

// New pattern for graph blob
graphJson: text('graph_json', { mode: 'json' })
  .$type<{ nodes: unknown[]; edges: unknown[]; positions: Record<string, { x: number; y: number }> }>()
  .notNull(),
```

### Drizzle synchronous transaction (from GraphPersistence.ts)
```typescript
db.transaction((tx) => {
  tx.insert(graphSnapshots).values(snapshot).run();
  // FIFO pruning inside same transaction if needed
});
```

### InferSelectModel / InferInsertModel (from positions.ts)
```typescript
export type GraphSnapshotRow = InferSelectModel<typeof graphSnapshots>;
export type GraphSnapshotInsert = InferInsertModel<typeof graphSnapshots>;
```

### Extending shared types index (from index.ts)
```typescript
// packages/shared/src/types/index.ts — add:
export * from './timeline.js';
```

### EventEmitter typed subscription (from DependencyGraph.ts)
```typescript
// DependencyGraph defines:
interface DependencyGraphEvents {
  delta: [delta: GraphDelta];
}
// SnapshotManager subscribes:
graph.on('delta', (delta: GraphDelta) => this.onDelta(delta));
```

### Structural change detection from GraphDelta
```typescript
// GraphDelta fields that indicate structural change:
const isStructural =
  delta.addedNodes.length > 0 ||
  delta.removedNodeIds.length > 0 ||
  delta.addedEdges.length > 0 ||
  delta.removedEdgeIds.length > 0;
// delta.modifiedNodes (export changes) = minor change, not structural
// delta.cyclesAdded/cyclesRemoved = debatable; treat as structural for safety
```

### Session ID generation (no uuid library)
```typescript
import { randomUUID } from 'node:crypto';
const sessionId = randomUUID(); // Built-in Node 16.7+, no dep needed
```

### drizzle-kit push command
```bash
cd packages/server && npx drizzle-kit push
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| drizzle-kit migrate | drizzle-kit push | Phase 1 of project | push is the established workflow; migrate would re-run all migrations |
| Manual SQL for table creation | Schema-as-code in schema.ts + push | Phase 1 | Adding tables = edit schema.ts + run push |

**Key existing state:**
- Live `archlens.db` has 4 tables: `change_events`, `graph_nodes`, `graph_edges`, `layout_positions`
- `__drizzle_migrations` table exists but is EMPTY — push was the workflow, not migrate
- drizzle-kit version: 0.30.6 (package.json) / 0.31.9 (globally installed); `drizzle-orm` 0.40.1
- `foreign_keys = OFF` in `connection.ts` — no FK enforcement at DB level

## Open Questions

1. **Snapshot size budget validation**
   - What we know: Context says "guided by 20MB/4hr budget"; CONTEXT.md defers cap threshold to Claude's discretion
   - What's unclear: Actual per-snapshot size in practice. A full graph with 200 nodes and 300 edges as JSON is roughly 50-100KB. At 500 snapshots: 25-50MB, above budget.
   - Recommendation: Set initial cap at 200 snapshots (~10-20MB). Expose `MAX_SNAPSHOTS` as an internal constant easy to tune. Planner should include a note to verify snapshot size in testing.

2. **How SnapshotManager wires into switchWatchRoot()**
   - What we know: `index.ts` has a `switchWatchRoot()` function that destroys old inferenceEngine and creates new pipeline. SnapshotManager will need the same lifecycle treatment.
   - What's unclear: Whether SnapshotManager is instantiated in `index.ts` alongside other services, or wrapped in a plugin.
   - Recommendation: Follow the pattern of `inferenceEngine` — instantiate SnapshotManager as a `let` variable in `index.ts`, destroy and recreate it in `switchWatchRoot()`. Delete session's snapshots on watch-root switch (scoped per session).

3. **Initial snapshot trigger point**
   - What we know: Must fire "after initial scan completes, not on empty state." The pipeline's initial scan is chokidar-based; completion is currently not signaled explicitly.
   - What's unclear: How to detect when the initial scan is complete. The existing code uses `initial_state` message timing implicitly.
   - Recommendation: The Pipeline or DependencyGraph could expose an `'initial_scan_complete'` event, or SnapshotManager could use a `ready` flag set on the first `initial_state` WS broadcast. Plan should resolve this approach explicitly.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `packages/server/src/db/schema.ts`, `connection.ts`, `repository/*.ts` — actual patterns in use
- Direct codebase inspection: `packages/shared/src/types/*.ts` — actual type convention
- Direct codebase inspection: `packages/server/src/index.ts` — lifecycle and event wiring
- `drizzle-kit push` test run — confirmed push workflow and "no changes detected" against existing schema
- `drizzle-kit migrate` test run — confirmed failure with "table already exists" proving push is the workflow
- SQLite schema inspection via `PRAGMA table_info` — confirmed all 4 existing tables and columns
- `__drizzle_migrations` table inspection — confirmed empty, proving push not migrate

### Secondary (MEDIUM confidence)
- drizzle-orm 0.40.1 API: `InferSelectModel`, `InferInsertModel`, `sqliteTable`, `{ mode: 'json' }` column — verified by reading installed node_modules source
- Node.js built-in `crypto.randomUUID()` — available since Node 14.17/16.7; project uses Node 22 types

### Tertiary (LOW confidence)
- Snapshot size estimate (50-100KB per snapshot for 200-node graph) — rough calculation, not measured

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by reading installed package versions and existing usage
- Architecture: HIGH — patterns copied directly from existing codebase files
- Pitfalls: HIGH — pitfalls 1-5 verified by direct code inspection and CLI testing; pitfall 6 is logical deduction from locked decisions

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack — Drizzle and TypeScript conventions change slowly)
