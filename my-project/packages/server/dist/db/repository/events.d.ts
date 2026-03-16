import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { changeEvents } from '../schema.js';
export type ChangeEventRow = InferSelectModel<typeof changeEvents>;
export type ChangeEventInsert = InferInsertModel<typeof changeEvents>;
export declare const eventsRepository: {
    append(event: Omit<ChangeEventInsert, "id">): void;
    findAll(): ChangeEventRow[];
    findSince(sequenceId: number): ChangeEventRow[];
    getLatestSequence(): number;
};
//# sourceMappingURL=events.d.ts.map