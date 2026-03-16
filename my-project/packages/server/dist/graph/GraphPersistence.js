import path from 'node:path';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { graphNodes, graphEdges } from '../db/schema.js';
import { NodeType, EdgeType } from '@archlens/shared/types';
// ---------------------------------------------------------------------------
// persistDelta
// ---------------------------------------------------------------------------
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
export function persistDelta(delta, getNodeMetadata, ctx) {
    db.transaction((tx) => {
        // ----------------------------------------------------------------
        // 1. Upsert added nodes
        // ----------------------------------------------------------------
        for (const nodeId of delta.addedNodes) {
            const meta = getNodeMetadata(nodeId);
            if (!meta)
                continue; // stub node (external) — no metadata to persist
            tx
                .insert(graphNodes)
                .values({
                id: nodeId,
                name: extractName(nodeId),
                nodeType: NodeType.SERVICE_MODULE,
                zone: null,
                fileList: [nodeId],
                incomingEdgeCount: ctx.getInDegree(nodeId),
                outgoingEdgeCount: ctx.getOutDegree(nodeId),
                lastModified: new Date(meta.lastModified),
                createdAt: new Date(),
            })
                .onConflictDoUpdate({
                target: graphNodes.id,
                set: {
                    name: extractName(nodeId),
                    nodeType: NodeType.SERVICE_MODULE,
                    zone: null,
                    fileList: [nodeId],
                    incomingEdgeCount: ctx.getInDegree(nodeId),
                    outgoingEdgeCount: ctx.getOutDegree(nodeId),
                    lastModified: new Date(meta.lastModified),
                },
            })
                .run();
        }
        // ----------------------------------------------------------------
        // 2. Upsert modified nodes
        // ----------------------------------------------------------------
        for (const nodeId of delta.modifiedNodes) {
            const meta = getNodeMetadata(nodeId);
            if (!meta)
                continue;
            tx
                .insert(graphNodes)
                .values({
                id: nodeId,
                name: extractName(nodeId),
                nodeType: NodeType.SERVICE_MODULE,
                zone: null,
                fileList: [nodeId],
                incomingEdgeCount: ctx.getInDegree(nodeId),
                outgoingEdgeCount: ctx.getOutDegree(nodeId),
                lastModified: new Date(meta.lastModified),
                createdAt: new Date(),
            })
                .onConflictDoUpdate({
                target: graphNodes.id,
                set: {
                    name: extractName(nodeId),
                    nodeType: NodeType.SERVICE_MODULE,
                    zone: null,
                    fileList: [nodeId],
                    incomingEdgeCount: ctx.getInDegree(nodeId),
                    outgoingEdgeCount: ctx.getOutDegree(nodeId),
                    lastModified: new Date(meta.lastModified),
                },
            })
                .run();
        }
        // ----------------------------------------------------------------
        // 3. Insert added edges
        // ----------------------------------------------------------------
        for (const edge of delta.addedEdges) {
            // Skip edges to/from external stub nodes — they have no DB row.
            // External stubs use the __ext__/ prefix and are not persisted.
            if (edge.v.startsWith('__ext__/') || edge.w.startsWith('__ext__/')) {
                continue;
            }
            tx
                .insert(graphEdges)
                .values({
                id: `${edge.v}->${edge.w}`,
                sourceId: edge.v,
                targetId: edge.w,
                edgeType: EdgeType.IMPORTS_DEPENDS_ON,
                createdAt: new Date(),
            })
                .onConflictDoUpdate({
                target: graphEdges.id,
                set: {
                    edgeType: EdgeType.IMPORTS_DEPENDS_ON,
                },
            })
                .run();
        }
        // ----------------------------------------------------------------
        // 4. Delete removed edges (before node deletion for FK safety)
        // ----------------------------------------------------------------
        for (const edgeId of delta.removedEdgeIds) {
            tx.delete(graphEdges).where(eq(graphEdges.id, edgeId)).run();
        }
        // ----------------------------------------------------------------
        // 5. Delete removed nodes (edges were already removed above or by
        //    step 4 — the preemptive edge delete handles incident edges for
        //    nodes whose incident edges may not all appear in removedEdgeIds)
        // ----------------------------------------------------------------
        for (const nodeId of delta.removedNodeIds) {
            // Delete all incident edges first (in case some weren't in removedEdgeIds)
            tx
                .delete(graphEdges)
                .where(or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId)))
                .run();
            tx.delete(graphNodes).where(eq(graphNodes.id, nodeId)).run();
        }
    });
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
export function loadGraphState() {
    const nodeRows = db.select().from(graphNodes).all();
    const edgeRows = db.select().from(graphEdges).all();
    const nodes = nodeRows.map((row) => ({
        id: row.id,
        metadata: {
            filePath: row.id,
            language: 'ts',
            exports: [],
            lastModified: row.lastModified instanceof Date
                ? row.lastModified.getTime()
                : Number(row.lastModified),
        },
    }));
    const edges = edgeRows.map((row) => ({
        source: row.sourceId,
        target: row.targetId,
        symbols: [], // repopulated on initial parse scan
    }));
    return { nodes, edges };
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/**
 * Extracts a human-readable name from a node ID (file path).
 * Returns the filename without extension, e.g. 'auth.service' from
 * 'packages/server/src/auth/auth.service.ts'.
 */
function extractName(nodeId) {
    const basename = path.posix.basename(nodeId);
    const extIndex = basename.indexOf('.');
    return extIndex > 0 ? basename.slice(0, extIndex) : basename;
}
//# sourceMappingURL=GraphPersistence.js.map