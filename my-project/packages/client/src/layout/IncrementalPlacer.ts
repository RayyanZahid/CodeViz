// ---------------------------------------------------------------------------
// IncrementalPlacer — d3-force layout engine with sticky node positions
// and zone-constrained placement.
//
// Design contract:
//   - Existing nodes (already in positions map) are PINNED via fx/fy and
//     will never move across updates (LAYOUT-02, LAYOUT-04).
//   - New nodes are initialized at their zone center with no fx/fy — free
//     to move during the simulation run — then pinned after settling (LAYOUT-03).
//   - Simulation runs silently via tick(N): never animated (LAYOUT-01).
//   - Positions loaded from server snapshot are sticky immediately (LAYOUT-02).
//
// IMPORTANT: Do NOT pass GraphNode objects from the Zustand store directly
// to d3-force. d3-force mutates node objects in-place (adds x, y, vx, vy,
// index). Always create fresh SimNode plain objects. (RESEARCH.md Pitfall 3)
// ---------------------------------------------------------------------------

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
} from 'd3-force';
import type { SimulationLinkDatum } from 'd3-force';
import forceBoundary from 'd3-force-boundary';
import {
  getZoneLayout,
  getZoneCenter,
  ZONE_LAYOUTS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './ZoneConfig.js';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * SimNode is the mutable scratch object passed to d3-force.
 * It is always created fresh — never the GraphNode from the store.
 */
interface SimNode {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  zone: string;
  index?: number;
}

type SimLink = SimulationLinkDatum<SimNode> & {
  source: string;
  target: string;
};

// ---------------------------------------------------------------------------
// IncrementalPlacer
// ---------------------------------------------------------------------------

export class IncrementalPlacer {
  /** Canonical position store — source of truth for rendering. */
  private positions: Map<string, { x: number; y: number }> = new Map();

  /** d3-force simulation — stopped immediately; always run via tick(). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private simulation: ReturnType<typeof forceSimulation<SimNode, any>>;

  constructor() {
    this.simulation = forceSimulation<SimNode>([])
      .force('charge', forceManyBody<SimNode>().strength(-150))
      .force('collide', forceCollide<SimNode>().radius(90).strength(1))
      .alphaDecay(0.03)
      .stop();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Load positions from server snapshot (InitialStateMessage.layoutPositions).
   * Called once on snapshot receipt — these positions become sticky immediately.
   */
  loadPositions(
    layoutPositions: Record<string, { x: number; y: number; zone: string | null }>,
  ): void {
    for (const [id, pos] of Object.entries(layoutPositions)) {
      this.positions.set(id, { x: pos.x, y: pos.y });
    }
  }

  /**
   * Place any new nodes in allNodes that are not yet in positions map.
   * Existing nodes are pinned via fx/fy and will not move.
   * New nodes settle via d3-force near related nodes within their zone.
   *
   * Returns the full positions map (existing + newly placed).
   */
  placeNewNodes(
    allNodes: Map<string, GraphNode>,
    edges: Map<string, GraphEdge>,
  ): Map<string, { x: number; y: number }> {
    // Early exit: no new nodes to place (LAYOUT-04: no reshuffle)
    if (this.getNewNodeCount(allNodes) === 0) {
      return this.positions;
    }

    // Build simNodes — fresh plain objects, never store GraphNode refs
    const simNodes: SimNode[] = [];
    const newNodeIds = new Set<string>();

    for (const [id, node] of allNodes) {
      const existing = this.positions.get(id);
      const zone = node.zone ?? 'external';

      if (existing) {
        // PINNED: existing node — fx/fy prevent any movement
        simNodes.push({
          id,
          x: existing.x,
          y: existing.y,
          fx: existing.x,
          fy: existing.y,
          zone,
        });
      } else {
        // FREE: new node — initialized at zone center, no fx/fy
        const center = getZoneCenter(zone);
        simNodes.push({
          id,
          x: center.x,
          y: center.y,
          zone,
        });
        newNodeIds.add(id);
      }
    }

    // Build sim links (source/target as id strings — resolved by .id() accessor)
    const simLinks: SimLink[] = [];
    for (const edge of edges.values()) {
      // Only include links where both endpoints are in the simulation
      const sourceInSim = allNodes.has(edge.sourceId);
      const targetInSim = allNodes.has(edge.targetId);
      if (sourceInSim && targetInSim) {
        simLinks.push({ source: edge.sourceId, target: edge.targetId });
      }
    }

    // Update simulation with current nodes and forces
    this.simulation.nodes(simNodes);

    this.simulation
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d: SimNode) => d.id)
          .distance(160)
          .strength(0.2),
      )
      .force(
        'x',
        forceX<SimNode>((d: SimNode) => getZoneCenter(d.zone).x).strength(0.15),
      )
      .force(
        'y',
        forceY<SimNode>((d: SimNode) => getZoneCenter(d.zone).y).strength(0.15),
      )
      .force(
        'boundary',
        forceBoundary<SimNode>(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).strength(0.5),
      );

    this.simulation.alpha(0.5);
    this.simulation.stop();
    this.simulation.tick(120);

    // Post-tick: store newly placed nodes and clamp to zone bounds
    const currentSimNodes = this.simulation.nodes();
    for (const simNode of currentSimNodes) {
      if (newNodeIds.has(simNode.id)) {
        // Clamp to zone bounds as safety net (zone forceX/forceY is a soft constraint)
        const clamped = this.clampToZone(simNode.x, simNode.y, simNode.zone);
        this.positions.set(simNode.id, clamped);
      }
      // Existing nodes: fx/fy prevented movement — no position update needed
    }

    return this.positions;
  }

  /**
   * Return readonly reference to all node positions.
   */
  getPositions(): Map<string, { x: number; y: number }> {
    return this.positions;
  }

  /**
   * Return position for a single node, or undefined if not yet placed.
   */
  getPosition(nodeId: string): { x: number; y: number } | undefined {
    return this.positions.get(nodeId);
  }

  /**
   * Remove a node from the positions map (called when node is removed from graph).
   */
  removeNode(nodeId: string): void {
    this.positions.delete(nodeId);
  }

  /**
   * Check whether a node has an assigned position.
   */
  hasPosition(nodeId: string): boolean {
    return this.positions.has(nodeId);
  }

  /**
   * Count nodes in allNodes that do not yet have a position.
   * Used for early-exit optimization in placeNewNodes.
   */
  getNewNodeCount(allNodes: Map<string, GraphNode>): number {
    let count = 0;
    for (const id of allNodes.keys()) {
      if (!this.positions.has(id)) {
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Clamp a position to its zone's bounds with padding.
   * Used as a safety net after the force simulation settles —
   * forceX/forceY is a soft constraint and may not fully contain nodes.
   */
  private clampToZone(x: number, y: number, zoneName: string): { x: number; y: number } {
    const zone = getZoneLayout(zoneName);
    const bounds = zone.bounds;
    const padding = 20; // Keep nodes away from zone edges
    return {
      x: Math.max(bounds.x0 + padding, Math.min(bounds.x1 - padding, x)),
      y: Math.max(bounds.y0 + padding, Math.min(bounds.y1 - padding, y)),
    };
  }
}
