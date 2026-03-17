// ---------------------------------------------------------------------------
// epochDetection — Pure utility for detecting epoch markers from intent
// session boundaries and activity gaps.
//
// Epoch markers are rendered on the TimelineBar as vertical tick marks at
// significant moments:
//   - 'focus_shift': when an intent session transitions to a different category
//   - 'gap': when more than 90 seconds pass between consecutive snapshots
// ---------------------------------------------------------------------------

import type { SnapshotMeta, IntentSession } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// EpochMarker — a significant moment on the timeline
// ---------------------------------------------------------------------------

export interface EpochMarker {
  snapshotId: number;
  snapshotIndex: number;
  label: string;
  type: 'focus_shift' | 'gap';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// findClosestSnapshotIndex — helper used by detectEpochs
// Returns the index in `snapshots` whose timestamp is closest to `timestamp`.
// Returns 0 if snapshots is empty.
// ---------------------------------------------------------------------------

export function findClosestSnapshotIndex(snapshots: SnapshotMeta[], timestamp: number): number {
  if (snapshots.length === 0) return 0;
  let closestIdx = 0;
  let closestDiff = Math.abs(snapshots[0].timestamp - timestamp);

  for (let i = 1; i < snapshots.length; i++) {
    const diff = Math.abs(snapshots[i].timestamp - timestamp);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  }

  return closestIdx;
}

// ---------------------------------------------------------------------------
// formatCategory — converts snake_case category to "Title Case" label
// e.g. "feature_building" -> "Feature Building"
// ---------------------------------------------------------------------------

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// detectEpochs — main export
//
// Detects two kinds of epoch markers:
//   1. Intent session boundaries where category changes (focus_shift)
//   2. Activity gaps > 90 seconds between consecutive snapshots (gap)
//
// Returns epoch markers sorted by timestamp ascending.
// ---------------------------------------------------------------------------

const GAP_THRESHOLD_MS = 90_000; // 90 seconds

export function detectEpochs(
  snapshots: SnapshotMeta[],
  intentSessions: IntentSession[],
): EpochMarker[] {
  const epochs: EpochMarker[] = [];

  // -------------------------------------------------------------------------
  // 1. Focus-shift epochs from intent session boundaries
  // -------------------------------------------------------------------------
  if (intentSessions.length >= 2) {
    // Sort by startedAt ascending
    const sorted = [...intentSessions].sort((a, b) => a.startedAt - b.startedAt);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // Only emit a focus-shift epoch when category changes
      if (prev.category !== curr.category) {
        // Use prev.endedAt if available; otherwise curr.startedAt
        const transitionTimestamp = prev.endedAt ?? curr.startedAt;

        const snapshotIndex = findClosestSnapshotIndex(snapshots, transitionTimestamp);
        const snapshot = snapshots[snapshotIndex];

        if (snapshot) {
          epochs.push({
            snapshotId: snapshot.id,
            snapshotIndex,
            label: `${formatCategory(prev.category)} \u2192 ${formatCategory(curr.category)}`,
            type: 'focus_shift',
            timestamp: transitionTimestamp,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Activity gap epochs — gaps > 90s between consecutive snapshots
  // -------------------------------------------------------------------------
  for (let i = 1; i < snapshots.length; i++) {
    const gap = snapshots[i].timestamp - snapshots[i - 1].timestamp;
    if (gap > GAP_THRESHOLD_MS) {
      epochs.push({
        snapshotId: snapshots[i].id,
        snapshotIndex: i,
        label: 'Activity resumed',
        type: 'gap',
        timestamp: snapshots[i].timestamp,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Sort by timestamp ascending
  // -------------------------------------------------------------------------
  epochs.sort((a, b) => a.timestamp - b.timestamp);

  return epochs;
}
