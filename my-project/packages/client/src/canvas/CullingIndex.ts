// ---------------------------------------------------------------------------
// CullingIndex — Quadtree-based viewport culling for the canvas.
//
// Maintains a quadtree spatial index of all node bounding boxes.
// On each viewport change, queries nodes overlapping the viewport and toggles
// their visibility. Edges are visible if either their source or target node
// is visible (O(edges) pass — acceptable since arrows are lightweight).
//
// updateVisibility() expects world-space coordinates (not screen-space).
// ViewportController (Plan 04) computes: { x: -stage.x()/scale,
//   y: -stage.y()/scale, width: stage.width()/scale, height: stage.height()/scale }
// ---------------------------------------------------------------------------

import Quadtree from '@timohausmann/quadtree-js';
import type { GraphEdge } from '@archlens/shared/types';
import type { NodeRenderer } from './NodeRenderer.js';
import type { EdgeRenderer } from './EdgeRenderer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Internal quadtree item — extends Quadtree.Rect with node ID
interface NodeItem extends Quadtree.Rect {
  id: string;
}

// ---------------------------------------------------------------------------
// CullingIndex
// ---------------------------------------------------------------------------

export class CullingIndex {
  private quadtree: Quadtree;
  private nodeRenderer: NodeRenderer;
  private edgeRenderer: EdgeRenderer;
  private lastVisibleNodeIds: Set<string> = new Set();
  private edges: Map<string, GraphEdge> = new Map();

  constructor(
    nodeRenderer: NodeRenderer,
    edgeRenderer: EdgeRenderer,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    this.nodeRenderer = nodeRenderer;
    this.edgeRenderer = edgeRenderer;
    this.quadtree = new Quadtree({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
  }

  // -------------------------------------------------------------------------
  // Edge data — kept in sync so updateVisibility can compute edge visibility
  // -------------------------------------------------------------------------

  /**
   * Update the edge map used for edge visibility computation.
   * Call this whenever the edges in graphStore change (same cadence as rebuild()).
   */
  setEdges(edges: Map<string, GraphEdge>): void {
    this.edges = edges;
  }

  // -------------------------------------------------------------------------
  // Spatial index management
  // -------------------------------------------------------------------------

  /**
   * Rebuild the quadtree from current node positions.
   * Relatively infrequent — only needed when nodes are added or layout changes.
   */
  rebuild(): void {
    this.quadtree.clear();

    for (const bounds of this.nodeRenderer.getAllNodeBounds()) {
      const item: NodeItem = {
        id: bounds.id,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
      this.quadtree.insert(item);
    }
  }

  // -------------------------------------------------------------------------
  // Visibility update — O(log n) node query + O(edges) edge pass
  // -------------------------------------------------------------------------

  /**
   * Toggle node and edge visibility based on current viewport bounds.
   * viewport must be in world (stage) coordinates, not screen coordinates.
   */
  updateVisibility(viewport: ViewportRect): void {
    // Query quadtree for nodes overlapping the viewport
    const visibleItems = this.quadtree.retrieve<NodeItem>(viewport);
    const visibleNodeIds = new Set<string>(visibleItems.map((item) => item.id));

    // Show newly visible nodes; hide newly invisible nodes
    for (const id of visibleNodeIds) {
      if (!this.lastVisibleNodeIds.has(id)) {
        this.nodeRenderer.setVisible(id, true);
      }
    }
    for (const id of this.lastVisibleNodeIds) {
      if (!visibleNodeIds.has(id)) {
        this.nodeRenderer.setVisible(id, false);
      }
    }

    // Edge visibility: visible if either source or target node is visible
    for (const [edgeId, edge] of this.edges) {
      const edgeVisible =
        visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId);
      this.edgeRenderer.setVisible(edgeId, edgeVisible);
    }

    this.lastVisibleNodeIds = visibleNodeIds;
  }

  // -------------------------------------------------------------------------
  // Debug accessor
  // -------------------------------------------------------------------------

  /**
   * Returns the number of nodes currently marked visible.
   * Useful for performance debugging and overlay stats.
   */
  getVisibleNodeCount(): number {
    return this.lastVisibleNodeIds.size;
  }
}
