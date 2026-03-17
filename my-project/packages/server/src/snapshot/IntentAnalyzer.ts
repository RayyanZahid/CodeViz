import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { GraphDelta } from '@archlens/shared/types';
import { IntentCategory } from '@archlens/shared/types';
import type { IntentSession } from '@archlens/shared/types';
import { intentSessionsRepository } from '../db/repository/intentSessions.js';
import { snapshotsRepository } from '../db/repository/snapshots.js';
import { broadcast } from '../plugins/websocket.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** EWMA decay factor — applied to all category scores on each delta. */
const DECAY = 0.85;

/** Minimum sum of all scores required to act on classification (noise gate). */
const MIN_SIGNAL_THRESHOLD = 0.1;

/** Minimum confidence delta before re-broadcasting intent_updated. */
const CONFIDENCE_BROADCAST_DELTA = 0.05;

/**
 * Activity gap in milliseconds. If the previous delta was more than 90 seconds
 * ago, scores are reset before processing the new delta — treating it as a
 * fresh context to prevent stale scores from creating spurious classifications.
 */
const ACTIVITY_GAP_MS = 90_000;

// ---------------------------------------------------------------------------
// Helper — human-readable objective labels
// ---------------------------------------------------------------------------

const OBJECTIVE_LABELS: Record<IntentCategory, string> = {
  [IntentCategory.FEATURE_BUILDING]: 'Adding Feature',
  [IntentCategory.BUG_FIXING]: 'Bug Fix',
  [IntentCategory.REFACTORING]: 'Refactoring',
  [IntentCategory.TEST_WRITING]: 'Test Coverage',
  [IntentCategory.DEPENDENCY_UPDATE]: 'Dependency Update',
  [IntentCategory.CLEANUP]: 'Cleanup',
};

// ---------------------------------------------------------------------------
// IntentAnalyzer
// ---------------------------------------------------------------------------

/**
 * IntentAnalyzer subscribes to graph delta events and classifies the agent's
 * current work into one of 6 coarse intent categories using heuristic scoring
 * with EWMA decay.
 *
 * Algorithm overview:
 * 1. On each delta, decay all category scores by 0.85.
 * 2. Analyse the delta for file-path and topology signals; add weighted scores.
 * 3. Determine the winner (highest score). If the sum is above threshold, act.
 * 4. If winner differs from the active session's category, close the current
 *    session (focus shift) and open a new one.
 * 5. Broadcast intent_updated and intent_closed messages via WebSocket.
 *
 * Session lifecycle is persisted to SQLite via intentSessionsRepository.
 */
export class IntentAnalyzer {
  /** Per-category running scores (EWMA-decayed on each delta). */
  private scores: Record<IntentCategory, number>;

  /** Database row ID of the currently open intent session, or null. */
  private activeSessionId: number | null = null;

  /** IntentCategory of the currently open session, or null. */
  private activeCategory: IntentCategory | null = null;

  /** Human-readable objective label of the currently open session. */
  private activeObjective: string | null = null;

  /** Confidence value at the last intent_updated broadcast (for delta check). */
  private lastBroadcastConfidence: number = 0;

  /** Timestamp of the last processed delta (for activity gap detection). */
  private lastDeltaTimestamp: number | null = null;

  /** Bound handler reference for clean removal in destroy(). */
  private readonly deltaHandler: (delta: GraphDelta) => void;

  constructor(
    private readonly graph: DependencyGraph,
    private readonly sessionId: string,
    private readonly watchRoot: string,
  ) {
    // Initialise all category scores to 0
    this.scores = {
      [IntentCategory.FEATURE_BUILDING]: 0,
      [IntentCategory.BUG_FIXING]: 0,
      [IntentCategory.REFACTORING]: 0,
      [IntentCategory.TEST_WRITING]: 0,
      [IntentCategory.DEPENDENCY_UPDATE]: 0,
      [IntentCategory.CLEANUP]: 0,
    };

    this.deltaHandler = (delta: GraphDelta) => this.onDelta(delta);
    this.graph.on('delta', this.deltaHandler);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the session ID assigned to this IntentAnalyzer.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Cleans up: removes the delta listener from the graph, and closes any
   * active intent session so it does not dangle as open in the DB.
   */
  destroy(): void {
    this.graph.removeListener('delta', this.deltaHandler);
    if (this.activeSessionId !== null) {
      this.closeSession();
    }
  }

  // ---------------------------------------------------------------------------
  // Private — delta handling
  // ---------------------------------------------------------------------------

  /**
   * Core entry point. Called on every graph delta. Applies EWMA decay, collects
   * signals from the delta, updates scores, and evaluates the current session.
   */
  private onDelta(delta: GraphDelta): void {
    const now = Date.now();

    // Activity gap detection — reset scores if idle for > 90 seconds
    if (this.lastDeltaTimestamp !== null && now - this.lastDeltaTimestamp > ACTIVITY_GAP_MS) {
      this.resetScores();
    }
    this.lastDeltaTimestamp = now;

    // 1. Decay all scores by EWMA factor
    for (const category of Object.keys(this.scores) as IntentCategory[]) {
      this.scores[category] *= DECAY;
    }

    // 2. Classify delta into signals and add weights
    const signals = this.classifyDelta(delta);
    for (const { category, weight } of signals) {
      this.scores[category] += weight;
    }

    // 3. Compute winner and confidence
    const entries = Object.entries(this.scores) as Array<[IntentCategory, number]>;
    const sumOfScores = entries.reduce((acc, [, v]) => acc + v, 0);

    // Minimum signal threshold — avoid acting on noise
    if (sumOfScores < MIN_SIGNAL_THRESHOLD) {
      return;
    }

    const [winner] = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best));
    const topScore = this.scores[winner];
    const confidence = sumOfScores > 0 ? topScore / sumOfScores : 0;

    // 4. Evaluate session state
    this.evaluateSession(winner, confidence);
  }

  // ---------------------------------------------------------------------------
  // Private — signal classification
  // ---------------------------------------------------------------------------

  /**
   * Analyses a GraphDelta and returns an array of weighted category signals.
   * Signals come from file-path patterns and topology shape.
   */
  private classifyDelta(delta: GraphDelta): Array<{ category: IntentCategory; weight: number }> {
    const signals: Array<{ category: IntentCategory; weight: number }> = [];

    // File-path signals — examine added nodes, modified nodes, trigger files
    const filePaths = [...delta.addedNodes, ...delta.modifiedNodes];

    for (const filePath of filePaths) {
      const fp = filePath.toLowerCase();

      // Test file signal
      if (fp.includes('test') || fp.includes('spec') || fp.includes('__tests__')) {
        signals.push({ category: IntentCategory.TEST_WRITING, weight: 0.6 });
      }

      // Dependency file signal
      if (
        fp.includes('package.json') ||
        fp.includes('package-lock') ||
        fp.includes('pnpm-lock')
      ) {
        signals.push({ category: IntentCategory.DEPENDENCY_UPDATE, weight: 0.8 });
      }

      // Config/cleanup signal
      if (
        fp.includes('.config.') ||
        fp.includes('tsconfig') ||
        fp.includes('vite.config') ||
        fp.includes('drizzle')
      ) {
        signals.push({ category: IntentCategory.CLEANUP, weight: 0.3 });
      }
    }

    // Topology signals — based on delta shape
    const hasAddedNodes = delta.addedNodes.length > 0;
    const hasAddedEdges = delta.addedEdges.length > 1;
    const hasRemovedNodes = delta.removedNodeIds.length > 0;
    const hasRemovedEdges = delta.removedEdgeIds.length > 1;
    const hasCycleChanges = delta.cyclesAdded.length > 0 || delta.cyclesRemoved.length > 0;
    const hasPureModifications =
      delta.modifiedNodes.length > 0 &&
      delta.addedNodes.length === 0 &&
      delta.removedNodeIds.length === 0 &&
      delta.addedEdges.length === 0 &&
      delta.removedEdgeIds.length === 0;

    if (hasAddedNodes || hasAddedEdges) {
      signals.push({ category: IntentCategory.FEATURE_BUILDING, weight: 0.5 });
    }

    if (hasRemovedNodes || hasRemovedEdges) {
      signals.push({ category: IntentCategory.REFACTORING, weight: 0.4 });
    }

    if (hasCycleChanges) {
      signals.push({ category: IntentCategory.CLEANUP, weight: 0.5 });
    }

    if (hasPureModifications) {
      signals.push({ category: IntentCategory.BUG_FIXING, weight: 0.3 });
      signals.push({ category: IntentCategory.REFACTORING, weight: 0.2 });
    }

    return signals;
  }

  // ---------------------------------------------------------------------------
  // Private — session lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Determines whether to open a new session, update the current one, or
   * close the current and open a fresh one (focus shift).
   */
  private evaluateSession(winner: IntentCategory, confidence: number): void {
    if (this.activeSessionId === null) {
      // No active session — open one
      this.openSession(winner, confidence);
    } else if (winner !== this.activeCategory) {
      // Focus shift — close current and open new
      this.closeSession();
      this.openSession(winner, confidence);
    } else {
      // Same category — update confidence
      this.updateSession(confidence);
    }
  }

  /**
   * Opens a new intent session for the given category, persists it to SQLite,
   * and broadcasts intent_updated.
   */
  private openSession(category: IntentCategory, confidence: number): void {
    const startSnapshotId = snapshotsRepository.getLatestId(this.sessionId) ?? null;
    const objective = OBJECTIVE_LABELS[category];

    const id = intentSessionsRepository.insert({
      sessionId: this.sessionId,
      watchRoot: this.watchRoot,
      category,
      objective,
      confidence,
      subtasks: [],
      evidence: [],
      riskSnapshot: [],
      startSnapshotId: startSnapshotId ?? null,
      endSnapshotId: null,
      startedAt: new Date(),
    });

    this.activeSessionId = id;
    this.activeCategory = category;
    this.activeObjective = objective;
    this.lastBroadcastConfidence = confidence;

    const session: IntentSession = {
      id,
      sessionId: this.sessionId,
      category,
      objective,
      confidence,
      subtasks: [],
      startSnapshotId: startSnapshotId ?? null,
      endSnapshotId: null,
      startedAt: Date.now(),
      endedAt: null,
    };

    broadcast({ type: 'intent_updated', session });
  }

  /**
   * Closes the currently active session, persists the end snapshot ID and
   * timestamp, and broadcasts intent_closed.
   */
  private closeSession(): void {
    if (this.activeSessionId === null) return;

    const endSnapshotId = snapshotsRepository.getLatestId(this.sessionId) ?? null;
    intentSessionsRepository.close(this.activeSessionId, endSnapshotId, new Date());

    broadcast({
      type: 'intent_closed',
      sessionId: this.sessionId,
      endSnapshotId,
    });

    this.activeSessionId = null;
    this.activeCategory = null;
    this.activeObjective = null;
    this.lastBroadcastConfidence = 0;
  }

  /**
   * Updates the confidence of the active session. Only broadcasts if the
   * confidence changed by more than CONFIDENCE_BROADCAST_DELTA to avoid
   * flooding WebSocket clients with high-frequency updates.
   */
  private updateSession(confidence: number): void {
    if (this.activeSessionId === null || this.activeObjective === null) return;

    intentSessionsRepository.updateConfidence(
      this.activeSessionId,
      confidence,
      this.activeObjective,
    );

    const delta = Math.abs(confidence - this.lastBroadcastConfidence);
    if (delta > CONFIDENCE_BROADCAST_DELTA) {
      this.lastBroadcastConfidence = confidence;

      const session: IntentSession = {
        id: this.activeSessionId,
        sessionId: this.sessionId,
        category: this.activeCategory!,
        objective: this.activeObjective,
        confidence,
        subtasks: [],
        startSnapshotId: null,
        endSnapshotId: null,
        startedAt: Date.now(),
        endedAt: null,
      };

      broadcast({ type: 'intent_updated', session });
    }
  }

  // ---------------------------------------------------------------------------
  // Private — utilities
  // ---------------------------------------------------------------------------

  /**
   * Resets all category scores to 0 (used on activity gap detection).
   */
  private resetScores(): void {
    for (const category of Object.keys(this.scores) as IntentCategory[]) {
      this.scores[category] = 0;
    }
  }
}
