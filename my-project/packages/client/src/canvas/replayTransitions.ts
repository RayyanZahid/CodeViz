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
//
// cancelAllTweens: module-level Set<Konva.Tween> tracks active tweens from
//   morphNodesToPositions so high-speed playback can destroy them before the
//   next snapshot loads.
// ---------------------------------------------------------------------------

import Konva from 'konva';
import type { NodeRenderer } from './NodeRenderer.js';

// ---------------------------------------------------------------------------
// Active tween registry — populated by morphNodesToPositions, consumed by
// cancelAllTweens. Allows high-speed playback to abort in-flight animations.
// ---------------------------------------------------------------------------
const activeTweens = new Set<Konva.Tween>();

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
        activeTweens.delete(tween);
        tween.destroy();
      },
    });
    activeTweens.add(tween);
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

// ---------------------------------------------------------------------------
// cancelAllTweens — Destroy all in-flight morph tweens registered by
// morphNodesToPositions. Called before loading a snapshot at high speeds
// (2x, 4x) to prevent animation pile-up.
// ---------------------------------------------------------------------------

/**
 * Cancel and destroy all active Konva.Tween instances created by morphNodesToPositions.
 * Safe to call even when no tweens are active (no-op in that case).
 */
export function cancelAllTweens(): void {
  for (const tween of activeTweens) {
    tween.destroy();
  }
  activeTweens.clear();
}

// ---------------------------------------------------------------------------
// applyDiffTint — Apply shadow glow diff colors to nodes based on diff sets.
//
// Color scheme:
//   Added nodes   → green  (#22c55e, shadowBlur 12, shadowOpacity 0.7)
//   Removed nodes → red    (#ef4444, shadowBlur 12, shadowOpacity 0.5, opacity 0.4)
//   Changed nodes → amber  (#eab308, shadowBlur 10, shadowOpacity 0.6)
//
// Returns a Map<nodeId, JSON> of original shadow settings for restoration.
// ---------------------------------------------------------------------------

interface OriginalShadowSettings {
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  shadowEnabled: boolean;
  opacity: number;
}

/**
 * Apply diff-mode shadow glow tints to nodes based on their diff classification.
 * @param nodeRenderer — renderer holding all node shapes
 * @param added        — node IDs that are new in the current snapshot
 * @param removed      — node IDs that existed in the base but not the current
 * @param changed      — node IDs that exist in both but have different properties
 * @returns Map of nodeId → JSON-serialized original shadow+opacity settings
 */
export function applyDiffTint(
  nodeRenderer: NodeRenderer,
  added: Set<string>,
  removed: Set<string>,
  changed: Set<string>,
): Map<string, string> {
  const diffTintedFills = new Map<string, string>();

  function tintNode(id: string, settings: {
    shadowColor: string;
    shadowBlur: number;
    shadowOpacity: number;
    opacity?: number;
  }): void {
    const shape = nodeRenderer.getShape(id);
    if (!shape) return;

    const rect = shape.findOne<Konva.Rect>('Rect');
    if (!rect) return;

    // Save original settings (including group opacity)
    const original: OriginalShadowSettings = {
      shadowColor: rect.shadowColor(),
      shadowBlur: rect.shadowBlur(),
      shadowOpacity: rect.shadowOpacity(),
      shadowEnabled: rect.shadowEnabled(),
      opacity: shape.opacity(),
    };
    diffTintedFills.set(id, JSON.stringify(original));

    // Apply diff tint
    rect.shadowColor(settings.shadowColor);
    rect.shadowBlur(settings.shadowBlur);
    rect.shadowOpacity(settings.shadowOpacity);
    rect.shadowEnabled(true);

    if (settings.opacity !== undefined) {
      shape.opacity(settings.opacity);
    }
  }

  for (const id of added) {
    tintNode(id, { shadowColor: '#22c55e', shadowBlur: 12, shadowOpacity: 0.7 });
  }

  for (const id of removed) {
    tintNode(id, { shadowColor: '#ef4444', shadowBlur: 12, shadowOpacity: 0.5, opacity: 0.4 });
  }

  for (const id of changed) {
    tintNode(id, { shadowColor: '#eab308', shadowBlur: 10, shadowOpacity: 0.6 });
  }

  return diffTintedFills;
}

// ---------------------------------------------------------------------------
// restoreDiffTint — Restore node shapes to their pre-diff shadow settings.
// Same pattern as restoreOriginalTint but also restores group opacity.
// ---------------------------------------------------------------------------

/**
 * Restore all nodes to their pre-diff shadow settings and clear the Map.
 * @param nodeRenderer    — renderer holding all node shapes
 * @param diffTintedFills — Map populated by applyDiffTint
 */
export function restoreDiffTint(
  nodeRenderer: NodeRenderer,
  diffTintedFills: Map<string, string>,
): void {
  for (const [nodeId, savedJson] of diffTintedFills) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    const rect = shape.findOne<Konva.Rect>('Rect');
    if (!rect) continue;

    const original = JSON.parse(savedJson) as OriginalShadowSettings;

    rect.shadowColor(original.shadowColor);
    rect.shadowBlur(original.shadowBlur);
    rect.shadowOpacity(original.shadowOpacity);
    rect.shadowEnabled(original.shadowEnabled);
    shape.opacity(original.opacity);
  }

  diffTintedFills.clear();
}
