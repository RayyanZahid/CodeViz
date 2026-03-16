export const NodeType = {
  SERVICE_MODULE: 'service_module',
  COMPONENT_PAGE: 'component_page',
  DATA_STORE: 'data_store',
  EXTERNAL_API: 'external_api',
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];

export const EdgeType = {
  IMPORTS_DEPENDS_ON: 'imports_depends_on',
  CALLS_INVOKES: 'calls_invokes',
  READS_WRITES: 'reads_writes',
  PUBLISHES_SUBSCRIBES: 'publishes_subscribes',
} as const;

export type EdgeType = typeof EdgeType[keyof typeof EdgeType];

export interface GraphNode {
  id: string;
  name: string;
  nodeType: NodeType;
  zone: string | null;
  fileList: string[];
  incomingEdgeCount: number;
  outgoingEdgeCount: number;
  lastModified: Date;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
}
