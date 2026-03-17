# Phase 15: Server Replay Layer - Research

**Researched:** 2026-03-16
**Domain:** Server-side snapshot checkpoint system + heuristic intent classification + REST API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Intent Categories**
- Use 6 action-oriented coarse categories: Adding Feature, Refactoring, Bug Fix, Dependency Update, Test Coverage, Cleanup
- Track focus transitions — emit a "focus shifted" event when the classified category changes mid-session
- On focus shift, close the current intent session and open a new one with the new category (clean separation)
- Classification signals: file patterns (e.g., test files -> Test Coverage, package.json -> Dependency Update) combined with graph topology changes (new edges -> Adding Feature, removed edges -> Refactoring, cycle changes -> Cleanup)

**Checkpoint Strategy**
- Fixed interval: every 50 snapshots becomes a full checkpoint (matches O(50-max) success criteria exactly)
- Checkpoint creation is synchronous — happens inline during the 50th snapshot write
- Retention: keep last N checkpoints (not indefinite); prune older checkpoints to bound storage

**Timeline API Shape**
- `GET /api/timeline` returns all snapshot metadata at once (no pagination) — assumes <1000 snapshots per session
- Per-snapshot metadata is minimal: ID, sequence number, timestamp, node count
- `GET /api/snapshot/:id` returns a bundled response: nodes, edges, and positions in a single payload (one round trip)
- Intent sessions have a separate endpoint: `GET /api/intents` — decoupled from timeline data

**Intent Confidence & Surfacing**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Snapshot reconstruction uses checkpoints for O(50-max) performance | Checkpoint table in SQLite stores full graph blobs at seq multiples of 50; `GET /api/snapshot/:id` walks from nearest checkpoint forward via stored graphJson deltas; max 49 forward steps guaranteed |
</phase_requirements>

---

## Summary

Phase 15 builds on the snapshot infrastructure established in Phase 14. The `graph_snapshots` table and `SnapshotManager` already write full `graphJson` blobs (nodes + edges + positions) for every snapshot. What Phase 15 adds is: (1) a checkpoint index so that `GET /api/snapshot/:id` can reconstruct any snapshot in ≤50 forward steps without scanning the whole table, (2) two new REST endpoints (`GET /api/timeline`, `GET /api/snapshot/:id`) that expose the timeline data, (3) an `IntentAnalyzer` class that listens to `graph delta` events and classifies work sessions into 6 coarse categories, and (4) a `GET /api/intents` endpoint.

The architectural insight is that snapshot reconstruction is actually trivial given the existing schema: since every snapshot already stores the full `graphJson` (not incremental deltas), `GET /api/snapshot/:id` simply calls `snapshotsRepository.findById(id)` and returns the stored blob directly. The "O(50-max)" constraint is satisfied by ensuring the checkpoint index is the nearest stored checkpoint, and if the snapshot IS already full state, reconstruction is O(1). The checkpoint table is mainly used as a retention anchor — it guarantees that even after FIFO pruning of non-checkpoint snapshots, checkpoints are preserved so scrubbing never becomes impossible.

The `IntentAnalyzer` is a new class parallel to `SnapshotManager` in the `snapshot/` directory. It subscribes to `graph delta` events, accumulates signals, classifies via heuristics (file-path patterns + topology changes), and persists sessions to the existing `intent_sessions` table. It broadcasts `intent_updated` and `intent_closed` WebSocket messages using the existing `broadcast()` helper. No external libraries needed — all logic is pure TypeScript heuristics.

**Primary recommendation:** Keep snapshot reconstruction as direct blob retrieval (O(1) — not delta replay), add a `snapshot_checkpoints` table as a retention anchor for FIFO pruning, and build `IntentAnalyzer` as a standalone class in `packages/server/src/snapshot/IntentAnalyzer.ts`.

---

## What Already Exists (from Phase 14)

Understanding what is already built prevents redundant work.

### Already complete — do NOT rebuild

| Component | Location | What it does |
|-----------|----------|--------------|
| `graphSnapshots` table | `packages/server/src/db/schema.ts` | Stores `{nodes, edges, positions}` as `graphJson` JSON blob per snapshot |
| `intentSessions` table | `packages/server/src/db/schema.ts` | Stores intent sessions with `category`, `confidence`, `startSnapshotId`, `endSnapshotId` |
| `snapshotsRepository` | `packages/server/src/db/repository/snapshots.ts` | `insert`, `findById`, `findBySession`, `getMetaBySession`, `getCount`, `deleteOldest`, `deleteBySession`, `deleteByWatchRoot` |
| `intentSessionsRepository` | `packages/server/src/db/repository/intentSessions.ts` | `insert`, `findById`, `findBySession`, `findActive`, `close`, `deleteBySession`, `deleteByWatchRoot` |
| `SnapshotManager` | `packages/server/src/snapshot/SnapshotManager.ts` | Listens to graph delta, writes snapshots on threshold, broadcasts `snapshot_saved` |
| `SnapshotMeta`, `IntentSession` types | `packages/shared/src/types/timeline.ts` | Lightweight descriptor + session shape |
| `IntentCategory` const/type | `packages/shared/src/types/timeline.ts` | 6 categories already defined |
| WS message types | `packages/shared/src/types/messages.ts` | `SnapshotSavedMessage`, `IntentUpdatedMessage`, `IntentClosedMessage` already in `ServerMessage` union |
| `broadcast()` | `packages/server/src/plugins/websocket.ts` | Already sends `ServerMessage` to all clients |

### IMPORTANT: IntentCategory mismatch

The user decisions name the 6 categories as: "Adding Feature, Refactoring, Bug Fix, Dependency Update, Test Coverage, Cleanup". The existing `timeline.ts` `IntentCategory` const defines: `FEATURE_BUILDING`, `BUG_FIXING`, `REFACTORING`, `TEST_WRITING`, `INFRASTRUCTURE`, `UNCERTAIN`.

The mapping is close but not exact:
- "Adding Feature" → `FEATURE_BUILDING` ✓
- "Bug Fix" → `BUG_FIXING` ✓
- "Refactoring" → `REFACTORING` ✓
- "Test Coverage" → `TEST_WRITING` ✓
- "Dependency Update" → no direct match (`INFRASTRUCTURE` is closest)
- "Cleanup" → no direct match
- "Uncertain" is NOT in the user's 6 — but the shared type has it

**Decision needed at plan time:** Either (a) update `IntentCategory` in `timeline.ts` to add `DEPENDENCY_UPDATE` and `CLEANUP`, remove `UNCERTAIN`, or (b) map "Dependency Update" → `INFRASTRUCTURE` and "Cleanup" → `REFACTORING` in the analyzer. Given the user said 6 categories explicitly and the CONTEXT.md names them, Option (a) — updating the const object — is the correct approach. This is a non-breaking schema change (the `category` column is `text`, not an enum constraint in SQLite).

### What needs to be BUILT in Phase 15

| Component | Location | Purpose |
|-----------|----------|---------|
| `snapshot_checkpoints` table | schema.ts (new table + migration) | Retention anchor; stores checkpoint metadata pointing to the graph_snapshots row that is the checkpoint |
| `checkpointsRepository` | `src/db/repository/checkpoints.ts` | CRUD for checkpoint table |
| `IntentAnalyzer` class | `src/snapshot/IntentAnalyzer.ts` | Classifies deltas, manages intent session lifecycle |
| `GET /api/timeline` endpoint | `src/plugins/timeline.ts` (new plugin) | Returns `SnapshotMeta[]` for session |
| `GET /api/snapshot/:id` endpoint | Extend `snapshot.ts` or new plugin | Returns full bundled snapshot by ID |
| `GET /api/intents` endpoint | same plugin | Returns `IntentSession[]` for session |
| Checkpoint logic in `SnapshotManager` | Modify `SnapshotManager.ts` | Every 50th snapshot → mark as checkpoint, prune non-checkpoints beyond retention |

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | ^11.0.0 | SQLite driver | Already used; synchronous API matches server model |
| `drizzle-orm` | ^0.40.0 | ORM + schema | Already used; type-safe SQLite queries |
| `drizzle-kit` | ^0.30.0 | Migrations | Already used; generates SQL migration files |
| `fastify` | ^5.0.0 | HTTP server + REST | Already used; `FastifyPluginAsync` pattern established |
| `@fastify/websocket` | ^11.2.0 | WebSocket | Already used; `broadcast()` helper established |
| `@archlens/shared` | workspace | Shared types | Already used; `IntentCategory`, `IntentSession`, messages |

### No new npm dependencies needed

Phase 15 is purely TypeScript + existing stack. No external classifier, ML, or date libraries required. File-path pattern matching can use plain `String.prototype.includes()` or `path.extname()`. No regex library needed.

---

## Architecture Patterns

### Recommended File Structure

```
packages/server/src/
├── db/
│   ├── schema.ts                        # ADD: snapshot_checkpoints table
│   └── repository/
│       ├── snapshots.ts                 # EXISTING: no changes needed
│       ├── intentSessions.ts            # EXISTING: no changes needed
│       └── checkpoints.ts              # NEW: checkpoint CRUD
├── snapshot/
│   ├── SnapshotManager.ts              # MODIFY: add checkpoint logic
│   └── IntentAnalyzer.ts              # NEW: intent classification
└── plugins/
    ├── snapshot.ts                     # MODIFY: add GET /api/snapshot/:id
    ├── websocket.ts                    # EXISTING: no changes
    └── timeline.ts                    # NEW: GET /api/timeline + GET /api/intents
```

### Pattern 1: Checkpoint Table Design

**What:** A `snapshot_checkpoints` table with one row per checkpoint. Each row records `sequenceNumber`, the corresponding `snapshotId` from `graph_snapshots`, `sessionId`, and `watchRoot`. The checkpoint row is the index entry — the actual graph data lives in `graph_snapshots.graphJson` on the pointed-to row.

**Why not delta replay:** The existing `graphJson` column already stores the complete graph (nodes + edges + positions). Snapshot reconstruction does not need to walk through deltas — it IS O(1) per lookup. The "O(50-max)" guarantee means: from any requested snapshot, the nearest checkpoint is at most 49 sequence numbers behind. Since the full blob is stored at checkpoints (and at every snapshot), reading `snapshotId` directly from `graph_snapshots` is always O(1). The checkpoint table's purpose is retention: during FIFO pruning, checkpoint rows are excluded from deletion.

**Schema:**
```typescript
// In schema.ts — add after intentSessions
export const snapshotCheckpoints = sqliteTable('snapshot_checkpoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  snapshotId: integer('snapshot_id').notNull(), // FK to graph_snapshots.id (logical, FK OFF)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
```

**Drizzle migration:** Run `npx drizzle-kit generate` to produce a new migration SQL file. Then apply via `npx drizzle-kit migrate` (or push). The project uses `drizzle-kit` already at `^0.30.0`.

### Pattern 2: Checkpoint Logic in SnapshotManager

**What:** After every `snapshotsRepository.insert(...)`, check `if (this.sequenceNumber % CHECKPOINT_INTERVAL === 0)`. If true, write a `snapshotCheckpoints` row pointing to the just-inserted snapshot ID. Then, during FIFO pruning: instead of deleting the single oldest snapshot, delete oldest non-checkpoint snapshots first. Checkpoints are only pruned when count exceeds `MAX_CHECKPOINTS`.

```typescript
// Constants (add to SnapshotManager.ts)
const CHECKPOINT_INTERVAL = 50;   // every 50th snapshot = checkpoint
const MAX_CHECKPOINTS = 10;       // retain last 10 checkpoints = last 500 snapshots worth

// After insert in captureSnapshot():
if (this.sequenceNumber % CHECKPOINT_INTERVAL === 0) {
  checkpointsRepository.insert({
    sessionId: this.sessionId,
    watchRoot: this.watchRoot,
    sequenceNumber: this.sequenceNumber,
    snapshotId: insertedId,
    createdAt: new Date(),
  });
  // Prune old checkpoints beyond MAX_CHECKPOINTS
  const cpCount = checkpointsRepository.getCount(this.sessionId);
  if (cpCount > MAX_CHECKPOINTS) {
    checkpointsRepository.deleteOldest(this.sessionId);
  }
}
```

**FIFO pruning change:** Currently `deleteOldest` deletes any oldest snapshot. Change to: delete oldest snapshot WHERE its ID is not referenced by a checkpoint row. Checkpoints are only deleted by the checkpoint pruner above.

```typescript
// New snapshotsRepository method needed:
deleteOldestNonCheckpoint(sessionId: string, checkpointSnapshotIds: number[]): void {
  // Find oldest snapshot whose id is NOT in checkpointSnapshotIds
  // then delete it
}
```

Or simpler: query checkpoint IDs first, then use `notInArray` from drizzle-orm:

```typescript
import { notInArray } from 'drizzle-orm';

deleteOldestNonCheckpoint(sessionId: string): void {
  // Get all checkpoint snapshot IDs for this session
  const cpIds = db.select({ snapshotId: snapshotCheckpoints.snapshotId })
    .from(snapshotCheckpoints)
    .where(eq(snapshotCheckpoints.sessionId, sessionId))
    .all()
    .map(r => r.snapshotId);

  const oldest = db.select({ id: graphSnapshots.id })
    .from(graphSnapshots)
    .where(
      and(
        eq(graphSnapshots.sessionId, sessionId),
        cpIds.length > 0 ? notInArray(graphSnapshots.id, cpIds) : sql`1=1`
      )
    )
    .orderBy(asc(graphSnapshots.sequenceNumber))
    .limit(1)
    .get();

  if (oldest) {
    db.delete(graphSnapshots).where(eq(graphSnapshots.id, oldest.id)).run();
  }
}
```

### Pattern 3: IntentAnalyzer Class

**What:** A standalone class in `src/snapshot/IntentAnalyzer.ts` that listens to `graph delta` events. It maintains a sliding window of recent deltas, classifies the current session intent using heuristics, manages the `intent_sessions` lifecycle, and broadcasts via `broadcast()`.

**Design:**
- Constructor receives `graph: DependencyGraph`, `sessionId: string`, `watchRoot: string`
- Subscribes to `graph.on('delta', ...)` — same pattern as `SnapshotManager` and `InferenceEngine`
- Has `destroy()` for cleanup — removes delta listener
- Persists to `intent_sessions` via `intentSessionsRepository`
- Broadcasts `intent_updated` and `intent_closed` via the existing `broadcast()` function

**Classification algorithm (heuristics — Claude's discretion):**

The classification uses two signal streams:
1. **File-path signals** from `delta.triggerFiles` (or `addedNodes + modifiedNodes`)
2. **Topology signals** from the delta shape

```typescript
// Signal scoring approach — simple additive scoring per delta
type IntentSignal = {
  category: IntentCategory;
  weight: number;
};

function classifyDelta(delta: GraphDelta): IntentSignal[] {
  const signals: IntentSignal[] = [];

  // --- File-path signals ---
  const files = [...delta.addedNodes, ...delta.modifiedNodes, ...delta.triggerFiles];
  for (const f of files) {
    if (f.includes('test') || f.includes('spec') || f.includes('__tests__')) {
      signals.push({ category: IntentCategory.TEST_WRITING, weight: 0.6 });
    }
    if (f.includes('package.json') || f.includes('package-lock') || f.includes('pnpm-lock')) {
      signals.push({ category: IntentCategory.DEPENDENCY_UPDATE, weight: 0.8 });
    }
    if (f.includes('.config.') || f.includes('tsconfig') || f.includes('vite.config') || f.includes('drizzle')) {
      signals.push({ category: IntentCategory.INFRASTRUCTURE, weight: 0.5 });
    }
  }

  // --- Topology signals ---
  if (delta.addedNodes.length > 0 || delta.addedEdges.length > 1) {
    signals.push({ category: IntentCategory.FEATURE_BUILDING, weight: 0.5 });
  }
  if (delta.removedNodeIds.length > 0 || delta.removedEdgeIds.length > 1) {
    signals.push({ category: IntentCategory.REFACTORING, weight: 0.4 });
  }
  if (delta.cyclesAdded.length > 0 || delta.cyclesRemoved.length > 0) {
    signals.push({ category: IntentCategory.CLEANUP, weight: 0.5 });
  }
  // Pure modification without add/remove → likely refactoring
  if (
    delta.modifiedNodes.length > 0 &&
    delta.addedNodes.length === 0 &&
    delta.removedNodeIds.length === 0 &&
    delta.addedEdges.length === 0 &&
    delta.removedEdgeIds.length === 0
  ) {
    signals.push({ category: IntentCategory.BUG_FIXING, weight: 0.3 });
    signals.push({ category: IntentCategory.REFACTORING, weight: 0.2 });
  }

  return signals;
}
```

**Session scoring (sliding window + EWMA):**

Maintain a rolling score vector per category. Each delta contributes signals. On every delta, re-score and pick the top category. Confidence = top score / sum of all scores. If the top category changes, emit focus shift.

```typescript
// Exponential decay factor — older deltas matter less
const DECAY = 0.85;

// Score accumulator in IntentAnalyzer
private scores: Record<IntentCategory, number> = { ... }; // initialized to 0

private onDelta(delta: GraphDelta): void {
  // Decay existing scores
  for (const cat of Object.keys(this.scores) as IntentCategory[]) {
    this.scores[cat] *= DECAY;
  }

  // Add new signals
  const signals = classifyDelta(delta);
  for (const s of signals) {
    this.scores[s.category] = (this.scores[s.category] ?? 0) + s.weight;
  }

  // Compute winner
  const [winner, confidence] = this.computeWinner();
  this.evaluateSession(winner, confidence, delta);
}
```

**Focus shift detection:**

When `winner !== this.activeSession.category`, close the current session and open a new one:
```typescript
private evaluateSession(category: IntentCategory, confidence: number, delta: GraphDelta): void {
  if (!this.activeSession) {
    this.openSession(category, confidence);
    return;
  }

  if (category !== this.activeSession.category) {
    // Focus shifted: close old, open new
    this.closeSession(this.lastSnapshotId);
    this.openSession(category, confidence);
  } else {
    // Same category: update confidence
    this.updateSession(confidence);
  }
}
```

**Intent re-evaluation:** When `updateSession()` is called, it updates the `confidence` in-memory (and optionally updates the DB row via a new `updateConfidence` method on `intentSessionsRepository`). It then broadcasts `intent_updated` with the revised confidence. This satisfies the CONTEXT.md decision that "IntentAnalyzer re-evaluates past classifications as more events arrive."

**The `intentSessions` table already has all the columns needed.** No schema change needed for the session itself. The `intentSessionsRepository` already has `insert`, `findActive`, and `close`. Need to add: `updateConfidence(id, confidence, objective)` method.

### Pattern 4: REST Endpoints

**What:** New Fastify plugin `timeline.ts` exposing:
- `GET /api/timeline` — returns `SnapshotMeta[]` (using `getMetaBySession`)
- `GET /api/snapshot/:id` — returns full bundled snapshot (nodes + edges + positions from `graphJson`)
- `GET /api/intents` — returns `IntentSession[]`

**Session ID source:** The current session ID is owned by `SnapshotManager`. The timeline endpoints need access to it. Best approach: pass `getSessionId: () => string` callback to the plugin options, similar to `getWatchRoot: () => string` in `watchRootPlugin`.

```typescript
// packages/server/src/plugins/timeline.ts
import type { FastifyPluginAsync } from 'fastify';
import { snapshotsRepository } from '../db/repository/snapshots.js';
import { intentSessionsRepository } from '../db/repository/intentSessions.js';

interface TimelinePluginOptions {
  getSessionId: () => string;
}

export const timelinePlugin: FastifyPluginAsync<TimelinePluginOptions> = async (
  fastify,
  { getSessionId },
) => {
  fastify.get('/api/timeline', async (_req, reply) => {
    const meta = snapshotsRepository.getMetaBySession(getSessionId());
    return reply.send(meta);
  });

  fastify.get('/api/snapshot/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return reply.status(400).send({ error: 'invalid id' });

    const row = snapshotsRepository.findById(numId);
    if (!row) return reply.status(404).send({ error: 'not found' });

    return reply.send({
      id: row.id,
      sequenceNumber: row.sequenceNumber,
      timestamp: row.timestamp,
      ...row.graphJson, // spreads: nodes, edges, positions
    });
  });

  fastify.get('/api/intents', async (_req, reply) => {
    const sessions = intentSessionsRepository.findBySession(getSessionId());
    return reply.send(sessions);
  });
};
```

**Important:** The existing `GET /api/snapshot` (no `:id`) in `snapshot.ts` returns the CURRENT live graph (not historical). Keep it as-is. `GET /api/snapshot/:id` (with `:id`) is the new historical endpoint. Fastify routes these correctly since `:id` makes them distinct.

### Pattern 5: Wiring in index.ts

IntentAnalyzer must be lifecycle-managed like SnapshotManager:
```typescript
// index.ts additions:
import { IntentAnalyzer } from './snapshot/IntentAnalyzer.js';
import { timelinePlugin } from './plugins/timeline.js';

let intentAnalyzer = new IntentAnalyzer(graph, snapshotManager.getSessionId(), currentWatchRoot);

// In switchWatchRoot():
intentAnalyzer.destroy();
// ... reset ...
intentAnalyzer = new IntentAnalyzer(graph, snapshotManager.getSessionId(), newWatchRoot);

// In onClose hook:
intentAnalyzer.destroy();

// Plugin registration:
fastify.register(timelinePlugin, { getSessionId: () => snapshotManager.getSessionId() });
```

The `getSessionId()` callback captures the current session ID by closure, which means after `switchWatchRoot()` replaces `snapshotManager`, the callback returns the new session ID automatically.

### Anti-Patterns to Avoid

- **Storing graphJson deltas instead of full blobs:** The existing schema stores full blobs; do not change this to a delta format. O(1) retrieval is the benefit.
- **Rebuilding checkpoint by replaying graphJson diffs:** Unnecessary — full state is already in every row. Reconstruction IS just `findById()`.
- **Adding the checkpoint to a separate database file:** Keep everything in `archlens.db`. Adding another SQLite file creates WAL conflict risk.
- **Per-delta intent session writes:** Only write/update the `intent_sessions` row when category changes or confidence updates significantly (not on every delta). Use in-memory state primarily; write to DB to persist.
- **Registering new graph.on('delta', ...) listeners in plugins:** Follow the established pattern — `IntentAnalyzer` subscribes in its constructor, not in plugin registration code.
- **Forgetting to destroy() IntentAnalyzer on watch-root switch:** If not destroyed, the old analyzer's delta listener leaks and fires for the new session's events.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL "not in array" filter | Custom loop with IN clause strings | `notInArray()` from `drizzle-orm` | Type-safe, injection-safe, already a dep |
| Schema migration | Manual `CREATE TABLE` in startup code | `drizzle-kit generate` + `drizzle-kit migrate` | Consistent with existing migration in `drizzle/0000_*` |
| HTTP parameter validation | Manual `parseInt` checks only | Fastify's built-in reply.status(400) | Already the pattern in `watchRoot.ts` |
| Broadcast to WS clients | New socket management | Existing `broadcast()` from `plugins/websocket.ts` | Already handles readyState checks |
| UUID generation | `Math.random()` | `randomUUID` from `node:crypto` | Already used in `SnapshotManager.ts` |

**Key insight:** This phase is largely plumbing — wiring existing pieces (tables, repositories, broadcast, session IDs) into new coordinating classes. The heaviest new logic is the intent scoring heuristic, which is a ~50-line TypeScript function.

---

## Common Pitfalls

### Pitfall 1: SnapshotMeta `timestamp` Type Mismatch

**What goes wrong:** `snapshotsRepository.getMetaBySession()` returns `timestamp: Date` (Drizzle maps `integer mode:'timestamp_ms'` to `Date`). But `SnapshotMeta` in `timeline.ts` declares `timestamp: number`. Fastify's `reply.send()` will serialize `Date` as ISO string, not epoch ms.

**Why it happens:** Drizzle's `{ mode: 'timestamp_ms' }` returns `Date` objects in query results, but the shared type expects `number`.

**How to avoid:** In the repository or plugin, convert: `timestamp: row.timestamp.getTime()`. Or update `getMetaBySession` return type to use `.getTime()` on the timestamp field. Verify this was done correctly in Phase 14's `SnapshotMeta` broadcast — check `SnapshotManager.ts` line ~218: `timestamp: Date.now()` is correct for the broadcast but `getMetaBySession` returns `Date`. Add `.getTime()` conversion in the timeline plugin.

**Warning signs:** TypeScript error `Type 'Date' is not assignable to type 'number'`.

### Pitfall 2: FIFO Pruning Deletes Checkpoint Snapshots

**What goes wrong:** `SnapshotManager.captureSnapshot()` calls `snapshotsRepository.deleteOldest(sessionId)` which deletes by `sequenceNumber ASC` with no exemption for checkpoint rows. A checkpoint snapshot gets pruned before its referenced `snapshot_checkpoints` row, leaving a dangling reference.

**Why it happens:** `deleteOldest` was written before checkpoints existed.

**How to avoid:** Replace `deleteOldest` calls with `deleteOldestNonCheckpoint`. The new method queries checkpoint `snapshotId` values first, then excludes them from deletion. Use `notInArray()` from drizzle-orm for the exclusion clause. Handle the edge case where all remaining snapshots are checkpoints — in that case, skip deletion (log a warning).

**Warning signs:** `GET /api/snapshot/:id` returns 404 for a checkpoint ID that was theoretically never prunable.

### Pitfall 3: IntentAnalyzer Fires Before First Snapshot Is Written

**What goes wrong:** IntentAnalyzer listens to `graph.on('delta', ...)`. On the initial scan, deltas fire before `snapshotManager.captureInitialSnapshot()` is called (which has a 2-second delay). IntentAnalyzer tries to set `startSnapshotId` to null or to a non-existent ID.

**Why it happens:** `SnapshotManager` uses `setTimeout(..., 2000)` for the initial snapshot. IntentAnalyzer has no such guard.

**How to avoid:** `startSnapshotId` on `intent_sessions` is already nullable (column allows NULL, FK is OFF). Set it to `null` initially and update it to the first snapshot's ID once `SnapshotManager` writes a snapshot. An alternative: IntentAnalyzer watches for `snapshot_saved` messages internally or receives a callback. Simplest: accept nullable `startSnapshotId` — Phase 17 UI can handle null start.

**Warning signs:** DB constraint errors on insert (not applicable here — FK is OFF), or confusing null startSnapshotId values in the timeline display.

### Pitfall 4: IntentAnalyzer Score Decay Without Activity Stalls

**What goes wrong:** If no deltas arrive for 90 seconds, the decayed scores approach 0 across all categories. When a new delta arrives, it gets classified with very low confidence. If the lowest nonzero score wins, noise creates a spurious focus shift.

**Why it happens:** EWMA decay reduces all scores uniformly; after many decay cycles with no new signals, all scores are effectively 0.

**How to avoid:** Add a minimum-signal threshold before emitting a category. Only classify if at least one category score exceeds a minimum (e.g., 0.05). Also track `lastDeltaTimestamp` — if gap > 90s (STATE.md blocker note), don't decay further (treat as paused). Alternatively: track total signal count in the window; if fewer than N signals in last M deltas, output `UNCERTAIN` / maintain current category.

**Warning signs:** Frequent focus shifts on low-activity projects.

### Pitfall 5: Fastify Route Conflict `/api/snapshot` vs `/api/snapshot/:id`

**What goes wrong:** If both routes are registered in the same plugin instance, Fastify may match `/api/snapshot/123` against the static `/api/snapshot` route, causing a 404 or wrong handler.

**Why it happens:** Route order sensitivity in Fastify's radix-tree router.

**How to avoid:** Keep the existing `GET /api/snapshot` (no param) in `snapshot.ts` and put `GET /api/snapshot/:id` in the new `timeline.ts` plugin. Fastify distinguishes them correctly when registered separately. Do NOT rename the existing endpoint.

**Warning signs:** `/api/snapshot/123` returns the current live state instead of the historical snapshot.

### Pitfall 6: `intentSessions` Repository Missing `updateConfidence`

**What goes wrong:** IntentAnalyzer re-evaluates confidence on each delta but the only existing update method is `close()`. Without `updateConfidence`, confidence updates require a full delete+insert or are lost on restart.

**Why it happens:** Phase 14 only built the minimal repository surface (insert, close, delete). Re-evaluation was a Phase 15 decision.

**How to avoid:** Add `updateConfidence(id: number, confidence: number): void` to `intentSessionsRepository`:
```typescript
updateConfidence(id: number, confidence: number): void {
  db.update(intentSessions)
    .set({ confidence })
    .where(eq(intentSessions.id, id))
    .run();
},
```

---

## Code Examples

### GET /api/timeline response shape

```typescript
// Response: SnapshotMeta[]
[
  {
    id: 1,
    sessionId: "abc-123",
    sequenceNumber: 1,
    timestamp: 1710000000000,  // epoch ms — NOT Date object
    summary: "12 nodes, 8 edges",
    triggerFiles: ["src/index.ts"]
  },
  {
    id: 2,
    sessionId: "abc-123",
    sequenceNumber: 2,
    timestamp: 1710000003000,
    summary: "13 nodes, 9 edges",
    triggerFiles: ["src/api/users.ts"]
  }
]
```

### GET /api/snapshot/:id response shape

```typescript
// Response: bundled snapshot
{
  id: 42,
  sequenceNumber: 42,
  timestamp: 1710000042000,
  nodes: [{ id: "src/index.ts", name: "index", ... }],
  edges: [{ id: "src/index.ts->src/api.ts", sourceId: "...", ... }],
  positions: { "src/index.ts": { x: 100, y: 200 } }
}
```

### WebSocket: intent_updated message

```typescript
// ServerMessage — IntentUpdatedMessage
{
  type: "intent_updated",
  session: {
    id: 5,
    sessionId: "abc-123",
    category: "feature_building",
    objective: "Adding Feature",
    confidence: 0.78,
    subtasks: [],
    startSnapshotId: 1,
    endSnapshotId: null,
    startedAt: 1710000000000,
    endedAt: null
  }
}
```

### WebSocket: intent_closed message (focus shift)

```typescript
// ServerMessage — IntentClosedMessage
{
  type: "intent_closed",
  sessionId: "abc-123",
  endSnapshotId: 41
}
// Followed immediately by intent_updated with new category
```

### Drizzle: notInArray usage (for deleteOldestNonCheckpoint)

```typescript
// Source: drizzle-orm API — notInArray
import { notInArray, and, eq, asc } from 'drizzle-orm';

const cpIds = db.select({ snapshotId: snapshotCheckpoints.snapshotId })
  .from(snapshotCheckpoints)
  .where(eq(snapshotCheckpoints.sessionId, sessionId))
  .all()
  .map(r => r.snapshotId);

const oldest = db.select({ id: graphSnapshots.id })
  .from(graphSnapshots)
  .where(
    cpIds.length > 0
      ? and(eq(graphSnapshots.sessionId, sessionId), notInArray(graphSnapshots.id, cpIds))
      : eq(graphSnapshots.sessionId, sessionId)
  )
  .orderBy(asc(graphSnapshots.sequenceNumber))
  .limit(1)
  .get();
```

Note: `notInArray` with an empty array would generate `NOT IN ()` which is invalid SQL. Always guard with `cpIds.length > 0`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Delta-only storage (store diffs) | Full blob per snapshot (already chosen in Phase 14) | O(1) reconstruction — no delta replay needed |
| ML-based intent classification | Heuristic scoring with EWMA decay | Offline, zero-latency, no API keys |
| Wall-clock checkpoints | Event-count checkpoints (every N snapshots) | Immune to low-activity dead zones |

**No deprecated approaches:** All libraries in use (drizzle-orm 0.40, fastify 5, better-sqlite3 11) are current as of early 2026.

---

## Open Questions

1. **IntentCategory const object alignment**
   - What we know: `timeline.ts` defines `FEATURE_BUILDING`, `BUG_FIXING`, `REFACTORING`, `TEST_WRITING`, `INFRASTRUCTURE`, `UNCERTAIN`. User decisions name: "Adding Feature, Refactoring, Bug Fix, Dependency Update, Test Coverage, Cleanup".
   - What's unclear: Should `UNCERTAIN` be kept? Should `INFRASTRUCTURE` be renamed `DEPENDENCY_UPDATE`? Should `CLEANUP` replace `UNCERTAIN`?
   - Recommendation: Update `IntentCategory` in `timeline.ts` to: `FEATURE_BUILDING`, `BUG_FIXING`, `REFACTORING`, `TEST_WRITING`, `DEPENDENCY_UPDATE`, `CLEANUP`. Remove `UNCERTAIN` (it was a research recommendation; CONTEXT.md supersedes it). This is a 2-line change in `timeline.ts` and is backward-compatible since SQLite `category` column is plain text.

2. **Checkpoint retention count**
   - What we know: "last N checkpoints" — user left N to Claude's discretion.
   - What's unclear: What constitutes a reasonable default?
   - Recommendation: `MAX_CHECKPOINTS = 10`. With 50 snapshots/checkpoint, this retains the last 500 snapshots of history. At ~500 bytes each (estimated), this is ~250KB of index overhead. The full snapshot blobs are bounded by `MAX_SNAPSHOTS = 200` in SnapshotManager — which means the FIFO pruner will keep at most 200 non-checkpoint snapshots. The 10 checkpoint blobs add 10 permanent rows to `graph_snapshots` beyond the 200 cap. This is acceptable.

3. **How IntentAnalyzer learns the latest snapshot ID for startSnapshotId**
   - What we know: `SnapshotManager` writes the snapshot and gets back the inserted ID. `IntentAnalyzer` doesn't have access to this.
   - What's unclear: How does IntentAnalyzer set `startSnapshotId` correctly?
   - Recommendation: Have IntentAnalyzer query `snapshotsRepository.getLatestId(sessionId)` when opening a session. Add `getLatestId(sessionId: string): number | undefined` to the snapshots repository. This avoids tight coupling between `SnapshotManager` and `IntentAnalyzer`.

4. **Concurrency: simultaneous snapshot write + timeline read**
   - What we know: `better-sqlite3` is synchronous. WAL mode is enabled (`journal_mode = WAL`). In WAL mode, readers do not block writers and writers do not block readers.
   - What's unclear: Nothing — this is solved by WAL mode already configured in `connection.ts`.
   - Recommendation: No additional work. WAL mode guarantees the success criterion "writing files during an active session does not cause the pipeline to pause."

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection of `packages/server/src/` — schema.ts, repositories, SnapshotManager.ts, InferenceEngine.ts, index.ts, plugins/
- Codebase inspection of `packages/shared/src/types/` — all type files verified
- `packages/server/src/db/connection.ts` — WAL mode and FK OFF confirmed
- `packages/server/drizzle/0000_mixed_carlie_cooper.sql` — migration format confirmed
- `packages/server/package.json` — dependency versions confirmed

### Secondary (MEDIUM confidence)

- drizzle-orm `notInArray` usage — standard Drizzle filter operator, consistent with other operators used in codebase (`eq`, `asc`, `desc`, `and`, `isNull`, `gt`)
- Fastify route disambiguation (static vs parametric) — standard Fastify behavior, no conflict expected given separate plugin registration

### Tertiary (LOW confidence)

- EWMA decay factor of 0.85 — a reasonable default; exact value should be tuned to observed delta frequency in real usage (per STATE.md blocker note about 90-second gap threshold)
- `MAX_CHECKPOINTS = 10` — reasonable estimate; no user specification; adjust if storage testing in Phase 18 shows concern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, versions pinned in package.json
- Architecture: HIGH — existing patterns (plugin registration, repository pattern, lifecycle management) are well-established and directly applicable
- Intent heuristics: MEDIUM — specific weights and thresholds are estimates; logic is sound but exact calibration requires real-world testing
- Pitfalls: HIGH — all derived from direct codebase inspection and concrete type mismatches found

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack — drizzle, fastify, better-sqlite3 all stable)
