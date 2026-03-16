import type { GraphDelta } from '@archlens/shared/types';
import type { ZoneUpdate, ArchitecturalEvent } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// EventCorroborator
// ---------------------------------------------------------------------------

/**
 * EventCorroborator accumulates corroboration signals across multiple
 * GraphDeltas and fires ArchitecturalEvents only when the signal count
 * reaches THRESHOLD (2).
 *
 * A single file edit produces one delta — it alone cannot trigger an event.
 * The counter must reach 2 across two separate deltas with the same signal,
 * preventing noisy single-file-edit events from flooding the system.
 *
 * Key design decisions (locked):
 * - THRESHOLD = 2: binary pass/fail, no confidence scores exposed.
 * - Events fire immediately when threshold is met (no time-window batching).
 * - Counter is deleted (not zeroed) on fire — re-accumulation starts fresh.
 * - MAX_STALE_VERSIONS = 10: evict entries older than 10 delta versions
 *   to prevent unbounded memory growth (RESEARCH.md Pitfall 2).
 */
export class EventCorroborator {
  /** Minimum number of signals required before an event fires. */
  readonly THRESHOLD = 2;

  /** Evict counter entries that are older than this many delta versions. */
  private readonly MAX_STALE_VERSIONS = 10;

  /**
   * Signal counters keyed by canonical "candidate event" string.
   * Format examples:
   *   component_created:src/foo.ts
   *   dependency_added:src/a.ts:src/b.ts
   *   dependency_removed:src/a.ts->src/b.ts
   *   component_merged:src/new.ts
   *   component_split:src/old.ts
   */
  private counters: Map<string, { count: number; deltaVersion: number }> = new Map();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Processes a GraphDelta and optional zone updates to accumulate signals
   * and fire ArchitecturalEvents when the corroboration threshold is reached.
   *
   * @param delta      - The computed graph delta for this update cycle.
   * @param zoneUpdates - Zone assignment updates produced by the ZoneClassifier
   *                      in the same inference cycle — used to attach zone labels
   *                      to component_created events.
   * @returns          Array of ArchitecturalEvents that fired this cycle
   *                   (may be empty if no counters crossed the threshold).
   */
  processDelta(delta: GraphDelta, zoneUpdates: ZoneUpdate[]): ArchitecturalEvent[] {
    const fired: ArchitecturalEvent[] = [];
    const currentVersion = delta.version;

    // Build a lookup map from nodeId -> zone for quick zone attachment.
    const zoneMap = new Map<string, ZoneUpdate['zone']>();
    for (const update of zoneUpdates) {
      zoneMap.set(update.nodeId, update.zone);
    }

    // 1. Eviction pass: remove stale counters and counters for removed nodes.
    const removedNodeSet = new Set(delta.removedNodeIds);
    for (const [key, entry] of this.counters) {
      if (currentVersion - entry.deltaVersion > this.MAX_STALE_VERSIONS) {
        this.counters.delete(key);
        continue;
      }
      // Evict counters whose subject node was removed.
      // The key format includes the nodeId after the first colon.
      const colonIdx = key.indexOf(':');
      if (colonIdx !== -1) {
        const nodeIdPart = key.slice(colonIdx + 1);
        // For dependency_added/removed keys the nodeIdPart is "v:w" or "v->w".
        // We check if either the full nodeIdPart or the source node is removed.
        const arrowIdx = nodeIdPart.indexOf('->');
        const colonIdx2 = nodeIdPart.indexOf(':');
        const firstNode = arrowIdx !== -1
          ? nodeIdPart.slice(0, arrowIdx)
          : colonIdx2 !== -1
            ? nodeIdPart.slice(0, colonIdx2)
            : nodeIdPart;
        if (removedNodeSet.has(firstNode) || removedNodeSet.has(nodeIdPart)) {
          this.counters.delete(key);
        }
      }
    }

    // 2. component_created signals: each added node.
    for (const nodeId of delta.addedNodes) {
      const key = `component_created:${nodeId}`;
      if (this.incrementCounter(key, currentVersion)) {
        fired.push({
          type: 'component_created',
          nodeId,
          zone: zoneMap.get(nodeId),
          timestamp: delta.timestamp,
        });
      }
    }

    // 3. dependency_added signals: each added edge.
    for (const edge of delta.addedEdges) {
      const key = `dependency_added:${edge.v}:${edge.w}`;
      if (this.incrementCounter(key, currentVersion)) {
        fired.push({
          type: 'dependency_added',
          nodeId: edge.v,
          targetNodeId: edge.w,
          zone: zoneMap.get(edge.v),
          timestamp: delta.timestamp,
        });
      }
    }

    // 4. dependency_removed signals: each removed edge.
    for (const edgeId of delta.removedEdgeIds) {
      const key = `dependency_removed:${edgeId}`;
      if (this.incrementCounter(key, currentVersion)) {
        // Parse nodeId and targetNodeId from the edgeId string (format: "sourceId->targetId").
        const arrowIdx = edgeId.indexOf('->');
        const nodeId = arrowIdx !== -1 ? edgeId.slice(0, arrowIdx) : edgeId;
        const targetNodeId = arrowIdx !== -1 ? edgeId.slice(arrowIdx + 2) : undefined;
        fired.push({
          type: 'dependency_removed',
          nodeId,
          targetNodeId,
          zone: zoneMap.get(nodeId),
          timestamp: delta.timestamp,
        });
      }
    }

    // 5. Split / merge detection.
    //    component_merged: 2+ nodes collapsed into 1.
    if (delta.removedNodeIds.length >= 2 && delta.addedNodes.length === 1) {
      const key = `component_merged:${delta.addedNodes[0]}`;
      if (this.incrementCounter(key, currentVersion)) {
        fired.push({
          type: 'component_merged',
          nodeId: delta.addedNodes[0],
          zone: zoneMap.get(delta.addedNodes[0]),
          timestamp: delta.timestamp,
        });
      }
    }

    //    component_split: 1 node exploded into 2+.
    if (delta.removedNodeIds.length === 1 && delta.addedNodes.length >= 2) {
      const key = `component_split:${delta.removedNodeIds[0]}`;
      if (this.incrementCounter(key, currentVersion)) {
        fired.push({
          type: 'component_split',
          nodeId: delta.removedNodeIds[0],
          zone: zoneMap.get(delta.removedNodeIds[0]),
          timestamp: delta.timestamp,
        });
      }
    }

    return fired;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Increments the counter for the given key.
   *
   * Returns true if the counter reached THRESHOLD (the event fires).
   * When firing, the counter entry is deleted so re-accumulation starts fresh.
   * Otherwise, the updated count is stored.
   */
  private incrementCounter(key: string, deltaVersion: number): boolean {
    const entry = this.counters.get(key);
    const newCount = (entry?.count ?? 0) + 1;
    if (newCount >= this.THRESHOLD) {
      this.counters.delete(key);
      return true; // fires
    }
    this.counters.set(key, { count: newCount, deltaVersion });
    return false; // accumulating
  }
}
