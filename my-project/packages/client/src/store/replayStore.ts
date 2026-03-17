import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import type { GraphDeltaMessage, InferenceMessage } from '@archlens/shared/types';

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
    });
  },

  exitReplay: () => {
    // NOTE: buffers are intentionally preserved — caller drains them, then calls clearBuffer()
    set({
      isReplay: false,
      replaySnapshotId: null,
      replayTimestamp: null,
      replayNodes: new Map<string, GraphNode>(),
      replayEdges: new Map<string, GraphEdge>(),
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
}));

// ---------------------------------------------------------------------------
// Vanilla reference for WsClient and App.tsx (same pattern as graphStore.ts)
// ---------------------------------------------------------------------------

export const replayStore = useReplayStore;
