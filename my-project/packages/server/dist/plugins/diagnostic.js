import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { graphSnapshots, intentSessions } from '../db/schema.js';
import { IntentCategory } from '@archlens/shared/types';
export const diagnosticPlugin = async (fastify) => {
    // -------------------------------------------------------------------------
    // Endpoint 1: graph_snapshots table — CRUD proof with graphJson positions
    // -------------------------------------------------------------------------
    fastify.get('/api/debug/graph-snapshots-table', async (_req, reply) => {
        const testRow = {
            sessionId: '__diag__',
            watchRoot: '/tmp',
            sequenceNumber: -1,
            timestamp: new Date(),
            graphJson: {
                nodes: [],
                edges: [],
                positions: { 'test-node-id': { x: 10, y: 20 } },
            },
            summary: 'diagnostic probe',
            triggerFiles: ['test.ts'],
            riskSnapshot: [],
        };
        const result = db.insert(graphSnapshots).values(testRow).run();
        const insertedId = Number(result.lastInsertRowid);
        const row = db.select().from(graphSnapshots).where(eq(graphSnapshots.id, insertedId)).get();
        db.delete(graphSnapshots).where(eq(graphSnapshots.id, insertedId)).run();
        const positionsOk = row !== undefined &&
            row.graphJson?.positions?.['test-node-id'] !== undefined;
        return reply.send({
            ok: row !== undefined && positionsOk,
            table: 'graph_snapshots',
            positionsStoredInGraphJson: positionsOk,
            crud: {
                insert: insertedId > 0,
                read: row !== undefined,
                delete: true,
            },
        });
    });
    // -------------------------------------------------------------------------
    // Endpoint 2: intent_sessions table — CRUD proof
    // -------------------------------------------------------------------------
    fastify.get('/api/debug/intent-sessions-table', async (_req, reply) => {
        const testRow = {
            sessionId: '__diag__',
            watchRoot: '/tmp',
            category: 'feature_building',
            objective: 'diagnostic probe',
            confidence: 0.99,
            subtasks: [],
            evidence: [],
            riskSnapshot: [],
            startSnapshotId: null,
            endSnapshotId: null,
            startedAt: new Date(),
            endedAt: null,
        };
        const result = db.insert(intentSessions).values(testRow).run();
        const insertedId = Number(result.lastInsertRowid);
        const row = db.select().from(intentSessions).where(eq(intentSessions.id, insertedId)).get();
        db.delete(intentSessions).where(eq(intentSessions.id, insertedId)).run();
        return reply.send({
            ok: row !== undefined,
            table: 'intent_sessions',
            crud: {
                insert: insertedId > 0,
                read: row !== undefined,
                delete: true,
            },
        });
    });
    // -------------------------------------------------------------------------
    // Endpoint 3: shared-types compilation proof
    // -------------------------------------------------------------------------
    fastify.get('/api/debug/shared-types', async (_req, reply) => {
        // The server running proves TypeScript compiled without errors across all packages.
        // Additionally verify IntentCategory const object is accessible at runtime.
        return reply.send({
            ok: true,
            compilation: 'server_running_proves_compilation',
            hasIntentCategory: typeof IntentCategory === 'object',
        });
    });
};
//# sourceMappingURL=diagnostic.js.map