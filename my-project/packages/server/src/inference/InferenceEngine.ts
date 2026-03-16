import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import type { GraphDelta, ZoneName, InferenceResult } from '@archlens/shared/types';
import { ChangeEventType } from '@archlens/shared/types';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import { db } from '../db/connection.js';
import { graphNodes } from '../db/schema.js';
import { nodesRepository } from '../db/repository/nodes.js';
import { eventsRepository } from '../db/repository/events.js';
import { ConfigLoader } from './ConfigLoader.js';
import { ZoneClassifier } from './ZoneClassifier.js';
import { EventCorroborator } from './EventCorroborator.js';
import { RiskDetector } from './RiskDetector.js';

// ---------------------------------------------------------------------------
// Event map for typed EventEmitter
// ---------------------------------------------------------------------------

interface InferenceEngineEvents {
  inference: [result: InferenceResult];
}

// ---------------------------------------------------------------------------
// InferenceEngine
// ---------------------------------------------------------------------------

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
export class InferenceEngine extends EventEmitter<InferenceEngineEvents> {
  /** ConfigLoader for .archlens.json zone overrides — owns the chokidar watcher. */
  private readonly configLoader: ConfigLoader;

  /** ZoneClassifier — path-first, topology-second, override-first classification. */
  private readonly classifier: ZoneClassifier;

  /** EventCorroborator — threshold=2 multi-signal event accumulation. */
  private readonly corroborator: EventCorroborator;

  /** RiskDetector — stateless cycle, boundary violation, fan-out detection. */
  private readonly riskDetector: RiskDetector;

  /** Reference to the dependency graph for zone lookups and edge traversal. */
  private readonly graph: DependencyGraph;

  /**
   * Creates an InferenceEngine and subscribes to graph delta events.
   *
   * @param graph     - The DependencyGraph instance to subscribe to.
   * @param watchRoot - Project root directory for .archlens.json discovery.
   */
  constructor(graph: DependencyGraph, watchRoot: string) {
    super();

    this.graph = graph;

    // Create the config loader (synchronously loads .archlens.json on construction).
    this.configLoader = new ConfigLoader(watchRoot);

    // Create inference pipeline components.
    this.classifier = new ZoneClassifier(this.configLoader, graph);
    this.corroborator = new EventCorroborator();
    this.riskDetector = new RiskDetector();

    // Subscribe to graph delta events — the InferenceEngine must be registered
    // BEFORE pipeline.start() so it sees every delta from the initial scan.
    graph.on('delta', (delta) => this.processDelta(delta));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Seeds the ZoneClassifier cache from SQLite-persisted zones on startup.
   *
   * Must be called BEFORE pipeline.start() so the classifier cache reflects
   * the prior session's state. Without this call, every node starts as
   * 'unknown' and topology classification degrades until zones are re-learned.
   */
  loadPersistedZones(): void {
    const nodes = nodesRepository.findAll();
    for (const row of nodes) {
      if (row.zone !== null && row.zone !== undefined) {
        this.classifier.updateZoneCache(row.id, row.zone as ZoneName);
      }
    }
  }

  /**
   * Stops the ConfigLoader's chokidar watcher for graceful shutdown.
   * Must be called in the server's onClose hook.
   */
  destroy(): void {
    this.configLoader.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private — inference pipeline
  // ---------------------------------------------------------------------------

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
  private processDelta(delta: GraphDelta): void {
    // Step 1: Zone classification.
    const zoneUpdates = this.classifier.classifyDelta(delta);

    // Step 2: Persist zone updates — fire-and-forget, no transaction coupling.
    for (const update of zoneUpdates) {
      // Update zone column on the existing graph_nodes row.
      db.update(graphNodes)
        .set({ zone: update.zone })
        .where(eq(graphNodes.id, update.nodeId))
        .run();

      // Append a zone_changed event to the changeEvents audit log.
      eventsRepository.append({
        eventType: ChangeEventType.ZONE_CHANGED,
        payload: {
          type: 'zone_changed',
          nodeId: update.nodeId,
          oldZone: update.previousZone,
          newZone: update.zone,
        },
        timestamp: new Date(),
      });
    }

    // Step 3: Event corroboration.
    const architecturalEvents = this.corroborator.processDelta(delta, zoneUpdates);

    // Step 4: Risk detection. Provide topology accessors as callbacks so
    // RiskDetector stays decoupled from DependencyGraph.
    const risks = this.riskDetector.detectRisks(
      delta,
      (id) => this.getZoneForNode(id),
      (id) => this.graph.getOutEdges(id),
    );

    // Step 5: Emit inference result only when there's something to report.
    if (zoneUpdates.length > 0 || architecturalEvents.length > 0 || risks.length > 0) {
      this.emit('inference', {
        zoneUpdates,
        architecturalEvents,
        risks,
        graphVersion: delta.version,
      });
    }
  }

  /**
   * Returns the zone for a given node from the ZoneClassifier's in-memory
   * cache. Falls back to 'unknown' if the node has no cached zone.
   *
   * Used as the getZone callback passed to RiskDetector.detectRisks().
   */
  private getZoneForNode(nodeId: string): ZoneName {
    // Re-classify on the fly — this ensures the cache is checked and the
    // full override > path > topology chain is consulted if needed.
    return this.classifier.classify(nodeId);
  }
}
