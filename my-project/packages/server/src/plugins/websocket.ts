import fastifyWebsocket from '@fastify/websocket';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { ComponentAggregator } from '../graph/ComponentAggregator.js';
import type {
  ServerMessage,
  GraphDeltaMessage,
  InferenceResult,
} from '@archlens/shared/types';
import type { GraphDelta } from '@archlens/shared/types';
import { db } from '../db/connection.js';

// ---------------------------------------------------------------------------
// Inference ID translation — file-level to component-level
// ---------------------------------------------------------------------------

/**
 * Translates inference result node IDs from file-level (e.g., src/parser/worker.ts)
 * to component-level (e.g., src/parser) using the provided file-to-component map.
 *
 * Per user decision: unmapped file IDs are silently skipped — they will appear
 * after the next inference cycle once the aggregator has processed them.
 * Returns null if nothing survives translation (caller skips broadcast).
 */
export function translateInferenceToComponentIds(
  result: InferenceResult,
  fileToComp: Map<string, string>,
): InferenceResult | null {
  // Translate zone updates — skip entries where file has no component mapping
  const zoneUpdates = [];
  for (const zu of result.zoneUpdates) {
    const compId = fileToComp.get(zu.nodeId);
    if (!compId) continue; // unmapped file, skip per user decision
    zoneUpdates.push({ ...zu, nodeId: compId });
  }
  // Deduplicate zone updates by nodeId (multiple files in same component may have same zone)
  const seenZoneNodes = new Set<string>();
  const dedupedZoneUpdates = zoneUpdates.filter(zu => {
    if (seenZoneNodes.has(zu.nodeId)) return false;
    seenZoneNodes.add(zu.nodeId);
    return true;
  });

  // Translate architectural events — skip if nodeId unmapped
  const architecturalEvents = [];
  for (const event of result.architecturalEvents) {
    const compId = fileToComp.get(event.nodeId);
    if (!compId) continue; // unmapped file, skip
    const translated = { ...event, nodeId: compId };
    if (event.targetNodeId) {
      const targetCompId = fileToComp.get(event.targetNodeId);
      if (targetCompId) {
        translated.targetNodeId = targetCompId;
      } else {
        translated.targetNodeId = undefined; // target unmapped, clear it
      }
    }
    architecturalEvents.push(translated);
  }

  // Translate risks — skip if nodeId unmapped
  const risks = [];
  for (const risk of result.risks) {
    const compId = fileToComp.get(risk.nodeId);
    if (!compId) continue; // unmapped file, skip
    const translated = { ...risk, nodeId: compId };
    if (risk.affectedNodeIds) {
      translated.affectedNodeIds = risk.affectedNodeIds
        .map(id => fileToComp.get(id))
        .filter((id): id is string => id !== undefined);
    }
    risks.push(translated);
  }

  // If nothing survived translation, don't broadcast
  if (dedupedZoneUpdates.length === 0 && architecturalEvents.length === 0 && risks.length === 0) {
    return null;
  }

  return {
    zoneUpdates: dedupedZoneUpdates,
    architecturalEvents,
    risks,
    graphVersion: result.graphVersion,
  };
}

// ---------------------------------------------------------------------------
// Connected client set — managed at module level, not per-connection
// ---------------------------------------------------------------------------

const clients = new Set<WebSocket>();

/**
 * Broadcasts a ServerMessage to all currently connected WebSocket clients.
 * Checks readyState before sending to avoid sending to closing/closed sockets.
 *
 * Exported so index.ts can use it to send watch_root_changed notifications
 * and wire new InferenceEngine inference broadcasts on watch-root switch.
 */
export function broadcast(message: ServerMessage): void {
  const json = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(json);
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket Plugin
// ---------------------------------------------------------------------------

export const websocketPlugin: FastifyPluginAsync<{
  graph: DependencyGraph;
  aggregator: ComponentAggregator;
}> = async (fastify, { graph, aggregator }) => {
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

  // Note: inference event subscription is wired in index.ts via wireInferenceBroadcast()
  // so it can be re-registered when the watch root switches and a new InferenceEngine
  // is created. The graph delta subscription above stays here since graph is stable.

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
