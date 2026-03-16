// ---------------------------------------------------------------------------
// NodeRenderer — Imperative Konva group management for graph nodes.
//
// Manages a Map of Konva.Groups (one per node) on the graph layer.
// Each group contains a rounded Rect (zone-colored) and a Text label.
// Node size scales by total edge count: more connections -> larger node.
//
// No React state — all updates are imperative Konva API calls.
// ZoneConfig provides zone fill colors for node Rect fills.
// ---------------------------------------------------------------------------

import Konva from 'konva';
import { getZoneLayout } from '../layout/ZoneConfig.js';
import type { GraphNode } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

export type Position = { x: number; y: number };

const NODE_BASE_SIZE = 120;
const NODE_HEIGHT_RATIO = 0.5;
const MIN_NODE_SIZE = 100;
const MAX_NODE_SIZE = 180;

// Component node sizing (larger for aggregated components)
const COMP_BASE_SIZE = 160;
const COMP_MIN_SIZE = 160;
const COMP_MAX_SIZE = 280;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isComponentNode(node: GraphNode): boolean {
  return node.fileCount !== undefined && node.fileCount > 1;
}

function computeNodeSize(node: GraphNode): number {
  if (isComponentNode(node)) {
    return clamp(
      COMP_BASE_SIZE + (node.fileCount ?? 1) * 8 + (node.incomingEdgeCount + node.outgoingEdgeCount) * 6,
      COMP_MIN_SIZE,
      COMP_MAX_SIZE,
    );
  }
  return clamp(
    NODE_BASE_SIZE + (node.incomingEdgeCount + node.outgoingEdgeCount) * 4,
    MIN_NODE_SIZE,
    MAX_NODE_SIZE,
  );
}

function truncateLabel(name: string, maxLen = 22): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '\u2026'; // ellipsis
}

// ---------------------------------------------------------------------------
// NodeRenderer
// ---------------------------------------------------------------------------

export class NodeRenderer {
  private layer: Konva.Layer;
  private shapes: Map<string, Konva.Group> = new Map();
  private positions: Map<string, Position> = new Map();

  constructor(layer: Konva.Layer) {
    this.layer = layer;
  }

  // -------------------------------------------------------------------------
  // Position tracking
  // -------------------------------------------------------------------------

  setPosition(nodeId: string, pos: Position): void {
    this.positions.set(nodeId, pos);
    const shape = this.shapes.get(nodeId);
    if (shape) {
      shape.x(pos.x);
      shape.y(pos.y);
    }
  }

  getPosition(nodeId: string): Position | undefined {
    return this.positions.get(nodeId);
  }

  // -------------------------------------------------------------------------
  // Full sync — reconcile all nodes against current state map
  // -------------------------------------------------------------------------

  syncAll(nodes: Map<string, GraphNode>): void {
    // Create or update shapes for all current nodes
    for (const [id, node] of nodes) {
      if (this.shapes.has(id)) {
        this.updateShape(id, node);
      } else {
        this.createShape(node);
      }
    }

    // Remove shapes for nodes that no longer exist
    for (const [id] of this.shapes) {
      if (!nodes.has(id)) {
        this.destroyShape(id);
      }
    }

    this.layer.batchDraw();
  }

  // -------------------------------------------------------------------------
  // Incremental delta — create/remove/update only changed nodes
  // -------------------------------------------------------------------------

  applyDelta(
    currentNodes: Map<string, GraphNode>,
    prevNodes: Map<string, GraphNode>,
  ): void {
    // Added nodes
    for (const [id, node] of currentNodes) {
      if (!prevNodes.has(id)) {
        this.createShape(node);
      }
    }

    // Removed nodes
    for (const [id] of prevNodes) {
      if (!currentNodes.has(id)) {
        this.destroyShape(id);
      }
    }

    // Updated nodes (zone or edge count changed)
    for (const [id, node] of currentNodes) {
      const prev = prevNodes.get(id);
      if (!prev) continue;
      if (
        prev.zone !== node.zone ||
        prev.incomingEdgeCount !== node.incomingEdgeCount ||
        prev.outgoingEdgeCount !== node.outgoingEdgeCount
      ) {
        this.updateShape(id, node);
      }
    }

    this.layer.batchDraw();
  }

  // -------------------------------------------------------------------------
  // Shape accessors (used by CullingIndex and AnimationQueue in Plan 04)
  // -------------------------------------------------------------------------

  getShape(nodeId: string): Konva.Group | undefined {
    return this.shapes.get(nodeId);
  }

  getAllNodeBounds(): Array<{ id: string; x: number; y: number; width: number; height: number }> {
    const result: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
    for (const [id, group] of this.shapes) {
      const rect = group.findOne<Konva.Rect>('Rect');
      if (!rect) continue;
      result.push({
        id,
        x: group.x(),
        y: group.y(),
        width: rect.width(),
        height: rect.height(),
      });
    }
    return result;
  }

  setVisible(nodeId: string, visible: boolean): void {
    const shape = this.shapes.get(nodeId);
    if (shape) shape.visible(visible);
  }

  // -------------------------------------------------------------------------
  // Private: shape lifecycle
  // -------------------------------------------------------------------------

  private createShape(node: GraphNode): void {
    const size = computeNodeSize(node);
    const isComp = isComponentNode(node);
    const height = isComp ? size * 0.45 : size * NODE_HEIGHT_RATIO;
    const zoneColor = getZoneLayout(node.zone ?? 'unknown').fillColor;

    const group = new Konva.Group({
      id: node.id,
      x: this.positions.get(node.id)?.x ?? 0,
      y: this.positions.get(node.id)?.y ?? 0,
    });

    // Store zone as custom attribute so AnimationQueue.activateFromDelta
    // can retrieve the glow color without needing graphStore access.
    group.setAttr('zone', node.zone ?? 'unknown');

    const rect = new Konva.Rect({
      width: size,
      height,
      offsetX: size / 2,
      offsetY: height / 2,
      fill: zoneColor,
      opacity: 0.85,
      stroke: 'rgba(255, 255, 255, 0.25)',
      strokeWidth: isComp ? 2 : 1,
      cornerRadius: isComp ? 12 : 8,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      shadowColor: zoneColor,
      shadowBlur: isComp ? 18 : 12,
      shadowOpacity: isComp ? 0.4 : 0.3,
    });

    group.add(rect);

    if (isComp) {
      // Component node: two-line label (name bold 14px + "N files" subtitle 11px)
      const textWidth = size - 16;
      const nameLabel = new Konva.Text({
        text: truncateLabel(node.name, 28),
        fontSize: 14,
        fontStyle: 'bold',
        fill: '#ffffffe6',
        align: 'center',
        width: textWidth,
        offsetX: textWidth / 2,
        offsetY: 14,
        listening: false,
      });

      const fileCount = node.fileCount ?? node.fileList.length;
      const subtitle = new Konva.Text({
        text: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
        fontSize: 11,
        fill: 'rgba(255, 255, 255, 0.6)',
        align: 'center',
        width: textWidth,
        offsetX: textWidth / 2,
        offsetY: -2,
        listening: false,
      });

      group.add(nameLabel);
      group.add(subtitle);
    } else {
      // Single-file node: original single-line label
      const textWidth = size - 8;
      const label = new Konva.Text({
        text: truncateLabel(node.name),
        fontSize: 12,
        fontStyle: 'bold',
        fill: '#ffffffe6',
        align: 'center',
        width: textWidth,
        offsetX: textWidth / 2,
        offsetY: 8,
        listening: false,
      });
      group.add(label);
    }

    this.layer.add(group);
    this.shapes.set(node.id, group);
  }

  private updateShape(nodeId: string, node: GraphNode): void {
    const group = this.shapes.get(nodeId);
    if (!group) return;

    // Keep zone attribute in sync for AnimationQueue lookups
    group.setAttr('zone', node.zone ?? 'unknown');

    const size = computeNodeSize(node);
    const isComp = isComponentNode(node);
    const height = isComp ? size * 0.45 : size * NODE_HEIGHT_RATIO;
    const zoneColor = getZoneLayout(node.zone ?? 'unknown').fillColor;

    const rect = group.findOne<Konva.Rect>('Rect');
    if (rect) {
      rect.fill(zoneColor);
      rect.width(size);
      rect.height(height);
      rect.offsetX(size / 2);
      rect.offsetY(height / 2);
      rect.cornerRadius(isComp ? 12 : 8);
      rect.strokeWidth(isComp ? 2 : 1);
      rect.shadowBlur(isComp ? 18 : 12);
      rect.shadowOpacity(isComp ? 0.4 : 0.3);
    }

    // Update text labels — find all Text children
    const texts = group.find<Konva.Text>('Text');

    if (isComp) {
      const textWidth = size - 16;
      const fileCount = node.fileCount ?? node.fileList.length;

      if (texts.length >= 2) {
        // Update existing two-line labels
        texts[0].text(truncateLabel(node.name, 28));
        texts[0].fontSize(14);
        texts[0].width(textWidth);
        texts[0].offsetX(textWidth / 2);
        texts[0].offsetY(14);

        texts[1].text(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);
        texts[1].fontSize(11);
        texts[1].fill('rgba(255, 255, 255, 0.6)');
        texts[1].width(textWidth);
        texts[1].offsetX(textWidth / 2);
        texts[1].offsetY(-2);
      } else if (texts.length === 1) {
        // Upgrade single label to two-line
        texts[0].text(truncateLabel(node.name, 28));
        texts[0].fontSize(14);
        texts[0].width(textWidth);
        texts[0].offsetX(textWidth / 2);
        texts[0].offsetY(14);

        const subtitle = new Konva.Text({
          text: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
          fontSize: 11,
          fill: 'rgba(255, 255, 255, 0.6)',
          align: 'center',
          width: textWidth,
          offsetX: textWidth / 2,
          offsetY: -2,
          listening: false,
        });
        group.add(subtitle);
      }
    } else {
      const textWidth = size - 8;
      if (texts.length > 0) {
        texts[0].text(truncateLabel(node.name));
        texts[0].fontSize(12);
        texts[0].width(textWidth);
        texts[0].offsetX(textWidth / 2);
        texts[0].offsetY(8);
      }
      // Remove extra text nodes if downgrading from component
      for (let i = 1; i < texts.length; i++) {
        texts[i].destroy();
      }
    }
  }

  private destroyShape(nodeId: string): void {
    const group = this.shapes.get(nodeId);
    if (group) {
      group.destroy();
      this.shapes.delete(nodeId);
    }
  }
}
