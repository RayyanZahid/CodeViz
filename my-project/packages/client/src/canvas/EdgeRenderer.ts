// ---------------------------------------------------------------------------
// EdgeRenderer — Imperative Konva Arrow management for graph edges.
//
// Manages a Map of Konva.Arrows (one per edge) on the graph layer.
// Arrow endpoints are derived from NodeRenderer's position map.
// Bezier tension=0.3 produces curved lines per CONTEXT.md spec.
//
// No React state — all updates are imperative Konva API calls.
// ---------------------------------------------------------------------------

import Konva from 'konva';
import type { GraphEdge } from '@archlens/shared/types';
import type { NodeRenderer } from './NodeRenderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeEdgeStrokeWidth(edge: GraphEdge): number {
  const count = edge.dependencyCount ?? 1;
  if (count >= 6) return 5;
  if (count >= 3) return 3;
  return 1.5;
}

function computeEdgeOpacity(edge: GraphEdge): number {
  const count = edge.dependencyCount ?? 1;
  if (count >= 6) return 0.7;
  if (count >= 3) return 0.6;
  return 0.5;
}

// ---------------------------------------------------------------------------
// EdgeRenderer
// ---------------------------------------------------------------------------

export class EdgeRenderer {
  private layer: Konva.Layer;
  private lines: Map<string, Konva.Arrow> = new Map();
  private nodeRenderer: NodeRenderer;

  constructor(layer: Konva.Layer, nodeRenderer: NodeRenderer) {
    this.layer = layer;
    this.nodeRenderer = nodeRenderer;
  }

  // -------------------------------------------------------------------------
  // Full sync — reconcile all edges against current state map
  // -------------------------------------------------------------------------

  syncAll(edges: Map<string, GraphEdge>): void {
    // Create or update arrows for all current edges
    for (const [id, edge] of edges) {
      if (this.lines.has(id)) {
        this.updateLine(id, edge);
      } else {
        this.createLine(edge);
      }
    }

    // Remove arrows for edges that no longer exist
    for (const [id] of this.lines) {
      if (!edges.has(id)) {
        this.destroyLine(id);
      }
    }

    this.layer.batchDraw();
  }

  // -------------------------------------------------------------------------
  // Incremental delta — create/remove only changed edges
  // -------------------------------------------------------------------------

  applyDelta(
    currentEdges: Map<string, GraphEdge>,
    prevEdges: Map<string, GraphEdge>,
  ): void {
    // Added edges
    for (const [, edge] of currentEdges) {
      if (!prevEdges.has(edge.id)) {
        this.createLine(edge);
      }
    }

    // Removed edges
    for (const [id] of prevEdges) {
      if (!currentEdges.has(id)) {
        this.destroyLine(id);
      }
    }

    this.layer.batchDraw();
  }

  // -------------------------------------------------------------------------
  // Update arrow endpoints after layout engine repositions nodes
  // -------------------------------------------------------------------------

  updatePositions(): void {
    for (const [id, arrow] of this.lines) {
      // Derive source and target IDs from arrow's name attribute (stored at creation)
      const sourceId = arrow.getAttr('sourceId') as string | undefined;
      const targetId = arrow.getAttr('targetId') as string | undefined;
      if (!sourceId || !targetId) continue;

      const srcPos = this.nodeRenderer.getPosition(sourceId);
      const tgtPos = this.nodeRenderer.getPosition(targetId);
      if (!srcPos || !tgtPos) continue;

      arrow.points([srcPos.x, srcPos.y, tgtPos.x, tgtPos.y]);
    }
    this.layer.batchDraw();
  }

  // -------------------------------------------------------------------------
  // Shape accessors (used by AnimationQueue in Plan 04 for edge glow)
  // -------------------------------------------------------------------------

  getLine(edgeId: string): Konva.Arrow | undefined {
    return this.lines.get(edgeId);
  }

  setVisible(edgeId: string, visible: boolean): void {
    const line = this.lines.get(edgeId);
    if (line) line.visible(visible);
  }

  // -------------------------------------------------------------------------
  // Private: shape lifecycle
  // -------------------------------------------------------------------------

  private createLine(edge: GraphEdge): void {
    const srcPos = this.nodeRenderer.getPosition(edge.sourceId);
    const tgtPos = this.nodeRenderer.getPosition(edge.targetId);

    // Skip if either node hasn't been placed yet
    if (!srcPos || !tgtPos) return;

    const strokeWidth = computeEdgeStrokeWidth(edge);
    const opacity = computeEdgeOpacity(edge);

    const arrow = new Konva.Arrow({
      id: edge.id,
      points: [srcPos.x, srcPos.y, tgtPos.x, tgtPos.y],
      stroke: `rgba(150, 200, 255, ${opacity})`,
      strokeWidth,
      fill: `rgba(150, 200, 255, ${opacity})`,
      pointerLength: 8,
      pointerWidth: 6,
      listening: false,
    });

    // Store source/target IDs as attributes for updatePositions()
    arrow.setAttr('sourceId', edge.sourceId);
    arrow.setAttr('targetId', edge.targetId);

    this.layer.add(arrow);
    this.lines.set(edge.id, arrow);
  }

  private updateLine(edgeId: string, edge: GraphEdge): void {
    const arrow = this.lines.get(edgeId);
    if (!arrow) return;

    const srcPos = this.nodeRenderer.getPosition(edge.sourceId);
    const tgtPos = this.nodeRenderer.getPosition(edge.targetId);
    if (!srcPos || !tgtPos) return;

    arrow.points([srcPos.x, srcPos.y, tgtPos.x, tgtPos.y]);
  }

  private destroyLine(edgeId: string): void {
    const arrow = this.lines.get(edgeId);
    if (arrow) {
      arrow.destroy();
      this.lines.delete(edgeId);
    }
  }
}
