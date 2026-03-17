import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import type { GraphDeltaMessage, InferenceMessage } from '@archlens/shared/types';
import type { SnapshotMeta } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// ReplayStore interface — mode state machine for historical snapshot viewing
// ---------------------------------------------------------------------------

export interface ReplayStore {
  /** Master mode gate — true while viewing a historical snapshot */
  isReplay: boolean;
  /** Current snapshot ID being viewed */
  replaySnapshotId: number | null;
  /** Epoch ms of the replayed point — displayed in the replay banner */
  replayTimestamp: number | null;
  /** Historical graph nodes for replay rendering */
  replayNodes: Map<string, GraphNode>;
  /** Historical graph edges for replay rendering */
  replayEdges: Map<string, GraphEdge>;
  /** Live graph_delta messages buffered during replay (not applied to graphStore) */
  bufferedGraphDeltas: GraphDeltaMessage[];
  /** Live inference messages buffered during replay (not applied to inferenceStore) */
  bufferedInferenceMessages: InferenceMessage[];
  /** Total count of buffered events — for banner display efficiency; avoids array.length selector re-renders */
  bufferedEventCount: number;
  /** True when buffer exceeds 500 entries — exit-replay uses snapshot fetch instead of buffer drain */
  bufferOverflowed: boolean;

  // -------------------------------------------------------------------------
  // Timeline and playback state — added Phase 17 (timeline slider)
  // -------------------------------------------------------------------------

  /** Snapshot metadata list loaded from GET /api/timeline; grows via appendSnapshot */
  snapshots: SnapshotMeta[];
  /** Index of the currently displayed snapshot in the snapshots array (-1 when not scrubbing) */
  currentSnapshotIndex: number;
  /** True when auto-playback is active */
  isPlaying: boolean;
  /** Playback speed multiplier */
  playbackSpeed: 0.5 | 1 | 2 | 4;
  /** Second snapshot ID for diff overlay (shift-click to set); null when no diff active */
  diffBaseSnapshotId: number | null;
  /**
   * Directory path set when replay mode is auto-exited due to a watch-root switch.
   * Non-null while the toast is visible; reset to null after auto-dismiss (2s).
   * Only set inside the isReplay guard — never fires on non-replay root switches.
   */
  replayExitedForSwitch: string | null;

  // Actions — called by WsClient, App.tsx, and Phase 17 timeline slider
  /**
   * Enter replay mode. Stores snapshot data into Maps, clears buffers, resets overflow flag.
   * Called by Phase 17 timeline slider after fetching GET /api/snapshot/:id.
   */
  enterReplay: (snapshotId: number, timestamp: number, nodes: GraphNode[], edges: GraphEdge[]) => void;
  /**
   * Exit replay mode. Clears replay graph data but does NOT clear buffers.
   * Caller reads bufferedGraphDeltas/bufferedInferenceMessages before calling exitReplay,
   * then calls clearBuffer after draining.
   */
  exitReplay: () => void;
  /**
   * Buffer a graph_delta message during replay.
   * If buffer length >= 500, sets bufferOverflowed=true and skips push.
   * Otherwise pushes to bufferedGraphDeltas and increments bufferedEventCount.
   */
  bufferGraphDelta: (msg: GraphDeltaMessage) => void;
  /**
   * Buffer an inference message during replay.
   * Pushes to bufferedInferenceMessages and increments bufferedEventCount.
   */
  bufferInference: (msg: InferenceMessage) => void;
  /**
   * Clear both buffer arrays, reset bufferedEventCount to 0, reset bufferOverflowed to false.
   * Call this after draining the buffers on exit-replay.
   */
  clearBuffer: () => void;

  // -------------------------------------------------------------------------
  // Timeline actions — Phase 17
  // -------------------------------------------------------------------------

  /** Replace the snapshots array (called after GET /api/timeline). */
  setSnapshots: (metas: SnapshotMeta[]) => void;
  /**
   * Append a single snapshot to the snapshots array.
   * Called on snapshot_saved WS message — even during replay so the live edge grows.
   */
  appendSnapshot: (meta: SnapshotMeta) => void;
  /** Set the currently scrubbed snapshot index (-1 = not scrubbing). */
  setCurrentSnapshotIndex: (index: number) => void;
  /** Toggle auto-playback state. */
  setIsPlaying: (playing: boolean) => void;
  /** Set playback speed multiplier. */
  setPlaybackSpeed: (speed: 0.5 | 1 | 2 | 4) => void;
  /** Set or clear the diff-base snapshot ID for diff overlay (shift-click). */
  setDiffBase: (snapshotId: number | null) => void;
  /** Signal that replay mode was auto-exited due to a watch-root switch. Pass the new directory path, or null to clear. */
  setReplayExitedForSwitch: (dir: string | null) => void;
}

// Buffer cap — prevents memory issues during long replay sessions.
// When exceeded, exit-replay fetches current live snapshot instead of draining buffer.
const BUFFER_CAP = 500;

// ---------------------------------------------------------------------------
// Store implementation — double-paren pattern for TypeScript middleware compat
// (mirrors graphStore.ts and inferenceStore.ts patterns exactly)
// ---------------------------------------------------------------------------

export const useReplayStore = create<ReplayStore>()((set, get) => ({
  isReplay: false,
  replaySnapshotId: null,
  replayTimestamp: null,
  replayNodes: new Map<string, GraphNode>(),
  replayEdges: new Map<string, GraphEdge>(),
  bufferedGraphDeltas: [],
  bufferedInferenceMessages: [],
  bufferedEventCount: 0,
  bufferOverflowed: false,

  // Timeline and playback defaults
  snapshots: [],
  currentSnapshotIndex: -1,
  isPlaying: false,
  playbackSpeed: 1,
  diffBaseSnapshotId: null,
  replayExitedForSwitch: null,

  enterReplay: (snapshotId, timestamp, nodes, edges) => {
    const nodesMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
    const edgesMap = new Map<string, GraphEdge>(edges.map((e) => [e.id, e]));
    set({
      isReplay: true,
      replaySnapshotId: snapshotId,
      replayTimestamp: timestamp,
      replayNodes: nodesMap,
      replayEdges: edgesMap,
      bufferedGraphDeltas: [],
      bufferedInferenceMessages: [],
      bufferedEventCount: 0,
      bufferOverflowed: false,
      // Entering replay always starts paused — user must explicitly play
      isPlaying: false,
    });
  },

  exitReplay: () => {
    // NOTE: buffers are intentionally preserved — caller drains them, then calls clearBuffer()
    // NOTE: snapshots and playbackSpeed are preserved — snapshots persist across replay sessions;
    //       playbackSpeed is a user preference that persists.
    set({
      isReplay: false,
      replaySnapshotId: null,
      replayTimestamp: null,
      replayNodes: new Map<string, GraphNode>(),
      replayEdges: new Map<string, GraphEdge>(),
      // Reset scrubbing/playback state (but not snapshots or playbackSpeed)
      currentSnapshotIndex: -1,
      isPlaying: false,
      diffBaseSnapshotId: null,
    });
  },

  bufferGraphDelta: (msg) => {
    const state = get();
    if (state.bufferedGraphDeltas.length >= BUFFER_CAP) {
      // Buffer cap exceeded — set overflow flag and drop the message
      if (!state.bufferOverflowed) {
        set({ bufferOverflowed: true });
      }
      return;
    }
    set((s) => ({
      bufferedGraphDeltas: [...s.bufferedGraphDeltas, msg],
      bufferedEventCount: s.bufferedEventCount + 1,
    }));
  },

  bufferInference: (msg) => {
    set((s) => ({
      bufferedInferenceMessages: [...s.bufferedInferenceMessages, msg],
      bufferedEventCount: s.bufferedEventCount + 1,
    }));
  },

  clearBuffer: () => {
    set({
      bufferedGraphDeltas: [],
      bufferedInferenceMessages: [],
      bufferedEventCount: 0,
      bufferOverflowed: false,
    });
  },

  // -------------------------------------------------------------------------
  // Timeline action implementations — Phase 17
  // -------------------------------------------------------------------------

  setSnapshots: (metas: SnapshotMeta[]) => {
    set({ snapshots: metas });
  },

  appendSnapshot: (meta: SnapshotMeta) => {
    set((s) => ({ snapshots: [...s.snapshots, meta] }));
  },

  setCurrentSnapshotIndex: (index: number) => {
    set({ currentSnapshotIndex: index });
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setPlaybackSpeed: (speed: 0.5 | 1 | 2 | 4) => {
    set({ playbackSpeed: speed });
  },

  setDiffBase: (snapshotId: number | null) => {
    set({ diffBaseSnapshotId: snapshotId });
  },

  setReplayExitedForSwitch: (dir: string | null) => {
    set({ replayExitedForSwitch: dir });
  },
}));

// ---------------------------------------------------------------------------
// Vanilla reference for WsClient and App.tsx (same pattern as graphStore.ts)
// ---------------------------------------------------------------------------

export const replayStore = useReplayStore;
