import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { graphNodes } from '../schema.js';
export const nodesRepository = {
    findById(id) {
        return db.select().from(graphNodes).where(eq(graphNodes.id, id)).get();
    },
    findAll() {
        return db.select().from(graphNodes).all();
    },
    upsert(node) {
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
    deleteById(id) {
        db.delete(graphNodes).where(eq(graphNodes.id, id)).run();
    },
};
//# sourceMappingURL=nodes.js.map