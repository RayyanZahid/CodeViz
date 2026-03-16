import type { GraphDelta, NodeMetadata } from '@archlens/shared/types';
/** Extra graph-level context the persistence layer needs beyond the delta. */
export interface PersistenceContext {
    /** Returns current in-degree for a given node ID from the live graph. */
    getInDegree: (nodeId: string) => number;
    /** Returns current out-degree for a given node ID from the live graph. */
    getOutDegree: (nodeId: string) => number;
}
/**
 * Writes all mutations in `delta` to SQLite as a single atomic transaction.
 *
 * Ordering within the transaction:
 *   1. Upsert added/modified nodes (FK must exist before edges reference them).
 *   2. Insert added edges (both endpoints must exist).
 *   3. Delete removed edges (before node deletion to satisfy FK constraints).
 *   4. Delete removed nodes (cascades edge removal via the pre-delete step).
 *
 * Called by DependencyGraph.onDeltaComputed() BEFORE the 'delta' event is
 * emitted, so SQLite state is always ahead-of or equal-to in-memory state.
 */
export declare function persistDelta(delta: GraphDelta, getNodeMetadata: (id: string) => NodeMetadata | undefined, ctx: PersistenceContext): void;
/** Node data returned by loadGraphState for consumption by DependencyGraph. */
export interface PersistedNode {
    id: string;
    metadata: Pick<NodeMetadata, 'filePath' | 'exports' | 'lastModified'> & {
        language: 'ts';
    };
}
/** Edge data returned by loadGraphState for consumption by DependencyGraph. */
export interface PersistedEdge {
    source: string;
    target: string;
    symbols: string[];
}
/** Result shape returned from loadGraphState. */
export interface GraphStateSnapshot {
    nodes: PersistedNode[];
    edges: PersistedEdge[];
}
/**
 * Reads all persisted nodes and edges from SQLite.
 *
 * Called once on DependencyGraph startup before the Pipeline starts watching,
 * so the in-memory graph reflects the last known state from previous sessions.
 *
 * Notes on partial data:
 * - `language` is not stored in the DB schema; defaults to 'ts' for all loaded
 *   nodes. The correct language is restored when chokidar re-emits the initial
 *   'add' events (ignoreInitial: false), triggering a re-parse of each file.
 * - `exports` are likewise empty on load — repopulated during the initial scan.
 * - `symbols` on edges are empty on load — repopulated when files are re-parsed.
 */
export declare function loadGraphState(): GraphStateSnapshot;
//# sourceMappingURL=GraphPersistence.d.ts.map