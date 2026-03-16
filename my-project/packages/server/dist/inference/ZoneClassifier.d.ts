import type { ZoneName, ZoneUpdate, GraphDelta } from '@archlens/shared/types';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { ConfigLoader } from './ConfigLoader.js';
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
export declare const ZONE_PATH_PATTERNS: {
    zone: ZoneName;
    patterns: RegExp[];
}[];
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
export declare class ZoneClassifier {
    private readonly configLoader;
    private readonly graph;
    /** Quick-lookup cache of node ID -> classified zone (in-memory only). */
    private readonly zoneCache;
    constructor(configLoader: ConfigLoader, graph: DependencyGraph);
    /**
     * Classifies a single node using override -> path -> topology priority.
     *
     * Returns 'unknown' if no signal can determine the zone.
     */
    classify(nodeId: string): ZoneName;
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
    classifyDelta(delta: GraphDelta): ZoneUpdate[];
    /**
     * Seeds the zone cache from a SQLite-loaded zone on startup.
     * Called by InferenceEngine to pre-populate zoneCache before the first delta
     * arrives, so topology classification sees the prior session's state.
     */
    updateZoneCache(nodeId: string, zone: ZoneName): void;
    /**
     * Classifies a node by matching its path against ZONE_PATH_PATTERNS.
     * Returns the first matching zone, or 'unknown' if no pattern matches.
     */
    private classifyByPath;
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
    private classifyByTopology;
}
//# sourceMappingURL=ZoneClassifier.d.ts.map