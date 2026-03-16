import { EventEmitter } from 'node:events';
import type { ParseBatchResult } from '@archlens/shared/types';
import type { GraphDelta, GraphDeltaEdge, NodeMetadata } from '@archlens/shared/types';
interface DependencyGraphEvents {
    delta: [delta: GraphDelta];
}
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
export declare class DependencyGraph extends EventEmitter<DependencyGraphEvents> {
    /** The in-memory directed graph (non-multigraph, non-compound). */
    private readonly g;
    /** Monotonic delta version counter — increments per flush. */
    private version;
    /** Previous ParseResult per file for incremental diffing. */
    private prevFileResults;
    /**
     * Canonicalized cycle strings for diff detection.
     * Format: lexicographically-rotated node IDs joined with ' -> '.
     */
    private activeCycles;
    /** Batches waiting to be consolidated within the debounce window. */
    private pendingBatches;
    /** The active consolidation timer handle, or null if idle. */
    private consolidateTimer;
    /** Debounce window in milliseconds for batch consolidation. */
    private readonly CONSOLIDATE_MS;
    constructor();
    /**
     * Entry point from the Pipeline. Pushes batch into the pending accumulator
     * and resets the consolidation timer. All batches arriving within
     * CONSOLIDATE_MS of each other will be processed together as a single delta.
     */
    onParseResult(batch: ParseBatchResult): void;
    /** Returns the current delta version counter. */
    getVersion(): number;
    /** Returns the number of nodes in the graph. */
    getNodeCount(): number;
    /** Returns the number of edges in the graph. */
    getEdgeCount(): number;
    /** Returns true if the graph has a node with the given ID. */
    hasNode(id: string): boolean;
    /**
     * Returns the NodeMetadata for the given node ID, or undefined if not found.
     */
    getNodeMetadata(id: string): NodeMetadata | undefined;
    /**
     * Returns the predecessor node IDs for the given node — i.e. nodes that
     * have edges pointing TO nodeId (files that import this file).
     */
    getPredecessors(nodeId: string): string[];
    /**
     * Returns the successor node IDs for the given node — i.e. nodes that
     * nodeId has edges pointing TO (files this node imports).
     */
    getSuccessors(nodeId: string): string[];
    /**
     * Returns the number of outgoing edges from the given node.
     */
    getOutDegree(nodeId: string): number;
    /**
     * Returns the number of incoming edges to the given node.
     */
    getInDegree(nodeId: string): number;
    /**
     * Returns the outgoing edges from nodeId with their edge metadata (symbols).
     * Needed by the inference engine for topology-based zone classification.
     */
    getOutEdges(nodeId: string): GraphDeltaEdge[];
    /**
     * Returns all node IDs currently in the graph.
     * Needed for re-evaluating unknown-zone nodes after neighbor classification.
     */
    getAllNodeIds(): string[];
    /** Drains pendingBatches and triggers the full update pipeline. */
    private flushPending;
    /**
     * Applies all accumulated batches to the in-memory graph, computes the
     * consolidated GraphDelta, detects cycle changes, increments the version
     * counter, and emits the 'delta' event.
     */
    private applyBatches;
    /**
     * Applies an incremental node/edge update for a single parsed file.
     * - Upserts the node (add if new, update if exports changed, skip if unchanged).
     * - Recomputes outgoing edges from import declarations.
     * - Tracks all mutations in the mutable delta builder.
     */
    private processFile;
    /**
     * Removes a file's node and all incident edges from the graph.
     * Graphlib's removeNode automatically removes all incident edges.
     */
    private processRemoval;
    /**
     * Runs cycle detection on the current graph state and diffs against the
     * previously known cycle set to populate delta.cyclesAdded and
     * delta.cyclesRemoved.
     *
     * Called ONCE per flush, after all file mutations are applied.
     */
    private detectCycleChanges;
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
    private computeCycleSeverity;
    /**
     * Builds a NodeMetadata object from a ParseResult.
     * Stores the file path, language, exported names, and last-modified time.
     */
    private buildNodeMetadata;
    /**
     * Returns true if the exports list changed between the previous and current
     * parse results. Uses sorted name comparison for stability.
     */
    private exportsChanged;
    /**
     * Resolves an import specifier to a canonical graph node ID.
     *
     * - Relative imports (`.` or `..` prefix): resolved against the importing
     *   file's directory using posix path semantics (FileWatcher normalizes all
     *   paths to forward slashes). Adds `.ts` extension if missing.
     * - Non-relative imports (bare specifiers, `node:` built-ins): mapped to
     *   external stub nodes with the `__ext__/` prefix.
     */
    private resolveImportTarget;
    /**
     * Called with every computed GraphDelta before the 'delta' event is emitted.
     * Persists the delta to SQLite atomically via a single transaction so that
     * the database is always at least as up-to-date as the in-memory graph.
     *
     * Crash safety: writing before emit means a crash mid-emit leaves the DB in
     * the pre-crash state, which is the most recent correct persisted state.
     */
    protected onDeltaComputed(delta: GraphDelta): void;
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
    loadFromDatabase(): void;
}
/**
 * Canonicalizes a cycle node array to a stable string key by rotating so the
 * lexicographically smallest node ID appears first, then joining with ' -> '.
 *
 * This prevents the same cycle from being treated as two different cycles
 * when Tarjan's SCC returns the nodes in different rotation orders across
 * successive calls.
 */
export declare function canonicalizeCycle(nodes: string[]): string;
/**
 * Resolves an import specifier to a canonical graph node ID.
 *
 * Exported as a standalone function so it can be unit-tested independently.
 */
export declare function resolveImportTarget(fromFile: string, importSource: string): string;
export {};
//# sourceMappingURL=DependencyGraph.d.ts.map