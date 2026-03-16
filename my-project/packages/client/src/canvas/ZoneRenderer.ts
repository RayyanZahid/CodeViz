// ---------------------------------------------------------------------------
// ZoneRenderer — Draws zone background rectangles with labels on the canvas.
//
// Renders one Konva.Group per zone in ZONE_LAYOUTS, each containing:
//   - A translucent Rect covering the zone's bounds (bgColor fill)
//   - A bold Text label in the top-left corner of the zone
//
// All zone groups are moved to the bottom of the layer so they appear behind
// node/edge shapes. Labels are hidden at high zoom levels (scale > 0.8) where
// they would compete with node labels.
//
// No React state — fully imperative Konva API.
// ---------------------------------------------------------------------------

import Konva from 'konva';
import { ZONE_LAYOUTS } from '../layout/ZoneConfig.js';

// ---------------------------------------------------------------------------
// ZoneRenderer
// ---------------------------------------------------------------------------

export class ZoneRenderer {
  private layer: Konva.Layer;
  private zoneGroups: Konva.Group[] = [];

  constructor(layer: Konva.Layer) {
    this.layer = layer;
    this.renderZones();
  }

  // -------------------------------------------------------------------------
  // Label visibility based on zoom scale
  // -------------------------------------------------------------------------

  /**
   * Toggle zone label visibility based on canvas zoom scale.
   * At high zoom (scale > 0.8) labels are hidden — nodes fill the view and
   * zone labels compete visually. At low zoom (scale <= 0.8) labels provide
   * orientation when nodes are small.
   */
  updateLabelVisibility(scale: number): void {
    const showLabels = scale <= 0.8;
    for (const group of this.zoneGroups) {
      const label = group.findOne<Konva.Text>('Text');
      if (label) label.visible(showLabels);
    }
  }

  // -------------------------------------------------------------------------
  // Private: initial render
  // -------------------------------------------------------------------------

  private renderZones(): void {
    for (const zone of ZONE_LAYOUTS) {
      const width = zone.bounds.x1 - zone.bounds.x0;
      const height = zone.bounds.y1 - zone.bounds.y0;

      const group = new Konva.Group({ listening: false });

      const rect = new Konva.Rect({
        x: zone.bounds.x0,
        y: zone.bounds.y0,
        width,
        height,
        fill: zone.bgColor,
        cornerRadius: 8,
        listening: false,
      });

      const label = new Konva.Text({
        x: zone.bounds.x0 + 12,
        y: zone.bounds.y0 + 10,
        text: zone.label,
        fontSize: 14,
        fill: '#ffffff25',
        fontStyle: 'bold',
        listening: false,
      });

      group.add(rect);
      group.add(label);
      this.layer.add(group);

      // Zones must render behind nodes and edges
      group.moveToBottom();

      this.zoneGroups.push(group);
    }

    this.layer.batchDraw();
  }
}
