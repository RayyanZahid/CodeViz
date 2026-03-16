// ---------------------------------------------------------------------------
// ZoneName — const object + derived type (project convention)
// ---------------------------------------------------------------------------

export const ZoneName = {
  FRONTEND: 'frontend',
  API: 'api',
  SERVICES: 'services',
  DATA_STORES: 'data-stores',
  INFRASTRUCTURE: 'infrastructure',
  EXTERNAL: 'external',
  UNKNOWN: 'unknown',
} as const;

export type ZoneName = typeof ZoneName[keyof typeof ZoneName];

// ---------------------------------------------------------------------------
// ArchitecturalEventType — const object + derived type
// ---------------------------------------------------------------------------

export const ArchitecturalEventType = {
  COMPONENT_CREATED: 'component_created',
  COMPONENT_SPLIT: 'component_split',
  COMPONENT_MERGED: 'component_merged',
  DEPENDENCY_ADDED: 'dependency_added',
  DEPENDENCY_REMOVED: 'dependency_removed',
} as const;

export type ArchitecturalEventType = typeof ArchitecturalEventType[keyof typeof ArchitecturalEventType];

// ---------------------------------------------------------------------------
// RiskType — const object + derived type
// ---------------------------------------------------------------------------

export const RiskType = {
  CIRCULAR_DEPENDENCY: 'circular_dependency',
  BOUNDARY_VIOLATION: 'boundary_violation',
  EXCESSIVE_FAN_OUT: 'excessive_fan_out',
} as const;

export type RiskType = typeof RiskType[keyof typeof RiskType];

// ---------------------------------------------------------------------------
// RiskSeverity — const object + derived type
// ---------------------------------------------------------------------------

export const RiskSeverity = {
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type RiskSeverity = typeof RiskSeverity[keyof typeof RiskSeverity];

// ---------------------------------------------------------------------------
// Inference interfaces
// ---------------------------------------------------------------------------

/** Represents a zone assignment or update for a single node. */
export interface ZoneUpdate {
  nodeId: string;
  zone: ZoneName;
  previousZone: ZoneName | null;
}

/** Represents a detected architectural event after corroboration threshold is met. */
export interface ArchitecturalEvent {
  type: ArchitecturalEventType;
  nodeId: string;
  targetNodeId?: string;
  zone?: ZoneName;
  timestamp: number;
}

/** Represents a detected risk signal in the dependency graph. */
export interface RiskSignal {
  type: RiskType;
  severity: RiskSeverity;
  nodeId: string;
  affectedNodeIds?: string[];
  details: string;
}

/** The result of one inference cycle, emitted after processing a GraphDelta. */
export interface InferenceResult {
  zoneUpdates: ZoneUpdate[];
  architecturalEvents: ArchitecturalEvent[];
  risks: RiskSignal[];
  graphVersion: number;
}
