import type { FastifyPluginAsync } from 'fastify';
import { snapshotsRepository } from '../db/repository/snapshots.js';
import { intentSessionsRepository } from '../db/repository/intentSessions.js';

interface TimelinePluginOptions {
  getSessionId: () => string;
}

export const timelinePlugin: FastifyPluginAsync<TimelinePluginOptions> = async (
  fastify,
  { getSessionId },
) => {
  // GET /api/timeline — returns SnapshotMeta[] for the current session
  // No pagination — assumes <1000 snapshots per session (per CONTEXT.md decision)
  fastify.get('/api/timeline', async (_req, reply) => {
    const rows = snapshotsRepository.getMetaBySession(getSessionId());
    // Convert Date objects to epoch milliseconds (Drizzle timestamp_ms mode returns Date)
    // per RESEARCH.md Pitfall 1: SnapshotMeta.timestamp is number, not Date
    const meta = rows.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      sequenceNumber: row.sequenceNumber,
      timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : row.timestamp,
      summary: row.summary,
      triggerFiles: row.triggerFiles,
    }));
    return reply.send(meta);
  });

  // GET /api/snapshot/:id — returns bundled snapshot (nodes, edges, positions)
  // This is the HISTORICAL snapshot endpoint — distinct from GET /api/snapshot
  // (current live state) which lives in snapshot.ts. Fastify routes them correctly
  // since :id makes them parametric vs static (per RESEARCH.md Pitfall 5).
  fastify.get('/api/snapshot/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return reply.status(400).send({ error: 'Invalid snapshot ID' });
    }

    const row = snapshotsRepository.findById(numId);
    if (!row) {
      return reply.status(404).send({ error: 'Snapshot not found' });
    }

    // Bundle response: spread graphJson (nodes, edges, positions) + metadata
    // per CONTEXT.md: single payload, one round trip
    const graphJson = row.graphJson as { nodes: unknown[]; edges: unknown[]; positions: Record<string, unknown> };
    return reply.send({
      id: row.id,
      sequenceNumber: row.sequenceNumber,
      timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : row.timestamp,
      nodes: graphJson.nodes,
      edges: graphJson.edges,
      positions: graphJson.positions,
    });
  });

  // GET /api/intents — returns IntentSession[] for the current session
  // Decoupled from timeline data per CONTEXT.md decision
  fastify.get('/api/intents', async (_req, reply) => {
    const sessions = intentSessionsRepository.findBySession(getSessionId());
    // Convert Date fields to epoch ms for consistent JSON serialization
    const mapped = sessions.map(s => ({
      id: s.id,
      sessionId: s.sessionId,
      category: s.category,
      objective: s.objective,
      confidence: s.confidence,
      subtasks: s.subtasks,
      startSnapshotId: s.startSnapshotId,
      endSnapshotId: s.endSnapshotId,
      startedAt: s.startedAt instanceof Date ? s.startedAt.getTime() : s.startedAt,
      endedAt: s.endedAt instanceof Date ? s.endedAt.getTime() : s.endedAt,
    }));
    return reply.send(mapped);
  });
};
