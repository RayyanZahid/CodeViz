import { eq, or } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphEdges } from '../schema.js';
export const edgesRepository = {
    findById(id) {
        return db.select().from(graphEdges).where(eq(graphEdges.id, id)).get();
    },
    findAll() {
        return db.select().from(graphEdges).all();
    },
    findByNodeId(nodeId) {
        return db
            .select()
            .from(graphEdges)
            .where(or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId)))
            .all();
    },
    insert(edge) {
        db.insert(graphEdges).values(edge).run();
    },
    deleteById(id) {
        db.delete(graphEdges).where(eq(graphEdges.id, id)).run();
    },
    deleteByNodeId(nodeId) {
        db
            .delete(graphEdges)
            .where(or(eq(graphEdges.sourceId, nodeId), eq(graphEdges.targetId, nodeId)))
            .run();
    },
};
//# sourceMappingURL=edges.js.map