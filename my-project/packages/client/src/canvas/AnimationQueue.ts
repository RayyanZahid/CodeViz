// ---------------------------------------------------------------------------
// AnimationQueue — Manages glow decay for active nodes and edges.
//
// Uses a Konva.Animation on the animation layer to run a continuous RAF loop.
// Each activated node gets a glow overlay rect (Konva.Rect with shadowEnabled).
//
// Animation phases:
//   Phase 1 — Pulse (PULSE_MS = 2.5s): sine-wave oscillation of shadow and border
//   Phase 2 — Decay (DECAY_MS = 30s): linear fade of shadow and node border
//   Phase 3 — Complete: restore original stroke, destroy glow shapes
//
// IMPORTANT: Do NOT call layer.draw() inside the animation callback —
// Konva.Animation handles redraws automatically. (RESEARCH.md anti-pattern)
//
// Per CONTEXT.md: "Pulse 2-3 seconds then 30-second linear decay. Border color
// matches zone glow color. Each new change resets the pulse timer."
// ---------------------------------------------------------------------------

import Konva from 'konva';
import { getZoneLayout } from '../layout/ZoneConfig.js';
import type { NodeRenderer } from './NodeRenderer.js';
import type { EdgeRenderer } from './EdgeRenderer.js';
import type { GraphEdge } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULSE_MS = 2_500;    // 2.5 second pulse phase per CONTEXT.md (2-3 seconds)
const PULSE_CYCLES = 3;    // Number of sine oscillations during pulse phase
const DECAY_MS = 30_000;   // 30 seconds decay per CONTEXT.md spec
const MAX_SHADOW_BLUR = 20;
const MAX_SHADOW_OPACITY = 0.8;
const BRIGHT_BORDER_WIDTH = 2.5; // strokeWidth during active glow

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface GlowEntry {
  glowShape: Konva.Rect;
  startTime: number;
  edgeGlows: Konva.Line[];
  nodeShape: Konva.Group;    // reference to the node group for border manipulation
  nodeRect: Konva.Rect;      // cached Rect child for direct stroke manipulation
  glowColor: string;         // zone glow color used for both shadow and border
  origStroke: string;        // original border color before glow activation
  origStrokeWidth: number;   // original border width before glow activation
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
   * If the node is already glowing, its start time is reset (restarts pulse phase).
   */
  activate(
    nodeId: string,
    nodeShape: Konva.Group,
    zoneName: string,
    edgeLines?: Konva.Arrow[],
  ): void {
    const glowColor = getZoneLayout(zoneName).glowColor;

    // If already active: reset startTime to restart pulse timer (per CONTEXT.md)
    const existing = this.active.get(nodeId);
    if (existing) {
      existing.startTime = Date.now();
      // Immediately re-apply bright border since clearSelection may have reset it
      existing.nodeRect.stroke(glowColor);
      existing.nodeRect.strokeWidth(BRIGHT_BORDER_WIDTH);
      return;
    }

    // Find the rect child in the group to get dimensions and original stroke
    const nodeRect = nodeShape.findOne<Konva.Rect>('Rect');
    if (!nodeRect) return; // Guard: can't glow without a Rect

    const nodeWidth = nodeRect.width();
    const nodeHeight = nodeRect.height();
    const offsetX = nodeRect.offsetX();
    const offsetY = nodeRect.offsetY();

    // Store original stroke values to restore after decay completes
    const origStroke = nodeRect.stroke() as string;
    const origStrokeWidth = nodeRect.strokeWidth();

    // Immediately apply bright border on the graph layer rect
    // This is immediately visible; the anim layer handles the shadow overlay
    nodeRect.stroke(glowColor);
    nodeRect.strokeWidth(BRIGHT_BORDER_WIDTH);

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
      nodeShape,
      nodeRect,
      glowColor,
      origStroke,
      origStrokeWidth,
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
   * Restores original stroke on all active nodes before cleaning up.
   * Call this on component unmount.
   */
  destroy(): void {
    if (this.animation) {
      this.animation.stop();
      this.animation = null;
    }

    for (const [, entry] of this.active) {
      // Restore original node border before destroying
      entry.nodeRect.stroke(entry.origStroke);
      entry.nodeRect.strokeWidth(entry.origStrokeWidth);

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
   * Called every animation frame. Two-phase animation:
   *   Phase 1 (Pulse): sine-wave oscillation for PULSE_MS
   *   Phase 2 (Decay): linear fade for DECAY_MS
   *   Phase 3 (Complete): restore original stroke, destroy shapes
   *
   * Per RESEARCH.md Pitfall 4: remove shapes after decay to keep animLayer lightweight.
   * Per CONTEXT.md: pulse and border use same zone glowColor for visual coherence.
   */
  private tick(): void {
    const now = Date.now();

    for (const [nodeId, entry] of this.active) {
      const elapsed = now - entry.startTime;
      const totalMs = PULSE_MS + DECAY_MS;

      if (elapsed >= totalMs) {
        // Phase 3: Complete — restore original stroke and destroy glow shapes
        entry.nodeRect.stroke(entry.origStroke);
        entry.nodeRect.strokeWidth(entry.origStrokeWidth);
        entry.glowShape.destroy();
        for (const line of entry.edgeGlows) {
          line.destroy();
        }
        this.active.delete(nodeId);

      } else if (elapsed < PULSE_MS) {
        // Phase 1: Pulse — sine-wave oscillation of shadow opacity/blur
        const pulseProgress = elapsed / PULSE_MS;
        // Sine wave produces 0..1 oscillation over PULSE_CYCLES full cycles
        const pulseValue = Math.sin(pulseProgress * PULSE_CYCLES * Math.PI * 2) * 0.5 + 0.5;

        // Modulate shadow opacity between 40%-100% of MAX
        const opacity = MAX_SHADOW_OPACITY * (0.4 + pulseValue * 0.6);
        // Modulate shadow blur between 50%-100% of MAX
        const blur = MAX_SHADOW_BLUR * (0.5 + pulseValue * 0.5);

        entry.glowShape.shadowOpacity(opacity);
        entry.glowShape.shadowBlur(blur);

        // Apply same modulation to edge glow lines (at lower intensity)
        for (const line of entry.edgeGlows) {
          line.shadowOpacity(opacity * 0.5);
          line.shadowBlur(blur * 0.6);
        }

        // Node border stays at full brightness during pulse phase
        // (already set in activate(); re-apply to handle clearSelection stomping)
        entry.nodeRect.stroke(entry.glowColor);
        entry.nodeRect.strokeWidth(BRIGHT_BORDER_WIDTH);

      } else {
        // Phase 2: Decay — linear fade of shadow and node border
        const decayProgress = (elapsed - PULSE_MS) / DECAY_MS;
        // Linear decay from full to zero
        const opacity = MAX_SHADOW_OPACITY * (1 - decayProgress);
        const blur = MAX_SHADOW_BLUR * (1 - decayProgress);

        entry.glowShape.shadowOpacity(opacity);
        entry.glowShape.shadowBlur(blur);

        // Apply same decay to edge glow lines
        for (const line of entry.edgeGlows) {
          line.shadowOpacity(opacity * 0.5);
          line.shadowBlur(blur * 0.6);
        }

        // Fade node border: interpolate strokeWidth from BRIGHT_BORDER_WIDTH to original
        const borderWidth =
          BRIGHT_BORDER_WIDTH + (entry.origStrokeWidth - BRIGHT_BORDER_WIDTH) * decayProgress;
        entry.nodeRect.strokeWidth(borderWidth);

        // Keep border color at glowColor throughout decay — it fades via reduced strokeWidth
        // At decayProgress=1 the strokeWidth matches origStrokeWidth anyway (phase 3 handles final restore)
        entry.nodeRect.stroke(entry.glowColor);
      }
    }
  }
}
