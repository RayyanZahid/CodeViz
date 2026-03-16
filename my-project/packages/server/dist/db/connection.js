import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
const sqlite = new Database('./archlens.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
export const db = drizzle(sqlite, { schema });
//# sourceMappingURL=connection.js.map