import { eq, or } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphEdges } from '../schema.js';

export type GraphEdgeRow = InferSelectModel<typeof graphEdges>;
export type GraphEdgeInsert = InferInsertModel<typeof graphEdges>;

export const edgesRepository = {
  findById(id: string): GraphEdgeRow | undefined {
    return db.select().from(graphEdges).where(eq(graphEdges.id, id)).get();
  },

  findAll(): GraphEdgeRow[] {
    return db.select().from(graphEdges).all();
  },

  findByNodeId(nodeId: string): GraphEdgeRow[] {
    return db
      .select()
      .from(graphEdges)
      .where(or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId)))
      .all();
  },

  insert(edge: GraphEdgeInsert): void {
    db.insert(graphEdges).values(edge).run();
  },

  deleteById(id: string): void {
    db.delete(graphEdges).where(eq(graphEdges.id, id)).run();
  },

  deleteByNodeId(nodeId: string): void {
    db
      .delete(graphEdges)
      .where(or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId)))
      .run();
  },
};
