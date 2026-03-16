# Phase 4: Architectural Inference Engine - Research

**Researched:** 2026-03-15
**Domain:** Semantic zone classification, multi-signal corroboration, risk signal detection, configuration override
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Zone definitions & classification signals**
- Exactly 6 zones: frontend, API, services, data stores, infrastructure, external
- Path patterns are the primary classification signal; import topology refines or confirms
- When path says "API" but imports say "frontend", path wins the tie
- Generic language-level heuristics only — no framework-specific detection (no Next.js/Express/FastAPI recognition)
- Unclassifiable files start in an "unknown" zone but are re-evaluated when more graph data arrives
- Files may migrate out of "unknown" over time as the graph grows and provides more signal

**Event corroboration**
- All 5 event types treated equally: component created, split, merged, dependency added, dependency removed
- Minimum 2 corroborating signals required before an architectural event fires
- A single file edit must never trigger an architectural event on its own
- Events fire immediately when the corroboration threshold is met — no time-window batching
- Binary pass/fail model — events either fire or don't, no confidence scores exposed

**Risk thresholds & severity**
- Fan-out risk: flag when a component has more than 8 outgoing dependencies
- Boundary violations use strict layering: frontend → API → services → data stores. Any layer skip is a violation (e.g., frontend importing data store directly)
- Risks have severity levels (e.g., warning vs critical) — circular deps are critical, high fan-out is warning, boundary violations are warning
- Circular dependency risk wraps Phase 3's existing cycle detection — no independent re-detection, just enriches with zone context and severity

### Claude's Discretion
- Override configuration (.archlens.json) structure and behavior
- Exact path pattern rules for zone classification
- Internal signal weighting mechanics
- How split/merge events are detected from graph deltas
- Severity level assignments beyond the examples above

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | System classifies components into semantic zones (frontend, API, services, data stores, infrastructure, external) using multi-signal heuristics | Path pattern matching (primary) + import topology analysis (secondary). Implemented as a ZoneClassifier module that examines the node's filePath and its graph neighbors. No external library needed — pure TypeScript pattern matching. |
| ARCH-02 | Zone classification uses file path patterns, import topology, and framework-specific signals | Path-first, topology-second design. Path patterns cover the common case; import topology analysis (what does this node import from, who imports this node) provides refinement. Framework-specific signals excluded per locked decisions. |
| ARCH-03 | System detects architectural events: component created, split, merged, dependency added, dependency removed | Events derived by comparing successive GraphDeltas. Component created/removed from addedNodes/removedNodeIds. Dependency added/removed from addedEdges/removedEdgeIds. Split/merge inferred from simultaneous node removal + additions + edge migration patterns in a single delta. |
| ARCH-04 | Architectural events require multiple corroborating signals before firing (confidence threshold) | Corroboration implemented as a signal accumulator: each node/edge delta signal increments a counter. Event fires only when count reaches 2+. Accumulator keyed per "candidate event" resets on fire. No time-window required (fires immediately at threshold). |
| ARCH-05 | System detects risk signals: circular dependencies, boundary violations (e.g., controller accessing DB directly), excessive fan-out | Three risk detectors: (1) CycleRiskDetector wraps Phase 3 GraphDelta.cyclesAdded, enriches with zone labels and critical severity. (2) BoundaryViolationDetector checks each added edge for layer-skip using zone ordering map. (3) FanOutDetector checks outgoingEdgeCount on modified/added nodes. |
| ARCH-06 | User can override zone assignments via a configuration file (.archlens.json) | Config file loaded at startup from watchRoot. Provides a `zoneOverrides` map: fileGlob or filePath → zone. Overrides are applied after path-pattern classification, before topology refinement. File is watched for changes and reloaded live. |
</phase_requirements>

---

## Summary

Phase 4 builds the ArchLens inference engine — the layer that transforms raw dependency graph deltas (from Phase 3's `DependencyGraph`) into architectural intelligence. There are four distinct sub-problems: (1) zone classification of each file node, (2) architectural event detection with corroboration, (3) risk signal detection, and (4) user override configuration. No new external libraries are required — this phase is pure TypeScript logic layered on top of the existing graph infrastructure.

The most important design choice for this phase is **where the inference engine lives in the data flow**: it must subscribe to `DependencyGraph.on('delta', ...)` and emit its own `InferenceResult` events (or call a callback) that the WebSocket layer (Phase 5) will consume. The inference engine does NOT own any SQLite writes for its own state — instead, it updates the `zone` column on existing `graph_nodes` rows via the `nodesRepository.upsert` pattern already established in Phase 3. The `changeEvents` table (append-only) receives `zone_changed` events when a node's zone is assigned or corrected.

The corroboration mechanism requires careful design. Since the locked decision says "events fire immediately when threshold is met — no time-window batching", the accumulator must be keyed per candidate event identity (e.g., "node X was just added to zone Y") and count corroborating signals across successive `GraphDelta` flushes. The binary pass/fail model simplifies the implementation — no probability math, just a counter reaching 2.

**Primary recommendation:** Implement `InferenceEngine` as an `EventEmitter` that subscribes to `DependencyGraph`'s `'delta'` events. It applies zone classification, updates SQLite zone columns, detects risk signals, and emits `'inference'` events carrying `InferenceResult` objects (zones updated, events fired, risks detected) for the WebSocket layer.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js EventEmitter (built-in) | Node 22 | Emit typed `inference` events | Zero dep; `EventEmitter<EventMap>` generic pattern already used by DependencyGraph in Phase 3 |
| @dagrejs/graphlib | 4.0.1 (already installed) | Read graph topology for import-topology classification signal | Already in use; `g.inEdges()`, `g.outEdges()`, `g.predecessors()`, `g.successors()` used for neighbor analysis |
| drizzle-orm | 0.40.0 (already installed) | Update zone column on graph_nodes; append zone_changed events | Already in use; nodesRepository.upsert and eventsRepository.append already exist |
| Node.js fs (built-in) | Node 22 | Load and watch .archlens.json config file | Built-in; chokidar (already installed) handles file-change re-load trigger |
| chokidar | 5.x (already installed) | Watch .archlens.json for live reload | Already installed for file watching; reuse for config file watching |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path (built-in) | Node 22 | Path normalization for pattern matching | Forward-slash normalization (FileWatcher already enforces this in Phase 2) |
| micromatch | 4.x | Glob pattern matching for .archlens.json zone overrides | If glob patterns needed for config overrides; if only exact paths needed, can use string comparison |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom signal accumulator | XState / state machine library | XState is well-suited to corroboration state but adds 40KB+ dep for a simple 2-signal counter; not justified |
| micromatch for overrides | minimatch | Both work; micromatch is generally faster and more featureful; either acceptable since no version is pre-installed |
| Custom path regex | minimatch / glob | Pattern matching in JS benefits from a library for edge cases; 1-2 libraries already available via node_modules dependencies |
| EventEmitter typed events | Callback + type narrowing | EventEmitter pattern is already established by DependencyGraph; consistency matters more than alternatives |

**Installation (if glob override support needed):**
```bash
pnpm --filter @archlens/server add micromatch
pnpm --filter @archlens/server add -D @types/micromatch
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── inference/
│   ├── InferenceEngine.ts          # Main class: subscribes to graph delta, emits inference results
│   ├── ZoneClassifier.ts           # Zone classification: path patterns + topology refinement
│   ├── EventCorroborator.ts        # Signal accumulation, fires architectural events at threshold=2
│   ├── RiskDetector.ts             # Fan-out, boundary violation, cycle enrichment detectors
│   └── ConfigLoader.ts             # .archlens.json loading, watching, and override lookup
packages/shared/src/types/
│   └── inference.ts                # New shared types: ZoneName, ArchitecturalEvent, RiskSignal, InferenceResult
```

The `inference/` directory is a new module parallel to `graph/`, `pipeline/`, `watcher/`, and `parser/`. It is the only consumer of `DependencyGraph`'s `delta` event in Phase 4.

### Pattern 1: InferenceEngine as EventEmitter

**What:** `InferenceEngine` subscribes to `DependencyGraph.on('delta', ...)` and processes each delta to produce an `InferenceResult`. It emits a typed `'inference'` event that Phase 5 (WebSocket) will subscribe to.

**When to use:** This is the core integration pattern for the phase.

```typescript
// Source: project pattern from DependencyGraph (Phase 3)
import { EventEmitter } from 'node:events';
import type { GraphDelta } from '@archlens/shared/types';
import type { InferenceResult } from '@archlens/shared/types';

interface InferenceEngineEvents {
  inference: [result: InferenceResult];
}

export class InferenceEngine extends EventEmitter<InferenceEngineEvents> {
  constructor(
    private readonly graph: DependencyGraph,
    private readonly classifier: ZoneClassifier,
    private readonly corroborator: EventCorroborator,
    private readonly riskDetector: RiskDetector,
    private readonly configLoader: ConfigLoader,
  ) {
    super();
    this.graph.on('delta', (delta) => this.processDelta(delta));
  }

  private processDelta(delta: GraphDelta): void {
    // 1. Apply zone classification for new/modified nodes
    const zoneUpdates = this.classifier.classifyDelta(delta);

    // 2. Persist zone updates to SQLite (nodesRepository.upsert zone column)
    //    and append zone_changed events to changeEvents table
    this.persistZoneUpdates(zoneUpdates);

    // 3. Run corroborator — accumulate signals, fire events at threshold
    const architecturalEvents = this.corroborator.processDelta(delta, zoneUpdates);

    // 4. Run risk detectors on current graph state
    const risks = this.riskDetector.detectRisks(delta, zoneUpdates);

    // 5. Emit inference result for downstream (WebSocket layer)
    if (zoneUpdates.length > 0 || architecturalEvents.length > 0 || risks.length > 0) {
      this.emit('inference', { zoneUpdates, architecturalEvents, risks });
    }
  }
}
```

### Pattern 2: Zone Classification — Path-First, Topology-Second

**What:** A two-pass classification. Pass 1 matches the file path against ordered regex patterns. Pass 2 uses import topology (who does this node import, who imports it) to refine or confirm. If path gives a conclusive result, topology is used only to confirm (path wins ties per locked decisions).

**When to use:** Every node in `delta.addedNodes` and `delta.modifiedNodes`. Also re-evaluate `unknown` nodes in `delta.modifiedNodes` (their graph neighborhood may have grown).

```typescript
// Source: project pattern — pure TypeScript, no external library
export const ZONE_PATH_PATTERNS: Array<{ zone: ZoneName; patterns: RegExp[] }> = [
  {
    zone: 'frontend',
    patterns: [
      /\/(components?|pages?|views?|ui|screens?|layouts?)\//i,
      /\/(hooks?|contexts?)\//i,
      /\.(tsx|jsx)$/i,
      /\/app\/(page|layout|loading|error|not-found)\.[tj]sx?$/i,
    ],
  },
  {
    zone: 'api',
    patterns: [
      /\/(routes?|controllers?|handlers?|endpoints?|api)\//i,
      /\/(middleware|middlewares?)\//i,
      /\.(routes?|controller|handler)\.[tj]s$/i,
    ],
  },
  {
    zone: 'services',
    patterns: [
      /\/(services?|use-?cases?|business|domain|application)\//i,
      /\.service\.[tj]s$/i,
      /\/(managers?|processors?|orchestrators?)\//i,
    ],
  },
  {
    zone: 'data-stores',
    patterns: [
      /\/(repositories?|models?|entities?|schemas?|migrations?|db|database)\//i,
      /\.(repository|model|entity|schema|migration)\.[tj]s$/i,
      /\/(prisma|drizzle|typeorm|sequelize)\//i,
    ],
  },
  {
    zone: 'infrastructure',
    patterns: [
      /\/(config|configs?|infra|infrastructure|setup|bootstrap|server)\//i,
      /\/(workers?|jobs?|queues?|tasks?|cron)\//i,
      /\/(plugins?|adapters?|connectors?)\//i,
      /\/(utils?|helpers?|lib|libs?|shared)\//i,
    ],
  },
  {
    zone: 'external',
    patterns: [
      /^__ext__\//,  // External stub nodes from Phase 3 resolveImportTarget
    ],
  },
];

export class ZoneClassifier {
  classify(nodeId: string, graph: DependencyGraph): ZoneName {
    // 1. Check override config first
    const override = this.configLoader.getOverride(nodeId);
    if (override) return override;

    // 2. Path pattern matching (primary signal)
    const pathZone = this.classifyByPath(nodeId);

    // 3. Topology refinement (secondary signal — only if path is 'unknown')
    if (pathZone !== 'unknown') return pathZone;

    return this.classifyByTopology(nodeId, graph) ?? 'unknown';
  }

  private classifyByPath(nodeId: string): ZoneName {
    for (const { zone, patterns } of ZONE_PATH_PATTERNS) {
      if (patterns.some((p) => p.test(nodeId))) return zone;
    }
    return 'unknown';
  }

  private classifyByTopology(nodeId: string, graph: DependencyGraph): ZoneName | null {
    // If all neighbors are in zone X, this node is likely also in zone X
    // Majority-vote over direct predecessors and successors
    const neighbors = [
      ...(graph.getPredecessors(nodeId) ?? []),
      ...(graph.getSuccessors(nodeId) ?? []),
    ].filter((id) => !id.startsWith('__ext__/'));

    if (neighbors.length === 0) return null;

    const zoneCounts = new Map<ZoneName, number>();
    for (const neighborId of neighbors) {
      const neighborZone = this.getPersistedZone(neighborId);
      if (neighborZone && neighborZone !== 'unknown') {
        zoneCounts.set(neighborZone, (zoneCounts.get(neighborZone) ?? 0) + 1);
      }
    }

    if (zoneCounts.size === 0) return null;

    // Return the zone with the most neighbors
    return [...zoneCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
}
```

**Important:** The `ZoneClassifier` needs read access to the current graph's node metadata to perform topology classification. Either pass the `DependencyGraph` instance or provide a neighbor-lookup callback. Topology classification is only used for `unknown` nodes — this keeps classification fast for the common case.

### Pattern 3: Event Corroboration — Signal Counter

**What:** A `Map<string, number>` keyed by a canonical "candidate event" string. Each GraphDelta that contributes a signal to a candidate increments its counter. When the counter reaches 2 (the locked threshold), the architectural event fires and the counter is reset.

**When to use:** Called on every processed GraphDelta after zone classification.

```typescript
// Source: custom — no external library needed
export type ArchitecturalEventType =
  | 'component_created'
  | 'component_split'
  | 'component_merged'
  | 'dependency_added'
  | 'dependency_removed';

export interface ArchitecturalEvent {
  type: ArchitecturalEventType;
  nodeId?: string;        // primary actor
  targetNodeId?: string;  // for dependency events
  zone?: ZoneName;
  timestamp: number;
}

export class EventCorroborator {
  /** signal counters keyed by canonical candidate event key */
  private readonly counters = new Map<string, number>();
  private readonly THRESHOLD = 2;

  processDelta(
    delta: GraphDelta,
    zoneUpdates: ZoneUpdate[],
  ): ArchitecturalEvent[] {
    const firedEvents: ArchitecturalEvent[] = [];

    // Signal: node added → "component_created" candidate
    for (const nodeId of delta.addedNodes) {
      const key = `component_created:${nodeId}`;
      const count = (this.counters.get(key) ?? 0) + 1;
      if (count >= this.THRESHOLD) {
        this.counters.delete(key);
        const zone = zoneUpdates.find((u) => u.nodeId === nodeId)?.zone;
        firedEvents.push({ type: 'component_created', nodeId, zone, timestamp: delta.timestamp });
      } else {
        this.counters.set(key, count);
      }
    }

    // Signal: node removed → "component_removed" candidate (not an event type)
    // Signal: edge added → "dependency_added" candidate
    for (const edge of delta.addedEdges) {
      const key = `dependency_added:${edge.v}:${edge.w}`;
      const count = (this.counters.get(key) ?? 0) + 1;
      if (count >= this.THRESHOLD) {
        this.counters.delete(key);
        firedEvents.push({
          type: 'dependency_added',
          nodeId: edge.v,
          targetNodeId: edge.w,
          timestamp: delta.timestamp,
        });
      } else {
        this.counters.set(key, count);
      }
    }

    // Signal: edge removed → "dependency_removed" candidate
    for (const edgeId of delta.removedEdgeIds) {
      const key = `dependency_removed:${edgeId}`;
      const count = (this.counters.get(key) ?? 0) + 1;
      if (count >= this.THRESHOLD) {
        this.counters.delete(key);
        firedEvents.push({
          type: 'dependency_removed',
          nodeId: edgeId.split('->')[0],
          targetNodeId: edgeId.split('->')[1],
          timestamp: delta.timestamp,
        });
      } else {
        this.counters.set(key, count);
      }
    }

    // Split/merge detection: simultaneous node removal + multiple node additions with shared edges
    this.detectSplitMerge(delta, zoneUpdates, firedEvents);

    return firedEvents;
  }

  private detectSplitMerge(
    delta: GraphDelta,
    zoneUpdates: ZoneUpdate[],
    firedEvents: ArchitecturalEvent[],
  ): void {
    // Merge: multiple nodes removed, one node added, new node has edges to all old node targets
    // Split: one node removed, multiple nodes added, new nodes collectively cover old edges
    // Both are detected by examining delta.removedNodeIds and delta.addedNodes together
    // Heuristic: if |removedNodes| >= 2 and |addedNodes| == 1 → component_merged candidate
    // Heuristic: if |removedNodes| == 1 and |addedNodes| >= 2 → component_split candidate
    // These require TWO such deltas before firing (standard corroboration logic)
    if (delta.removedNodeIds.length >= 2 && delta.addedNodes.length === 1) {
      const key = `component_merged:${delta.addedNodes[0]}`;
      const count = (this.counters.get(key) ?? 0) + 1;
      if (count >= this.THRESHOLD) {
        this.counters.delete(key);
        firedEvents.push({
          type: 'component_merged',
          nodeId: delta.addedNodes[0],
          timestamp: delta.timestamp,
        });
      } else {
        this.counters.set(key, count);
      }
    } else if (delta.removedNodeIds.length === 1 && delta.addedNodes.length >= 2) {
      const key = `component_split:${delta.removedNodeIds[0]}`;
      const count = (this.counters.get(key) ?? 0) + 1;
      if (count >= this.THRESHOLD) {
        this.counters.delete(key);
        firedEvents.push({
          type: 'component_split',
          nodeId: delta.removedNodeIds[0],
          timestamp: delta.timestamp,
        });
      } else {
        this.counters.set(key, count);
      }
    }
  }
}
```

**Critical design note:** The corroboration counter persists across multiple `GraphDelta` events. This is intentional — a single file edit produces one delta; the counter only reaches 2 after two deltas that both contribute the same signal. This fulfills the locked requirement "a single file edit must never trigger an architectural event."

### Pattern 4: Risk Detection — Three Detectors

**What:** A `RiskDetector` class that runs three independent checks on each `GraphDelta` with updated zone information.

**When to use:** Called once per `processDelta`, after zone classification.

```typescript
// Source: custom — derives from Phase 3 GraphDelta structure and locked risk thresholds
export const RiskSeverity = {
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;
export type RiskSeverity = typeof RiskSeverity[keyof typeof RiskSeverity];

export interface RiskSignal {
  type: 'circular_dependency' | 'boundary_violation' | 'excessive_fan_out';
  severity: RiskSeverity;
  nodeId: string;
  details: string;
  affectedNodeIds?: string[];
}

// Strict layer ordering for boundary violation detection
// frontend(0) → api(1) → services(2) → data-stores(3)
// Any edge from lower index to higher index that SKIPS a level is a violation
// Infrastructure and external are not in the strict ordering
const ZONE_LAYER_ORDER: Partial<Record<ZoneName, number>> = {
  'frontend': 0,
  'api': 1,
  'services': 2,
  'data-stores': 3,
};

const FAN_OUT_THRESHOLD = 8; // locked: more than 8 outgoing deps = warning

export class RiskDetector {
  detectRisks(
    delta: GraphDelta,
    zoneUpdates: ZoneUpdate[],
    getZone: (nodeId: string) => ZoneName,
    getOutDegree: (nodeId: string) => number,
  ): RiskSignal[] {
    const risks: RiskSignal[] = [];

    // 1. Circular dependency risks (wrap Phase 3 cycle detection)
    for (const cycle of delta.cyclesAdded) {
      const zoneLabels = cycle.path.map((id) => getZone(id));
      risks.push({
        type: 'circular_dependency',
        severity: RiskSeverity.CRITICAL, // locked: circular deps are critical
        nodeId: cycle.path[0],
        affectedNodeIds: cycle.path,
        details: `Circular dependency: ${cycle.path.join(' → ')} (zones: ${zoneLabels.join(' → ')})`,
      });
    }

    // 2. Boundary violation risks (check newly added edges)
    for (const edge of delta.addedEdges) {
      const sourceZone = getZone(edge.v);
      const targetZone = getZone(edge.w);
      const sourceLayer = ZONE_LAYER_ORDER[sourceZone];
      const targetLayer = ZONE_LAYER_ORDER[targetZone];

      if (sourceLayer !== undefined && targetLayer !== undefined) {
        // A "skip" is when source is in layer N and target is in layer N+2 or greater
        // (jumping over a layer), OR when going backwards (higher layer → lower layer ... wait)
        // Clean architecture: outer layers should import inner layers.
        // frontend(0) imports api(1): ALLOWED (adjacent)
        // frontend(0) imports services(2): VIOLATION (skips api)
        // frontend(0) imports data-stores(3): VIOLATION (skips api and services)
        // api(1) imports data-stores(3): VIOLATION (skips services)
        // services(2) imports frontend(0): VIOLATION (wrong direction)
        const diff = targetLayer - sourceLayer;
        if (diff !== 1 && diff !== 0) {
          // Only adjacent-layer imports (diff === 1) are allowed in the strict layering model
          // Same-zone imports (diff === 0) are always allowed
          risks.push({
            type: 'boundary_violation',
            severity: RiskSeverity.WARNING, // locked: boundary violations are warning
            nodeId: edge.v,
            affectedNodeIds: [edge.v, edge.w],
            details: `${sourceZone}(${edge.v}) → ${targetZone}(${edge.w}): violates strict layering`,
          });
        }
      }
    }

    // 3. Fan-out risks (check nodes whose out-degree changed)
    const nodesToCheck = [
      ...delta.addedNodes,
      ...delta.modifiedNodes,
      ...delta.addedEdges.map((e) => e.v),
    ];
    const uniqueNodes = [...new Set(nodesToCheck)];
    for (const nodeId of uniqueNodes) {
      const outDegree = getOutDegree(nodeId);
      if (outDegree > FAN_OUT_THRESHOLD) {
        risks.push({
          type: 'excessive_fan_out',
          severity: RiskSeverity.WARNING, // locked: high fan-out is warning
          nodeId,
          details: `${nodeId} has ${outDegree} outgoing dependencies (threshold: ${FAN_OUT_THRESHOLD})`,
        });
      }
    }

    return risks;
  }
}
```

### Pattern 5: Config Loader — .archlens.json Override

**What:** Load a `.archlens.json` file from the project root at startup. The config provides `zoneOverrides` mapping file paths or glob patterns to zone names. The file is watched for changes and reloaded live.

**When to use:** Called by `ZoneClassifier.classify()` as the first step.

```typescript
// Source: custom — Node.js fs + chokidar pattern
export interface ArchLensConfig {
  zoneOverrides?: Record<string, ZoneName>; // key: filePath or glob, value: zone name
}

export class ConfigLoader {
  private config: ArchLensConfig = {};
  private configPath: string;

  constructor(watchRoot: string) {
    this.configPath = path.join(watchRoot, '.archlens.json');
    this.loadConfig();
    // Watch for config changes and reload
    // Use existing chokidar instance pattern from FileWatcher
  }

  getOverride(nodeId: string): ZoneName | null {
    const overrides = this.config.zoneOverrides ?? {};

    // 1. Exact match first (most specific)
    if (overrides[nodeId]) return overrides[nodeId];

    // 2. Glob pattern match (if micromatch available)
    for (const [pattern, zone] of Object.entries(overrides)) {
      if (this.matchesGlob(nodeId, pattern)) return zone;
    }

    return null;
  }

  private loadConfig(): void {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(raw) as ArchLensConfig;
    } catch {
      this.config = {}; // file not present or invalid — use empty config
    }
  }
}
```

**Schema design for .archlens.json:**
```json
{
  "zoneOverrides": {
    "src/utils/format.ts": "services",
    "src/lib/**/*.ts": "infrastructure",
    "src/db/seed.ts": "data-stores"
  }
}
```

### Pattern 6: Integration with index.ts

**What:** Wire `InferenceEngine` into `index.ts` after `DependencyGraph` is created. The engine subscribes to the graph's `delta` event automatically in its constructor.

**When to use:** Server startup, after `DependencyGraph` and before `Pipeline.start()`.

```typescript
// packages/server/src/index.ts — additions for Phase 4
import { InferenceEngine } from './inference/InferenceEngine.js';

const graph = new DependencyGraph();
graph.loadFromDatabase();

const inferenceEngine = new InferenceEngine(graph, watchRoot);

inferenceEngine.on('inference', (result) => {
  // Phase 5 will subscribe here instead
  console.log(`[Inference] ${result.architecturalEvents.length} events, ${result.risks.length} risks`);
});
```

### Anti-Patterns to Avoid

- **Re-running zone classification on every delta for all nodes:** Only classify nodes in `addedNodes` and `modifiedNodes`. Do not re-classify the entire graph on every delta — this negates the incremental model from Phase 3.
- **Storing zone in NodeMetadata (in-memory) but forgetting SQLite:** Zone classification must persist to the `zone` column in `graph_nodes` via `nodesRepository.upsert`. Otherwise zone information is lost on restart.
- **Using framework-specific signals:** The locked decision forbids Next.js/Express/FastAPI-specific detection. Pattern matching must use generic path terms (`pages/`, `api/`, `services/`) not framework-specific conventions (`app/(page)/`... wait, the research shows this could be generic enough, but page routing is locked out by "no framework detection" — err on the side of generic).
- **Accumulating corroboration signals for already-fired events:** The counter map must be deleted (not zeroed) when an event fires. Re-accumulation should start fresh.
- **Detecting boundary violations on edges to/from external nodes:** `__ext__/` prefixed nodes are in the `external` zone (layer: undefined in ZONE_LAYER_ORDER). Skip them from boundary violation checking.
- **Rechecking fan-out for all nodes on every delta:** Only check nodes that appear in `delta.addedNodes`, `delta.modifiedNodes`, or as the source (`edge.v`) of `delta.addedEdges`. Unchanged nodes cannot have changed fan-out.
- **Making the InferenceEngine synchronous blocking:** Zone classification, corroboration, and risk detection are all synchronous and cheap (O(edges) in the worst case). No async needed. Matching the `DependencyGraph` pattern (synchronous delta processing) is correct here.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph topology queries for zone inference | Custom adjacency Map | `DependencyGraph.getPredecessors(id)` / `DependencyGraph.getSuccessors(id)` wrapping graphlib | Already available from Phase 3; consistent with existing graph abstraction |
| Cycle detection | Independent DFS | Use `delta.cyclesAdded` from Phase 3 GraphDelta | Phase 3 already runs alg.findCycles() per flush; re-running would duplicate work |
| File watching for .archlens.json | Custom fs.watch() | Re-use chokidar (already installed) or a simple fs.watchFile() | Chokidar is already the project standard for file watching |
| Zone persistence | Direct SQL INSERT | `nodesRepository.upsert({ zone: ... })` | Repository pattern already established; consistency with Phase 3 persistence |
| Glob pattern matching | Custom regex | micromatch (or minimatch) | Edge cases in glob matching (negation, double-star, brace expansion) are non-trivial; library handles them correctly |

**Key insight:** Phase 4 is a pure logic layer. All persistence, file watching, and graph data access are already implemented. The value is in the classification rules, corroboration mechanics, and risk algorithms — not infrastructure.

---

## Common Pitfalls

### Pitfall 1: Unknown Zone Re-evaluation Timing

**What goes wrong:** Nodes that start as `unknown` may never be re-classified because the inference engine only classifies nodes in `delta.addedNodes` and `delta.modifiedNodes`. If a node's neighbors get classified later, the unknown node remains stuck.

**Why it happens:** Zone classification is triggered by the node itself being added/modified — not by its neighbors being classified.

**How to avoid:** When a node's zone is updated (non-unknown to a zone), check whether any of its `unknown` neighbors can now be classified by topology. Add these neighbors to the "to re-classify" set for the current delta processing cycle. One round of neighbor propagation is sufficient (don't need a full BFS).

**Warning signs:** Express+React project has >20% unknown after initial scan; `unknown` nodes persist even after their neighbors are classified.

### Pitfall 2: Corroboration Counter Leakage

**What goes wrong:** The corroboration counter map accumulates stale entries for events that never fire (e.g., a node was added once but never again). Over time, the map grows unboundedly.

**Why it happens:** No eviction policy for counters that don't reach the threshold.

**How to avoid:** Add a time-to-live or version-based expiry. Simple approach: associate a `deltaVersion` with each counter entry; if the entry's deltaVersion is more than N versions behind the current version, evict it. Alternatively, evict on node removal (`delta.removedNodeIds` clears any counters keyed on that node).

**Warning signs:** Memory growth during long-running sessions; stale events firing after a node is deleted and re-created later.

### Pitfall 3: Boundary Violation Direction

**What goes wrong:** The layering model `frontend(0) → api(1) → services(2) → data-stores(3)` encodes a "frontend imports api" direction. But the clean architecture principle says inner layers (data-stores) should not import outer layers (frontend) — violations go in BOTH directions. Only adjacent layer imports are allowed.

**Why it happens:** Treating the boundary rule as "only forward violations" misses backward dependencies (e.g., a service importing from a React component).

**How to avoid:** Any `diff !== 1 && diff !== 0` is a violation, where `diff = targetLayer - sourceLayer`. This correctly catches:
  - Skips forward: `frontend(0) → data-stores(3)` → diff=3 → violation
  - Backward imports: `services(2) → frontend(0)` → diff=-2 → violation
  - Adjacent (allowed): `frontend(0) → api(1)` → diff=1 → OK
  - Same zone (allowed): `services(2) → services(2)` → diff=0 → OK

**Warning signs:** A `frontend → services` import (skip) is flagged but a `services → frontend` import (backwards) is not.

### Pitfall 4: classifyByTopology Accessing Stale Zone Data

**What goes wrong:** `classifyByTopology` reads the zone of neighbor nodes from SQLite (`getPersistedZone`). On the first startup scan, all nodes arrive in a burst: the topology query for node A sees its neighbors as `unknown` because they haven't been classified yet.

**Why it happens:** Batch processing order is non-deterministic; topology classification depends on neighbors already having zone information.

**How to avoid:** Two-pass processing within a single delta: (1) classify all nodes by path first, persisting those that are non-unknown; (2) classify remaining `unknown` nodes by topology using the in-memory zone assignments from step 1. This ensures topology sees path-classified neighbors.

**Warning signs:** Large spike in `unknown` nodes after initial startup that never resolves even with more graph data.

### Pitfall 5: Zone Column in SQLite Not Updated Atomically with Edge Changes

**What goes wrong:** The inference engine updates zone columns after the graph delta has already been persisted by Phase 3's `onDeltaComputed`. If the inference engine crashes or throws, the SQLite `zone` column is never updated but the node/edge data is persisted.

**Why it happens:** Phase 3 persists structural graph data synchronously; Phase 4 zone updates happen in a separate step.

**How to avoid:** Zone updates to SQLite should be fire-and-forget updates (no transaction coupling with Phase 3). Since `zone` is nullable and the `loadGraphState` already handles null zones (treating them as `unknown`), a missing zone on a persisted node is a recoverable state — zone will be re-classified on the next delta that touches that node.

**Warning signs:** Nodes show as `unknown` zone after restart even though their path clearly places them in a zone.

### Pitfall 6: Fan-Out Counting __ext__ Stub Nodes

**What goes wrong:** External stub nodes (`__ext__/express`, `__ext__/node:fs`, etc.) inflate the out-degree count. A file importing 3 business modules and 7 npm packages shows outDegree=10 and triggers a fan-out warning even though its inter-project coupling is low.

**Why it happens:** Phase 3 creates `__ext__/` stub nodes for all non-relative imports; the out-degree count includes edges to these stubs.

**How to avoid:** When computing fan-out for risk detection, count only edges to internal nodes (those NOT starting with `__ext__/`). Two fan-out thresholds may be warranted: one for internal dependencies, one for all dependencies. Per locked decisions, the threshold is 8 — calibrate this against internal-only or all, then document the choice.

**Warning signs:** Server entry points (which legitimately import many npm packages) always trigger fan-out warnings.

---

## Code Examples

Verified patterns from official sources and project code:

### Shared Types — New inference.ts

```typescript
// packages/shared/src/types/inference.ts
// Project convention: const objects + derived types (from Phase 1 decisions)

export const ZoneName = {
  FRONTEND: 'frontend',
  API: 'api',
  SERVICES: 'services',
  DATA_STORES: 'data-stores',
  INFRASTRUCTURE: 'infrastructure',
  EXTERNAL: 'external',
  UNKNOWN: 'unknown',
} as const;
export type ZoneName = typeof ZoneName[keyof typeof ZoneName];

export const ArchitecturalEventType = {
  COMPONENT_CREATED: 'component_created',
  COMPONENT_SPLIT: 'component_split',
  COMPONENT_MERGED: 'component_merged',
  DEPENDENCY_ADDED: 'dependency_added',
  DEPENDENCY_REMOVED: 'dependency_removed',
} as const;
export type ArchitecturalEventType = typeof ArchitecturalEventType[keyof typeof ArchitecturalEventType];

export const RiskType = {
  CIRCULAR_DEPENDENCY: 'circular_dependency',
  BOUNDARY_VIOLATION: 'boundary_violation',
  EXCESSIVE_FAN_OUT: 'excessive_fan_out',
} as const;
export type RiskType = typeof RiskType[keyof typeof RiskType];

export const RiskSeverity = {
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;
export type RiskSeverity = typeof RiskSeverity[keyof typeof RiskSeverity];

export interface ZoneUpdate {
  nodeId: string;
  zone: ZoneName;
  previousZone: ZoneName | null;
}

export interface ArchitecturalEvent {
  type: ArchitecturalEventType;
  nodeId: string;
  targetNodeId?: string;
  zone?: ZoneName;
  timestamp: number;
}

export interface RiskSignal {
  type: RiskType;
  severity: RiskSeverity;
  nodeId: string;
  affectedNodeIds?: string[];
  details: string;
}

export interface InferenceResult {
  zoneUpdates: ZoneUpdate[];
  architecturalEvents: ArchitecturalEvent[];
  risks: RiskSignal[];
  graphVersion: number;
}
```

### Accessing DependencyGraph for Zone Queries

Phase 4 needs to read the graph's neighbor data and node metadata. DependencyGraph currently exposes `getNodeMetadata(id)` and the raw graphlib `g` is private. The inference engine needs either:
1. New public methods on `DependencyGraph` (e.g., `getPredecessors(id)`, `getSuccessors(id)`, `getOutDegree(id)`)
2. Or pass the graphlib instance directly

**Recommendation:** Add minimal public accessors to `DependencyGraph`. This is consistent with Phase 3's patterns and keeps graphlib internal:

```typescript
// Add to DependencyGraph.ts
getPredecessors(nodeId: string): string[] | undefined {
  return this.g.predecessors(nodeId) ?? undefined;
}

getSuccessors(nodeId: string): string[] | undefined {
  return this.g.successors(nodeId) ?? undefined;
}

getOutDegree(nodeId: string): number {
  return this.g.outEdges(nodeId)?.length ?? 0;
}

getInDegree(nodeId: string): number {
  return this.g.inEdges(nodeId)?.length ?? 0;
}

getOutEdges(nodeId: string): GraphDeltaEdge[] {
  return (this.g.outEdges(nodeId) ?? []).map(e => ({
    v: e.v,
    w: e.w,
    symbols: (this.g.edge(e.v, e.w) as EdgeMetadata)?.symbols ?? [],
  }));
}
```

These methods may already be partially present (the Phase 3 `PersistenceContext` interface uses `getInDegree`/`getOutDegree` internally). The key question is whether they need to become public — they should, since the inference engine is a legitimate consumer.

### nodesRepository Zone Update Pattern

```typescript
// Pattern from nodesRepository.ts — update zone column only
// nodesRepository.upsert handles onConflictDoUpdate already; just pass current zone
import { db } from '../db/connection.js';
import { graphNodes } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Direct zone column update without full upsert
db.update(graphNodes)
  .set({ zone: zoneName })
  .where(eq(graphNodes.id, nodeId))
  .run();

// And append the zone_changed event:
eventsRepository.append({
  eventType: ChangeEventType.ZONE_CHANGED,
  payload: { type: 'zone_changed', nodeId, oldZone: null, newZone: zoneName },
  timestamp: new Date(),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Framework-specific classifiers (detect Next.js, Express) | Generic path pattern classifiers | 2023+ (agent-agnostic tools) | Required by locked decision; simpler, more portable across projects |
| Static analysis with AST parsing for classification | File path + import graph topology signals | Current standard in dependency-cruiser, Nx | No additional parsing needed — graph already built by Phase 2/3 |
| Hard-coded risk rules | Configurable thresholds with .archlens.json overrides | Current best practice | ARCH-06 requirement; configuration-driven architecture tools are industry norm |
| Full-graph cycle detection on each event | Incremental cycle delta from Phase 3 | Phase 3 decision | CycleRisk in Phase 4 simply reads delta.cyclesAdded — no additional detection work |

**Deprecated/outdated:**
- Direct AST traversal for zone classification: unnecessary given path patterns cover 80%+ of cases; Phase 2 already handles AST parsing.
- Time-windowed corroboration: rejected by locked decisions in favor of immediate threshold firing.

---

## Open Questions

1. **Should fan-out count include __ext__/ edges or only internal edges?**
   - What we know: The locked threshold is 8. External stubs inflate out-degree. A typical server file importing express, node:fs, node:path, etc. will have several external edges.
   - What's unclear: Whether the threshold was designed for total out-degree or internal-only.
   - Recommendation: Count internal edges only (exclude `__ext__/` targets) for fan-out risk. Document this in code. Re-calibrate threshold if needed after initial testing against real projects.

2. **Corroboration counter eviction strategy**
   - What we know: Counters that never reach threshold will accumulate in the Map.
   - What's unclear: Whether corroboration counters should be evicted on node removal, after N versions, or both.
   - Recommendation: Evict on `delta.removedNodeIds` (clear any counter keyed on that nodeId). Also add a version-delta check: if a counter's originating version is more than 10 versions old, evict it. This is simple and covers the common cases.

3. **Should zone updates go into the same SQLite transaction as graph delta writes?**
   - What we know: Phase 3 writes graph structure in `onDeltaComputed` before emitting the `delta` event. Zone updates happen after the event is received in Phase 4.
   - What's unclear: Whether atomicity between graph structure and zone data is needed.
   - Recommendation: No need for cross-phase transaction coupling. Zone is a nullable column; a missing zone is recoverable. Keep Phase 3 and Phase 4 writes independent.

4. **How many path patterns are needed for <20% unknown on Express+React and Next.js+FastAPI?**
   - What we know: The success criterion requires <20% unknown on standard structures for those two project types.
   - What's unclear: The exact coverage needed. Calibration requires testing against real project trees.
   - Recommendation: The proposed pattern set covers: components, pages, hooks, contexts (frontend); routes, controllers, handlers, api, middleware (API); services, use-cases, domain (services); repositories, models, entities, db, migrations (data stores); config, utils, lib, plugins, workers (infrastructure). This covers standard Express+React and Next.js+FastAPI project structures generically. Test against real trees and adjust during UAT.

5. **Does DependencyGraph need new public methods for Phase 4?**
   - What we know: `DependencyGraph` currently has `getNodeMetadata(id)` and internal graphlib access. Phase 4 needs predecessor/successor lists and out-degree counts.
   - What's unclear: Whether adding public accessors to DependencyGraph is preferred over passing graphlib directly.
   - Recommendation: Add public `getPredecessors`, `getSuccessors`, `getOutDegree`, `getInDegree`, `getOutEdges` accessors to `DependencyGraph`. This is minimal surface area and keeps graphlib encapsulated.

---

## Sources

### Primary (HIGH confidence)
- `packages/server/src/graph/DependencyGraph.ts` — verified GraphDelta structure, NodeMetadata, existing public API, onDeltaComputed hook
- `packages/server/src/graph/GraphPersistence.ts` — verified nodesRepository.upsert pattern, zone column in graph_nodes schema
- `packages/server/src/db/schema.ts` — verified zone TEXT column on graph_nodes, changeEvents table structure
- `packages/shared/src/types/graph-delta.ts` — verified GraphDelta type: addedNodes, removedNodeIds, modifiedNodes, addedEdges, removedEdgeIds, cyclesAdded, cyclesRemoved
- `packages/shared/src/types/graph.ts` — verified NodeType, EdgeType, GraphNode with zone field
- `packages/shared/src/types/events.ts` — verified ChangeEventType.ZONE_CHANGED, ChangeEventPayload for zone_changed
- `packages/shared/src/types/messages.ts` — verified InferenceResult will be a new message type consumed by Phase 5
- `packages/server/src/index.ts` — verified DependencyGraph instantiation and pipeline wiring pattern
- `packages/server/src/db/repository/nodes.ts` — verified nodesRepository.upsert pattern
- `packages/server/src/db/repository/events.ts` — verified eventsRepository.append pattern

### Secondary (MEDIUM confidence)
- [dependency-cruiser GitHub](https://github.com/sverweij/dependency-cruiser) — path pattern approach for boundary enforcement; confirmed regex-based path matching is the standard approach
- [Clean Architecture — Uncle Bob](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — strict layer ordering model (domain → application → infrastructure); validates the frontend→api→services→data-stores ordering locked by decisions
- [Feature-Sliced Design](https://feature-sliced.design/blog/frontend-architecture-guide) — layered FSD approach; validates that path-based zone inference (slices/layers directories) is the prevailing standard
- [LogRocket: Managing dependency boundaries in TypeScript](https://blog.logrocket.com/managing-dependency-boundaries-typescript/) — boundary enforcement patterns and violation detection approaches

### Tertiary (LOW confidence)
- WebSearch on corroboration threshold patterns — no standard library exists; custom counter map is the correct approach (confirmed by absence of relevant results)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new external libraries required; all libraries already installed and verified in Phase 1-3
- Architecture: HIGH — patterns derived from existing Phase 3 codebase and project conventions; no library API uncertainty
- Pitfalls: HIGH for implementation-specific (derived from reading actual Phase 3 code and data types); MEDIUM for calibration questions (unknown% threshold, fan-out counting)
- Path patterns: MEDIUM — list covers standard Express+React and Next.js+FastAPI project structures; exact coverage vs. 20% unknown target requires calibration testing

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain; no fast-moving library dependencies introduced)
