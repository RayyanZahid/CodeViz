import { gt, asc, sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { changeEvents } from '../schema.js';

export type ChangeEventRow = InferSelectModel<typeof changeEvents>;
export type ChangeEventInsert = InferInsertModel<typeof changeEvents>;

export const eventsRepository = {
  append(event: Omit<ChangeEventInsert, 'id'>): void {
    db.insert(changeEvents).values(event).run();
  },

  findAll(): ChangeEventRow[] {
    return db.select().from(changeEvents).orderBy(asc(changeEvents.id)).all();
  },

  findSince(sequenceId: number): ChangeEventRow[] {
    return db
      .select()
      .from(changeEvents)
      .where(gt(changeEvents.id, sequenceId))
      .orderBy(asc(changeEvents.id))
      .all();
  },

  getLatestSequence(): number {
    const result = db
      .select({ maxId: sql<number>`max(${changeEvents.id})` })
      .from(changeEvents)
      .get();
    return result?.maxId ?? 0;
  },
};
