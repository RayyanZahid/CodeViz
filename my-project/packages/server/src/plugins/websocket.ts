import fastifyWebsocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { InferenceEngine } from '../inference/InferenceEngine.js';
import type {
  ServerMessage,
  GraphDeltaMessage,
  InferenceMessage,
  GraphNode,
  GraphEdge,
} from '@archlens/shared/types';
import type { GraphDelta, NodeMetadata } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Connected client set — managed at module level, not per-connection
// ---------------------------------------------------------------------------

const clients = new Set<WebSocket>();

/**
 * Broadcasts a ServerMessage to all currently connected WebSocket clients.
 * Checks readyState before sending to avoid sending to closing/closed sockets.
 */
function broadcast(message: ServerMessage): void {
  const json = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(json);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helper: map internal NodeMetadata to wire-format GraphNode
// ---------------------------------------------------------------------------

function buildGraphNode(id: string, meta: NodeMetadata, inDegree: number, outDegree: number): GraphNode {
  return {
    id,
    name: id.split('/').pop()?.replace(/\.\w+$/, '') ?? id,
    nodeType: 'service_module', // Default — Phase 4 zone classification enriches this
    zone: null, // Zone filled by InferenceMessage zone updates
    fileList: [meta.filePath],
    incomingEdgeCount: inDegree,
    outgoingEdgeCount: outDegree,
    lastModified: new Date(meta.lastModified),
  };
}

// ---------------------------------------------------------------------------
// WebSocket Plugin
// ---------------------------------------------------------------------------

export const websocketPlugin: FastifyPluginAsync<{
  graph: DependencyGraph;
  inferenceEngine: InferenceEngine;
}> = async (fastify, { graph, inferenceEngine }) => {
  // Register @fastify/websocket as a sub-plugin so this plugin's routes
  // can use { websocket: true } route options.
  await fastify.register(fastifyWebsocket);

  // Subscribe to graph delta events ONCE at plugin registration time —
  // NOT inside the per-connection handler (avoids O(N^2) listener leak,
  // per RESEARCH.md Pitfall 4).
  graph.on('delta', (delta: GraphDelta) => {
    // Map internal delta (node IDs as strings) to wire-format GraphDeltaMessage
    // (node IDs as GraphNode objects with full metadata).
    const addedNodes: GraphNode[] = delta.addedNodes
      .filter((id) => !id.startsWith('__ext__/'))
      .map((id) => {
        const meta = graph.getNodeMetadata(id);
        if (!meta) return null;
        return buildGraphNode(id, meta, graph.getInDegree(id), graph.getOutDegree(id));
      })
      .filter((n): n is GraphNode => n !== null);

    const updatedNodes: GraphNode[] = delta.modifiedNodes
      .filter((id) => !id.startsWith('__ext__/'))
      .map((id) => {
        const meta = graph.getNodeMetadata(id);
        if (!meta) return null;
        return buildGraphNode(id, meta, graph.getInDegree(id), graph.getOutDegree(id));
      })
      .filter((n): n is GraphNode => n !== null);

    const addedEdges: GraphEdge[] = delta.addedEdges
      .filter((e) => !e.v.startsWith('__ext__/') && !e.w.startsWith('__ext__/'))
      .map((e) => ({
        id: `${e.v}->${e.w}`,
        sourceId: e.v,
        targetId: e.w,
        edgeType: 'imports_depends_on' as const,
      }));

    const message: GraphDeltaMessage = {
      type: 'graph_delta',
      version: delta.version,
      addedNodes,
      removedNodeIds: delta.removedNodeIds.filter((id) => !id.startsWith('__ext__/')),
      updatedNodes,
      addedEdges,
      removedEdgeIds: delta.removedEdgeIds.filter((id) => !id.includes('__ext__/')),
    };

    broadcast(message);
  });

  // Subscribe to inference events ONCE at plugin registration time.
  inferenceEngine.on('inference', (result) => {
    const message: InferenceMessage = {
      type: 'inference',
      version: result.graphVersion,
      zoneUpdates: result.zoneUpdates,
      architecturalEvents: result.architecturalEvents,
      risks: result.risks,
    };

    broadcast(message);
  });

  // Register the /ws route. The handler receives the WebSocket directly
  // (v10+ API — NOT the old `connection.socket` SocketStream pattern).
  fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
    // Add to the connected client set.
    clients.add(socket);

    // Send the full graph snapshot immediately on connect so the client
    // has complete state without needing to request it separately.
    const { nodes, edges } = graph.getSnapshot();
    const initialState: ServerMessage = {
      type: 'initial_state',
      version: graph.getVersion(),
      nodes,
      edges,
      layoutPositions: {}, // Phase 6 will populate from SQLite layout_positions table
    };
    socket.send(JSON.stringify(initialState));

    // No-op for messages from client — Phase 5 is server-to-client only.
    socket.on('message', (_data) => {
      // Reserved for future client-to-server commands (Phase 7+).
    });

    // Remove from client set on disconnect to prevent memory leaks
    // and sending to stale sockets.
    socket.on('close', () => {
      clients.delete(socket);
    });
  });
};
