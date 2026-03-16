import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { layoutPositions } from '../schema.js';
export const positionsRepository = {
    findByNodeId(nodeId) {
        return db.select().from(layoutPositions).where(eq(layoutPositions.nodeId, nodeId)).get();
    },
    findAll() {
        return db.select().from(layoutPositions).all();
    },
    upsert(position) {
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
    deleteByNodeId(nodeId) {
        db.delete(layoutPositions).where(eq(layoutPositions.nodeId, nodeId)).run();
    },
};
//# sourceMappingURL=positions.js.map