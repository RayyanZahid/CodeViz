import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sub-schemas — Node and Edge wire types
// ---------------------------------------------------------------------------

const GraphNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodeType: z.string(),
  zone: z.string().nullable(),
  fileList: z.array(z.string()),
  incomingEdgeCount: z.number(),
  outgoingEdgeCount: z.number(),
  lastModified: z.string().or(z.number()).or(z.date()),
});

const GraphEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  edgeType: z.string(),
});

// ---------------------------------------------------------------------------
// Sub-schemas — Inference types (relaxed string enums to tolerate future additions)
// ---------------------------------------------------------------------------

const ZoneUpdateSchema = z.object({
  nodeId: z.string(),
  zone: z.string(),
  previousZone: z.string().nullable(),
});

const ArchitecturalEventSchema = z.object({
  type: z.string(),
  nodeId: z.string(),
  targetNodeId: z.string().optional(),
  zone: z.string().optional(),
  timestamp: z.number(),
});

const RiskSignalSchema = z.object({
  type: z.string(),
  severity: z.string(),
  nodeId: z.string(),
  affectedNodeIds: z.array(z.string()).optional(),
  details: z.string(),
});

// ---------------------------------------------------------------------------
// Message schemas — 4-member discriminated union matching ServerMessage
// ---------------------------------------------------------------------------

const GraphDeltaMessageSchema = z.object({
  type: z.literal('graph_delta'),
  version: z.number(),
  addedNodes: z.array(GraphNodeSchema),
  removedNodeIds: z.array(z.string()),
  updatedNodes: z.array(GraphNodeSchema),
  addedEdges: z.array(GraphEdgeSchema),
  removedEdgeIds: z.array(z.string()),
});

const InitialStateMessageSchema = z.object({
  type: z.literal('initial_state'),
  version: z.number(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  layoutPositions: z.record(z.string(), z.object({ x: z.number(), y: z.number(), zone: z.string().nullable() })),
});

const InferenceMessageSchema = z.object({
  type: z.literal('inference'),
  version: z.number(),
  zoneUpdates: z.array(ZoneUpdateSchema),
  architecturalEvents: z.array(ArchitecturalEventSchema),
  risks: z.array(RiskSignalSchema),
});

const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Top-level discriminated union
// ---------------------------------------------------------------------------

export const ServerMessageSchema = z.discriminatedUnion('type', [
  GraphDeltaMessageSchema,
  InitialStateMessageSchema,
  InferenceMessageSchema,
  ErrorMessageSchema,
]);

export type ServerMessageParsed = z.infer<typeof ServerMessageSchema>;

// Re-export sub-schemas for external use
export {
  GraphNodeSchema,
  GraphEdgeSchema,
  ZoneUpdateSchema,
  ArchitecturalEventSchema,
  RiskSignalSchema,
};
