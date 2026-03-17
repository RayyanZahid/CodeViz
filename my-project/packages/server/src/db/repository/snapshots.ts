import { eq, asc, desc, sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphSnapshots } from '../schema.js';

export type GraphSnapshotRow = InferSelectModel<typeof graphSnapshots>;
export type GraphSnapshotInsert = InferInsertModel<typeof graphSnapshots>;

export const snapshotsRepository = {
  insert(snapshot: Omit<GraphSnapshotInsert, 'id'>): number {
    const result = db.insert(graphSnapshots).values(snapshot).run();
    return Number(result.lastInsertRowid);
  },

  findById(id: number): GraphSnapshotRow | undefined {
    return db.select().from(graphSnapshots).where(eq(graphSnapshots.id, id)).get();
  },

  findBySession(sessionId: string): GraphSnapshotRow[] {
    return db
      .select()
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .orderBy(asc(graphSnapshots.sequenceNumber))
      .all();
  },

  getMetaBySession(
    sessionId: string,
  ): Array<{ id: number; sessionId: string; sequenceNumber: number; timestamp: Date; summary: string; triggerFiles: string[] }> {
    return db
      .select({
        id: graphSnapshots.id,
        sessionId: graphSnapshots.sessionId,
        sequenceNumber: graphSnapshots.sequenceNumber,
        timestamp: graphSnapshots.timestamp,
        summary: graphSnapshots.summary,
        triggerFiles: graphSnapshots.triggerFiles,
      })
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .orderBy(asc(graphSnapshots.sequenceNumber))
      .all();
  },

  getCount(sessionId: string): number {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .get();
    return result?.count ?? 0;
  },

  deleteOldest(sessionId: string): void {
    const oldest = db
      .select({ id: graphSnapshots.id })
      .from(graphSnapshots)
      .where(eq(graphSnapshots.sessionId, sessionId))
      .orderBy(asc(graphSnapshots.sequenceNumber))
      .limit(1)
      .get();
    if (oldest) {
      db.delete(graphSnapshots).where(eq(graphSnapshots.id, oldest.id)).run();
    }
  },

  deleteBySession(sessionId: string): void {
    db.delete(graphSnapshots).where(eq(graphSnapshots.sessionId, sessionId)).run();
  },

  deleteByWatchRoot(watchRoot: string): void {
    db.delete(graphSnapshots).where(eq(graphSnapshots.watchRoot, watchRoot)).run();
  },
};
