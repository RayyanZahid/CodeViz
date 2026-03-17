import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const graphNodes = sqliteTable('graph_nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nodeType: text('node_type').notNull(),
  zone: text('zone'),
  fileList: text('file_list', { mode: 'json' }).$type<string[]>().notNull().default([]),
  incomingEdgeCount: integer('incoming_edge_count').notNull().default(0),
  outgoingEdgeCount: integer('outgoing_edge_count').notNull().default(0),
  lastModified: integer('last_modified', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const graphEdges = sqliteTable('graph_edges', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => graphNodes.id),
  targetId: text('target_id').notNull().references(() => graphNodes.id),
  edgeType: text('edge_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const changeEvents = sqliteTable('change_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
});

export const layoutPositions = sqliteTable('layout_positions', {
  nodeId: text('node_id').primaryKey().references(() => graphNodes.id),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  zone: text('zone'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const graphSnapshots = sqliteTable('graph_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  graphJson: text('graph_json', { mode: 'json' })
    .$type<{ nodes: unknown[]; edges: unknown[]; positions: Record<string, { x: number; y: number }> }>()
    .notNull(),
  summary: text('summary').notNull(),
  triggerFiles: text('trigger_files', { mode: 'json' }).$type<string[]>().notNull(),
  riskSnapshot: text('risk_snapshot', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
});

export const intentSessions = sqliteTable('intent_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  category: text('category').notNull(),
  objective: text('objective').notNull(),
  confidence: real('confidence').notNull(),
  subtasks: text('subtasks', { mode: 'json' }).$type<string[]>().notNull().default([]),
  evidence: text('evidence', { mode: 'json' }).$type<string[]>().notNull().default([]),
  riskSnapshot: text('risk_snapshot', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  startSnapshotId: integer('start_snapshot_id'),
  endSnapshotId: integer('end_snapshot_id'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
});

export const snapshotCheckpoints = sqliteTable('snapshot_checkpoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  watchRoot: text('watch_root').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  snapshotId: integer('snapshot_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
