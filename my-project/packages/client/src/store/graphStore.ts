import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import type { GraphDeltaMessage, InitialStateMessage } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'syncing';

export interface ChangeSummary {
  addedNodes: number;
  removedNodes: number;
  addedEdges: number;
  removedEdges: number;
}

export interface GraphStore {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  version: number;
  connectionStatus: ConnectionStatus;
  /** Set on reconnect when changes occurred while away. */
  changeSummary: ChangeSummary | null;
  /** Currently watched directory — pre-filled from GET /api/watch on mount. */
  watchRoot: string;
  /** True while a watch-root switch is in progress (between watch_root_changed and first graph_delta). */
  scanning: boolean;

  // Actions — called by WsClient, not React components
  applyDelta: (msg: GraphDeltaMessage) => void;
  applySnapshot: (msg: InitialStateMessage) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setChangeSummary: (summary: ChangeSummary | null) => void;
  resetState: () => void;
  setWatchRoot: (dir: string) => void;
  setScanning: (scanning: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store implementation — double-paren pattern for TypeScript middleware compat
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphStore>()((set, get) => ({
  nodes: new Map<string, GraphNode>(),
  edges: new Map<string, GraphEdge>(),
  version: 0,
  connectionStatus: 'connecting',
  changeSummary: null,
  watchRoot: '',
  scanning: false,

  applyDelta: (msg: GraphDeltaMessage) => {
    const current = get();

    // Create new Map copies for immutable Zustand update
    const newNodes = new Map<string, GraphNode>(current.nodes);
    const newEdges = new Map<string, GraphEdge>(current.edges);

    // Remove nodes by ID
    for (const nodeId of msg.removedNodeIds) {
      newNodes.delete(nodeId);
    }

    // Remove edges by ID
    for (const edgeId of msg.removedEdgeIds) {
      newEdges.delete(edgeId);
    }

    // Add/update nodes from addedNodes and updatedNodes
    for (const node of msg.addedNodes) {
      newNodes.set(node.id, node);
    }
    for (const node of msg.updatedNodes) {
      newNodes.set(node.id, node);
    }

    // Add edges from addedEdges
    for (const edge of msg.addedEdges) {
      newEdges.set(edge.id, edge);
    }

    set({
      nodes: newNodes,
      edges: newEdges,
      version: msg.version,
    });
  },

  applySnapshot: (msg: InitialStateMessage) => {
    const newNodes = new Map<string, GraphNode>();
    const newEdges = new Map<string, GraphEdge>();

    for (const node of msg.nodes) {
      newNodes.set(node.id, node);
    }
    for (const edge of msg.edges) {
      newEdges.set(edge.id, edge);
    }

    set({
      nodes: newNodes,
      edges: newEdges,
      version: msg.version,
      connectionStatus: 'connected',
    });
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set({ connectionStatus: status });
  },

  setChangeSummary: (summary: ChangeSummary | null) => {
    set({ changeSummary: summary });
  },

  resetState: () => {
    set({
      nodes: new Map<string, GraphNode>(),
      edges: new Map<string, GraphEdge>(),
      version: 0,
      connectionStatus: 'connected', // Stay connected — WS is still alive
      changeSummary: null,
    });
  },

  setWatchRoot: (dir: string) => {
    set({ watchRoot: dir });
  },

  setScanning: (scanning: boolean) => {
    set({ scanning });
  },
}));

// ---------------------------------------------------------------------------
// Vanilla reference for WsClient (useGraphStore itself works as vanilla via
// .getState()/.setState())
// ---------------------------------------------------------------------------
export const graphStore = useGraphStore;
