import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { graphEdges } from '../schema.js';
export type GraphEdgeRow = InferSelectModel<typeof graphEdges>;
export type GraphEdgeInsert = InferInsertModel<typeof graphEdges>;
export declare const edgesRepository: {
    findById(id: string): GraphEdgeRow | undefined;
    findAll(): GraphEdgeRow[];
    findByNodeId(nodeId: string): GraphEdgeRow[];
    insert(edge: GraphEdgeInsert): void;
    deleteById(id: string): void;
    deleteByNodeId(nodeId: string): void;
};
//# sourceMappingURL=edges.d.ts.map