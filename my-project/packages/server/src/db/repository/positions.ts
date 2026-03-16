import { eq } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { layoutPositions } from '../schema.js';

export type LayoutPositionRow = InferSelectModel<typeof layoutPositions>;
export type LayoutPositionInsert = InferInsertModel<typeof layoutPositions>;

export const positionsRepository = {
  findByNodeId(nodeId: string): LayoutPositionRow | undefined {
    return db.select().from(layoutPositions).where(eq(layoutPositions.nodeId, nodeId)).get();
  },

  findAll(): LayoutPositionRow[] {
    return db.select().from(layoutPositions).all();
  },

  upsert(position: LayoutPositionInsert): void {
    db.insert(layoutPositions)
      .values(position)
      .onConflictDoUpdate({
        target: layoutPositions.nodeId,
        set: {
          x: position.x,
          y: position.y,
          zone: position.zone,
          updatedAt: position.updatedAt,
        },
      })
      .run();
  },

  deleteByNodeId(nodeId: string): void {
    db.delete(layoutPositions).where(eq(layoutPositions.nodeId, nodeId)).run();
  },
};
