import { useState } from 'react';
import { useGraphStore } from '../store/graphStore.js';
import { useInferenceStore } from '../store/inferenceStore.js';
import type { ActivityItem } from '../store/inferenceStore.js';

// ---------------------------------------------------------------------------
// Relative timestamp helper
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return 'now';
  if (diffSec < 60) return `${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h`;
}

// ---------------------------------------------------------------------------
// SectionHeader — small section label
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#ffffff66',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: 12,
        marginBottom: 4,
        padding: '0 8px',
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentChangeItem — a single recent change row
// ---------------------------------------------------------------------------

function RecentChangeItem({ item }: { item: ActivityItem }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: item.iconColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#ffffffaa',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.sentence}
      </span>
      <span
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#ffffff55',
          flexShrink: 0,
        }}
      >
        {relativeTime(item.timestamp)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InspectorContent — rendered when a node is selected
// ---------------------------------------------------------------------------

interface InspectorContentProps {
  selectedNodeId: string;
  onHighlightNode?: (nodeId: string) => void;
}

function InspectorContent({ selectedNodeId, onHighlightNode }: InspectorContentProps) {
  const node = useGraphStore((s) => s.nodes.get(selectedNodeId));
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const activityFeed = useInferenceStore((s) => s.activityFeed);

  if (!node) {
    return (
      <div
        style={{
          padding: '12px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#ffffff44',
        }}
      >
        Node not found
      </div>
    );
  }

  // Compute outgoing edges (depends on) and incoming edges (depended by)
  const outgoingEdges = Array.from(edges.values()).filter(
    (e) => e.sourceId === selectedNodeId
  );
  const incomingEdges = Array.from(edges.values()).filter(
    (e) => e.targetId === selectedNodeId
  );

  // Filter recent changes for this node
  const recentChanges = activityFeed
    .filter(
      (item) =>
        item.event.nodeId === selectedNodeId ||
        item.event.targetNodeId === selectedNodeId
    )
    .slice(0, 5);

  // File list (max 10 shown)
  const fileList = node.fileList ?? [];
  const visibleFiles = fileList.slice(0, 10);
  const extraFileCount = fileList.length - visibleFiles.length;

  return (
    <div>
      {/* Section 1: Files */}
      <SectionHeader label="Files" />
      <div style={{ padding: '0 8px' }}>
        {visibleFiles.length === 0 ? (
          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#ffffff44',
            }}
          >
            No files
          </span>
        ) : (
          visibleFiles.map((filePath) => (
            <div
              key={filePath}
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#ffffffaa',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '1px 0',
              }}
              title={filePath}
            >
              {filePath}
            </div>
          ))
        )}
        {extraFileCount > 0 && (
          <div
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#ffffff55',
              padding: '2px 0',
            }}
          >
            +{extraFileCount} more
          </div>
        )}
      </div>

      {/* Section 2: Dependencies */}
      <SectionHeader label="Dependencies" />
      <div style={{ padding: '0 8px' }}>
        {/* Depends on (outgoing) */}
        <div
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#ffffff55',
            marginBottom: 2,
          }}
        >
          Depends on ({outgoingEdges.length})
        </div>
        {outgoingEdges.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#ffffff44',
              padding: '1px 0',
            }}
          >
            None
          </div>
        ) : (
          outgoingEdges.map((edge) => {
            const targetNode = nodes.get(edge.targetId);
            const displayName = targetNode?.name ?? edge.targetId;
            return (
              <div
                key={edge.id}
                onClick={() => onHighlightNode?.(edge.targetId)}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffffaa',
                  padding: '1px 0',
                  cursor: onHighlightNode ? 'pointer' : 'default',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={edge.targetId}
              >
                {displayName}
              </div>
            );
          })
        )}

        {/* Depended by (incoming) */}
        <div
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#ffffff55',
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          Depended by ({incomingEdges.length})
        </div>
        {incomingEdges.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#ffffff44',
              padding: '1px 0',
            }}
          >
            None
          </div>
        ) : (
          incomingEdges.map((edge) => {
            const sourceNode = nodes.get(edge.sourceId);
            const displayName = sourceNode?.name ?? edge.sourceId;
            return (
              <div
                key={edge.id}
                onClick={() => onHighlightNode?.(edge.sourceId)}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffffaa',
                  padding: '1px 0',
                  cursor: onHighlightNode ? 'pointer' : 'default',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={edge.sourceId}
              >
                {displayName}
              </div>
            );
          })
        )}
      </div>

      {/* Section 3: Recent Changes */}
      <SectionHeader label="Recent Changes" />
      {recentChanges.length === 0 ? (
        <div
          style={{
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#ffffff44',
          }}
        >
          No recent changes
        </div>
      ) : (
        recentChanges.map((item) => (
          <RecentChangeItem key={item.id} item={item} />
        ))
      )}
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
        padding: '16px 8px',
        fontSize: 12,
        fontFamily: 'monospace',
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
}

// ---------------------------------------------------------------------------
// NodeInspector — main panel component
//
// Displays three sections for the selected node: files, dependencies, and
// recent changes. Supports collapse/expand via local useState.
// ---------------------------------------------------------------------------

export function NodeInspector({ selectedNodeId, onHighlightNode }: NodeInspectorProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Look up node name for header badge
  const nodeName = useGraphStore((s) =>
    selectedNodeId ? (s.nodes.get(selectedNodeId)?.name ?? null) : null
  );

  return (
    <div
      style={{
        background: 'transparent',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Collapse triangle */}
        <span
          style={{
            fontSize: 10,
            color: '#ffffff66',
            lineHeight: 1,
          }}
        >
          {collapsed ? '▶' : '▼'}
        </span>

        {/* Title */}
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#ffffff99',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flex: 1,
          }}
        >
          Inspector
        </span>

        {/* Node name badge — shown when a node is selected */}
        {nodeName && (
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#ffffff88',
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: '1px 5px',
              borderRadius: 3,
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={nodeName}
          >
            {nodeName}
          </span>
        )}
      </div>

      {/* Collapsible content area */}
      <div
        style={{
          maxHeight: collapsed ? 0 : 400,
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {selectedNodeId ? (
            <InspectorContent
              selectedNodeId={selectedNodeId}
              onHighlightNode={onHighlightNode}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
