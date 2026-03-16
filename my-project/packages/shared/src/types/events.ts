export const ChangeEventType = {
  NODE_ADDED: 'node_added',
  NODE_REMOVED: 'node_removed',
  NODE_UPDATED: 'node_updated',
  EDGE_ADDED: 'edge_added',
  EDGE_REMOVED: 'edge_removed',
  ZONE_CHANGED: 'zone_changed',
} as const;

export type ChangeEventType = typeof ChangeEventType[keyof typeof ChangeEventType];

export type ChangeEventPayload =
  | { type: 'node_added'; nodeId: string; name: string; nodeType: string }
  | { type: 'node_removed'; nodeId: string }
  | { type: 'node_updated'; nodeId: string; name: string; nodeType: string }
  | { type: 'edge_added'; edgeId: string; sourceId: string; targetId: string; edgeType: string }
  | { type: 'edge_removed'; edgeId: string }
  | { type: 'zone_changed'; nodeId: string; oldZone: string | null; newZone: string };

export interface ChangeEvent {
  id: number;
  eventType: ChangeEventType;
  payload: ChangeEventPayload;
  timestamp: Date;
}
