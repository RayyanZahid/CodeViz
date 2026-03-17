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
// Replay mode integration (Plan 03):
//   replayStore.subscribe orchestrates enter/exit transitions:
//     - Enter: morph common nodes to historical positions, fade in/out historical/live-only nodes,
//              apply blue tint, auto-zoom viewport
//     - Exit: restore tint, re-sync live graph, morph back to live positions
//   graphStore subscription guards against visual updates while isReplay=true.
//
// Imperative Zustand subscription (graphStore.subscribe) bypasses React re-renders.
// No React.StrictMode — avoids Konva double-mount issues.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { graphStore } from '../store/graphStore.js';
import { replayStore, useReplayStore } from '../store/replayStore.js';
import { NodeRenderer } from './NodeRenderer.js';
import { EdgeRenderer } from './EdgeRenderer.js';
import { ZoneRenderer } from './ZoneRenderer.js';
import { CullingIndex } from './CullingIndex.js';
import { AnimationQueue } from './AnimationQueue.js';
import { ViewportController } from './ViewportController.js';
import { IncrementalPlacer } from '../layout/IncrementalPlacer.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../layout/ZoneConfig.js';
import {
  morphNodesToPositions,
  fadeInNodes,
  fadeOutNodes,
  applyReplayTint,
  restoreOriginalTint,
} from './replayTransitions.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeTooltipData {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  dependencyCount: number;
  targetExports: string[];
  x: number;
  y: number;
}

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
  /** Called with tooltip data when hovering an edge, or null to dismiss */
  onEdgeHover?: (data: EdgeTooltipData | null) => void;
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
  onEdgeHover,
}: ArchCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const graphLayerRef = useRef<Konva.Layer>(null);
  const animLayerRef = useRef<Konva.Layer>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Replay state selectors — for empty graph message overlay
  const isReplay = useReplayStore(s => s.isReplay);
  const replayNodeCount = useReplayStore(s => s.replayNodes.size);

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

  // Keep a stable ref to onEdgeHover so the effect closure doesn't go stale
  const onEdgeHoverRef = useRef(onEdgeHover);
  onEdgeHoverRef.current = onEdgeHover;

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
    // Clear stale viewport state so fitToView runs clean on first load
    viewport.resetView();

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
      edgeRenderer.updatePositions();

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
      // Skip visual updates during replay — live graph store may be silently
      // updated by initial_state but canvas must show historical data only.
      if (replayStore.getState().isReplay) {
        return;
      }

      const addedNodeIds = [...state.nodes.keys()].filter((id) => !prev.nodes.has(id));
      const removedNodeIds = [...prev.nodes.keys()].filter((id) => !state.nodes.has(id));
      const updatedNodeIds = [...state.nodes.keys()].filter(
        (id) => prev.nodes.has(id) && state.nodes.get(id) !== prev.nodes.get(id),
      );

      nodeRenderer.applyDelta(state.nodes, prev.nodes);

      for (const id of removedNodeIds) {
        placer.removeNode(id);
      }

      // Detect nodes whose zone changed — they need re-placement
      const zoneChangedIds: string[] = [];
      for (const id of updatedNodeIds) {
        const prevNode = prev.nodes.get(id);
        const currNode = state.nodes.get(id);
        if (prevNode && currNode && prevNode.zone !== currNode.zone) {
          placer.removeNode(id); // Unpin so placer treats it as new
          zoneChangedIds.push(id);
        }
      }

      const needsLayout = addedNodeIds.length > 0 || zoneChangedIds.length > 0;

      if (needsLayout) {
        placer.placeNewNodes(state.nodes, state.edges);
        for (const [id, pos] of placer.getPositions()) {
          nodeRenderer.setPosition(id, pos);
        }
        if (nodePositionsRef) {
          const posMap = new Map<string, { x: number; y: number }>();
          for (const [id, pos] of placer.getPositions()) {
            posMap.set(id, pos);
          }
          nodePositionsRef.current = posMap;
        }
        cullingIndex.rebuild();
        // Auto-fit on first meaningful layout
        if (addedNodeIds.length > 0) {
          viewport.fitToView();
        }
      }

      edgeRenderer.applyDelta(state.edges, prev.edges);
      // Full sync edges after layout changes to catch any with missing positions
      if (needsLayout) {
        edgeRenderer.syncAll(state.edges);
      }
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
    // Replay mode transitions — replayStore subscription
    // Handles enter/exit animations: morph, fade, tint, viewport zoom.
    // -------------------------------------------------------------------------

    // Track tinted fills for restore on exit (keyed by nodeId, value = JSON shadow settings)
    const tintedFills = new Map<string, string>();
    // Track whether a replay was entered (gate for exit logic)
    let wasInReplay = false;

    const replayUnsub = replayStore.subscribe((state, prev) => {
      // --- ENTER REPLAY ---
      if (state.isReplay && !prev.isReplay) {
        wasInReplay = true;

        // 1. Determine which nodes exist in both live and historical, which are new, which are removed
        const liveNodeIds = new Set(graphStore.getState().nodes.keys());
        const historicalNodeIds = new Set(state.replayNodes.keys());

        const commonIds = [...liveNodeIds].filter(id => historicalNodeIds.has(id));
        const addedInHistorical = [...historicalNodeIds].filter(id => !liveNodeIds.has(id));
        const removedInHistorical = [...liveNodeIds].filter(id => !historicalNodeIds.has(id));

        // 2. Create shapes for nodes that exist in historical but not live.
        //    NodeRenderer.createShape is private — use syncAll with merged Map.
        //    Build a combined nodes map: live nodes + historical-only nodes.
        const liveState = graphStore.getState();
        if (addedInHistorical.length > 0) {
          const mergedNodes = new Map(liveState.nodes);
          for (const id of addedInHistorical) {
            const node = state.replayNodes.get(id);
            if (node) mergedNodes.set(id, node);
          }
          nodeRenderer.syncAll(mergedNodes);
        }

        // 3. Compute target positions for historical nodes via IncrementalPlacer.
        //    Historical-only nodes are not in placer positions yet — placeNewNodes will seat them.
        placer.placeNewNodes(state.replayNodes, state.replayEdges);
        const historicalPositions = new Map<string, { x: number; y: number }>();
        for (const [id, pos] of placer.getPositions()) {
          if (historicalNodeIds.has(id)) {
            historicalPositions.set(id, pos);
          }
        }

        // 4. Animate common nodes to historical positions (morph)
        const commonPositions = new Map<string, { x: number; y: number }>();
        for (const id of commonIds) {
          const pos = historicalPositions.get(id);
          if (pos) commonPositions.set(id, pos);
        }
        morphNodesToPositions(commonPositions, nodeRenderer, 0.5);

        // 5. Position historical-only nodes at their computed positions, then fade in
        for (const id of addedInHistorical) {
          const pos = historicalPositions.get(id);
          if (pos) nodeRenderer.setPosition(id, pos);
        }
        fadeInNodes(addedInHistorical, nodeRenderer, 0.5);

        // 6. Fade out nodes that exist live but not in historical snapshot
        fadeOutNodes(removedInHistorical, nodeRenderer, 0.5);

        // 7. Sync edges to historical graph
        edgeRenderer.syncAll(state.replayEdges);
        edgeRenderer.updatePositions();

        // 8. Apply cool blue tint (shadow glow) to all visible historical nodes
        applyReplayTint(nodeRenderer, tintedFills);

        // 9. Auto-zoom viewport to fit historical graph (~500ms per CONTEXT.md)
        //    Small delay lets morph start before fitting
        setTimeout(() => {
          viewport.fitToView();
        }, 100);

        gl.batchDraw();
      }

      // --- EXIT REPLAY ---
      if (!state.isReplay && prev.isReplay && wasInReplay) {
        wasInReplay = false;

        // 1. Restore original tint (remove blue glow)
        restoreOriginalTint(nodeRenderer, tintedFills);

        // 2. Re-sync the live graph state onto the canvas
        const liveState = graphStore.getState();

        // 3. Remove any historical-only shapes that were temporarily added
        //    by the enter-replay syncAll merge. Use syncAll with live nodes
        //    to reconcile (removes extras, preserves live nodes).
        nodeRenderer.syncAll(liveState.nodes);

        // 4. Re-seed placer with live nodes so new positions are computed correctly
        placer.placeNewNodes(liveState.nodes, liveState.edges);

        // 5. Morph existing nodes back to live positions
        const livePositions = new Map<string, { x: number; y: number }>();
        for (const [id, pos] of placer.getPositions()) {
          livePositions.set(id, pos);
        }
        morphNodesToPositions(livePositions, nodeRenderer, 0.5);

        // 6. Nodes that are live but were not in historical — fade them in
        const historicalNodeIds = new Set(prev.replayNodes.keys());
        const newInLive = [...liveState.nodes.keys()].filter(id => !historicalNodeIds.has(id));
        for (const id of newInLive) {
          const pos = livePositions.get(id);
          if (pos) nodeRenderer.setPosition(id, pos);
        }
        fadeInNodes(newInLive, nodeRenderer, 0.5);

        // 7. Sync edges back to live state
        edgeRenderer.syncAll(liveState.edges);
        edgeRenderer.updatePositions();

        // 8. Update nodePositionsRef for cross-panel navigation
        if (nodePositionsRef) {
          nodePositionsRef.current = livePositions;
        }

        // 9. Rebuild culling index
        cullingIndex.setEdges(liveState.edges);
        cullingIndex.rebuild();
        handleViewportChange();

        // 10. Fit to view to restore live graph framing
        setTimeout(() => viewport.fitToView(), 100);

        gl.batchDraw();
      }
    });

    // -------------------------------------------------------------------------
    // Edge highlight state — tracks which edge (if any) is currently highlighted
    // -------------------------------------------------------------------------
    let highlightedEdgeId: string | null = null;

    function clearEdgeHighlight(): void {
      if (highlightedEdgeId) {
        edgeRenderer.resetLineStyle(highlightedEdgeId);
        highlightedEdgeId = null;
      }
      clearSelection(nodeRenderer);
      gl.batchDraw();
    }

    function highlightEdge(arrow: Konva.Arrow): void {
      // Clear any existing selection / edge highlight first
      clearEdgeHighlight();

      highlightedEdgeId = arrow.id();

      // Style the clicked edge: accent blue, thicker
      const currentWidth = arrow.strokeWidth();
      arrow.stroke('#60a5fa');
      arrow.fill('#60a5fa');
      arrow.strokeWidth(currentWidth + 2);

      // Retrieve endpoint node IDs
      const sourceId = arrow.getAttr('sourceId') as string | undefined;
      const targetId = arrow.getAttr('targetId') as string | undefined;

      if (sourceId) highlightNode(sourceId, nodeRenderer);
      if (targetId) highlightNode(targetId, nodeRenderer);

      // Dim all other nodes
      const bounds = nodeRenderer.getAllNodeBounds();
      for (const { id } of bounds) {
        if (id !== sourceId && id !== targetId) {
          const shape = nodeRenderer.getShape(id);
          if (shape) shape.opacity(0.15);
        }
      }

      gl.batchDraw();
    }

    // -------------------------------------------------------------------------
    // Mousemove — edge hover tooltip
    // -------------------------------------------------------------------------
    let lastHoveredArrowId: string | null = null;

    stage.on('mousemove', (e) => {
      const target = e.target;

      if (target instanceof Konva.Arrow) {
        const arrowId = target.id();

        // Avoid re-firing tooltip for the same edge
        if (arrowId === lastHoveredArrowId) return;
        lastHoveredArrowId = arrowId;

        const sourceId = target.getAttr('sourceId') as string | undefined;
        const targetId = target.getAttr('targetId') as string | undefined;
        const dependencyCount = (target.getAttr('dependencyCount') as number | undefined) ?? 1;

        const state = graphStore.getState();
        const sourceNode = sourceId ? state.nodes.get(sourceId) : undefined;
        const targetNode = targetId ? state.nodes.get(targetId) : undefined;

        const sourceName = sourceNode?.name ?? sourceId ?? '';
        const targetName = targetNode?.name ?? targetId ?? '';
        const targetExports = targetNode?.keyExports ?? [];

        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;

        onEdgeHoverRef.current?.({
          edgeId: arrowId,
          sourceId: sourceId ?? '',
          targetId: targetId ?? '',
          sourceName,
          targetName,
          dependencyCount,
          targetExports,
          x: pointerPos.x,
          y: pointerPos.y,
        });
      } else {
        // Moved off an arrow — dismiss tooltip
        if (lastHoveredArrowId !== null) {
          lastHoveredArrowId = null;
          onEdgeHoverRef.current?.(null);
        }
      }
    });

    // -------------------------------------------------------------------------
    // Click-to-select — selects node and highlights its direct dependencies
    // Also handles edge click-to-highlight
    // -------------------------------------------------------------------------
    stage.on('click tap', (e) => {
      const target = e.target;

      // Background click — deselect all and clear edge highlight
      if (target === stage) {
        clearEdgeHighlight();
        handleSelectNodeRef.current(null);
        gl.batchDraw();
        return;
      }

      // Check if clicked target is a Konva.Arrow (edge click)
      if (target instanceof Konva.Arrow) {
        const arrowId = target.id();
        if (arrowId === highlightedEdgeId) {
          // Clicking the already-highlighted edge dismisses the highlight
          clearEdgeHighlight();
        } else {
          highlightEdge(target);
        }
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

      // Clear edge highlight when clicking a node or blank area
      clearEdgeHighlight();

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
    // Escape key — dismiss edge highlight (document-level listener)
    // -------------------------------------------------------------------------
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && highlightedEdgeId) {
        clearEdgeHighlight();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    // -------------------------------------------------------------------------
    // Imperative handle for programmatic node selection from parent (App.tsx)
    // Allows sidebar interactions (risk click, dependency click) to highlight
    // the selected node and its dependency edges on the canvas.
    // -------------------------------------------------------------------------
    if (canvasRef) {
      canvasRef.current = {
        selectNodeOnCanvas: (nodeId: string) => {
          clearEdgeHighlight();
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
      replayUnsub();
      animQueue.destroy();
      stage.off('click tap');
      stage.off('wheel');
      stage.off('dragend');
      stage.off('mousemove');
      document.removeEventListener('keydown', handleKeyDown);
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
    <div style={{ position: 'relative', width, height }}>
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

      {/* Empty replay canvas message — shown when viewing a historical snapshot with 0 nodes */}
      {isReplay && replayNodeCount === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 14,
            fontFamily: 'monospace',
            textAlign: 'center',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          No architecture at this point in time
        </div>
      )}
    </div>
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

// ---------------------------------------------------------------------------
// loadSnapshotAndEnterReplay — Exported for Phase 17 timeline slider.
// Fetches a historical snapshot and calls replayStore.enterReplay().
// ---------------------------------------------------------------------------

/**
 * Fetch a historical snapshot from the server and enter replay mode.
 * Phase 17 timeline slider calls this when the user scrubs to a snapshot.
 * Can also be called programmatically for testing in Phase 16.
 */
export async function loadSnapshotAndEnterReplay(snapshotId: number): Promise<void> {
  const res = await fetch(`/api/snapshot/${snapshotId}`);
  if (!res.ok) throw new Error(`Snapshot ${snapshotId} not found (HTTP ${res.status})`);

  const data = await res.json() as {
    id: number;
    timestamp: number;
    graphJson: {
      nodes: Array<{
        id: string;
        name: string;
        nodeType: string;
        zone: string | null;
        fileList: string[];
        incomingEdgeCount: number;
        outgoingEdgeCount: number;
        lastModified: string | number;
        fileCount?: number;
        keyExports?: string[];
      }>;
      edges: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        edgeType: string;
        dependencyCount?: number;
      }>;
      positions: Record<string, { x: number; y: number }>;
    };
  };

  const nodes = data.graphJson.nodes;
  const edges = data.graphJson.edges;

  replayStore.getState().enterReplay(
    data.id,
    data.timestamp,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes as any,  // Wire format matches GraphNode shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    edges as any,  // Wire format matches GraphEdge shape
  );
}
