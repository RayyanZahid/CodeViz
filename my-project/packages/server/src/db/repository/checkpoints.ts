import { eq, asc, sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { snapshotCheckpoints } from '../schema.js';

export type CheckpointRow = InferSelectModel<typeof snapshotCheckpoints>;
export type CheckpointInsert = InferInsertModel<typeof snapshotCheckpoints>;

export const checkpointsRepository = {
  insert(checkpoint: Omit<CheckpointInsert, 'id'>): number {
    const result = db.insert(snapshotCheckpoints).values(checkpoint).run();
    return Number(result.lastInsertRowid);
  },

  getBySession(sessionId: string): CheckpointRow[] {
    return db
      .select()
      .from(snapshotCheckpoints)
      .where(eq(snapshotCheckpoints.sessionId, sessionId))
      .orderBy(asc(snapshotCheckpoints.sequenceNumber))
      .all();
  },

  getSnapshotIds(sessionId: string): number[] {
    return db
      .select({ snapshotId: snapshotCheckpoints.snapshotId })
      .from(snapshotCheckpoints)
      .where(eq(snapshotCheckpoints.sessionId, sessionId))
      .all()
      .map(r => r.snapshotId);
  },

  getCount(sessionId: string): number {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(snapshotCheckpoints)
      .where(eq(snapshotCheckpoints.sessionId, sessionId))
      .get();
    return result?.count ?? 0;
  },

  deleteOldest(sessionId: string): void {
    const oldest = db
      .select({ id: snapshotCheckpoints.id })
      .from(snapshotCheckpoints)
      .where(eq(snapshotCheckpoints.sessionId, sessionId))
      .orderBy(asc(snapshotCheckpoints.sequenceNumber))
      .limit(1)
      .get();
    if (oldest) {
      db.delete(snapshotCheckpoints).where(eq(snapshotCheckpoints.id, oldest.id)).run();
    }
  },

  deleteBySession(sessionId: string): void {
    db.delete(snapshotCheckpoints).where(eq(snapshotCheckpoints.sessionId, sessionId)).run();
  },

  deleteByWatchRoot(watchRoot: string): void {
    db.delete(snapshotCheckpoints).where(eq(snapshotCheckpoints.watchRoot, watchRoot)).run();
  },
};
