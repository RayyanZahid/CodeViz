// ---------------------------------------------------------------------------
// IntentCategory — const object + derived type (project convention)
// ---------------------------------------------------------------------------

export const IntentCategory = {
  FEATURE_BUILDING: 'feature_building',
  BUG_FIXING: 'bug_fixing',
  REFACTORING: 'refactoring',
  TEST_WRITING: 'test_writing',
  INFRASTRUCTURE: 'infrastructure',
  UNCERTAIN: 'uncertain',
} as const;

export type IntentCategory = typeof IntentCategory[keyof typeof IntentCategory];

// ---------------------------------------------------------------------------
// Domain types — read by both server (persistence) and client (display)
// ---------------------------------------------------------------------------

/** Lightweight snapshot descriptor for timeline browsing (no graph payload). */
export interface SnapshotMeta {
  id: number;
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  summary: string;
  triggerFiles: string[];
}

/** A single intent detection session — one contiguous objective. */
export interface IntentSession {
  id: number;
  sessionId: string;
  category: IntentCategory;
  objective: string;
  confidence: number;
  subtasks: string[];
  startSnapshotId: number | null;
  endSnapshotId: number | null;
  startedAt: number;
  endedAt: number | null;
}

// ---------------------------------------------------------------------------
// WebSocket push message types (metadata-only — client fetches full data)
// ---------------------------------------------------------------------------

/** Server pushes after writing a new snapshot — lightweight metadata only. */
export interface SnapshotSavedMessage {
  type: 'snapshot_saved';
  meta: SnapshotMeta;
}

/** Server pushes when intent session opens or updates. */
export interface IntentUpdatedMessage {
  type: 'intent_updated';
  session: IntentSession;
}

/** Server pushes when intent session closes (focus shifted). */
export interface IntentClosedMessage {
  type: 'intent_closed';
  sessionId: string;
  endSnapshotId: number | null;
}
