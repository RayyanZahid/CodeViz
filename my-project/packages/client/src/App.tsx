import { useEffect, useRef, useState, useCallback } from 'react';
import { ArchCanvas } from './canvas/ArchCanvas.js';
import { MinimapStage } from './minimap/MinimapStage.js';
import { NodeInspector } from './panels/NodeInspector.js';
import { RiskPanel } from './panels/RiskPanel.js';
import { ActivityFeed } from './panels/ActivityFeed.js';
import { inferenceStore } from './store/inferenceStore.js';
import { useGraphStore } from './store/graphStore.js';
import type { ConnectionStatus } from './store/graphStore.js';
import type { ViewportController } from './canvas/ViewportController.js';

// ---------------------------------------------------------------------------
// App — root React component
//
// Two-column flex layout:
//   - Left: canvas area (flex: 1) with navigation controls overlay and minimap
//   - Right: sidebar (280px) with three collapsible panels:
//       Inspector (top), Risk (middle), Activity Feed (bottom)
//
// Cross-panel navigation:
//   - Clicking a canvas node sets selectedNodeId → populates Inspector
//   - Clicking a risk row or dependency link calls handleHighlightNode
//     → selectNodeOnCanvas (highlights node + dependency edges) + panToNode
//
// Per CONTEXT.md:
//   "Zoom via scroll wheel + explicit +/- buttons in corner for keyboard users"
//   "Fit-to-view button + auto-fit on initial load"
//   "Toggleable minimap — small minimap showing full graph with viewport indicator"
// ---------------------------------------------------------------------------

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth - 280,
    height: window.innerHeight,
  });
  const [viewportRect, setViewportRect] = useState({
    x: 0,
    y: 0,
    width: window.innerWidth - 280,
    height: window.innerHeight,
  });
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Pipeline health — read connection status from graphStore (updated by WsClient)
  const connectionStatus = useGraphStore((s) => s.connectionStatus);

  // Ref to ViewportController — populated by ArchCanvas on init
  const viewportControllerRef = useRef<ViewportController | null>(null);

  // Ref populated with latest node world positions for cross-panel navigation
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Ref populated with imperative canvas handle for programmatic node selection
  const canvasRef = useRef<{ selectNodeOnCanvas: (nodeId: string) => void } | null>(null);

  // -------------------------------------------------------------------------
  // ResizeObserver — track canvas container dimensions (excludes sidebar)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);

    // Set initial dimensions from container (canvas area, not full viewport)
    setDimensions({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Active node pruning — clean up 30-second glow decay (UI-04)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      inferenceStore.getState().pruneExpiredActive();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------------------------
  // Navigation handlers — delegate to ViewportController
  // -------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    viewportControllerRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    viewportControllerRef.current?.zoomOut();
  }, []);

  const handleFitToView = useCallback(() => {
    viewportControllerRef.current?.fitToView();
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setMinimapVisible((v) => !v);
  }, []);

  // -------------------------------------------------------------------------
  // Cross-panel navigation callback
  //
  // Called by RiskPanel (clicking a risk row) and NodeInspector (clicking a
  // dependency). Highlights the node and its dependency edges on the canvas,
  // and pans the viewport to center on the node.
  //
  // selectNodeOnCanvas already calls handleSelectNodeRef.current(nodeId)
  // internally, which calls onSelectNode prop and thus setSelectedNodeId —
  // so no separate setSelectedNodeId call is needed here.
  // -------------------------------------------------------------------------
  const handleHighlightNode = useCallback((nodeId: string) => {
    // 1. Highlight the node AND its dependency edges on the canvas
    canvasRef.current?.selectNodeOnCanvas(nodeId);

    // 2. Pan canvas to the node's world position
    const pos = nodePositionsRef.current.get(nodeId);
    if (pos && viewportControllerRef.current) {
      viewportControllerRef.current.panToNode(pos.x, pos.y);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0a0a0f',
      }}
    >
      {/* Canvas area — flex-grow fills remaining width after sidebar */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <ArchCanvas
          width={dimensions.width}
          height={dimensions.height}
          onViewportChange={setViewportRect}
          onSelectNode={setSelectedNodeId}
          viewportControllerRef={viewportControllerRef}
          nodePositionsRef={nodePositionsRef}
          canvasRef={canvasRef}
        />

        {/* Navigation controls overlay — position:absolute within canvas wrapper (not fixed) */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 200,
          }}
        >
          <NavButton onClick={handleZoomIn} title="Zoom in">+</NavButton>
          <NavButton onClick={handleZoomOut} title="Zoom out">−</NavButton>
          <NavButton onClick={handleFitToView} title="Fit to view">
            <FitIcon />
          </NavButton>
          <NavButton
            onClick={handleToggleMinimap}
            title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
            active={minimapVisible}
          >
            <MapIcon />
          </NavButton>
        </div>

        {/* Selected node indicator — position:absolute within canvas wrapper (not fixed) */}
        {selectedNodeId && (
          <div
            style={{
              position: 'absolute',
              bottom: minimapVisible ? 165 : 16,
              left: 16,
              background: 'rgba(10, 10, 15, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#ffffffcc',
              fontSize: 12,
              fontFamily: 'monospace',
              zIndex: 200,
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedNodeId}
          </div>
        )}

        {/* Pipeline health status dot — bottom-left corner of canvas area */}
        <PipelineStatusDot
          status={connectionStatus}
          minimapVisible={minimapVisible}
          selectedNodeId={selectedNodeId}
        />

        {/* Minimap — bottom-right corner of canvas area */}
        <MinimapStage viewportRect={viewportRect} visible={minimapVisible} />
      </div>

      {/* Right sidebar — fixed 280px width, three collapsible panels */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0d14',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Panel order (top to bottom): Inspector, Risk, Feed */}
        <NodeInspector
          selectedNodeId={selectedNodeId}
          onHighlightNode={handleHighlightNode}
        />
        <RiskPanel
          onHighlightNode={handleHighlightNode}
        />
        <ActivityFeed />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavButton — small dark rounded button for navigation controls
// ---------------------------------------------------------------------------

interface NavButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function NavButton({ onClick, title, active, children }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'rgba(255, 255, 255, 0.15)' : 'rgba(10, 10, 15, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 6,
        color: '#ffffffcc',
        fontSize: 18,
        cursor: 'pointer',
        padding: 0,
        lineHeight: 1,
        fontFamily: 'monospace',
        transition: 'background 0.15s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = active
          ? 'rgba(255, 255, 255, 0.15)'
          : 'rgba(10, 10, 15, 0.85)';
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PipelineStatusDot — pipeline health indicator
// ---------------------------------------------------------------------------

function statusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':    return '#22c55e'; // green
    case 'connecting':   return '#eab308'; // yellow
    case 'syncing':      return '#eab308'; // yellow
    case 'disconnected': return '#ef4444'; // red
  }
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':    return 'Connected';
    case 'connecting':   return 'Connecting...';
    case 'syncing':      return 'Syncing...';
    case 'disconnected': return 'Disconnected';
  }
}

interface PipelineStatusDotProps {
  status: ConnectionStatus;
  minimapVisible: boolean;
  selectedNodeId: string | null;
}

function PipelineStatusDot({ status, minimapVisible, selectedNodeId }: PipelineStatusDotProps) {
  // Minimap height ~148px + 16px margin; selected node indicator ~32px + 8px gap
  const minimapOffset = minimapVisible ? 164 : 0;
  const selectedNodeOffset = selectedNodeId ? 40 : 0;
  const bottomOffset = 16 + minimapOffset + selectedNodeOffset;

  const color = statusColor(status);
  const label = statusLabel(status);
  const showLabel = status !== 'connected';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 200,
        transition: 'bottom 0.15s ease',
      }}
      title={label}
    >
      {/* Status dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
          transition: 'background-color 0.3s ease',
          boxShadow: `0 0 4px ${color}88`,
        }}
      />
      {/* Label — only shown when not connected to keep UI clean when healthy */}
      {showLabel && (
        <span
          style={{
            fontSize: 10,
            color: color,
            fontFamily: 'monospace',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function FitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="9" y="4" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="4" y="9" width="8" height="3" rx="0.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
