import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import type { Graph as GraphType } from '@dagrejs/graphlib';
const _require = createRequire(import.meta.url);
const graphlib: { Graph: typeof GraphType; alg: typeof import('@dagrejs/graphlib')['alg'] } = _require('@dagrejs/graphlib');
import type {
  ParseBatchResult,
  ParseResult,
  FileRemoved,
} from '@archlens/shared/types';
import type {
  GraphDelta,
  GraphDeltaCycle,
  GraphDeltaEdge,
  NodeMetadata,
  EdgeMetadata,
} from '@archlens/shared/types';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import { CycleSeverity } from '@archlens/shared/types';
import { db } from '../db/connection.js';
import { graphNodes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { persistDelta, loadGraphState } from './GraphPersistence.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Mutable delta builder — assembled as we process files, then frozen into
 * GraphDelta at flush time.
 */
interface MutableDelta {
  addedNodes: string[];
  removedNodeIds: string[];
  modifiedNodes: string[];
  addedEdges: GraphDeltaEdge[];
  removedEdgeIds: string[];
  cyclesAdded: GraphDeltaCycle[];
  cyclesRemoved: GraphDeltaCycle[];
}

// ---------------------------------------------------------------------------
// Severity thresholds (Claude's discretion per CONTEXT.md / RESEARCH.md)
// ---------------------------------------------------------------------------

const HIGH_SEVERITY_THRESHOLD = 10;
const MEDIUM_SEVERITY_THRESHOLD = 4;

// ---------------------------------------------------------------------------
// Event map for typed EventEmitter
// ---------------------------------------------------------------------------

interface DependencyGraphEvents {
  delta: [delta: GraphDelta];
}

// ---------------------------------------------------------------------------
// DependencyGraph
// ---------------------------------------------------------------------------

/**
 * DependencyGraph maintains an in-memory directed graph of file-level
 * dependencies using @dagrejs/graphlib. It receives ParseBatchResult objects
 * from the Pipeline, applies incremental per-file updates, computes typed
 * GraphDelta events, detects cycle changes with severity tiers, consolidates
 * rapid batches via a debounce window, and emits typed 'delta' events for
 * downstream consumers (inference engine, WebSocket layer).
 *
 * Node IDs are project-relative file paths (forward-slash, normalized).
 * External/built-in module nodes use the prefix `__ext__/`.
 */
export class DependencyGraph extends EventEmitter<DependencyGraphEvents> {
  /** The in-memory directed graph (non-multigraph, non-compound). */
  private readonly g: GraphType;

  /** Monotonic delta version counter — increments per flush. */
  private version: number = 0;

  /** Previous ParseResult per file for incremental diffing. */
  private prevFileResults: Map<string, ParseResult> = new Map();

  /**
   * Canonicalized cycle strings for diff detection.
   * Format: lexicographically-rotated node IDs joined with ' -> '.
   */
  private activeCycles: Set<string> = new Set();

  /** Batches waiting to be consolidated within the debounce window. */
  private pendingBatches: ParseBatchResult[] = [];

  /** The active consolidation timer handle, or null if idle. */
  private consolidateTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounce window in milliseconds for batch consolidation. */
  private readonly CONSOLIDATE_MS = 50;

  constructor() {
    super();
    // Non-multigraph: only one edge allowed per (v, w) pair.
    // This aligns with the data model decision: single edge per file pair
    // with an aggregated symbol list.
    this.g = new graphlib.Graph({ directed: true });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Entry point from the Pipeline. Pushes batch into the pending accumulator
   * and resets the consolidation timer. All batches arriving within
   * CONSOLIDATE_MS of each other will be processed together as a single delta.
   */
  onParseResult(batch: ParseBatchResult): void {
    this.pendingBatches.push(batch);
    if (this.consolidateTimer !== null) {
      clearTimeout(this.consolidateTimer);
    }
    this.consolidateTimer = setTimeout(() => this.flushPending(), this.CONSOLIDATE_MS);
  }

  /** Returns the current delta version counter. */
  getVersion(): number {
    return this.version;
  }

  /** Returns the number of nodes in the graph. */
  getNodeCount(): number {
    return this.g.nodeCount();
  }

  /** Returns the number of edges in the graph. */
  getEdgeCount(): number {
    return this.g.edgeCount();
  }

  /** Returns true if the graph has a node with the given ID. */
  hasNode(id: string): boolean {
    return this.g.hasNode(id);
  }

  /**
   * Returns the NodeMetadata for the given node ID, or undefined if not found.
   */
  getNodeMetadata(id: string): NodeMetadata | undefined {
    if (!this.g.hasNode(id)) return undefined;
    return this.g.node(id) as NodeMetadata | undefined;
  }

  /**
   * Returns the predecessor node IDs for the given node — i.e. nodes that
   * have edges pointing TO nodeId (files that import this file).
   */
  getPredecessors(nodeId: string): string[] {
    return this.g.predecessors(nodeId) ?? [];
  }

  /**
   * Returns the successor node IDs for the given node — i.e. nodes that
   * nodeId has edges pointing TO (files this node imports).
   */
  getSuccessors(nodeId: string): string[] {
    return this.g.successors(nodeId) ?? [];
  }

  /**
   * Returns the number of outgoing edges from the given node.
   */
  getOutDegree(nodeId: string): number {
    return this.g.outEdges(nodeId)?.length ?? 0;
  }

  /**
   * Returns the number of incoming edges to the given node.
   */
  getInDegree(nodeId: string): number {
    return this.g.inEdges(nodeId)?.length ?? 0;
  }

  /**
   * Returns the outgoing edges from nodeId with their edge metadata (symbols).
   * Needed by the inference engine for topology-based zone classification.
   */
  getOutEdges(nodeId: string): GraphDeltaEdge[] {
    return (this.g.outEdges(nodeId) ?? []).map((e) => ({
      v: e.v,
      w: e.w,
      symbols: (this.g.edge(e.v, e.w) as EdgeMetadata)?.symbols ?? [],
    }));
  }

  /**
   * Returns all node IDs currently in the graph.
   * Needed for re-evaluating unknown-zone nodes after neighbor classification.
   */
  getAllNodeIds(): string[] {
    return this.g.nodes();
  }

  /**
   * Serializes the current in-memory graph into GraphNode[] and GraphEdge[]
   * arrays matching the shared wire-format types from graph.ts.
   *
   * External stub nodes (prefixed with `__ext__/`) are excluded — they have no
   * client-visible metadata and are not meaningful for visualization.
   *
   * This method is read-only and does not mutate any graph state.
   */
  getSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    // Read persisted zones from SQLite so snapshot includes zone data
    const zoneMap = new Map<string, string | null>();
    try {
      const rows = db.select({ id: graphNodes.id, zone: graphNodes.zone }).from(graphNodes).all();
      for (const row of rows) {
        zoneMap.set(row.id, row.zone);
      }
    } catch {
      // DB may not have zones yet — continue with null zones
    }

    const nodes: GraphNode[] = [];
    for (const id of this.g.nodes()) {
      // Skip external stub nodes — they have no metadata and are not meaningful for the client
      if (id.startsWith('__ext__/')) continue;
      const meta = this.g.node(id) as NodeMetadata | undefined;
      if (!meta) continue;
      nodes.push({
        id,
        name: id.split('/').pop()?.replace(/\.\w+$/, '') ?? id,
        nodeType: 'service_module',
        zone: zoneMap.get(id) ?? null,
        fileList: [meta.filePath],
        incomingEdgeCount: this.g.inEdges(id)?.length ?? 0,
        outgoingEdgeCount: this.g.outEdges(id)?.length ?? 0,
        lastModified: new Date(meta.lastModified),
      });
    }

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const edges: GraphEdge[] = [];
    for (const e of this.g.edges()) {
      // Skip edges involving external stubs
      if (e.v.startsWith('__ext__/') || e.w.startsWith('__ext__/')) continue;
      // Normalize .js/.jsx → .ts/.tsx to match node IDs (TS imports use .js specifiers)
      const src = normalizeExt(e.v);
      const tgt = normalizeExt(e.w);
      // Only include edges where both endpoints exist as nodes
      if (!nodeIdSet.has(src) || !nodeIdSet.has(tgt)) continue;
      edges.push({
        id: `${src}->${tgt}`,
        sourceId: src,
        targetId: tgt,
        edgeType: 'imports_depends_on',
      });
    }

    return { nodes, edges };
  }

  // ---------------------------------------------------------------------------
  // Private — batch consolidation
  // ---------------------------------------------------------------------------

  /** Drains pendingBatches and triggers the full update pipeline. */
  private flushPending(): void {
    const batches = this.pendingBatches.splice(0); // drain atomically
    this.consolidateTimer = null;

    if (batches.length === 0) return;

    const triggerFiles = batches.flatMap((b) =>
      b.results.map((r) => r.filePath),
    );

    this.applyBatches(batches, triggerFiles);
  }

  // ---------------------------------------------------------------------------
  // Private — main update logic
  // ---------------------------------------------------------------------------

  /**
   * Applies all accumulated batches to the in-memory graph, computes the
   * consolidated GraphDelta, detects cycle changes, increments the version
   * counter, and emits the 'delta' event.
   */
  private applyBatches(batches: ParseBatchResult[], triggerFiles: string[]): void {
    const delta: MutableDelta = {
      addedNodes: [],
      removedNodeIds: [],
      modifiedNodes: [],
      addedEdges: [],
      removedEdgeIds: [],
      cyclesAdded: [],
      cyclesRemoved: [],
    };

    for (const batch of batches) {
      for (const result of batch.results) {
        if ('type' in result && result.type === 'removed') {
          this.processRemoval((result as FileRemoved).filePath, delta);
        } else {
          this.processFile(result as ParseResult, delta);
        }
      }
    }

    // Detect cycle changes ONCE after all files in batch are processed.
    this.detectCycleChanges(delta);

    // Increment version and build the final GraphDelta.
    this.version += 1;

    const graphDelta: GraphDelta = {
      version: this.version,
      addedNodes: delta.addedNodes,
      removedNodeIds: delta.removedNodeIds,
      modifiedNodes: delta.modifiedNodes,
      addedEdges: delta.addedEdges,
      removedEdgeIds: delta.removedEdgeIds,
      cyclesAdded: delta.cyclesAdded,
      cyclesRemoved: delta.cyclesRemoved,
      triggerFiles,
      timestamp: Date.now(),
    };

    // Call the extensibility hook (Plan 02 will override for persistence).
    this.onDeltaComputed(graphDelta);

    // Emit typed 'delta' event for all downstream subscribers.
    this.emit('delta', graphDelta);
  }

  // ---------------------------------------------------------------------------
  // Private — per-file incremental update
  // ---------------------------------------------------------------------------

  /**
   * Applies an incremental node/edge update for a single parsed file.
   * - Upserts the node (add if new, update if exports changed, skip if unchanged).
   * - Recomputes outgoing edges from import declarations.
   * - Tracks all mutations in the mutable delta builder.
   */
  private processFile(result: ParseResult, delta: MutableDelta): void {
    const nodeId = result.filePath;
    const prev = this.prevFileResults.get(nodeId);

    // --- Node upsert ---
    if (!this.g.hasNode(nodeId)) {
      this.g.setNode(nodeId, this.buildNodeMetadata(result));
      delta.addedNodes.push(nodeId);
    } else if (this.exportsChanged(prev, result)) {
      this.g.setNode(nodeId, this.buildNodeMetadata(result));
      delta.modifiedNodes.push(nodeId);
    }
    // else: node unchanged — no-op (incremental correctness)

    // --- Edge reconciliation ---
    // Build the desired edge set: Map<targetId, string[]> aggregating all
    // symbols imported from the same target. Single edge per file pair.
    const desiredEdges = new Map<string, string[]>();
    for (const imp of result.imports) {
      const targetId = this.resolveImportTarget(nodeId, imp.source);
      const existing = desiredEdges.get(targetId);
      // ImportInfo.source may or may not carry symbol names; we use the
      // import specifier as a symbol proxy when explicit names are unavailable.
      // The import source itself is recorded so edges have non-empty symbols.
      const symbolEntry = imp.source;
      if (existing) {
        if (!existing.includes(symbolEntry)) {
          existing.push(symbolEntry);
        }
      } else {
        desiredEdges.set(targetId, [symbolEntry]);
      }
    }

    // Ensure external/stub target nodes exist so edges are never dangling.
    for (const targetId of desiredEdges.keys()) {
      if (!this.g.hasNode(targetId)) {
        // Stub node — will be populated when the file is parsed, or stays
        // as an external stub for node_modules and built-ins.
        this.g.setNode(targetId);
      }
    }

    // Remove edges that are no longer present.
    const currentOutEdges = this.g.outEdges(nodeId) ?? [];
    for (const edge of currentOutEdges) {
      if (!desiredEdges.has(edge.w)) {
        this.g.removeEdge(edge.v, edge.w);
        delta.removedEdgeIds.push(`${edge.v}->${edge.w}`);
      }
    }

    // Add new edges (skip those already present — setEdge would silently
    // update; we need to distinguish add vs update for the delta).
    for (const [targetId, symbols] of desiredEdges) {
      if (!this.g.hasEdge(nodeId, targetId)) {
        const edgeLabel: EdgeMetadata = { symbols };
        this.g.setEdge(nodeId, targetId, edgeLabel);
        delta.addedEdges.push({ v: nodeId, w: targetId, symbols });
      } else {
        // Edge already exists — update the symbols label silently (no delta
        // entry needed for symbol-only updates within an existing edge).
        const edgeLabel: EdgeMetadata = { symbols };
        this.g.setEdge(nodeId, targetId, edgeLabel);
      }
    }

    // Update the previous-state snapshot for the next incremental diff.
    this.prevFileResults.set(nodeId, result);
  }

  /**
   * Removes a file's node and all incident edges from the graph.
   * Graphlib's removeNode automatically removes all incident edges.
   */
  private processRemoval(filePath: string, delta: MutableDelta): void {
    if (!this.g.hasNode(filePath)) return;

    // Capture all incident edge IDs before removal.
    const outEdges = this.g.outEdges(filePath) ?? [];
    const inEdges = this.g.inEdges(filePath) ?? [];
    for (const edge of outEdges) {
      delta.removedEdgeIds.push(`${edge.v}->${edge.w}`);
    }
    for (const edge of inEdges) {
      delta.removedEdgeIds.push(`${edge.v}->${edge.w}`);
    }

    // removeNode also removes all incident edges in graphlib.
    this.g.removeNode(filePath);
    delta.removedNodeIds.push(filePath);
    this.prevFileResults.delete(filePath);
  }

  // ---------------------------------------------------------------------------
  // Private — cycle detection
  // ---------------------------------------------------------------------------

  /**
   * Runs cycle detection on the current graph state and diffs against the
   * previously known cycle set to populate delta.cyclesAdded and
   * delta.cyclesRemoved.
   *
   * Called ONCE per flush, after all file mutations are applied.
   */
  private detectCycleChanges(delta: MutableDelta): void {
    // graphlib.alg.findCycles returns string[][] (Tarjan SCC)
    const rawCycles: string[][] = graphlib.alg.findCycles(this.g);

    // Canonicalize each cycle to a stable string key for set comparison.
    const currentCycleKeys = new Map<string, string[]>();
    for (const cycle of rawCycles) {
      const key = canonicalizeCycle(cycle);
      currentCycleKeys.set(key, cycle);
    }

    // Detect newly added cycles.
    for (const [key, cycleNodes] of currentCycleKeys) {
      if (!this.activeCycles.has(key)) {
        delta.cyclesAdded.push({
          path: cycleNodes,
          severity: this.computeCycleSeverity(cycleNodes),
        });
      }
    }

    // Detect removed cycles.
    for (const key of this.activeCycles) {
      if (!currentCycleKeys.has(key)) {
        // Cycle no longer exists — severity is informational (LOW).
        const cycleNodes = key.split(' -> ');
        delta.cyclesRemoved.push({
          path: cycleNodes,
          severity: CycleSeverity.LOW,
        });
      }
    }

    // Update the active cycle set.
    this.activeCycles = new Set(currentCycleKeys.keys());
  }

  /**
   * Computes cycle severity using the sum of in-degrees for all nodes in the
   * cycle as the centrality proxy (higher = more dependents affected = higher
   * severity).
   *
   * Thresholds per RESEARCH.md recommendation:
   *   - HIGH   : total in-degree >= 10
   *   - MEDIUM : total in-degree >= 4
   *   - LOW    : total in-degree < 4
   */
  private computeCycleSeverity(cycleNodes: string[]): CycleSeverity {
    const totalInDegree = cycleNodes.reduce((sum, nodeId) => {
      return sum + (this.g.inEdges(nodeId)?.length ?? 0);
    }, 0);

    if (totalInDegree >= HIGH_SEVERITY_THRESHOLD) return CycleSeverity.HIGH;
    if (totalInDegree >= MEDIUM_SEVERITY_THRESHOLD) return CycleSeverity.MEDIUM;
    return CycleSeverity.LOW;
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds a NodeMetadata object from a ParseResult.
   * Stores the file path, language, exported names, and last-modified time.
   */
  private buildNodeMetadata(result: ParseResult): NodeMetadata {
    return {
      filePath: result.filePath,
      language: result.language,
      exports: result.exports.map((e) => e.name),
      lastModified: Date.now(),
    };
  }

  /**
   * Returns true if the exports list changed between the previous and current
   * parse results. Uses sorted name comparison for stability.
   */
  private exportsChanged(
    prev: ParseResult | undefined,
    current: ParseResult,
  ): boolean {
    if (!prev) return false; // New node — not a modification
    const prevNames = prev.exports.map((e) => e.name).sort();
    const currNames = current.exports.map((e) => e.name).sort();
    if (prevNames.length !== currNames.length) return true;
    return prevNames.some((name, i) => name !== currNames[i]);
  }

  /**
   * Resolves an import specifier to a canonical graph node ID.
   *
   * - Relative imports (`.` or `..` prefix): resolved against the importing
   *   file's directory using posix path semantics (FileWatcher normalizes all
   *   paths to forward slashes). Adds `.ts` extension if missing.
   * - Non-relative imports (bare specifiers, `node:` built-ins): mapped to
   *   external stub nodes with the `__ext__/` prefix.
   */
  private resolveImportTarget(fromFile: string, importSource: string): string {
    return resolveImportTarget(fromFile, importSource);
  }

  // ---------------------------------------------------------------------------
  // Protected extensibility hook — overridden here with SQLite write-through
  // ---------------------------------------------------------------------------

  /**
   * Called with every computed GraphDelta before the 'delta' event is emitted.
   * Persists the delta to SQLite atomically via a single transaction so that
   * the database is always at least as up-to-date as the in-memory graph.
   *
   * Crash safety: writing before emit means a crash mid-emit leaves the DB in
   * the pre-crash state, which is the most recent correct persisted state.
   */
  protected onDeltaComputed(delta: GraphDelta): void {
    persistDelta(
      delta,
      (id) => this.getNodeMetadata(id),
      {
        getInDegree: (id) => this.g.inEdges(id)?.length ?? 0,
        getOutDegree: (id) => this.g.outEdges(id)?.length ?? 0,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Public — database load on startup
  // ---------------------------------------------------------------------------

  /**
   * Resets all in-memory graph state to an empty baseline.
   *
   * Called by the watchRoot plugin when switching the watched directory.
   * Does NOT emit a delta event — the caller handles client notification.
   * Does NOT touch SQLite — the caller handles DB purge separately.
   */
  reset(): void {
    // Clear all nodes (graphlib automatically removes incident edges)
    for (const n of this.g.nodes()) {
      this.g.removeNode(n);
    }

    // Clear incremental diffing state
    this.prevFileResults = new Map();

    // Clear cycle tracking
    this.activeCycles = new Set();

    // Clear consolidation timer to avoid stale batches firing after reset
    if (this.consolidateTimer !== null) {
      clearTimeout(this.consolidateTimer);
      this.consolidateTimer = null;
    }

    // Drain pending batches accumulated before reset
    this.pendingBatches = [];

    // Reset version counter
    this.version = 0;
  }

  /**
   * Loads previously persisted graph state from SQLite into the in-memory graph.
   *
   * Must be called BEFORE pipeline.start() so the graph reflects the prior
   * session's state before chokidar begins emitting 'add' events for the
   * initial directory scan.
   *
   * After loading, chokidar's ignoreInitial:false initial scan will re-parse
   * all files, causing DependencyGraph to apply incremental updates on top of
   * the loaded state — repopulating node metadata, exports, and edge symbols.
   */
  loadFromDatabase(): void {
    const { nodes, edges } = loadGraphState();

    for (const { id, metadata } of nodes) {
      this.g.setNode(id, metadata);
    }

    for (const { source, target, symbols } of edges) {
      // Ensure both endpoint nodes exist (they should from the nodes pass above,
      // but guard in case of any DB inconsistency).
      if (!this.g.hasNode(source)) this.g.setNode(source);
      if (!this.g.hasNode(target)) this.g.setNode(target);
      this.g.setEdge(source, target, { symbols });
    }

    // Rebuild active cycle set from the loaded graph so cycle diffs are correct
    // during the first delta after startup.
    const rawCycles: string[][] = graphlib.alg.findCycles(this.g);
    this.activeCycles = new Set(rawCycles.map(canonicalizeCycle));

    console.log(
      `[DependencyGraph] Loaded ${nodes.length} nodes, ${edges.length} edges from SQLite`,
    );
  }
}

// ---------------------------------------------------------------------------
// Module-level pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Canonicalizes a cycle node array to a stable string key by rotating so the
 * lexicographically smallest node ID appears first, then joining with ' -> '.
 *
 * This prevents the same cycle from being treated as two different cycles
 * when Tarjan's SCC returns the nodes in different rotation orders across
 * successive calls.
 */
/**
 * Normalizes .js/.jsx extensions to .ts/.tsx to match node IDs.
 * TypeScript imports use .js specifiers per ESM convention, but node IDs use .ts.
 */
export function normalizeExt(id: string): string {
  if (id.endsWith('.js')) return id.slice(0, -3) + '.ts';
  if (id.endsWith('.jsx')) return id.slice(0, -4) + '.tsx';
  return id;
}

export function canonicalizeCycle(nodes: string[]): string {
  if (nodes.length === 0) return '';
  const minNode = nodes.reduce((a, b) => (a < b ? a : b));
  const minIdx = nodes.indexOf(minNode);
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  return rotated.join(' -> ');
}

/**
 * Resolves an import specifier to a canonical graph node ID.
 *
 * Exported as a standalone function so it can be unit-tested independently.
 */
export function resolveImportTarget(fromFile: string, importSource: string): string {
  if (importSource.startsWith('./') || importSource.startsWith('../')) {
    // Relative import — resolve against the importing file's directory.
    const fromDir = path.posix.dirname(fromFile);
    let resolved = path.posix.normalize(path.posix.join(fromDir, importSource));

    // Add .ts extension if no extension is present. TypeScript files import
    // each other without extensions in source (e.g., './auth.service').
    const hasExtension = path.posix.extname(resolved) !== '';
    if (!hasExtension) {
      resolved = resolved + '.ts';
    }

    return resolved;
  }

  // Non-relative: bare specifier (npm package, `node:` built-in, workspace package).
  // Normalize 'node:fs' → '__ext__/node:fs', 'express' → '__ext__/express'.
  return `__ext__/${importSource}`;
}
