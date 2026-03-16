import type { ArchitecturalEvent, RiskSignal } from '@archlens/shared/types';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// toSentence — maps an ArchitecturalEvent to a terse technical sentence
//
// Pure function: takes a nodeNameFn for display name resolution so this
// function remains testable without graphStore coupling.
// ---------------------------------------------------------------------------

/**
 * Converts an ArchitecturalEvent into a terse technical natural-language sentence.
 *
 * @param event      The architectural event to describe
 * @param nodeNameFn Resolves a node ID to its display name (e.g. from graphStore)
 */
export function toSentence(
  event: ArchitecturalEvent,
  nodeNameFn: (id: string) => string,
): string {
  const name = nodeNameFn(event.nodeId);
  const targetName = event.targetNodeId ? nodeNameFn(event.targetNodeId) : '';

  switch (event.type) {
    case 'component_created':
      return `${name} created`;

    case 'component_split':
      return `${name} split`;

    case 'component_merged':
      return `${name} merged`;

    case 'dependency_added':
      return `${name} → depends on ${targetName}`;

    case 'dependency_removed':
      return `${name} → removed dep on ${targetName}`;

    default:
      return `${name} updated`;
  }
}

// ---------------------------------------------------------------------------
// DeltaSentenceItem — a single sentence entry from a graph delta
// ---------------------------------------------------------------------------

export interface DeltaSentenceItem {
  sentence: string;
  iconColor: string;
  nodeId: string;
}

// ---------------------------------------------------------------------------
// deltaToSentence — converts graph delta arrays into feed sentence items
//
// Returns an array of DeltaSentenceItems for display in the activity feed.
// Each item has a sentence, colored dot, and nodeId for batching.
// ---------------------------------------------------------------------------

/**
 * Converts graph delta arrays into natural-language feed entries.
 *
 * @param addedNodes     Nodes added in this delta
 * @param removedNodeIds IDs of nodes removed in this delta
 * @param updatedNodes   Nodes updated in this delta
 * @param addedEdges     Edges added in this delta
 * @param removedEdgeIds IDs of edges removed (format: "${sourceId}::${targetId}")
 * @param nodeNameFn     Resolves a node ID to its display name
 */
export function deltaToSentence(
  addedNodes: GraphNode[],
  removedNodeIds: string[],
  updatedNodes: GraphNode[],
  addedEdges: GraphEdge[],
  removedEdgeIds: string[],
  nodeNameFn: (id: string) => string,
): DeltaSentenceItem[] {
  const items: DeltaSentenceItem[] = [];

  // Added nodes — green dot (component creation)
  for (const node of addedNodes) {
    items.push({
      sentence: `${node.name} created`,
      iconColor: '#22c55e', // green
      nodeId: node.id,
    });
  }

  // Removed nodes — gray dot
  for (const nodeId of removedNodeIds) {
    const name = nodeNameFn(nodeId);
    items.push({
      sentence: `${name} removed`,
      iconColor: '#94a3b8', // gray
      nodeId,
    });
  }

  // Updated nodes — gray dot (routine file modification)
  for (const node of updatedNodes) {
    items.push({
      sentence: `${node.name} modified`,
      iconColor: '#94a3b8', // gray
      nodeId: node.id,
    });
  }

  // Added edges — blue dot (new dependency)
  for (const edge of addedEdges) {
    const sourceName = nodeNameFn(edge.sourceId);
    const targetName = nodeNameFn(edge.targetId);
    items.push({
      sentence: `New dependency: ${sourceName} → ${targetName}`,
      iconColor: '#3b82f6', // blue
      nodeId: edge.sourceId,
    });
  }

  // Removed edges — blue dot (removed dependency)
  for (const edgeId of removedEdgeIds) {
    // Edge ID format: "${sourceId}::${targetId}"
    const separatorIndex = edgeId.indexOf('::');
    if (separatorIndex === -1) continue; // Skip malformed IDs

    const sourceId = edgeId.slice(0, separatorIndex);
    const targetId = edgeId.slice(separatorIndex + 2);
    const sourceName = nodeNameFn(sourceId);
    const targetName = nodeNameFn(targetId);

    items.push({
      sentence: `Removed dependency: ${sourceName} → ${targetName}`,
      iconColor: '#3b82f6', // blue
      nodeId: sourceId,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// riskToSentence — converts a RiskSignal to a feed sentence string
// ---------------------------------------------------------------------------

/** Human-readable labels for each risk type (mirrors RiskPanel's riskTypeLabel) */
function riskTypeLabel(type: RiskSignal['type']): string {
  switch (type) {
    case 'circular_dependency':
      return 'Circular dependency';
    case 'boundary_violation':
      return 'Boundary violation';
    case 'excessive_fan_out':
      return 'High fan-out';
    default:
      return type;
  }
}

/**
 * Converts a RiskSignal into a natural-language sentence for the activity feed.
 *
 * Format: "${SeverityCapitalized}: ${riskTypeLabel} — ${nodeName}"
 * Example: "Critical: Circular dependency — Parser"
 * Example: "Warning: Boundary violation — Database"
 *
 * @param signal     The risk signal to describe
 * @param nodeNameFn Resolves a node ID to its display name
 */
export function riskToSentence(
  signal: RiskSignal,
  nodeNameFn: (id: string) => string,
): string {
  const severityLabel = signal.severity === 'critical' ? 'Critical' : 'Warning';
  const typeLabel = riskTypeLabel(signal.type);
  const nodeName = nodeNameFn(signal.nodeId);
  return `${severityLabel}: ${typeLabel} — ${nodeName}`;
}
