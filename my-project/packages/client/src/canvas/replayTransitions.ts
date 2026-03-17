// ---------------------------------------------------------------------------
// replayTransitions — Animation helpers for replay mode entry and exit.
//
// All helpers are pure: no store imports. They receive the NodeRenderer
// instance and data as arguments for testability.
//
// Uses the Konva.Tween API (same pattern as ViewportController.panToNode):
//   - EaseInOut easing for smooth morph/fade transitions
//   - 500ms default duration per Phase 16 CONTEXT.md spec
//   - onFinish callback destroys tween for GC cleanup
// ---------------------------------------------------------------------------

import Konva from 'konva';
import type { NodeRenderer } from './NodeRenderer.js';

// ---------------------------------------------------------------------------
// morphNodesToPositions — Animate existing nodes from their current rendered
// positions to historical target positions. Used on replay entry and exit.
// ---------------------------------------------------------------------------

/**
 * Animate all nodes in targetPositions from their current x/y to the target.
 * Uses actual shape.x()/shape.y() as start point (NOT placer position) per
 * RESEARCH.md Pitfall 3 — avoids jumps if node was tween-animated already.
 */
export function morphNodesToPositions(
  targetPositions: Map<string, { x: number; y: number }>,
  nodeRenderer: NodeRenderer,
  duration = 0.5,
): void {
  for (const [nodeId, target] of targetPositions) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    const tween = new Konva.Tween({
      node: shape,
      x: target.x,
      y: target.y,
      duration,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        tween.destroy();
      },
    });
    tween.play();
  }
}

// ---------------------------------------------------------------------------
// fadeInNodes — Fade in nodes from opacity 0 to 1.
// Used for historical-only nodes that don't exist in the live graph.
// ---------------------------------------------------------------------------

/**
 * Fade in the given node IDs from invisible to fully visible.
 * Sets opacity to 0 and visible=true before starting the tween.
 */
export function fadeInNodes(
  nodeIds: string[],
  nodeRenderer: NodeRenderer,
  duration = 0.5,
): void {
  for (const nodeId of nodeIds) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    shape.opacity(0);
    shape.visible(true);

    const tween = new Konva.Tween({
      node: shape,
      opacity: 1,
      duration,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        tween.destroy();
      },
    });
    tween.play();
  }
}

// ---------------------------------------------------------------------------
// fadeOutNodes — Fade out nodes from current opacity to 0.
// Used for live-only nodes that don't exist in the historical snapshot.
// ---------------------------------------------------------------------------

/**
 * Fade out the given node IDs to invisible.
 * On finish: sets visible=false and restores opacity=1 (clean state for reuse).
 */
export function fadeOutNodes(
  nodeIds: string[],
  nodeRenderer: NodeRenderer,
  duration = 0.5,
): void {
  for (const nodeId of nodeIds) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    const tween = new Konva.Tween({
      node: shape,
      opacity: 0,
      duration,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        shape.visible(false);
        shape.opacity(1); // Restore default for potential reuse
        tween.destroy();
      },
    });
    tween.play();
  }
}

// ---------------------------------------------------------------------------
// applyReplayTint — Apply a cool blue shadow glow to all visible node rects.
// Saves original shadow settings in tintedFills for restoration on exit.
//
// Chosen approach: blue shadow glow (per PLAN.md task spec "CHOSEN APPROACH"):
//   shadowColor '#64a0ff', shadowBlur 8, shadowOpacity 0.5, shadowEnabled true.
// This is visually distinct, simple to implement, and easy to restore.
// ---------------------------------------------------------------------------

/**
 * Apply a cool blue shadow glow to every node rect visible on the canvas.
 * @param nodeRenderer — renderer holding all node shapes
 * @param tintedFills — output Map: nodeId -> JSON of original shadow settings
 */
export function applyReplayTint(
  nodeRenderer: NodeRenderer,
  tintedFills: Map<string, string>,
): void {
  const bounds = nodeRenderer.getAllNodeBounds();
  for (const { id } of bounds) {
    const shape = nodeRenderer.getShape(id);
    if (!shape) continue;

    const rect = shape.findOne<Konva.Rect>('Rect');
    if (!rect) continue;

    // Save original shadow settings
    const original = {
      shadowColor: rect.shadowColor(),
      shadowBlur: rect.shadowBlur(),
      shadowOpacity: rect.shadowOpacity(),
      shadowEnabled: rect.shadowEnabled(),
    };
    tintedFills.set(id, JSON.stringify(original));

    // Apply cool blue tint glow
    rect.shadowColor('#64a0ff');
    rect.shadowBlur(8);
    rect.shadowOpacity(0.5);
    rect.shadowEnabled(true);
  }
}

// ---------------------------------------------------------------------------
// restoreOriginalTint — Restore all node rects to their pre-replay shadow
// settings and clear the tintedFills Map.
// ---------------------------------------------------------------------------

/**
 * Restore original shadow settings from tintedFills and clear the Map.
 * @param nodeRenderer — renderer holding all node shapes
 * @param tintedFills — Map populated by applyReplayTint
 */
export function restoreOriginalTint(
  nodeRenderer: NodeRenderer,
  tintedFills: Map<string, string>,
): void {
  for (const [nodeId, savedJson] of tintedFills) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    const rect = shape.findOne<Konva.Rect>('Rect');
    if (!rect) continue;

    const original = JSON.parse(savedJson) as {
      shadowColor: string;
      shadowBlur: number;
      shadowOpacity: number;
      shadowEnabled: boolean;
    };

    rect.shadowColor(original.shadowColor);
    rect.shadowBlur(original.shadowBlur);
    rect.shadowOpacity(original.shadowOpacity);
    rect.shadowEnabled(original.shadowEnabled);
  }

  tintedFills.clear();
}
