# Phase 3: Dependency Graph Model - Research

**Researched:** 2026-03-15
**Domain:** In-memory directed graph with incremental updates, delta computation, cycle detection, and SQLite write-through
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Node & edge data model**
- Nodes represent files, but edges carry the specific imported symbols (file + key exports granularity)
- Each edge from A→B includes the list of symbol names imported (e.g., `['UserService', 'AuthMiddleware']`)
- Only static imports tracked as edge type — no dynamic import or re-export distinction needed
- Node metadata: Claude's discretion based on what downstream phases (inference, canvas, UI) need

**Delta format & consumers**
- Deltas are three-state: added, removed, and modified (nodes whose exports changed but file still exists)
- Each delta carries a monotonic version counter for ordering and "give me changes since vN" replay
- Deltas include the list of trigger file paths that caused the update — useful for activity feed and debugging
- Downstream consumers (inference engine, WebSocket layer) subscribe via event emitter pattern — graph emits 'delta' events

**Circular dependency handling**
- Cycles listed in a separate `cycles` field on the delta as ordered paths `[A → B → C → A]`
- Cycles reported only on change — when newly created or broken, not on every delta
- Severity tiers based on impact scope: cycles involving many dependents = high severity, isolated cycles between leaf files = low severity (graph centrality-based)

### Claude's Discretion
- Specific node metadata fields (path, language, size, exports — pick what downstream needs)
- Batching/consolidation debounce window and merge strategy for rapid file changes
- Exact severity tier boundaries and centrality algorithm for cycle classification
- SQLite write-through granularity and startup loading strategy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAPH-01 | System maintains an in-memory directed dependency graph using @dagrejs/graphlib | @dagrejs/graphlib v4.0.1 confirmed available; ESM + TypeScript named exports verified from package inspection |
| GRAPH-02 | Graph updates are incremental — only changed nodes and edges are recomputed | Incremental update pattern: compute per-file diff, apply only node/edge deltas using setNode/removeNode/setEdge/removeEdge; no full rebuild needed |
| GRAPH-03 | System computes graph deltas (added/removed nodes and edges) after each parse batch | Three-state delta type (added/removed/modified) with version counter; built from diff between previous and next state for each file in batch |
| GRAPH-04 | Graph state is persisted to SQLite via write-through on every update | Drizzle ORM db.transaction() wraps batch node+edge upserts and event appends atomically; existing nodesRepository.upsert and edgesRepository.insert already exist |
| GRAPH-05 | System detects circular dependencies in the graph | alg.findCycles(graph) returns string[][] (O(|V|+|E|)); reports added/removed cycles by diffing previous cycle set after each update |
</phase_requirements>

---

## Summary

Phase 3 builds the `DependencyGraph` class — the central data structure for ArchLens. It sits between the parsing pipeline (Phase 2) and the inference + WebSocket layers (Phases 4–5). The graph receives `ParseBatchResult` objects from `Pipeline.onResult`, applies incremental updates to an in-memory `@dagrejs/graphlib` `Graph` instance, computes a typed delta, detects cycle changes, persists to SQLite via Drizzle transactions, and emits a `'delta'` event for downstream consumers.

The library selection is locked by REQUIREMENTS.md (`GRAPH-01`: `@dagrejs/graphlib`). The v4.0.1 package has been verified: it ships both ESM (`dist/graphlib.esm.js`) and CJS bundles with full TypeScript type definitions, and supports named imports `import { Graph, alg, json } from '@dagrejs/graphlib'`. Algorithms `alg.findCycles`, `alg.tarjan`, `alg.isAcyclic`, and `alg.topsort` are all exported from the `alg` namespace. The `json.write` / `json.read` pair supports full graph serialization for startup loading, though the write-through strategy (rows in SQLite vs. JSON blob) needs a deliberate choice.

The key engineering decisions Claude must make are: (1) node identity — using file path as the node ID (the natural key since Phase 2 produces file-relative paths); (2) the debounce window for consolidating rapid file changes into a single delta (success criterion 5); (3) cycle severity classification using in-degree of cycle participants as the centrality proxy; and (4) SQLite write-through granularity — per-row upserts inside a transaction (recommended) vs. JSON blob snapshots.

**Primary recommendation:** Build `DependencyGraph` as a class extending `EventEmitter` with a typed `'delta'` event. Use file path as node ID. Maintain a `Map<filePath, ParseResult>` as previous-state for incremental diffing. Use `alg.findCycles` after each update and diff the cycle set to detect only new/broken cycles. Persist via `db.transaction()` wrapping batch upserts. Consolidate rapid batches with a `setTimeout`-based accumulator (50–100ms window) before emitting.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dagrejs/graphlib | 4.0.1 | In-memory directed graph with O(1) node/edge ops and O(|V|+|E|) cycle detection | Mandated by GRAPH-01; actively maintained (published 2026-03-08); full ESM+TS support; includes tarjan/findCycles/topsort |
| Node.js EventEmitter | built-in (Node 22) | Typed delta event emission for downstream subscribers | No external dep; @types/node v22 supports generic `EventEmitter<EventMap>` for type-safe events |
| drizzle-orm | 0.40.0 (already installed) | Write-through persistence of nodes and edges to SQLite | Already in use; `db.transaction()` wraps batch upserts atomically |
| better-sqlite3 | 11.x (already installed) | Synchronous SQLite driver | Already in use; sync API is correct — graph updates are synchronous, no async/await overhead |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 22.x (already installed) | TypeScript types for EventEmitter with generics | Required for typed `EventEmitter<{ delta: [GraphDelta] }>` pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dagrejs/graphlib | graphology | graphology has richer API but is NOT mandated by requirements; do not use |
| @dagrejs/graphlib | custom Map-based graph | Much simpler, avoids dep, but would not fulfill GRAPH-01; do not use |
| Node EventEmitter | eventemitter3 | Faster but external dep; not needed at this scale |
| db.transaction() | individual .run() calls | Per-row writes are fine for small batches but risk partial writes on crash; use transaction |

**Installation:**
```bash
pnpm --filter @archlens/server add @dagrejs/graphlib
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── graph/
│   ├── DependencyGraph.ts       # Main class: EventEmitter, incremental updates, cycle detection
│   ├── GraphDelta.ts            # Types: GraphDelta, GraphDeltaCycle, severity tiers
│   └── GraphPersistence.ts      # SQLite write-through and startup load
packages/shared/src/types/
│   └── graph.ts                 # Add: GraphDelta, GraphDeltaCycle, CycleSeverity (shared types for WS layer)
```

### Pattern 1: Typed EventEmitter Subclass

**What:** `DependencyGraph` extends `EventEmitter` with a TypeScript event map so `on('delta', handler)` is fully typed.
**When to use:** All graph consumers (inference engine, WebSocket handler) subscribe to this class.

**Example:**
```typescript
// Source: @types/node v22 EventEmitter generics
import { EventEmitter } from 'node:events';
import type { GraphDelta } from './GraphDelta.js';

interface DependencyGraphEvents {
  delta: [delta: GraphDelta];
}

export class DependencyGraph extends EventEmitter<DependencyGraphEvents> {
  private readonly g: Graph<string, NodeMetadata, EdgeMetadata>;
  private version: number = 0;
  private prevFileResults: Map<string, ParseResult> = new Map();
  private activeCycles: Set<string> = new Set(); // serialized cycle paths

  // ...
}
```

### Pattern 2: Incremental Per-File Diff

**What:** For each file in a `ParseBatchResult`, compute what changed from the previous `ParseResult` for that file and apply only the minimum node/edge mutations.
**When to use:** Every `ParseBatchResult` from the pipeline.

**Example:**
```typescript
// Source: @dagrejs/graphlib v4.0.1 Graph API (verified from dist/types/lib/graph.d.ts)
import { Graph, alg } from '@dagrejs/graphlib';

processFile(result: ParseResult, delta: MutableDelta): void {
  const nodeId = result.filePath;   // file path is the node ID

  // 1. Upsert node
  const prev = this.prevFileResults.get(nodeId);
  if (!this.g.hasNode(nodeId)) {
    this.g.setNode(nodeId, buildNodeMetadata(result));
    delta.addedNodes.push(nodeId);
  } else if (exportsChanged(prev, result)) {
    this.g.setNode(nodeId, buildNodeMetadata(result)); // update label
    delta.modifiedNodes.push(nodeId);
  }

  // 2. Compute new edges from imports
  const newEdges = resolveEdges(result);     // ImportInfo[] → file-relative paths
  const oldEdges = this.g.outEdges(nodeId) ?? [];

  // Remove edges no longer present
  for (const edge of oldEdges) {
    if (!newEdges.has(edge.w)) {
      this.g.removeEdge(edge);
      delta.removedEdgeIds.push(edgeId(edge));
    }
  }

  // Add new edges
  for (const [targetId, symbols] of newEdges) {
    if (!this.g.hasEdge(nodeId, targetId)) {
      this.g.setEdge(nodeId, targetId, { symbols });
      delta.addedEdges.push({ v: nodeId, w: targetId, symbols });
    }
  }

  this.prevFileResults.set(nodeId, result);
}

processRemoval(filePath: string, delta: MutableDelta): void {
  if (!this.g.hasNode(filePath)) return;
  // removeNode automatically removes incident edges
  this.g.removeNode(filePath);
  delta.removedNodeIds.push(filePath);
  this.prevFileResults.delete(filePath);
}
```

### Pattern 3: Batch Consolidation (Debounce Accumulator)

**What:** Accumulate multiple `ParseBatchResult` arrivals within a short window (50ms recommended) before computing a single consolidated delta. This satisfies success criterion 5 ("10 rapid changes = 1 diff").
**When to use:** The Pipeline already debounces at 200ms via FileWatcher. The graph's consolidation window is an _additional_ safeguard for back-pressure scenarios.

**Example:**
```typescript
// Source: standard Node.js setTimeout pattern
private pendingBatches: ParseBatchResult[] = [];
private consolidateTimer: NodeJS.Timeout | null = null;
private readonly CONSOLIDATE_MS = 50;

onParseResult(batch: ParseBatchResult): void {
  this.pendingBatches.push(batch);
  if (this.consolidateTimer) clearTimeout(this.consolidateTimer);
  this.consolidateTimer = setTimeout(() => this.flushPending(), this.CONSOLIDATE_MS);
}

private flushPending(): void {
  const batches = this.pendingBatches.splice(0);  // drain
  this.consolidateTimer = null;
  const triggerFiles = batches.flatMap(b =>
    b.results.map(r => r.filePath)
  );
  this.applyBatches(batches, triggerFiles);
}
```

### Pattern 4: Cycle Detection with Delta Diff

**What:** After each update, run `alg.findCycles(graph)` and diff against the previous cycle set to report only new/broken cycles.
**When to use:** After every `flushPending` call.

**Example:**
```typescript
// Source: @dagrejs/graphlib v4.0.1 alg.findCycles (verified from dist/types/lib/alg/find-cycles.d.ts)
// findCycles returns string[][] — each inner array is a cycle's node IDs
import { alg } from '@dagrejs/graphlib';

private detectCycleChanges(g: Graph): { added: CyclePath[], removed: CyclePath[] } {
  const rawCycles = alg.findCycles(g);
  const currentCycleSet = new Set(rawCycles.map(c => canonicalizeCycle(c)));

  const added: CyclePath[] = [];
  const removed: CyclePath[] = [];

  for (const key of currentCycleSet) {
    if (!this.activeCycles.has(key)) added.push(parseCyclePath(key));
  }
  for (const key of this.activeCycles) {
    if (!currentCycleSet.has(key)) removed.push(parseCyclePath(key));
  }

  this.activeCycles = currentCycleSet;
  return { added, removed };
}

// Canonicalize: rotate so lowest node ID is first, then join
function canonicalizeCycle(nodes: string[]): string {
  const minIdx = nodes.indexOf(nodes.reduce((a, b) => (a < b ? a : b)));
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  return rotated.join(' → ');
}
```

### Pattern 5: Cycle Severity via In-Degree Sum

**What:** Use sum of `inEdges(nodeId).length` for all nodes in a cycle as the centrality proxy. Higher values = more dependents affected = higher severity.
**When to use:** Assigning severity tier to each detected cycle.

**Example:**
```typescript
// Source: @dagrejs/graphlib v4.0.1 Graph.inEdges() (verified from dist/types/lib/graph.d.ts)
function cycleSeverity(g: Graph, cycleNodes: string[]): CycleSeverity {
  const totalInDegree = cycleNodes.reduce((sum, nodeId) => {
    return sum + (g.inEdges(nodeId)?.length ?? 0);
  }, 0);

  if (totalInDegree >= HIGH_SEVERITY_THRESHOLD) return 'high';
  if (totalInDegree >= MEDIUM_SEVERITY_THRESHOLD) return 'medium';
  return 'low';
}
// Recommended thresholds (Claude's discretion): high >= 10, medium >= 4, low < 4
```

### Pattern 6: SQLite Write-Through in Transaction

**What:** After computing the in-memory delta, persist all changed nodes and edges in a single `db.transaction()` call, then append change events.
**When to use:** After every `flushPending`.

**Example:**
```typescript
// Source: drizzle-orm transactions docs (verified)
import { db } from '../db/connection.js';
import { nodesRepository } from '../db/repository/nodes.js';
import { edgesRepository } from '../db/repository/edges.js';

function persist(delta: GraphDelta): void {
  db.transaction((tx) => {
    // Upsert added and modified nodes
    for (const nodeId of [...delta.addedNodes, ...delta.modifiedNodes]) {
      nodesRepository.upsert(toDbRow(nodeId, g));
    }
    // Delete removed nodes (cascade deletes edges via deleteByNodeId)
    for (const nodeId of delta.removedNodeIds) {
      edgesRepository.deleteByNodeId(nodeId);  // existing method
      nodesRepository.deleteById(nodeId);       // existing method
    }
    // Insert new edges
    for (const edge of delta.addedEdges) {
      edgesRepository.insert(toEdgeRow(edge));
    }
    // Delete removed edges
    for (const edgeId of delta.removedEdgeIds) {
      edgesRepository.deleteById(edgeId);
    }
  });
}
```

**Note:** Drizzle's `db.transaction()` with better-sqlite3 is synchronous (better-sqlite3 is synchronous). The callback receives no `tx` parameter — use the module-level `db` directly within the callback, or pass `tx` as provided. Verified: the Drizzle better-sqlite3 adapter supports synchronous transactions with `db.transaction(fn)` where `fn` is called synchronously.

### Pattern 7: Startup Load from SQLite

**What:** On `DependencyGraph.start()`, load all nodes and edges from SQLite to rebuild the in-memory graph before beginning to process events.
**When to use:** Server startup, before Pipeline is started.

**Example:**
```typescript
async start(): Promise<void> {
  const nodes = nodesRepository.findAll();
  const edges = edgesRepository.findAll();
  for (const row of nodes) {
    this.g.setNode(row.id, rowToNodeMetadata(row));
  }
  for (const row of edges) {
    this.g.setEdge(row.sourceId, row.targetId, rowToEdgeMetadata(row));
  }
  // Rebuild cycle state
  const cycles = alg.findCycles(this.g);
  this.activeCycles = new Set(cycles.map(c => canonicalizeCycle(c)));
}
```

### Anti-Patterns to Avoid

- **Full graph rebuild on every batch:** Iterating all nodes/edges and recomputing from scratch. Instead, diff per-file and apply only mutations. The whole point of GRAPH-02 is incremental updates.
- **Storing import paths as-is without resolution:** `ImportInfo.source` from the parser is a raw import specifier (e.g., `'./auth.service'`). It must be resolved to a canonical file path to match node IDs. Use `path.resolve(path.dirname(filePath), source)` + normalization. Handle `node_modules` imports as external nodes.
- **Running cycle detection per-file in a batch:** `alg.findCycles` is O(|V|+|E|) — run it once after all files in a batch are processed, not after each file.
- **Emitting delta before SQLite write completes:** Always persist first, then emit. If the process crashes mid-emit, the disk state is correct for replay.
- **Using `alg.topsort` for cycle detection:** `topsort` throws `CycleException` on cycles — it is a side effect, not the intended API. Use `alg.findCycles` or `alg.isAcyclic` explicitly.
- **ESM import of `alg` as a named destructured import without namespace:** Verified from the ESM bundle: `export { ... alg ... }` — named import `import { Graph, alg, json } from '@dagrejs/graphlib'` works correctly in the v4.0.1 ESM build. The historical issue ("alg not exported") affected older v2.x releases that had a CJS-only default export.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directed graph data structure with adjacency lookup | Custom Map<nodeId, Set<neighborId>> | `@dagrejs/graphlib` Graph class | GRAPH-01 requirement; O(1) edge lookup, incident edge enumeration, predecessor/successor navigation |
| Cycle detection (Tarjan SCC) | Custom DFS with color marking | `alg.findCycles(g)` | O(|V|+|E|), handles all cycle topologies, returns node arrays ready for path formatting |
| Graph cycle canonicalization | Custom sort/rotate | Rotate to min-node + join (5 lines) | Simple enough to write inline; no library needed |
| Typed event emission | Custom pub/sub or callback arrays | Node.js `EventEmitter<EventMap>` | Zero dep, fully typed in @types/node 22 |
| SQLite transactions for batch writes | Manual BEGIN/COMMIT SQL | `db.transaction(fn)` | Drizzle handles rollback on throw, type safety |

**Key insight:** The graph data structure and cycle detection are solved problems in graphlib. The Phase 3 work is about the _integration layer_: wiring `ParseBatchResult` → incremental diff → graphlib mutation → delta computation → SQLite persistence → delta event emission.

---

## Common Pitfalls

### Pitfall 1: Import Specifier Resolution

**What goes wrong:** `ParseResult.imports[i].source` is a raw import string like `'./auth.service'`, `'../utils'`, `'node:fs'`, or `'express'`. If used as a graph node ID directly, edges point to non-existent nodes.
**Why it happens:** The parser (tree-sitter) extracts the literal specifier string, not a resolved path.
**How to avoid:**
1. For relative imports: resolve against `path.dirname(filePath)` and normalize with `path.posix.normalize` to a project-relative path. Add extension if missing (`.ts` first, then `.js`).
2. For `node:` built-ins or bare specifiers (no `.` prefix): create external nodes with a prefix like `__external__/express` — do not resolve. These are valid graph nodes for ARCH-05 fan-out detection.
3. For imports that don't resolve to a watched file: still create the target node as a stub; it will be populated when that file is parsed.
**Warning signs:** Edges pointing to node IDs that never appear as sources; orphaned external nodes accumulating.

### Pitfall 2: Edge ID Collision in Non-Multigraph

**What goes wrong:** `@dagrejs/graphlib` default graph is NOT a multigraph (`multigraph: false`). Only one edge is allowed between any (v, w) pair. The second `setEdge(v, w, newLabel)` silently replaces the first.
**Why it happens:** Files can have multiple imports from the same source (e.g., `import { A } from './x'` and `import type { B } from './x'`). The natural per-import approach tries to set multiple edges.
**How to avoid:** Aggregate all imports from the same source file into a single edge whose label contains the merged symbol list. The data model decision (single edge per file pair with symbol list) aligns with this constraint.
**Warning signs:** Symbol lists on edges containing only the last import from a source, not all imports.

### Pitfall 3: drizzle-orm Transaction API with better-sqlite3

**What goes wrong:** The transaction callback in Drizzle with better-sqlite3 is synchronous — calling async operations inside it will not be awaited. The callback parameter `tx` may or may not provide the same API as `db` depending on Drizzle version.
**Why it happens:** better-sqlite3 is a synchronous driver; Drizzle wraps it synchronously.
**How to avoid:** Use `db.transaction((tx) => { tx.insert(...).run(); })` — fully synchronous. Do not `await` inside. Use repository methods (which already call `.run()` / `.all()` synchronously).
**Warning signs:** TypeScript errors about "cannot use await inside sync transaction" or data appearing not written.

### Pitfall 4: `@types/node` EventEmitter Generic Available Only in v22+

**What goes wrong:** `EventEmitter<{ delta: [GraphDelta] }>` generic syntax requires `@types/node` 22.x. Earlier versions don't have this overload.
**Why it happens:** The generic `EventEmitter<TEvents>` was added to `@types/node` in 2024 for Node 22.
**How to avoid:** The project already uses `@types/node@^22.0.0` (verified in server `package.json`). This is safe to use.
**Warning signs:** TypeScript error "Type 'EventEmitter' is not generic".

### Pitfall 5: Graph State Divergence Between Memory and SQLite on Startup

**What goes wrong:** If the server crashes mid-write, SQLite has partial state. On restart, the in-memory graph is loaded from SQLite and diverges from what was parsed.
**Why it happens:** No atomic snapshot of the complete graph state.
**How to avoid:** The `db.transaction()` wrapper ensures per-update atomicity. On startup, rebuild in-memory state from whatever is in SQLite (which was always committed atomically). The pipeline's `ignoreInitial: false` setting means chokidar re-emits all existing files on startup, which will re-parse and reconcile any divergence. This is already wired in Phase 2.
**Warning signs:** Graph has nodes with no edges after restart; duplicate events on startup causing spurious deltas.

### Pitfall 6: Cycle Canonicalization Producing Duplicates

**What goes wrong:** `alg.findCycles` may return the same cycle with nodes in different rotation orders across calls (e.g., `[A, B, C]` and `[B, C, A]`). Naively comparing arrays creates false "new cycle" detections.
**Why it happens:** Tarjan's SCC result order is not deterministic with respect to cycle rotation.
**How to avoid:** Canonicalize all cycle arrays before storing in the `activeCycles` Set. Rotate to the lexicographically smallest node ID, then join with ` → ` separator.
**Warning signs:** Same cycle reported as both added and removed in consecutive deltas.

---

## Code Examples

Verified patterns from official sources:

### @dagrejs/graphlib v4 — Named ESM Import (Verified from dist/graphlib.esm.js)

```typescript
// Source: verified from @dagrejs/graphlib@4.0.1 dist/types/index.d.ts
// `export { Graph } from './lib/graph'; export * as alg from './lib/alg/index'; export * as json from './lib/json';`
import { Graph, alg, json } from '@dagrejs/graphlib';

const g = new Graph<string, NodeMetadata, EdgeMetadata>({ directed: true });

// Node operations
g.setNode('src/auth.ts', { language: 'ts', exports: ['AuthService'] });
g.hasNode('src/auth.ts');      // true
g.node('src/auth.ts');         // NodeMetadata
g.removeNode('src/auth.ts');   // also removes incident edges

// Edge operations
g.setEdge('src/index.ts', 'src/auth.ts', { symbols: ['AuthService'] });
g.outEdges('src/index.ts');    // Edge[] | void
g.inEdges('src/auth.ts');      // Edge[] | void
g.edge('src/index.ts', 'src/auth.ts'); // EdgeMetadata
g.removeEdge('src/index.ts', 'src/auth.ts');

// Cycle detection
const cycles: string[][] = alg.findCycles(g);
// Returns e.g. [['src/a.ts', 'src/b.ts'], ['src/c.ts', 'src/d.ts', 'src/e.ts']]

const isAcyclic: boolean = alg.isAcyclic(g);  // fast early return

// JSON serialization for debug/startup
const serialized = json.write(g);
const restored = json.read(serialized);
```

### Node-Label Type Pattern (Recommended for Phase 3)

```typescript
// Source: project pattern from Phase 1 (const objects + derived types)
export interface NodeMetadata {
  filePath: string;
  language: SupportedLanguage;
  exports: string[];       // export names — for "modified" detection and downstream inference
  lastModified: number;    // Date.now() from ParseResult
}

export interface EdgeMetadata {
  symbols: string[];       // imported symbol names: ['UserService', 'AuthMiddleware']
}
```

### GraphDelta Type (Shared Package)

```typescript
// Source: messages.ts already defines GraphDeltaMessage; this extends it for internal use
export type CycleSeverity = 'high' | 'medium' | 'low';

export interface GraphDeltaCycle {
  path: string[];          // ordered node IDs: ['src/a.ts', 'src/b.ts', 'src/a.ts']
  severity: CycleSeverity;
}

export interface GraphDelta {
  version: number;                    // monotonic, increments per flush
  addedNodes: string[];               // node IDs
  removedNodeIds: string[];
  modifiedNodes: string[];            // nodes whose exports changed
  addedEdges: Array<{ v: string; w: string; symbols: string[] }>;
  removedEdgeIds: string[];           // 'v\0w' composite key
  cyclesAdded: GraphDeltaCycle[];     // newly detected cycles
  cyclesRemoved: GraphDeltaCycle[];   // cycles that no longer exist
  triggerFiles: string[];             // files that caused this delta
  timestamp: number;                  // Date.now()
}
```

### Drizzle Transaction (Synchronous with better-sqlite3)

```typescript
// Source: drizzle-orm transactions docs + project connection.ts pattern
// db is `drizzle(sqlite, { schema })` where sqlite is better-sqlite3 — synchronous
db.transaction((tx) => {
  for (const nodeId of delta.addedNodes) {
    tx.insert(graphNodes).values(toNodeRow(nodeId)).onConflictDoUpdate({
      target: graphNodes.id,
      set: { /* updated fields */ }
    }).run();
  }
  for (const nodeId of delta.removedNodeIds) {
    tx.delete(graphEdges).where(
      or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId))
    ).run();
    tx.delete(graphNodes).where(eq(graphNodes.id, nodeId)).run();
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `graphlib` (original npm package) | `@dagrejs/graphlib` v4.0.1 | 2023+ | dagrejs is the maintained fork; v4 adds full ESM + TypeScript generics; use `@dagrejs/graphlib` only |
| `import * as graphlib from '@dagrejs/graphlib'` (namespace import) | `import { Graph, alg, json } from '@dagrejs/graphlib'` | v3.0+ | Named exports work correctly in v3+ and v4 ESM build; old issue with `alg` not found was in v2 CJS builds |
| @types/node EventEmitter (untyped string events) | `EventEmitter<EventMap>` generic (typed) | @types/node v22, 2024 | Full type safety for `on('delta', ...)` without external libs |
| Full graph rebuild per batch | Incremental per-file diff | Best practice since v2 | Required by GRAPH-02; eliminates O(N) rebuild cost |

**Deprecated/outdated:**
- `graphlib` (npm): unmaintained original; replaced by `@dagrejs/graphlib`
- `import graphlib from '@dagrejs/graphlib'` (default import): CJS default import anti-pattern; use named imports in ESM/NodeNext

---

## Open Questions

1. **Edge ID scheme for `removedEdgeIds` in the delta**
   - What we know: graphlib uses `v + '\0' + w` internally for edge keys in non-multigraph mode. The current `graphEdges` schema uses a text `id` primary key.
   - What's unclear: How to generate stable, collision-free edge IDs for the SQLite schema that also work as delta references for the WebSocket layer.
   - Recommendation: Use `${sourceId}→${targetId}` as the edge ID in SQLite (same as the in-memory key). This is deterministic and human-readable. The `→` separator is safe if file paths use `/` only (which FileWatcher ensures via `.replace(/\\/g, '/')`.

2. **Import path resolution for TypeScript path aliases and monorepo workspace imports**
   - What we know: ParseResult.imports contains raw specifiers; relative imports can be resolved with `path.resolve`. But `@archlens/shared/types` style imports from the monorepo won't resolve to a file path via simple join.
   - What's unclear: Should workspace package imports create external nodes or resolve to actual source files?
   - Recommendation: For Phase 3, treat any non-relative import (no leading `./` or `../`) as an external node with id `__ext__/${specifier}`. Monorepo resolution is a Phase 4+ concern if inference needs cross-package edges.

3. **`db.transaction()` callback receives `tx` or re-uses `db`?**
   - What we know: Drizzle's better-sqlite3 transaction calls `fn` synchronously. The callback receives `tx` typed as the same db type.
   - What's unclear: Whether the existing repository methods (which import `db` directly) work inside a transaction context or require explicit `tx` threading.
   - Recommendation: The existing repositories import `db` from `connection.ts` as a module singleton. Since better-sqlite3 transactions are synchronous and on the same connection, calling `db.*` inside a `db.transaction()` callback should nest correctly. However, to be safe, the GraphPersistence module should call Drizzle's raw insert/update/delete directly (not through the repositories) inside the transaction, passing `tx` explicitly.

---

## Sources

### Primary (HIGH confidence)
- `@dagrejs/graphlib@4.0.1` — installed and inspected locally: `dist/types/index.d.ts`, `dist/types/lib/graph.d.ts`, `dist/types/lib/alg/index.d.ts`, `dist/types/lib/alg/find-cycles.d.ts`, `dist/types/lib/alg/tarjan.d.ts`, `dist/types/lib/alg/is-acyclic.d.ts`, `dist/types/lib/json.d.ts`, `dist/graphlib.esm.js` (verified named exports)
- `packages/server/package.json` — verified drizzle-orm 0.40.0, better-sqlite3 11.x installed
- `packages/server/tsconfig.json` — verified `module: NodeNext, moduleResolution: NodeNext`
- `packages/server/src/db/` — verified existing repository pattern (nodesRepository, edgesRepository, eventsRepository) and schema
- `packages/shared/src/types/` — verified GraphNode, GraphEdge, GraphDeltaMessage, ChangeEventPayload existing types
- `packages/server/src/pipeline/Pipeline.ts` — verified `onResult: (result: ParseBatchResult) => void` callback interface that DependencyGraph must implement
- [drizzle-orm transactions docs](https://orm.drizzle.team/docs/transactions) — verified `db.transaction(fn)` API

### Secondary (MEDIUM confidence)
- [github.com/dagrejs/graphlib wiki API Reference](https://github.com/dagrejs/graphlib/wiki/API-Reference) — algorithm descriptions (verified against source types)
- [docs.jointjs.com/learn/features/export-import/graphlib](https://docs.jointjs.com/learn/features/export-import/graphlib/) — ESM import pattern `import * as graphlib` (superseded by named import confirmation from source inspection)
- [@types/node generics for EventEmitter](https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/55298) — confirmed available in @types/node v22

### Tertiary (LOW confidence)
- WebSearch results on cycle severity / centrality — general graph theory; specific thresholds (HIGH_SEVERITY_THRESHOLD = 10, MEDIUM = 4) are Claude's discretion per CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @dagrejs/graphlib v4.0.1 inspected from dist locally; all API signatures verified
- Architecture: HIGH — patterns derived from verified API + existing project code structure
- Pitfalls: HIGH for library-specific (verified from source); MEDIUM for operational (SQLite transaction behavior inferred from docs)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable library; @dagrejs/graphlib v4.0.1 just released 2026-03-08)
