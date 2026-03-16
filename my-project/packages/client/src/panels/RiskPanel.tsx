import { useState } from 'react';
import { useInferenceStore } from '../store/inferenceStore.js';
import type { RiskItem } from '../store/inferenceStore.js';
import type { RiskSeverity, RiskType } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Severity color helper (kept for potential external use)
// ---------------------------------------------------------------------------

function severityColor(severity: RiskSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#f97316';
    default: return '#eab308';
  }
}

// ---------------------------------------------------------------------------
// Severity badge style helper
// ---------------------------------------------------------------------------

function severityBadgeStyle(severity: RiskSeverity): React.CSSProperties {
  return {
    backgroundColor: severityColor(severity),
    color: '#ffffff',
    padding: '1px 6px',
    borderRadius: 3,
    fontSize: 9,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    fontWeight: 600,
    flexShrink: 0,
    lineHeight: '14px',
  };
}

// ---------------------------------------------------------------------------
// Risk type label helper
// ---------------------------------------------------------------------------

function riskTypeLabel(type: RiskType): string {
  switch (type) {
    case 'circular_dependency': return 'Circular dependency';
    case 'boundary_violation': return 'Boundary violation';
    case 'excessive_fan_out': return 'High fan-out';
    default: return type;
  }
}

// ---------------------------------------------------------------------------
// RiskItemRow — renders a single risk item (unreviewed or reviewed)
// ---------------------------------------------------------------------------

interface RiskItemRowProps {
  risk: RiskItem;
  reviewed: boolean;
  onMarkReviewed?: (id: string) => void;
  onHighlightNode?: (nodeId: string) => void;
}

function RiskItemRow({ risk, reviewed, onMarkReviewed, onHighlightNode }: RiskItemRowProps) {
  const [hoverButton, setHoverButton] = useState(false);

  const handleRowClick = () => {
    if (!reviewed) {
      const targetId = risk.signal.nodeId || risk.signal.affectedNodeIds?.[0];
      if (targetId) onHighlightNode?.(targetId);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        opacity: reviewed ? 0.5 : 1,
        cursor: !reviewed && onHighlightNode ? 'pointer' : 'default',
      }}
    >
      {/* Severity badge — replaces severity color dot */}
      <span style={severityBadgeStyle(risk.signal.severity)}>
        {risk.signal.severity}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#ffffffcc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={risk.signal.details}
        >
          {risk.signal.details}
        </div>
        <div
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#ffffff66',
            marginTop: 1,
          }}
        >
          {riskTypeLabel(risk.signal.type)}
        </div>
      </div>

      {/* Checkmark button — only for unreviewed risks */}
      {!reviewed && onMarkReviewed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkReviewed(risk.id);
          }}
          onMouseEnter={() => setHoverButton(true)}
          onMouseLeave={() => setHoverButton(false)}
          style={{
            background: hoverButton ? 'rgba(255,255,255,0.1)' : 'none',
            border: 'none',
            padding: 0,
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: hoverButton ? '#22c55e' : '#ffffff44',
            cursor: 'pointer',
            flexShrink: 0,
            alignSelf: 'center',
          }}
          title="Mark as reviewed"
        >
          {'\u2713'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewedCounter — collapses reviewed risks into a single row
// ---------------------------------------------------------------------------

interface ReviewedCounterProps {
  reviewedRisks: RiskItem[];
}

function ReviewedCounter({ reviewedRisks }: ReviewedCounterProps) {
  const [showReviewed, setShowReviewed] = useState(false);

  return (
    <div>
      <div
        onClick={() => setShowReviewed((s) => !s)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#ffffff44',
            lineHeight: 1,
          }}
        >
          {showReviewed ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#ffffff44',
          }}
        >
          {reviewedRisks.length} reviewed
        </span>
      </div>

      {showReviewed && (
        <div>
          {reviewedRisks.map((risk) => (
            <RiskItemRow
              key={risk.id}
              risk={risk}
              reviewed
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — shown when no risks detected
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <span style={{ color: '#22c55e', fontSize: 14 }}>{'\u2713'}</span>
      <span>No risks detected — architecture looks clean</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllClearState — shown when all risks have been reviewed
// ---------------------------------------------------------------------------

function AllClearState() {
  return (
    <div
      style={{
        padding: '8px 8px 4px',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#22c55e',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span>{'\u2713'}</span>
      <span>All clear</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RiskPanel props
// ---------------------------------------------------------------------------

interface RiskPanelProps {
  onHighlightNode?: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// RiskPanel — main panel component
//
// Displays active risks with severity badges. Unreviewed risks are shown
// prominently; reviewed risks collapse into a counter row. Shows green
// positive states for empty and all-reviewed scenarios.
// ---------------------------------------------------------------------------

export function RiskPanel({ onHighlightNode }: RiskPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const risks = useInferenceStore((s) => s.risks);
  const markRiskReviewed = useInferenceStore((s) => s.markRiskReviewed);

  // Split risks into unreviewed and reviewed
  const allRisks = Array.from(risks.values());
  const unreviewedRisks = allRisks.filter((r) => !r.reviewed);
  const reviewedRisks = allRisks.filter((r) => r.reviewed);
  const unreviewedCount = unreviewedRisks.length;

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
          Risks
        </span>

        {/* Unreviewed count badge — only shown when count > 0 */}
        {unreviewedCount > 0 && (
          <div
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#ffffff',
              padding: '0 4px',
            }}
          >
            {unreviewedCount}
          </div>
        )}
      </div>

      {/* Collapsible content area */}
      <div
        style={{
          maxHeight: collapsed ? 0 : 300,
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        <div
          style={{
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {risks.size === 0 ? (
            <EmptyState />
          ) : (
            <>
              {unreviewedRisks.map((risk) => (
                <RiskItemRow
                  key={risk.id}
                  risk={risk}
                  reviewed={false}
                  onMarkReviewed={markRiskReviewed}
                  onHighlightNode={onHighlightNode}
                />
              ))}

              {/* All-clear message — shown when all risks have been reviewed */}
              {unreviewedRisks.length === 0 && reviewedRisks.length > 0 && (
                <AllClearState />
              )}

              {reviewedRisks.length > 0 && (
                <ReviewedCounter reviewedRisks={reviewedRisks} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
