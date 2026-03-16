import type { DependencyGraph } from './DependencyGraph.js';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import { graphNodes } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

// ---------------------------------------------------------------------------
// Name mapping for common directory names → human-readable component names
// ---------------------------------------------------------------------------

const NAME_MAP: Record<string, string> = {
  db: 'Database',
  parser: 'Parser',
  inference: 'Inference Engine',
  graph: 'Graph Engine',
  pipeline: 'Pipeline',
  plugins: 'Plugins',
  watcher: 'File Watcher',
  root: 'Entry Point',
};

// ---------------------------------------------------------------------------
// ComponentAggregator
// ---------------------------------------------------------------------------

/**
 * Transforms a file-level dependency graph into meaningful architectural
 * components grouped by directory path. Each component aggregates files
 * under the same first meaningful directory under src/.
 */
export class ComponentAggregator {
  private readonly graph: DependencyGraph;

  /** Cache of the last computed snapshot for diffing. */
  private lastSnapshot: { nodes: GraphNode[]; edges: GraphEdge[] } | null = null;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Returns the last computed component snapshot, or null if none yet.
   */
  getLastSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
    return this.lastSnapshot;
  }

  /**
   * Aggregates the file-level graph into component-level nodes and edges.
   *
   * Component ID = first meaningful directory under src/ (e.g., src/parser).
   * Files at root (src/index.ts, drizzle.config.ts) get component ID "root".
   * Subdirectories collapse into parent (src/db/repository/nodes.ts → src/db).
   */
  aggregateSnapshot(
    graph: DependencyGraph,
    db: BetterSQLite3Database<typeof schema>,
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    // Get the file-level snapshot
    const fileSnapshot = graph.getSnapshot();

    // Build a zone map from DB
    const zoneMap = new Map<string, string | null>();
    try {
      const rows = db
        .select({ id: graphNodes.id, zone: graphNodes.zone })
        .from(graphNodes)
        .all();
      for (const row of rows) {
        zoneMap.set(row.id, row.zone);
      }
    } catch {
      // DB may not have zones yet
    }

    // Group files into components
    const componentFiles = new Map<string, GraphNode[]>();

    for (const node of fileSnapshot.nodes) {
      const compId = this.fileToComponentId(node.id);
      let files = componentFiles.get(compId);
      if (!files) {
        files = [];
        componentFiles.set(compId, files);
      }
      files.push(node);
    }

    // Build a file→component lookup
    const fileToComp = new Map<string, string>();
    for (const [compId, files] of componentFiles) {
      for (const file of files) {
        fileToComp.set(file.id, compId);
      }
    }

    // Build component nodes
    const nodes: GraphNode[] = [];
    for (const [compId, files] of componentFiles) {
      const fileList = files.map((f) => f.id);
      const zone = this.computeZoneByMajority(files, zoneMap);
      const dirName = compId === 'root' ? 'root' : compId.split('/').pop() ?? compId;
      const name = NAME_MAP[dirName] ?? dirName.charAt(0).toUpperCase() + dirName.slice(1);

      // Collect key exports from file metadata
      const keyExports: string[] = [];
      for (const file of files) {
        const meta = graph.getNodeMetadata(file.id);
        if (meta?.exports) {
          keyExports.push(...meta.exports);
        }
      }
      // Deduplicate and limit
      const uniqueExports = [...new Set(keyExports)].slice(0, 10);

      // Compute edge counts at the component level
      let incomingCount = 0;
      let outgoingCount = 0;

      nodes.push({
        id: compId,
        name,
        nodeType: 'service_module',
        zone,
        fileList,
        incomingEdgeCount: incomingCount, // will be updated after edge computation
        outgoingEdgeCount: outgoingCount,
        lastModified: files.reduce(
          (latest, f) => (f.lastModified > latest ? f.lastModified : latest),
          files[0].lastModified,
        ),
        fileCount: files.length,
        keyExports: uniqueExports,
      });
    }

    // Build component-level edges by counting file-level edges between components
    const edgeCounts = new Map<string, number>();
    for (const edge of fileSnapshot.edges) {
      const srcComp = fileToComp.get(edge.sourceId);
      const tgtComp = fileToComp.get(edge.targetId);
      if (!srcComp || !tgtComp) continue;
      // Skip self-loops (edges within the same component)
      if (srcComp === tgtComp) continue;

      const key = `${srcComp}->${tgtComp}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }

    const edges: GraphEdge[] = [];
    // Track component edge counts for node metadata
    const compIncoming = new Map<string, number>();
    const compOutgoing = new Map<string, number>();

    for (const [key, count] of edgeCounts) {
      const [srcComp, tgtComp] = key.split('->');
      edges.push({
        id: key,
        sourceId: srcComp,
        targetId: tgtComp,
        edgeType: 'imports_depends_on',
        dependencyCount: count,
      });
      compOutgoing.set(srcComp, (compOutgoing.get(srcComp) ?? 0) + 1);
      compIncoming.set(tgtComp, (compIncoming.get(tgtComp) ?? 0) + 1);
    }

    // Update node edge counts
    for (const node of nodes) {
      node.incomingEdgeCount = compIncoming.get(node.id) ?? 0;
      node.outgoingEdgeCount = compOutgoing.get(node.id) ?? 0;
    }

    const snapshot = { nodes, edges };
    this.lastSnapshot = snapshot;
    return snapshot;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Maps a file path to its component ID.
   *
   * Rules:
   * - Files under src/<dir>/... → "src/<dir>"
   * - Files directly in src/ (e.g., src/index.ts) → "root"
   * - Files at project root (e.g., drizzle.config.ts) → "root"
   */
  private fileToComponentId(filePath: string): string {
    const parts = filePath.split('/');

    // Find the src/ segment
    const srcIdx = parts.indexOf('src');
    if (srcIdx === -1) {
      // No src/ in path — root component
      return 'root';
    }

    // If src is the last directory and the next part is a file
    // (e.g., src/index.ts) → root
    if (srcIdx + 1 >= parts.length - 1) {
      // File is directly in src/ or src is the file itself
      const nextPart = parts[srcIdx + 1];
      if (!nextPart || nextPart.includes('.')) {
        return 'root';
      }
    }

    // First meaningful directory under src/
    const dirAfterSrc = parts[srcIdx + 1];
    if (!dirAfterSrc || dirAfterSrc.includes('.')) {
      return 'root';
    }

    return `src/${dirAfterSrc}`;
  }

  /**
   * Computes zone by majority vote across files in a component.
   * Falls back to null if no zones are assigned.
   */
  private computeZoneByMajority(
    files: GraphNode[],
    zoneMap: Map<string, string | null>,
  ): string | null {
    const zoneCounts = new Map<string, number>();

    for (const file of files) {
      const zone = zoneMap.get(file.id) ?? file.zone;
      if (zone) {
        zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
      }
    }

    if (zoneCounts.size === 0) return null;

    // Return the zone with the highest count
    let bestZone: string | null = null;
    let bestCount = 0;
    for (const [zone, count] of zoneCounts) {
      if (count > bestCount) {
        bestZone = zone;
        bestCount = count;
      }
    }

    return bestZone;
  }
}
