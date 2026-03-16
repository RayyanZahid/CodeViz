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
