import { create } from 'zustand';
import type { IntentSession } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// IntentStore interface — intent session state for the Intent Panel
// ---------------------------------------------------------------------------

export interface IntentStore {
  /** Currently active intent session (null when no activity is detected) */
  activeSession: IntentSession | null;
  /** Closed intent sessions for history log, newest-first, capped at 50 */
  intentHistory: IntentSession[];

  /**
   * Set the active session from a server intent_updated push.
   * Focus-shift detection: if there was a previous activeSession with a different
   * category, a focus-shift history entry is created before replacing.
   */
  applyIntentUpdated: (session: IntentSession) => void;
  /**
   * Close the active session when intent_closed is received.
   * If activeSession matches sessionId: sets endSnapshotId + endedAt, moves to
   * intentHistory (prepend, cap 50), sets activeSession=null.
   */
  applyIntentClosed: (sessionId: string, endSnapshotId: number | null) => void;
  /**
   * Seed intentHistory from GET /api/intents response.
   * Sorts by startedAt descending, caps at 50.
   */
  loadHistory: (sessions: IntentSession[]) => void;
  /**
   * Clear activeSession and intentHistory.
   * Called by WsClient on watch_root_changed (old project timeline is invalid).
   */
  resetState: () => void;
}

// ---------------------------------------------------------------------------
// History cap — matches inferenceStore activityFeed cap for consistency
// ---------------------------------------------------------------------------

const HISTORY_CAP = 50;

// ---------------------------------------------------------------------------
// Store implementation — double-paren pattern for TypeScript middleware compat
// (mirrors graphStore.ts, inferenceStore.ts, and replayStore.ts exactly)
// ---------------------------------------------------------------------------

export const useIntentStore = create<IntentStore>()((set, get) => ({
  activeSession: null,
  intentHistory: [],

  applyIntentUpdated: (session: IntentSession) => {
    const { activeSession, intentHistory } = get();

    // Focus-shift detection: if we had an active session with a DIFFERENT category,
    // push the old session to history before replacing (captures the focus shift).
    let updatedHistory = [...intentHistory];
    if (activeSession !== null && activeSession.category !== session.category) {
      // Mark the old session as ended at this moment (approximate) before archiving
      const closedOldSession: IntentSession = {
        ...activeSession,
        endedAt: activeSession.endedAt ?? Date.now(),
      };
      updatedHistory = [closedOldSession, ...updatedHistory].slice(0, HISTORY_CAP);
    }

    set({
      activeSession: session,
      intentHistory: updatedHistory,
    });
  },

  applyIntentClosed: (sessionId: string, endSnapshotId: number | null) => {
    const { activeSession, intentHistory } = get();

    if (activeSession === null || activeSession.sessionId !== sessionId) {
      // Session not found or already closed — no-op
      return;
    }

    // Close the session: record endSnapshotId and endedAt
    const closedSession: IntentSession = {
      ...activeSession,
      endSnapshotId,
      endedAt: Date.now(),
    };

    const updatedHistory = [closedSession, ...intentHistory].slice(0, HISTORY_CAP);

    set({
      activeSession: null,
      intentHistory: updatedHistory,
    });
  },

  loadHistory: (sessions: IntentSession[]) => {
    // Sort by startedAt descending (newest first), then cap at 50
    const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, HISTORY_CAP);
    set({ intentHistory: sorted });
  },

  resetState: () => {
    set({
      activeSession: null,
      intentHistory: [],
    });
  },
}));

// ---------------------------------------------------------------------------
// Vanilla reference for WsClient (same pattern as graphStore.ts, replayStore.ts)
// ---------------------------------------------------------------------------

export const intentStore = useIntentStore;
