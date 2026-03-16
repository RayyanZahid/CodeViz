import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { layoutPositions } from '../schema.js';
export type LayoutPositionRow = InferSelectModel<typeof layoutPositions>;
export type LayoutPositionInsert = InferInsertModel<typeof layoutPositions>;
export declare const positionsRepository: {
    findByNodeId(nodeId: string): LayoutPositionRow | undefined;
    findAll(): LayoutPositionRow[];
    upsert(position: LayoutPositionInsert): void;
    deleteByNodeId(nodeId: string): void;
};
//# sourceMappingURL=positions.d.ts.map