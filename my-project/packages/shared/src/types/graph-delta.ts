import type { SupportedLanguage } from './parser.js';

// ---------------------------------------------------------------------------
// Cycle severity — const object + derived type (project convention)
// ---------------------------------------------------------------------------

export const CycleSeverity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type CycleSeverity = typeof CycleSeverity[keyof typeof CycleSeverity];

// ---------------------------------------------------------------------------
// Node and edge metadata
// ---------------------------------------------------------------------------

/** Metadata stored on each node in the in-memory dependency graph. */
export interface NodeMetadata {
  filePath: string;
  language: SupportedLanguage;
  exports: string[];       // export names — for "modified" detection and inference
  lastModified: number;    // Date.now() timestamp from parse time
}

/** Metadata stored on each directed edge in the dependency graph. */
export interface EdgeMetadata {
  symbols: string[];       // imported symbol names, e.g. ['UserService', 'AuthMiddleware']
}

// ---------------------------------------------------------------------------
// GraphDelta component types
// ---------------------------------------------------------------------------

/** A detected circular dependency with its ordered node path and severity. */
export interface GraphDeltaCycle {
  path: string[];          // ordered node IDs forming the cycle, e.g. ['src/a.ts', 'src/b.ts']
  severity: CycleSeverity;
}

/** An edge included in a delta (added edges only — carry full metadata). */
export interface GraphDeltaEdge {
  v: string;               // source node ID (file path)
  w: string;               // target node ID (file path or __ext__/specifier)
  symbols: string[];       // imported symbol names on this edge
}

// ---------------------------------------------------------------------------
// GraphDelta — the primary event emitted after each update flush
// ---------------------------------------------------------------------------

/**
 * GraphDelta describes incremental changes to the dependency graph after
 * processing one or more ParseBatchResult objects.
 *
 * Three-state node delta: added / removed / modified (exports changed).
 * Edge delta: added edges carry full metadata; removed edges referenced by ID.
 * Cycle delta: only reports newly created or broken cycles (not all cycles).
 * Version counter enables "give me changes since vN" replay for late-joiners.
 */
export interface GraphDelta {
  /** Monotonic version counter — increments per flush. */
  version: number;

  /** Node IDs of files added to the graph. */
  addedNodes: string[];

  /** Node IDs of files removed from the graph. */
  removedNodeIds: string[];

  /** Node IDs of files whose exports changed (file still exists). */
  modifiedNodes: string[];

  /** New directed edges added, with their imported symbol lists. */
  addedEdges: GraphDeltaEdge[];

  /**
   * Edge IDs removed from the graph.
   * Format: `${sourceId}->${targetId}` (forward slash paths, no backslashes).
   */
  removedEdgeIds: string[];

  /** Cycles that were newly detected in this update. */
  cyclesAdded: GraphDeltaCycle[];

  /** Cycles that no longer exist after this update. */
  cyclesRemoved: GraphDeltaCycle[];

  /** File paths that triggered this delta (from the originating parse batch). */
  triggerFiles: string[];

  /** Wall-clock timestamp (Date.now()) when the delta was computed. */
  timestamp: number;
}
