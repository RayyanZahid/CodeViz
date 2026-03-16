import fastifyWebsocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { InferenceEngine } from '../inference/InferenceEngine.js';
import type { ComponentAggregator } from '../graph/ComponentAggregator.js';
import type {
  ServerMessage,
  GraphDeltaMessage,
  InferenceMessage,
  GraphNode,
  GraphEdge,
} from '@archlens/shared/types';
import type { GraphDelta, NodeMetadata } from '@archlens/shared/types';
import { normalizeExt } from '../graph/DependencyGraph.js';
import { db } from '../db/connection.js';

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

function buildGraphNode(id: string, meta: NodeMetadata, inDegree: number, outDegree: number, zone?: string | null): GraphNode {
  return {
    id,
    name: id.split('/').pop()?.replace(/\.\w+$/, '') ?? id,
    nodeType: 'service_module',
    zone: zone ?? null,
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
  aggregator: ComponentAggregator;
}> = async (fastify, { graph, inferenceEngine, aggregator }) => {
  // Register @fastify/websocket as a sub-plugin so this plugin's routes
  // can use { websocket: true } route options.
  await fastify.register(fastifyWebsocket);

  // Subscribe to graph delta events ONCE at plugin registration time —
  // NOT inside the per-connection handler (avoids O(N^2) listener leak,
  // per RESEARCH.md Pitfall 4).
  graph.on('delta', (delta: GraphDelta) => {
    // Recompute full component snapshot and diff against previous
    const prevSnapshot = aggregator.getLastSnapshot();
    const newSnapshot = aggregator.aggregateSnapshot(graph, db);

    // Build node ID sets for diffing
    const prevNodeIds = new Set(prevSnapshot?.nodes.map((n) => n.id) ?? []);
    const newNodeIds = new Set(newSnapshot.nodes.map((n) => n.id));
    const prevEdgeIds = new Set(prevSnapshot?.edges.map((e) => e.id) ?? []);
    const newEdgeIds = new Set(newSnapshot.edges.map((e) => e.id));

    // Compute added/removed/updated nodes
    const addedNodes = newSnapshot.nodes.filter((n) => !prevNodeIds.has(n.id));
    const removedNodeIds = [...prevNodeIds].filter((id) => !newNodeIds.has(id));

    // Updated nodes: exist in both but changed
    const prevNodeMap = new Map(prevSnapshot?.nodes.map((n) => [n.id, n]) ?? []);
    const updatedNodes = newSnapshot.nodes.filter((n) => {
      const prev = prevNodeMap.get(n.id);
      if (!prev) return false;
      return (
        prev.zone !== n.zone ||
        prev.fileCount !== n.fileCount ||
        prev.incomingEdgeCount !== n.incomingEdgeCount ||
        prev.outgoingEdgeCount !== n.outgoingEdgeCount
      );
    });

    // Compute added/removed edges
    const addedEdges = newSnapshot.edges.filter((e) => !prevEdgeIds.has(e.id));
    const removedEdgeIds = [...prevEdgeIds].filter((id) => !newEdgeIds.has(id));

    const message: GraphDeltaMessage = {
      type: 'graph_delta',
      version: delta.version,
      addedNodes,
      removedNodeIds,
      updatedNodes,
      addedEdges,
      removedEdgeIds,
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

    // Send the full component-level snapshot immediately on connect so the
    // client has complete state without needing to request it separately.
    const { nodes, edges } = aggregator.aggregateSnapshot(graph, db);
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
