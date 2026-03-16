import { useState, useEffect } from 'react';
import { useGraphStore } from '../store/graphStore.js';

// ---------------------------------------------------------------------------
// Zone color mapping
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<string, string> = {
  frontend: '#3b82f6',
  api: '#8b5cf6',
  services: '#f59e0b',
  'data-stores': '#22c55e',
  infrastructure: '#6b7280',
  external: '#94a3b8',
  unknown: '#475569',
};

function getZoneColor(zone: string | null): string {
  if (!zone) return ZONE_COLORS.unknown;
  return ZONE_COLORS[zone] ?? ZONE_COLORS.unknown;
}

// ---------------------------------------------------------------------------
// CollapsibleSection — section with triangle toggle
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ label, count, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const headerLabel = count !== undefined ? `${label} (${count})` : label;

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Section header — clickable */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '7px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: '#ffffff66',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {open ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#ffffff66',
            fontWeight: 500,
          }}
        >
          {headerLabel}
        </span>
      </div>

      {/* Collapsible content */}
      {open && (
        <div style={{ paddingBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShowMoreToggle — expand/collapse for lists
// ---------------------------------------------------------------------------

interface ShowMoreToggleProps {
  extraCount: number;
  expanded: boolean;
  onToggle: () => void;
}

function ShowMoreToggle({ extraCount, expanded, onToggle }: ShowMoreToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'block',
        marginTop: 4,
        marginLeft: 10,
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: 11,
        color: '#ffffff55',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(255,255,255,0.2)',
      }}
    >
      {expanded ? 'Show less' : `Show ${extraCount} more`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CountBadge — small pill for dependency count
// ---------------------------------------------------------------------------

function CountBadge({ count }: { count: number }) {
  const label = count === 1 ? '1 import' : `${count} imports`;
  return (
    <span
      style={{
        fontSize: 10,
        color: '#ffffff55',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 4,
        padding: '1px 5px',
        marginLeft: 4,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      ({label})
    </span>
  );
}

// ---------------------------------------------------------------------------
// DependencyRow — clickable row with hover highlight for dependency lists
// ---------------------------------------------------------------------------

interface DepEntry {
  nodeId: string;
  name: string;
  count: number;
}

interface DependencyRowProps {
  dep: DepEntry;
  onHighlightNode?: (nodeId: string) => void;
}

function DependencyRow({ dep, onHighlightNode }: DependencyRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onHighlightNode?.(dep.nodeId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 10px',
        cursor: onHighlightNode ? 'pointer' : 'default',
        background: hovered && onHighlightNode ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderRadius: 3,
        transition: 'background 0.1s ease',
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: onHighlightNode ? '#ffffffcc' : '#ffffffaa',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={dep.nodeId}
      >
        {dep.name}
      </span>
      <CountBadge count={dep.count} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// InspectorContent — rendered when a node is selected
// ---------------------------------------------------------------------------

interface InspectorContentProps {
  selectedNodeId: string;
  onHighlightNode?: (nodeId: string) => void;
  onClose?: () => void;
}

function InspectorContent({ selectedNodeId, onHighlightNode, onClose }: InspectorContentProps) {
  const node = useGraphStore((s) => s.nodes.get(selectedNodeId));
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);

  // Track whether file list and exports list are expanded
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [exportsExpanded, setExportsExpanded] = useState(false);

  // Reset expand states when the selected node changes
  useEffect(() => {
    setFilesExpanded(false);
    setExportsExpanded(false);
  }, [selectedNodeId]);

  if (!node) {
    return (
      <div
        style={{
          padding: '12px 10px',
          fontSize: 11,
          color: '#ffffff44',
        }}
      >
        Node not found
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Files data
  // -------------------------------------------------------------------------
  const fileList = node.fileList ?? [];
  const fileCount = node.fileCount ?? fileList.length;
  const FILE_INITIAL = 5;
  const visibleFiles = filesExpanded ? fileList : fileList.slice(0, FILE_INITIAL);
  const extraFileCount = fileList.length - FILE_INITIAL;

  // -------------------------------------------------------------------------
  // Key Exports data
  // -------------------------------------------------------------------------
  const keyExports = node.keyExports ?? [];
  const EXPORT_INITIAL = 10;
  const visibleExports = exportsExpanded ? keyExports : keyExports.slice(0, EXPORT_INITIAL);
  const extraExportCount = keyExports.length - EXPORT_INITIAL;

  // -------------------------------------------------------------------------
  // Dependencies Out — aggregate by targetId (skip self-referencing edges)
  // -------------------------------------------------------------------------
  const outgoingRaw = Array.from(edges.values()).filter(
    (e) => e.sourceId === selectedNodeId && e.targetId !== selectedNodeId
  );

  const outgoingMap = new Map<string, DepEntry>();
  for (const edge of outgoingRaw) {
    const existingOut = outgoingMap.get(edge.targetId);
    const addCount = edge.dependencyCount ?? 1;
    if (existingOut) {
      existingOut.count += addCount;
    } else {
      const targetNode = nodes.get(edge.targetId);
      outgoingMap.set(edge.targetId, {
        nodeId: edge.targetId,
        name: targetNode?.name ?? edge.targetId,
        count: addCount,
      });
    }
  }
  const outgoingDeps = Array.from(outgoingMap.values()).sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // Dependencies In — aggregate by sourceId (skip self-referencing edges)
  // -------------------------------------------------------------------------
  const incomingRaw = Array.from(edges.values()).filter(
    (e) => e.targetId === selectedNodeId && e.sourceId !== selectedNodeId
  );

  const incomingMap = new Map<string, DepEntry>();
  for (const edge of incomingRaw) {
    const existing = incomingMap.get(edge.sourceId);
    const addCount = edge.dependencyCount ?? 1;
    if (existing) {
      existing.count += addCount;
    } else {
      const sourceNode = nodes.get(edge.sourceId);
      incomingMap.set(edge.sourceId, {
        nodeId: edge.sourceId,
        name: sourceNode?.name ?? edge.sourceId,
        count: addCount,
      });
    }
  }
  const incomingDeps = Array.from(incomingMap.values()).sort((a, b) => b.count - a.count);

  const zoneColor = getZoneColor(node.zone);

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Header: component name + zone badge + X button                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          position: 'relative',
          padding: '12px 36px 12px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Component name */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#ffffffdd',
            lineHeight: 1.3,
            flex: '1 1 0',
            minWidth: 0,
            wordBreak: 'break-word',
          }}
        >
          {node.name}
        </span>

        {/* Zone badge */}
        {node.zone && (
          <span
            style={{
              fontSize: 10,
              color: '#ffffff',
              backgroundColor: zoneColor,
              borderRadius: 4,
              padding: '2px 7px',
              flexShrink: 0,
              opacity: 0.9,
              alignSelf: 'flex-start',
              marginTop: 2,
            }}
          >
            {node.zone}
          </span>
        )}

        {/* X close button */}
        {onClose && (
          <button
            onClick={onClose}
            title="Close inspector"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff66',
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              transition: 'color 0.15s ease, background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffffcc';
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#ffffff66';
              e.currentTarget.style.background = 'none';
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Files                                                   */}
      {/* ------------------------------------------------------------------ */}
      <CollapsibleSection label="Files" count={fileCount}>
        {fileList.length === 0 ? (
          <div style={{ padding: '0 10px', fontSize: 11, color: '#ffffff44' }}>
            No files
          </div>
        ) : (
          <>
            {visibleFiles.map((filePath) => (
              <div
                key={filePath}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffffaa',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '2px 10px',
                  lineHeight: 1.4,
                }}
                title={filePath}
              >
                {filePath}
              </div>
            ))}
            {extraFileCount > 0 && (
              <ShowMoreToggle
                extraCount={extraFileCount}
                expanded={filesExpanded}
                onToggle={() => setFilesExpanded((v) => !v)}
              />
            )}
          </>
        )}
      </CollapsibleSection>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Key Exports                                             */}
      {/* ------------------------------------------------------------------ */}
      <CollapsibleSection label="Key Exports" count={keyExports.length}>
        {keyExports.length === 0 ? (
          <div style={{ padding: '0 10px', fontSize: 11, color: '#ffffff44' }}>
            No exports detected
          </div>
        ) : (
          <>
            {visibleExports.map((symbol) => (
              <div
                key={symbol}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffffaa',
                  padding: '2px 10px',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={symbol}
              >
                {symbol}
              </div>
            ))}
            {extraExportCount > 0 && (
              <ShowMoreToggle
                extraCount={extraExportCount}
                expanded={exportsExpanded}
                onToggle={() => setExportsExpanded((v) => !v)}
              />
            )}
          </>
        )}
      </CollapsibleSection>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Dependencies Out                                        */}
      {/* ------------------------------------------------------------------ */}
      <CollapsibleSection label="Dependencies Out" count={outgoingDeps.length}>
        {outgoingDeps.length === 0 ? (
          <div style={{ padding: '0 10px', fontSize: 11, color: '#ffffff44' }}>
            None
          </div>
        ) : (
          outgoingDeps.map((dep) => (
            <DependencyRow
              key={dep.nodeId}
              dep={dep}
              onHighlightNode={onHighlightNode}
            />
          ))
        )}
      </CollapsibleSection>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Dependencies In                                         */}
      {/* ------------------------------------------------------------------ */}
      <CollapsibleSection label="Dependencies In" count={incomingDeps.length}>
        {incomingDeps.length === 0 ? (
          <div style={{ padding: '0 10px', fontSize: 11, color: '#ffffff44' }}>
            None
          </div>
        ) : (
          incomingDeps.map((dep) => (
            <DependencyRow
              key={dep.nodeId}
              dep={dep}
              onHighlightNode={onHighlightNode}
            />
          ))
        )}
      </CollapsibleSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — shown when no node is selected
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      style={{
        padding: '20px 12px',
        fontSize: 12,
        color: '#ffffff44',
        textAlign: 'center',
      }}
    >
      Click a node to inspect
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeInspector props
// ---------------------------------------------------------------------------

interface NodeInspectorProps {
  selectedNodeId: string | null;
  onHighlightNode?: (nodeId: string) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// NodeInspector — main panel component
//
// When a node is selected, renders InspectorContent with 4 collapsible
// sections (Files, Key Exports, Dependencies Out, Dependencies In), a zone
// badge, and an X close button. Supports ESC dismissal via onClose prop.
// ---------------------------------------------------------------------------

export function NodeInspector({ selectedNodeId, onHighlightNode, onClose }: NodeInspectorProps) {
  return (
    <div
      style={{
        background: '#12121a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: selectedNodeId ? 0 : 0,
      }}
    >
      {selectedNodeId ? (
        <InspectorContent
          selectedNodeId={selectedNodeId}
          onHighlightNode={onHighlightNode}
          onClose={onClose}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
