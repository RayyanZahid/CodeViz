import type { ZoneName, ZoneUpdate, GraphDelta } from '@archlens/shared/types';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { ConfigLoader } from './ConfigLoader.js';

// ---------------------------------------------------------------------------
// ZONE_PATH_PATTERNS
// ---------------------------------------------------------------------------

/**
 * Ordered array of zone-to-pattern mappings.
 *
 * Each entry specifies a ZoneName and an array of RegExp patterns. Patterns are
 * tested against the full node ID (project-relative file path). The first zone
 * whose ANY pattern matches the nodeId wins.
 *
 * Order matters: more specific zones appear before broader ones.
 * - frontend before infrastructure (both can match TS/TSX files)
 * - data-stores before services (both can match domain-sounding paths)
 *
 * Per locked decisions (RESEARCH.md):
 * - No framework-specific detection (no Next.js, Express, FastAPI patterns).
 * - Path wins over topology when the two signals conflict.
 * - __ext__/ prefix identifies external stub nodes from Phase 3.
 */
export const ZONE_PATH_PATTERNS: { zone: ZoneName; patterns: RegExp[] }[] = [
  {
    zone: 'frontend',
    patterns: [
      /\/(components?|pages?|views?|ui|screens?|layouts?)\//i,
      /\/(hooks?|contexts?)\//i,
      /\.(tsx|jsx)$/i,
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
      /\/(graph|inference|engine|parser|pipeline|watcher|analyzer)\//i,
      /\/(core|logic|modules?)\//i,
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
      /^__ext__\//,
    ],
  },
];

// ---------------------------------------------------------------------------
// ZoneClassifier
// ---------------------------------------------------------------------------

/**
 * ZoneClassifier assigns semantic zones to file nodes using a two-signal
 * strategy:
 *
 * 1. **Config override** — .archlens.json takes absolute precedence (ARCH-06).
 * 2. **Path classification** — ZONE_PATH_PATTERNS matched against the node ID.
 *    Path wins when it yields a non-unknown result (locked decision: "When path
 *    says API but imports say frontend, path wins the tie.").
 * 3. **Topology classification** — majority-vote over already-classified
 *    neighbors in zoneCache. Used only when path yields 'unknown'.
 *
 * The classifier processes deltas in two passes:
 * - Pass 1: classify all added/modified nodes (populates zoneCache).
 * - Pass 2: re-evaluate previously-'unknown' nodes whose neighbors were just
 *   classified in Pass 1 (implements "unknown nodes are re-evaluated when
 *   neighbors become classified").
 *
 * Important: topology classification uses the in-memory zoneCache only — not
 * SQLite — to avoid stale data during the initial burst of deltas on startup.
 */
export class ZoneClassifier {
  /** Quick-lookup cache of node ID -> classified zone (in-memory only). */
  private readonly zoneCache: Map<string, ZoneName> = new Map();

  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly graph: DependencyGraph,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Classifies a single node using override -> path -> topology priority.
   *
   * Returns 'unknown' if no signal can determine the zone.
   */
  classify(nodeId: string): ZoneName {
    // 1. User override takes absolute precedence (ARCH-06).
    const override = this.configLoader.getOverride(nodeId);
    if (override !== null) return override;

    // 2. Path classification — the primary automated signal.
    const pathZone = this.classifyByPath(nodeId);
    if (pathZone !== 'unknown') return pathZone;

    // 3. Topology classification — secondary, only when path yields unknown.
    const topoZone = this.classifyByTopology(nodeId);
    if (topoZone !== null) return topoZone;

    return 'unknown';
  }

  /**
   * Main entry point called by InferenceEngine after a GraphDelta arrives.
   *
   * Two-pass algorithm:
   * - Pass 1: classify all added/modified nodes via classify(). Update zoneCache
   *   immediately after each node so Pass 2 (and within-Pass-1 topology checks)
   *   can use the latest data.
   * - Pass 2: re-evaluate all 'unknown' nodes in zoneCache whose neighbors were
   *   newly classified to non-unknown in Pass 1.
   *
   * Returns only ZoneUpdate objects where the zone actually changed.
   */
  classifyDelta(delta: GraphDelta): ZoneUpdate[] {
    const updates: ZoneUpdate[] = [];

    // Pass 1 — classify added and modified nodes.
    const pass1Classified = new Set<string>(); // tracks nodes that changed to non-unknown in Pass 1

    for (const nodeId of [...delta.addedNodes, ...delta.modifiedNodes]) {
      const previousZone = this.zoneCache.get(nodeId) ?? null;
      const newZone = this.classify(nodeId);

      // Update cache immediately so subsequent topology lookups in this pass
      // (and in Pass 2) see the latest classification.
      this.zoneCache.set(nodeId, newZone);

      if (newZone !== previousZone) {
        updates.push({ nodeId, zone: newZone, previousZone });
        if (newZone !== 'unknown') {
          pass1Classified.add(nodeId);
        }
      }
    }

    // Pass 2 — re-evaluate unknown nodes whose neighbors were just classified.
    if (pass1Classified.size > 0) {
      for (const [nodeId, cachedZone] of this.zoneCache) {
        if (cachedZone !== 'unknown') continue; // only re-evaluate unknowns

        // Check if any neighbor of this node was classified in Pass 1.
        const predecessors = this.graph.getPredecessors(nodeId);
        const successors = this.graph.getSuccessors(nodeId);
        const neighbors = [...predecessors, ...successors];

        const hasNewlyClassifiedNeighbor = neighbors.some((n) => pass1Classified.has(n));
        if (!hasNewlyClassifiedNeighbor) continue;

        // Re-classify via topology (path already returned unknown, or we would
        // have cached a non-unknown zone for this node).
        const newZone = this.classifyByTopology(nodeId) ?? 'unknown';
        if (newZone !== 'unknown') {
          this.zoneCache.set(nodeId, newZone);
          updates.push({ nodeId, zone: newZone, previousZone: 'unknown' });
        }
      }
    }

    return updates;
  }

  /**
   * Seeds the zone cache from a SQLite-loaded zone on startup.
   * Called by InferenceEngine to pre-populate zoneCache before the first delta
   * arrives, so topology classification sees the prior session's state.
   */
  updateZoneCache(nodeId: string, zone: ZoneName): void {
    this.zoneCache.set(nodeId, zone);
  }

  // ---------------------------------------------------------------------------
  // Private — classification signals
  // ---------------------------------------------------------------------------

  /**
   * Classifies a node by matching its path against ZONE_PATH_PATTERNS.
   * Returns the first matching zone, or 'unknown' if no pattern matches.
   */
  private classifyByPath(nodeId: string): ZoneName {
    for (const { zone, patterns } of ZONE_PATH_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(nodeId)) {
          return zone;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Classifies a node by majority-vote over its already-classified neighbors
   * in zoneCache.
   *
   * - Uses predecessors + successors from the dependency graph.
   * - Excludes __ext__/ stub nodes (external stubs are already classified
   *   by path and have no informational value for zone inference of internal nodes).
   * - Counts only non-unknown cached zones.
   * - Returns the zone with the most neighbors, or null if no data.
   */
  private classifyByTopology(nodeId: string): ZoneName | null {
    const predecessors = this.graph.getPredecessors(nodeId);
    const successors = this.graph.getSuccessors(nodeId);

    // Combine neighbors, filter out external stubs.
    const neighbors = [...predecessors, ...successors].filter(
      (n) => !n.startsWith('__ext__/'),
    );

    if (neighbors.length === 0) return null;

    // Count zones from cache — exclude unknown.
    const zoneCounts = new Map<ZoneName, number>();
    for (const neighbor of neighbors) {
      const neighborZone = this.zoneCache.get(neighbor);
      if (neighborZone === undefined || neighborZone === 'unknown') continue;
      zoneCounts.set(neighborZone, (zoneCounts.get(neighborZone) ?? 0) + 1);
    }

    if (zoneCounts.size === 0) return null;

    // Return the zone with the highest count (majority vote).
    let topZone: ZoneName | null = null;
    let topCount = 0;
    for (const [zone, count] of zoneCounts) {
      if (count > topCount) {
        topZone = zone;
        topCount = count;
      }
    }

    return topZone;
  }
}
