// ---------------------------------------------------------------------------
// ArchCanvas — Full canvas orchestrator wiring all renderers, layout engine,
// animation queue, viewport controller, and culling index.
//
// Architecture:
//   - graph-layer: static node/edge/zone shapes; redraws on graph delta
//   - anim-layer: glow overlays; listening=false, runs continuous RAF via Konva.Animation
//
// Renderer wiring:
//   ZoneRenderer   — draws 6 zone backgrounds once on init
//   NodeRenderer   — imperative Map of Konva.Groups per GraphNode
//   EdgeRenderer   — imperative Map of Konva.Arrows per GraphEdge
//   IncrementalPlacer — d3-force sticky layout; places new nodes near zone center
//   AnimationQueue — 30s glow decay on animLayer for added/updated nodes
//   ViewportController — zoom-to-pointer, pan, fit-to-view, localStorage persistence
//   CullingIndex   — quadtree viewport culling for 60fps at 300 nodes
//
// Imperative Zustand subscription (graphStore.subscribe) bypasses React re-renders.
// No React.StrictMode — avoids Konva double-mount issues.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { graphStore } from '../store/graphStore.js';
import { NodeRenderer } from './NodeRenderer.js';
import { EdgeRenderer } from './EdgeRenderer.js';
import { ZoneRenderer } from './ZoneRenderer.js';
import { CullingIndex } from './CullingIndex.js';
import { AnimationQueue } from './AnimationQueue.js';
import { ViewportController } from './ViewportController.js';
import { IncrementalPlacer } from '../layout/IncrementalPlacer.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../layout/ZoneConfig.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArchCanvasProps {
  width: number;
  height: number;
  onViewportChange?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onSelectNode?: (nodeId: string | null) => void;
  viewportControllerRef?: React.MutableRefObject<ViewportController | null>;
  /** Ref populated with latest node world positions after each layout tick */
  nodePositionsRef?: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  /** Ref populated with imperative handle for programmatic node selection */
  canvasRef?: React.MutableRefObject<{ selectNodeOnCanvas: (nodeId: string) => void } | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArchCanvas({
  width,
  height,
  onViewportChange,
  onSelectNode,
  viewportControllerRef,
  nodePositionsRef,
  canvasRef,
}: ArchCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const graphLayerRef = useRef<Konva.Layer>(null);
  const animLayerRef = useRef<Konva.Layer>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleSelectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      onSelectNode?.(nodeId);
    },
    [onSelectNode],
  );

  // Keep a stable ref to handleSelectNode so the effect closure doesn't go stale
  const handleSelectNodeRef = useRef(handleSelectNode);
  handleSelectNodeRef.current = handleSelectNode;

  // Keep a stable ref to onViewportChange so the effect closure doesn't go stale
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    const stage = stageRef.current;
    const graphLayerRaw = graphLayerRef.current;
    const animLayerRaw = animLayerRef.current;

    // Guard: all three must be mounted before wiring
    if (!stage || !graphLayerRaw || !animLayerRaw) return;

    // Capture non-null locals so TypeScript can trust them inside closures.
    // (TypeScript cannot narrow ref values across closure boundaries.)
    const gl: Konva.Layer = graphLayerRaw;
    const al: Konva.Layer = animLayerRaw;

    // -------------------------------------------------------------------------
    // Instantiate all subsystems
    // -------------------------------------------------------------------------
    const zoneRenderer = new ZoneRenderer(gl);
    const nodeRenderer = new NodeRenderer(gl);
    const edgeRenderer = new EdgeRenderer(gl, nodeRenderer);
    const placer = new IncrementalPlacer();
    const cullingIndex = new CullingIndex(nodeRenderer, edgeRenderer, CANVAS_WIDTH, CANVAS_HEIGHT);
    const animQueue = new AnimationQueue(al);

    // -------------------------------------------------------------------------
    // Viewport change callback — updates culling, label visibility, minimap
    // -------------------------------------------------------------------------
    // viewport is assigned below after ViewportController is created;
    // we forward-declare it here so handleViewportChange can close over it.
    let viewport: ViewportController;

    function handleViewportChange() {
      const rect = viewport.getViewportRect();
      const scale = viewport.getScale();
      cullingIndex.updateVisibility(rect);
      zoneRenderer.updateLabelVisibility(scale);
      onViewportChangeRef.current?.(rect);
    }

    viewport = new ViewportController(stage, handleViewportChange);

    // Expose viewport controller to parent (for zoom +/- buttons)
    if (viewportControllerRef) {
      viewportControllerRef.current = viewport;
    }

    // -------------------------------------------------------------------------
    // Full sync — initial render of all nodes/edges
    // -------------------------------------------------------------------------
    function fullSync(): void {
      const state = graphStore.getState();

      nodeRenderer.syncAll(state.nodes);

      placer.placeNewNodes(state.nodes, state.edges);
      for (const [id, pos] of placer.getPositions()) {
        nodeRenderer.setPosition(id, pos);
      }

      // Populate nodePositionsRef on initial sync
      if (nodePositionsRef) {
        const posMap = new Map<string, { x: number; y: number }>();
        for (const [id, pos] of placer.getPositions()) {
          posMap.set(id, pos);
        }
        nodePositionsRef.current = posMap;
      }

      edgeRenderer.syncAll(state.edges);

      cullingIndex.setEdges(state.edges);
      cullingIndex.rebuild();
      handleViewportChange();

      gl.batchDraw();
    }

    // Run initial sync if store already has data
    const initialState = graphStore.getState();
    if (initialState.nodes.size > 0) {
      fullSync();
      viewport.fitToView();
    }

    // -------------------------------------------------------------------------
    // Incremental updates — graphStore subscription
    // -------------------------------------------------------------------------
    const unsub = graphStore.subscribe((state, prev) => {
      const addedNodeIds = [...state.nodes.keys()].filter((id) => !prev.nodes.has(id));
      const removedNodeIds = [...prev.nodes.keys()].filter((id) => !state.nodes.has(id));
      const updatedNodeIds = [...state.nodes.keys()].filter(
        (id) => prev.nodes.has(id) && state.nodes.get(id) !== prev.nodes.get(id),
      );

      nodeRenderer.applyDelta(state.nodes, prev.nodes);

      for (const id of removedNodeIds) {
        placer.removeNode(id);
      }

      if (addedNodeIds.length > 0) {
        placer.placeNewNodes(state.nodes, state.edges);
        for (const [id, pos] of placer.getPositions()) {
          nodeRenderer.setPosition(id, pos);
        }
        // Update nodePositionsRef so App.tsx can read world positions for panToNode
        if (nodePositionsRef) {
          const posMap = new Map<string, { x: number; y: number }>();
          for (const [id, pos] of placer.getPositions()) {
            posMap.set(id, pos);
          }
          nodePositionsRef.current = posMap;
        }
        cullingIndex.rebuild();
      }

      edgeRenderer.applyDelta(state.edges, prev.edges);
      edgeRenderer.updatePositions();
      cullingIndex.setEdges(state.edges);

      animQueue.activateFromDelta(
        addedNodeIds,
        updatedNodeIds,
        nodeRenderer,
        edgeRenderer,
        state.edges,
      );

      handleViewportChange();
      gl.batchDraw();
    });

    // -------------------------------------------------------------------------
    // Click-to-select — selects node and highlights its direct dependencies
    // -------------------------------------------------------------------------
    stage.on('click tap', (e) => {
      const target = e.target;

      // Background click — deselect all
      if (target === stage) {
        clearSelection(nodeRenderer);
        handleSelectNodeRef.current(null);
        gl.batchDraw();
        return;
      }

      // Walk up the parent chain to find a Group with a non-empty id (node group)
      let current: Konva.Node | null = target;
      let nodeId: string | null = null;

      while (current && current !== gl) {
        // A node group has a non-empty id set by NodeRenderer
        if (current.getType() === 'Group' && current.id()) {
          nodeId = current.id();
          break;
        }
        current = current.parent;
      }

      clearSelection(nodeRenderer);

      if (!nodeId) {
        handleSelectNodeRef.current(null);
        gl.batchDraw();
        return;
      }

      // Highlight selected node
      highlightNode(nodeId, nodeRenderer);

      // Highlight direct dependency nodes (targets of outgoing edges)
      const currentState = graphStore.getState();
      for (const edge of currentState.edges.values()) {
        if (edge.sourceId === nodeId) {
          highlightDependency(edge.targetId, nodeRenderer);
        }
      }

      handleSelectNodeRef.current(nodeId);
      gl.batchDraw();
    });

    // -------------------------------------------------------------------------
    // Imperative handle for programmatic node selection from parent (App.tsx)
    // Allows sidebar interactions (risk click, dependency click) to highlight
    // the selected node and its dependency edges on the canvas.
    // -------------------------------------------------------------------------
    if (canvasRef) {
      canvasRef.current = {
        selectNodeOnCanvas: (nodeId: string) => {
          clearSelection(nodeRenderer);
          highlightNode(nodeId, nodeRenderer);
          // Highlight dependency edges (same logic as click handler)
          const currentState = graphStore.getState();
          for (const edge of currentState.edges.values()) {
            if (edge.sourceId === nodeId) {
              highlightDependency(edge.targetId, nodeRenderer);
            }
          }
          handleSelectNodeRef.current(nodeId);
          gl.batchDraw();
        },
      };
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    return () => {
      unsub();
      animQueue.destroy();
      stage.off('click tap');
      stage.off('wheel');
      stage.off('dragend');
      if (viewportControllerRef) {
        viewportControllerRef.current = null;
      }
      if (canvasRef) {
        canvasRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress unused warning — selectedNodeId is managed by handleSelectNode
  void selectedNodeId;

  return (
    <Stage
      ref={stageRef as React.RefObject<Konva.Stage>}
      width={width}
      height={height}
      draggable
    >
      {/* Graph layer: zone backgrounds, node groups, edge arrows — listening=true for click-to-select */}
      <Layer ref={graphLayerRef as React.RefObject<Konva.Layer>} id="graph-layer" />
      {/* Animation layer: glow overlays — listening=false saves hit detection pass (REND-04) */}
      <Layer ref={animLayerRef as React.RefObject<Konva.Layer>} id="anim-layer" listening={false} />
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// Selection helpers — imperative Konva stroke manipulation
// ---------------------------------------------------------------------------

function clearSelection(nodeRenderer: NodeRenderer): void {
  const bounds = nodeRenderer.getAllNodeBounds();
  for (const { id } of bounds) {
    const shape = nodeRenderer.getShape(id);
    if (!shape) continue;
    const rect = shape.findOne<Konva.Rect>('Rect');
    if (rect) {
      rect.stroke('#ffffff20');
      rect.strokeWidth(1);
    }
    shape.opacity(1);
  }
}

function highlightNode(nodeId: string, nodeRenderer: NodeRenderer): void {
  const shape = nodeRenderer.getShape(nodeId);
  if (!shape) return;
  const rect = shape.findOne<Konva.Rect>('Rect');
  if (rect) {
    rect.stroke('#ffffff');
    rect.strokeWidth(2);
  }
}

function highlightDependency(nodeId: string, nodeRenderer: NodeRenderer): void {
  const shape = nodeRenderer.getShape(nodeId);
  if (!shape) return;
  const rect = shape.findOne<Konva.Rect>('Rect');
  if (rect) {
    rect.stroke('#ffffff80');
    rect.strokeWidth(1.5);
  }
  shape.opacity(0.9);
}
