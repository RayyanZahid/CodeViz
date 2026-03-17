import { eq, asc, and, isNull } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { intentSessions } from '../schema.js';

export type IntentSessionRow = InferSelectModel<typeof intentSessions>;
export type IntentSessionInsert = InferInsertModel<typeof intentSessions>;

export const intentSessionsRepository = {
  insert(session: Omit<IntentSessionInsert, 'id'>): number {
    const result = db.insert(intentSessions).values(session).run();
    return Number(result.lastInsertRowid);
  },

  findById(id: number): IntentSessionRow | undefined {
    return db.select().from(intentSessions).where(eq(intentSessions.id, id)).get();
  },

  findBySession(sessionId: string): IntentSessionRow[] {
    return db
      .select()
      .from(intentSessions)
      .where(eq(intentSessions.sessionId, sessionId))
      .orderBy(asc(intentSessions.startedAt))
      .all();
  },

  findActive(sessionId: string): IntentSessionRow | undefined {
    return db
      .select()
      .from(intentSessions)
      .where(and(eq(intentSessions.sessionId, sessionId), isNull(intentSessions.endedAt)))
      .get();
  },

  close(id: number, endSnapshotId: number | null, endedAt: Date): void {
    db.update(intentSessions)
      .set({ endSnapshotId, endedAt })
      .where(eq(intentSessions.id, id))
      .run();
  },

  deleteBySession(sessionId: string): void {
    db.delete(intentSessions).where(eq(intentSessions.sessionId, sessionId)).run();
  },

  deleteByWatchRoot(watchRoot: string): void {
    db.delete(intentSessions).where(eq(intentSessions.watchRoot, watchRoot)).run();
  },
};
