import { eq } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphNodes } from '../schema.js';

export type GraphNodeRow = InferSelectModel<typeof graphNodes>;
export type GraphNodeInsert = InferInsertModel<typeof graphNodes>;

export const nodesRepository = {
  findById(id: string): GraphNodeRow | undefined {
    return db.select().from(graphNodes).where(eq(graphNodes.id, id)).get();
  },

  findAll(): GraphNodeRow[] {
    return db.select().from(graphNodes).all();
  },

  upsert(node: GraphNodeInsert): void {
    db.insert(graphNodes)
      .values(node)
      .onConflictDoUpdate({
        target: graphNodes.id,
        set: {
          name: node.name,
          nodeType: node.nodeType,
          zone: node.zone,
          fileList: node.fileList,
          incomingEdgeCount: node.incomingEdgeCount,
          outgoingEdgeCount: node.outgoingEdgeCount,
          lastModified: node.lastModified,
        },
      })
      .run();
  },

  deleteById(id: string): void {
    db.delete(graphNodes).where(eq(graphNodes.id, id)).run();
  },
};
