import path from 'node:path';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { graphNodes, graphEdges } from '../db/schema.js';
import type { GraphDelta, NodeMetadata } from '@archlens/shared/types';
import { NodeType, EdgeType } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// GraphPersistence
// ---------------------------------------------------------------------------
//
// Provides two functions consumed by DependencyGraph:
//
//   persistDelta — write-through a GraphDelta to SQLite atomically.
//   loadGraphState — read all persisted nodes and edges on startup.
//
// All operations are synchronous because better-sqlite3 is synchronous and
// Drizzle wraps it synchronously. db.transaction() ensures each delta is
// written as a single atomic unit — a crash mid-emit leaves the database in
// the pre-delta state, which is the last correctly-persisted state.
// ---------------------------------------------------------------------------

/** Extra graph-level context the persistence layer needs beyond the delta. */
export interface PersistenceContext {
  /** Returns current in-degree for a given node ID from the live graph. */
  getInDegree: (nodeId: string) => number;
  /** Returns current out-degree for a given node ID from the live graph. */
  getOutDegree: (nodeId: string) => number;
}

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
export function persistDelta(
  delta: GraphDelta,
  getNodeMetadata: (id: string) => NodeMetadata | undefined,
  ctx: PersistenceContext,
): void {
  db.transaction((tx) => {
    // ----------------------------------------------------------------
    // 1. Upsert added nodes
    // ----------------------------------------------------------------
    for (const nodeId of delta.addedNodes) {
      const meta = getNodeMetadata(nodeId);
      if (!meta) continue; // stub node (external) — no metadata to persist
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
      if (!meta) continue;
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
        .where(
          or(
            eq(graphEdges.sourceId, nodeId),
            eq(graphEdges.targetId, nodeId),
          ),
        )
        .run();
      tx.delete(graphNodes).where(eq(graphNodes.id, nodeId)).run();
    }
  });
}

// ---------------------------------------------------------------------------
// loadGraphState
// ---------------------------------------------------------------------------

/** Node data returned by loadGraphState for consumption by DependencyGraph. */
export interface PersistedNode {
  id: string;
  metadata: Pick<NodeMetadata, 'filePath' | 'exports' | 'lastModified'> & {
    language: 'ts'; // DB doesn't store language — default to ts on load
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
export function loadGraphState(): GraphStateSnapshot {
  const nodeRows = db.select().from(graphNodes).all();
  const edgeRows = db.select().from(graphEdges).all();

  const nodes: PersistedNode[] = nodeRows.map((row) => ({
    id: row.id,
    metadata: {
      filePath: row.id,
      language: 'ts' as const,
      exports: [],
      lastModified: row.lastModified instanceof Date
        ? row.lastModified.getTime()
        : Number(row.lastModified),
    },
  }));

  const edges: PersistedEdge[] = edgeRows.map((row) => ({
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
function extractName(nodeId: string): string {
  const basename = path.posix.basename(nodeId);
  const extIndex = basename.indexOf('.');
  return extIndex > 0 ? basename.slice(0, extIndex) : basename;
}
