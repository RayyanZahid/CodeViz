import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { graphNodes } from '../schema.js';
export type GraphNodeRow = InferSelectModel<typeof graphNodes>;
export type GraphNodeInsert = InferInsertModel<typeof graphNodes>;
export declare const nodesRepository: {
    findById(id: string): GraphNodeRow | undefined;
    findAll(): GraphNodeRow[];
    upsert(node: GraphNodeInsert): void;
    deleteById(id: string): void;
};
//# sourceMappingURL=nodes.d.ts.map