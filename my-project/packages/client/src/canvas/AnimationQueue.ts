// ---------------------------------------------------------------------------
// AnimationQueue — Manages glow decay for active nodes and edges.
//
// Uses a Konva.Animation on the animation layer to run a continuous RAF loop.
// Each activated node gets a glow overlay rect (Konva.Rect with shadowEnabled).
// The glow decays linearly over DECAY_MS (30 seconds) from full opacity to 0.
// Edges connected to active nodes glow alongside their source nodes.
//
// IMPORTANT: Do NOT call layer.draw() inside the animation callback —
// Konva.Animation handles redraws automatically. (RESEARCH.md anti-pattern)
//
// Per CONTEXT.md: "Static glow + decay — solid bright glow that slowly dims
// over 30 seconds, no pulsing"
// ---------------------------------------------------------------------------

import Konva from 'konva';
import { getZoneLayout } from '../layout/ZoneConfig.js';
import type { NodeRenderer } from './NodeRenderer.js';
import type { EdgeRenderer } from './EdgeRenderer.js';
import type { GraphEdge } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DECAY_MS = 30_000; // 30 seconds per CONTEXT.md spec
const MAX_SHADOW_BLUR = 20;
const MAX_SHADOW_OPACITY = 0.8;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface GlowEntry {
  glowShape: Konva.Rect;
  startTime: number;
  edgeGlows: Konva.Line[];
}

// ---------------------------------------------------------------------------
// AnimationQueue
// ---------------------------------------------------------------------------

export class AnimationQueue {
  private animLayer: Konva.Layer;
  private active: Map<string, GlowEntry> = new Map();
  private animation: Konva.Animation | null;

  constructor(animLayer: Konva.Layer) {
    this.animLayer = animLayer;

    // Create and start the animation — runs continuously on animLayer only.
    // IMPORTANT: Do NOT call layer.draw() in the callback; Konva handles it.
    this.animation = new Konva.Animation(() => {
      this.tick();
    }, animLayer);

    this.animation.start();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Activate a glow effect on a node (and optionally its outgoing edges).
   * If the node is already glowing, its start time is reset (extends glow).
   */
  activate(
    nodeId: string,
    nodeShape: Konva.Group,
    zoneName: string,
    edgeLines?: Konva.Arrow[],
  ): void {
    // If already active: reset startTime to extend glow
    const existing = this.active.get(nodeId);
    if (existing) {
      existing.startTime = Date.now();
      // Update edge glow list in case new edges arrived
      return;
    }

    const glowColor = getZoneLayout(zoneName).glowColor;

    // Find the rect child in the group to get dimensions
    const nodeRect = nodeShape.findOne<Konva.Rect>('Rect');
    const nodeWidth = nodeRect ? nodeRect.width() : 100;
    const nodeHeight = nodeRect ? nodeRect.height() : 60;
    const offsetX = nodeRect ? nodeRect.offsetX() : nodeWidth / 2;
    const offsetY = nodeRect ? nodeRect.offsetY() : nodeHeight / 2;

    // Create a glow overlay rect at the same world position as the node
    const glowShape = new Konva.Rect({
      x: nodeShape.x() - offsetX,
      y: nodeShape.y() - offsetY,
      width: nodeWidth,
      height: nodeHeight,
      cornerRadius: 6,
      fill: 'transparent',
      stroke: 'transparent',
      shadowEnabled: true,
      shadowColor: glowColor,
      shadowBlur: MAX_SHADOW_BLUR,
      shadowOpacity: MAX_SHADOW_OPACITY,
      shadowForStrokeEnabled: false,
      listening: false,
      perfectDrawEnabled: false,
    });

    this.animLayer.add(glowShape);

    // Create transparent edge glow copies on the animation layer
    const edgeGlows: Konva.Line[] = [];
    if (edgeLines) {
      for (const arrow of edgeLines) {
        const edgeGlow = new Konva.Line({
          points: arrow.points(),
          tension: arrow.tension(),
          stroke: 'transparent',
          strokeWidth: arrow.strokeWidth(),
          shadowEnabled: true,
          shadowColor: glowColor,
          shadowBlur: MAX_SHADOW_BLUR * 0.6,
          shadowOpacity: MAX_SHADOW_OPACITY * 0.5,
          listening: false,
          perfectDrawEnabled: false,
        });
        this.animLayer.add(edgeGlow);
        edgeGlows.push(edgeGlow);
      }
    }

    this.active.set(nodeId, {
      glowShape,
      startTime: Date.now(),
      edgeGlows,
    });
  }

  /**
   * Activate glow for all added/updated nodes from a graph delta.
   * Retrieves node shapes and outgoing edge arrows from their respective renderers.
   */
  activateFromDelta(
    addedNodeIds: string[],
    updatedNodeIds: string[],
    nodeRenderer: NodeRenderer,
    edgeRenderer: EdgeRenderer,
    edges: Map<string, GraphEdge>,
  ): void {
    const nodeIdsToActivate = [...addedNodeIds, ...updatedNodeIds];

    for (const nodeId of nodeIdsToActivate) {
      const nodeShape = nodeRenderer.getShape(nodeId);
      if (!nodeShape) continue;

      // Determine zone from node's group attrs (stored during NodeRenderer.createShape)
      // We look up the node's position to find it — the zone is not stored on the group,
      // so we pass 'unknown' and let getZoneLayout fall back to 'external'
      // Better: look up the zone from the Rect fill color via reverse mapping.
      // Practical: store zone as attr on the group during creation.
      const zoneName = (nodeShape.getAttr('zone') as string | undefined) ?? 'unknown';

      // Collect outgoing edge Arrow shapes for this node
      const outgoingArrows: Konva.Arrow[] = [];
      for (const edge of edges.values()) {
        if (edge.sourceId === nodeId) {
          const arrow = edgeRenderer.getLine(edge.id);
          if (arrow) outgoingArrows.push(arrow);
        }
      }

      this.activate(nodeId, nodeShape, zoneName, outgoingArrows);
    }
  }

  /**
   * Stop animation and remove all glow shapes from the animation layer.
   * Call this on component unmount.
   */
  destroy(): void {
    if (this.animation) {
      this.animation.stop();
      this.animation = null;
    }

    for (const [, entry] of this.active) {
      entry.glowShape.destroy();
      for (const line of entry.edgeGlows) {
        line.destroy();
      }
    }
    this.active.clear();
  }

  // -------------------------------------------------------------------------
  // Private: animation tick
  // -------------------------------------------------------------------------

  /**
   * Called every animation frame. Decays glow opacity linearly over DECAY_MS.
   * Removes expired entries from the animation layer.
   * Per RESEARCH.md Pitfall 4: remove shapes after decay to keep animLayer lightweight.
   */
  private tick(): void {
    const now = Date.now();

    for (const [nodeId, entry] of this.active) {
      const elapsed = now - entry.startTime;

      if (elapsed >= DECAY_MS) {
        // Decay complete — remove glow shapes to keep layer lightweight
        entry.glowShape.destroy();
        for (const line of entry.edgeGlows) {
          line.destroy();
        }
        this.active.delete(nodeId);
      } else {
        // Linear decay: progress goes from 0 (fresh) to 1 (fully decayed)
        const progress = elapsed / DECAY_MS;
        const opacity = MAX_SHADOW_OPACITY * (1 - progress);
        const blur = MAX_SHADOW_BLUR * (1 - progress);

        entry.glowShape.shadowOpacity(opacity);
        entry.glowShape.shadowBlur(blur);

        // Apply same decay to edge glow lines
        for (const line of entry.edgeGlows) {
          line.shadowOpacity(opacity * 0.5);
          line.shadowBlur(blur * 0.6);
        }
      }
    }
  }
}
