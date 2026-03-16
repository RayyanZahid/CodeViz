import { EventEmitter } from 'node:events';
import type { InferenceResult } from '@archlens/shared/types';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
interface InferenceEngineEvents {
    inference: [result: InferenceResult];
}
/**
 * InferenceEngine orchestrates the full inference pipeline for every
 * GraphDelta produced by DependencyGraph:
 *
 * 1. ZoneClassifier — assigns semantic zones to file nodes.
 * 2. Persistence — updates the zone column on graph_nodes rows and appends
 *    zone_changed events to changeEvents table in SQLite.
 * 3. EventCorroborator — fires ArchitecturalEvents after reaching threshold=2.
 * 4. RiskDetector — detects circular dependencies, boundary violations,
 *    and excessive fan-out.
 * 5. Emits a typed 'inference' event for downstream consumers (Phase 5 WebSocket).
 *
 * Design decisions:
 * - All operations are synchronous and O(edges) worst case — no async needed.
 * - Zone updates to SQLite are fire-and-forget (no transaction coupling with
 *   Phase 3's graph persistence).
 * - InferenceEngine does NOT own graph structure writes — only zone column
 *   updates and changeEvent logging.
 */
export declare class InferenceEngine extends EventEmitter<InferenceEngineEvents> {
    /** ConfigLoader for .archlens.json zone overrides — owns the chokidar watcher. */
    private readonly configLoader;
    /** ZoneClassifier — path-first, topology-second, override-first classification. */
    private readonly classifier;
    /** EventCorroborator — threshold=2 multi-signal event accumulation. */
    private readonly corroborator;
    /** RiskDetector — stateless cycle, boundary violation, fan-out detection. */
    private readonly riskDetector;
    /** Reference to the dependency graph for zone lookups and edge traversal. */
    private readonly graph;
    /**
     * Creates an InferenceEngine and subscribes to graph delta events.
     *
     * @param graph     - The DependencyGraph instance to subscribe to.
     * @param watchRoot - Project root directory for .archlens.json discovery.
     */
    constructor(graph: DependencyGraph, watchRoot: string);
    /**
     * Seeds the ZoneClassifier cache from SQLite-persisted zones on startup.
     *
     * Must be called BEFORE pipeline.start() so the classifier cache reflects
     * the prior session's state. Without this call, every node starts as
     * 'unknown' and topology classification degrades until zones are re-learned.
     */
    loadPersistedZones(): void;
    /**
     * Stops the ConfigLoader's chokidar watcher for graceful shutdown.
     * Must be called in the server's onClose hook.
     */
    destroy(): void;
    /**
     * Core delta processing pipeline — called for every GraphDelta emitted by
     * DependencyGraph.
     *
     * Pipeline:
     * 1. Zone classification via ZoneClassifier.classifyDelta().
     * 2. Persist zone updates to SQLite (zone column + zone_changed events).
     * 3. Event corroboration via EventCorroborator.processDelta().
     * 4. Risk detection via RiskDetector.detectRisks().
     * 5. Emit typed 'inference' event if there's anything to report.
     */
    private processDelta;
    /**
     * Returns the zone for a given node from the ZoneClassifier's in-memory
     * cache. Falls back to 'unknown' if the node has no cached zone.
     *
     * Used as the getZone callback passed to RiskDetector.detectRisks().
     */
    private getZoneForNode;
}
export {};
//# sourceMappingURL=InferenceEngine.d.ts.map