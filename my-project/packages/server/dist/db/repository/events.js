import { gt, asc, sql } from 'drizzle-orm';
import { db } from '../connection.js';
import { changeEvents } from '../schema.js';
export const eventsRepository = {
    append(event) {
        db.insert(changeEvents).values(event).run();
    },
    findAll() {
        return db.select().from(changeEvents).orderBy(asc(changeEvents.id)).all();
    },
    findSince(sequenceId) {
        return db
            .select()
            .from(changeEvents)
            .where(gt(changeEvents.id, sequenceId))
            .orderBy(asc(changeEvents.id))
            .all();
    },
    getLatestSequence() {
        const result = db
            .select({ maxId: sql `max(${changeEvents.id})` })
            .from(changeEvents)
            .get();
        return result?.maxId ?? 0;
    },
};
//# sourceMappingURL=events.js.map