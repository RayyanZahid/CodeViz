import { randomUUID } from 'node:crypto';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { GraphDelta } from '@archlens/shared/types';
import type { SnapshotMeta } from '@archlens/shared/types';
import { snapshotsRepository } from '../db/repository/snapshots.js';
import { broadcast } from '../plugins/websocket.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minor (non-structural) events before a forced snapshot. */
const MINOR_THRESHOLD = 10;

/** Debounce window in milliseconds — within the 2-5s discretion range. */
const DEBOUNCE_MS = 3000;

/** FIFO cap targeting ~10-20MB budget (200 over 500 for safer sizing). */
const MAX_SNAPSHOTS = 200;

// ---------------------------------------------------------------------------
// SnapshotManager
// ---------------------------------------------------------------------------

/**
 * SnapshotManager subscribes to graph delta events and captures snapshots to
 * SQLite at meaningful moments:
 *
 * - Structural changes (added/removed nodes or edges, cycle changes) trigger
 *   an immediate (debounced) snapshot.
 * - Minor changes (export-only modifications) accumulate until the
 *   MINOR_THRESHOLD (10) is reached, then trigger a snapshot.
 * - A 3-second debounce prevents burst flooding from rapid file edits.
 * - FIFO pruning removes the oldest snapshot once the 200-entry cap is hit.
 * - An explicit captureInitialSnapshot() call captures state after the first
 *   scan completes (not on empty graph state).
 *
 * Snapshot writes are decoupled from the delta hot path via the debounce
 * timer — the delta event handler returns immediately; writing happens async.
 */
export class SnapshotManager {
  /** Accumulator for non-structural (minor) changes since last snapshot. */
  private minorEventCount: number = 0;

  /** Active debounce timer handle, or null when idle. */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Monotonically increasing sequence number per session. */
  private sequenceNumber: number = 0;

  /** File IDs that contributed to the pending (not yet captured) snapshot. */
  private pendingTriggerFiles: string[] = [];

  /** Bound handler reference stored for clean removal in destroy(). */
  private readonly deltaHandler: (delta: GraphDelta) => void;

  constructor(
    private readonly graph: DependencyGraph,
    private readonly sessionId: string,
    private readonly watchRoot: string,
  ) {
    this.deltaHandler = (delta: GraphDelta) => this.onDelta(delta);
    this.graph.on('delta', this.deltaHandler);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Called explicitly after the initial file scan completes.
   * Captures a snapshot immediately (no debounce) so the first entry
   * reflects real graph state, not an empty graph.
   */
  captureInitialSnapshot(): void {
    this.captureSnapshot();
  }

  /**
   * Returns the session ID assigned to this SnapshotManager.
   * Used by index.ts for lifecycle logging.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Cleans up: cancels any pending debounce timer and removes the delta
   * listener from the graph so this instance can be garbage collected.
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.graph.removeListener('delta', this.deltaHandler);
  }

  // ---------------------------------------------------------------------------
  // Private — delta handling
  // ---------------------------------------------------------------------------

  /**
   * Receives every GraphDelta from the DependencyGraph and decides whether to
   * schedule a snapshot based on structural vs. minor classification.
   */
  private onDelta(delta: GraphDelta): void {
    // Structural: any topology change (nodes, edges, or cycle changes)
    const isStructural =
      delta.addedNodes.length > 0 ||
      delta.removedNodeIds.length > 0 ||
      delta.addedEdges.length > 0 ||
      delta.removedEdgeIds.length > 0 ||
      delta.cyclesAdded.length > 0 ||
      delta.cyclesRemoved.length > 0;

    // Collect trigger files from added nodes (string IDs) and modified nodes (string IDs)
    for (const nodeId of delta.addedNodes) {
      this.pendingTriggerFiles.push(nodeId);
    }
    for (const nodeId of delta.modifiedNodes) {
      this.pendingTriggerFiles.push(nodeId);
    }

    if (isStructural) {
      this.scheduleSnapshot();
      this.minorEventCount = 0;
    } else {
      this.minorEventCount += 1;
      if (this.minorEventCount >= MINOR_THRESHOLD) {
        this.scheduleSnapshot();
        this.minorEventCount = 0;
      }
    }
  }

  /**
   * Arms (or re-arms) the debounce timer. The actual snapshot is captured
   * only when the timer fires — burst edits reset the timer repeatedly but
   * only result in a single snapshot write after the burst settles.
   */
  private scheduleSnapshot(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.captureSnapshot();
    }, DEBOUNCE_MS);
  }

  // ---------------------------------------------------------------------------
  // Private — snapshot capture
  // ---------------------------------------------------------------------------

  /**
   * Captures the current graph state to SQLite, broadcasts metadata to clients,
   * and applies FIFO pruning if needed.
   *
   * This method runs in the debounce callback (off the delta hot path) so
   * SQLite I/O does not block event emission.
   */
  private captureSnapshot(): void {
    // 1. Get full graph state (nodes + edges in wire format)
    const snapshot = this.graph.getSnapshot();

    // 2. Build graph JSON blob (positions not yet tracked — reserved for Phase 6)
    const graphJson = {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      positions: {} as Record<string, { x: number; y: number }>,
    };

    // 3. Build human-readable summary
    const summary = `${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges`;

    // 4. Capture and reset pending trigger files (deduplicated)
    const triggerFiles = [...new Set(this.pendingTriggerFiles)];
    this.pendingTriggerFiles = [];

    // 5. Increment sequence number
    this.sequenceNumber += 1;

    // 6. Persist to SQLite via repository
    const insertedId = snapshotsRepository.insert({
      sessionId: this.sessionId,
      watchRoot: this.watchRoot,
      sequenceNumber: this.sequenceNumber,
      timestamp: new Date(),
      graphJson,
      summary,
      triggerFiles,
      riskSnapshot: [],
    });

    // 7. FIFO pruning — remove oldest if over cap
    const count = snapshotsRepository.getCount(this.sessionId);
    if (count > MAX_SNAPSHOTS) {
      snapshotsRepository.deleteOldest(this.sessionId);
    }

    // 8. Build SnapshotMeta and broadcast to connected WebSocket clients
    const meta: SnapshotMeta = {
      id: insertedId,
      sessionId: this.sessionId,
      sequenceNumber: this.sequenceNumber,
      timestamp: Date.now(),
      summary,
      triggerFiles,
    };
    broadcast({ type: 'snapshot_saved', meta });

    // 9. Log for visibility
    console.log(`[Snapshot] #${this.sequenceNumber}: ${summary}`);
  }
}

// Re-export randomUUID for consumers that need a session ID without importing crypto directly
export { randomUUID };
