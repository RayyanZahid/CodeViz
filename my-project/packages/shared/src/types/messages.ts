import type { GraphNode, GraphEdge } from './graph.js';
import type { ZoneUpdate, ArchitecturalEvent, RiskSignal } from './inference.js';
import type { SnapshotSavedMessage, IntentUpdatedMessage, IntentClosedMessage } from './timeline.js';

export interface GraphDeltaMessage {
  type: 'graph_delta';
  version: number;
  addedNodes: GraphNode[];
  removedNodeIds: string[];
  updatedNodes: GraphNode[];
  addedEdges: GraphEdge[];
  removedEdgeIds: string[];
}

export interface InitialStateMessage {
  type: 'initial_state';
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layoutPositions: Record<string, { x: number; y: number; zone: string | null }>;
}

export interface InferenceMessage {
  type: 'inference';
  version: number;
  zoneUpdates: ZoneUpdate[];
  architecturalEvents: ArchitecturalEvent[];
  risks: RiskSignal[];
}

export interface ErrorMessage {
  type: 'error';
  code: 'DIRECTORY_UNAVAILABLE' | 'INTERNAL_ERROR';
  message: string;
}

export interface WatchRootChangedMessage {
  type: 'watch_root_changed';
  directory: string;
}

export type ServerMessage =
  | GraphDeltaMessage
  | InitialStateMessage
  | InferenceMessage
  | ErrorMessage
  | WatchRootChangedMessage
  | SnapshotSavedMessage
  | IntentUpdatedMessage
  | IntentClosedMessage;
