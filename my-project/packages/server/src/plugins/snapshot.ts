import type { FastifyPluginAsync } from 'fastify';
import type { DependencyGraph } from '../graph/DependencyGraph.js';
import type { InitialStateMessage } from '@archlens/shared/types';

/**
 * REST snapshot plugin — provides GET /api/snapshot for reconnect recovery.
 *
 * Returns the current full graph state as an InitialStateMessage so clients
 * can recover complete state after a version gap or reconnection event without
 * needing to replay individual delta messages from the beginning.
 */
export const snapshotPlugin: FastifyPluginAsync<{
  graph: DependencyGraph;
}> = async (fastify, { graph }) => {
  fastify.get('/api/snapshot', async (_req, reply) => {
    const { nodes, edges } = graph.getSnapshot();
    const response: InitialStateMessage = {
      type: 'initial_state',
      version: graph.getVersion(),
      nodes,
      edges,
      layoutPositions: {}, // Phase 6 will populate this from SQLite layout_positions table
    };
    return reply.send(response);
  });
};
