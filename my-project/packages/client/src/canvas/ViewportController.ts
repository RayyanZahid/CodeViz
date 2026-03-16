// ---------------------------------------------------------------------------
// ViewportController — Zoom-to-pointer, pan, fit-to-view, and viewport
// state persistence for the ArchCanvas Konva Stage.
//
// Zoom-to-pointer implementation per RESEARCH.md Pattern 4:
//   1. Compute mouse position in world space before scale change
//   2. Apply new scale
//   3. Reposition stage so world-space point stays under the cursor
//
// Viewport state (zoom + pan) persists to localStorage via utils/viewport.ts.
// The persisted state is restored on construction so the user returns to
// where they left off.
// ---------------------------------------------------------------------------

import Konva from 'konva';
import { saveViewport, loadViewport, clearViewport } from '../utils/viewport.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../layout/ZoneConfig.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 0.05;
const MAX_SCALE = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// ViewportController
// ---------------------------------------------------------------------------

export class ViewportController {
  private stage: Konva.Stage;
  private onViewportChange: (() => void) | null;

  constructor(stage: Konva.Stage, onViewportChange?: () => void) {
    this.stage = stage;
    this.onViewportChange = onViewportChange ?? null;

    // Attach wheel handler for zoom-to-pointer
    stage.on('wheel', (e) => {
      e.evt.preventDefault();

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Compute the world-space point under the cursor before scale change
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = clamp(
        oldScale * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR),
        MIN_SCALE,
        MAX_SCALE,
      );

      stage.scale({ x: newScale, y: newScale });

      // Reposition so the world-space point stays under the cursor
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });

      this.persistViewport();
      this.onViewportChange?.();
    });

    // Attach dragend handler for pan persistence
    stage.on('dragend', () => {
      this.persistViewport();
      this.onViewportChange?.();
    });

    // Restore viewport from localStorage on init
    const saved = loadViewport();
    if (saved) {
      stage.scale({ x: saved.zoom, y: saved.zoom });
      stage.position({ x: saved.panX, y: saved.panY });
    }
  }

  // -------------------------------------------------------------------------
  // Navigation methods
  // -------------------------------------------------------------------------

  /**
   * Fit the entire graph into the visible stage area with padding.
   * Uses the graph-layer bounding rect to compute scale and position.
   * Falls back to canvas center if the graph is empty.
   */
  fitToView(padding = 60): void {
    const stage = this.stage;
    const graphLayer = stage.findOne<Konva.Layer>('#graph-layer');
    if (!graphLayer) return;

    const box = graphLayer.getClientRect({ skipTransform: true });

    if (box.width === 0 || box.height === 0) {
      // Empty graph — center the stage on the canvas
      const scale = Math.min(
        stage.width() / CANVAS_WIDTH,
        stage.height() / CANVAS_HEIGHT,
      );
      stage.scale({ x: scale, y: scale });
      stage.position({
        x: (stage.width() - CANVAS_WIDTH * scale) / 2,
        y: (stage.height() - CANVAS_HEIGHT * scale) / 2,
      });
    } else {
      // Compute scale to fit the bounding box with padding
      const scaleX = (stage.width() - 2 * padding) / box.width;
      const scaleY = (stage.height() - 2 * padding) / box.height;
      const scale = Math.min(scaleX, scaleY, 2.0);

      // Center the bounding box in the stage
      stage.scale({ x: scale, y: scale });
      stage.position({
        x: (stage.width() - box.width * scale) / 2 - box.x * scale,
        y: (stage.height() - box.height * scale) / 2 - box.y * scale,
      });
    }

    this.persistViewport();
    this.onViewportChange?.();
  }

  /**
   * Zoom in centered on the stage center point.
   */
  zoomIn(): void {
    this.zoomCentered(ZOOM_FACTOR);
  }

  /**
   * Zoom out centered on the stage center point.
   */
  zoomOut(): void {
    this.zoomCentered(1 / ZOOM_FACTOR);
  }

  /**
   * Clear persisted viewport and fit the graph to view.
   */
  resetView(): void {
    clearViewport();
    this.fitToView();
  }

  /**
   * Get the current viewport rectangle in world (stage) coordinates.
   * Used by CullingIndex.updateVisibility() and MinimapStage.
   */
  getViewportRect(): { x: number; y: number; width: number; height: number } {
    const scale = this.stage.scaleX();
    return {
      x: -this.stage.x() / scale,
      y: -this.stage.y() / scale,
      width: this.stage.width() / scale,
      height: this.stage.height() / scale,
    };
  }

  /**
   * Get the current zoom scale factor.
   */
  getScale(): number {
    return this.stage.scaleX();
  }

  /**
   * Pan the viewport to center on a given world-space coordinate.
   * Used by handleHighlightNode in App.tsx for cross-panel navigation.
   */
  panToNode(worldX: number, worldY: number): void {
    const stage = this.stage;
    const scale = stage.scaleX();
    // Center the given world point in the viewport
    const newX = stage.width() / 2 - worldX * scale;
    const newY = stage.height() / 2 - worldY * scale;
    stage.position({ x: newX, y: newY });
    stage.batchDraw();
    this.persistViewport();
    this.onViewportChange?.();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Zoom by factor centered on the stage center (for +/- buttons).
   */
  private zoomCentered(factor: number): void {
    const stage = this.stage;
    const oldScale = stage.scaleX();
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);

    // Center point in screen coords
    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;

    // World-space point under the center
    const worldX = (centerX - stage.x()) / oldScale;
    const worldY = (centerY - stage.y()) / oldScale;

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: centerX - worldX * newScale,
      y: centerY - worldY * newScale,
    });

    this.persistViewport();
    this.onViewportChange?.();
  }

  /**
   * Persist current viewport state to localStorage.
   */
  private persistViewport(): void {
    saveViewport({
      zoom: this.stage.scaleX(),
      panX: this.stage.x(),
      panY: this.stage.y(),
    });
  }
}
