import { useMemo, useState } from 'react';
import { useIntentStore } from '../store/intentStore.js';
import { useInferenceStore } from '../store/inferenceStore.js';

// ---------------------------------------------------------------------------
// Category formatter — "feature_building" → "Feature Building"
// ---------------------------------------------------------------------------

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Timestamp formatter — "2:15 PM" style (same pattern as ReplayBanner.tsx)
// ---------------------------------------------------------------------------

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

// ---------------------------------------------------------------------------
// Confidence badge color helper
// ---------------------------------------------------------------------------

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#22c55e'; // green
  if (confidence >= 0.4) return '#eab308'; // amber
  return '#ef4444'; // red
}

// ---------------------------------------------------------------------------
// SubtaskItem — a single derived subtask row with checkmark
// ---------------------------------------------------------------------------

interface SubtaskItemProps {
  label: string;
  count: number;
}

function SubtaskItem({ label, count }: SubtaskItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
      }}
    >
      <span style={{ color: '#22c55e', fontSize: 11, flexShrink: 0 }}>{'\u2713'}</span>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#ffffffcc',
        }}
      >
        {label} ({count})
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntentPanel — fourth collapsible sidebar panel
//
// Shows the AI agent's inferred objective, confidence badge, derived subtask
// checklist, focus-shift notification, risk correlation badge, and collapsible
// intent history log.
// ---------------------------------------------------------------------------

export function IntentPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  // Intent state
  const activeSession = useIntentStore((s) => s.activeSession);
  const intentHistory = useIntentStore((s) => s.intentHistory);

  // Inference state for subtask derivation and risk correlation
  const activityFeed = useInferenceStore((s) => s.activityFeed);
  const risks = useInferenceStore((s) => s.risks);

  // ---------------------------------------------------------------------------
  // Derived: subtask groups from activityFeed iconColor categories
  // ---------------------------------------------------------------------------

  const subtasks = useMemo(() => {
    const colorLabelMap: Record<string, string> = {
      '#22c55e': 'File creation',
      '#f97316': 'Risk detection',
      '#3b82f6': 'Dependency changes',
      '#94a3b8': 'File modifications',
    };

    const counts: Record<string, number> = {};

    for (const item of activityFeed) {
      if (item.isReplaySeparator) continue;
      const label = colorLabelMap[item.iconColor];
      if (label) {
        counts[label] = (counts[label] ?? 0) + 1;
      }
    }

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => ({ label, count }));
  }, [activityFeed]);

  // ---------------------------------------------------------------------------
  // Derived: unreviewed risk count for risk correlation section
  // ---------------------------------------------------------------------------

  const unreviewedRiskCount = useMemo(() => {
    return [...risks.values()].filter((r) => !r.reviewed).length;
  }, [risks]);

  // ---------------------------------------------------------------------------
  // Derived: focus-shift detection
  // ---------------------------------------------------------------------------

  const focusShift = useMemo(() => {
    if (!activeSession || intentHistory.length === 0) return null;
    const prev = intentHistory[0];
    if (prev.category !== activeSession.category) {
      return {
        from: formatCategory(prev.category),
        to: formatCategory(activeSession.category),
      };
    }
    return null;
  }, [activeSession, intentHistory]);

  // ---------------------------------------------------------------------------
  // Derived: capped history (newest-first, max 10)
  // ---------------------------------------------------------------------------

  const visibleHistory = useMemo(() => intentHistory.slice(0, 10), [intentHistory]);

  return (
    <div
      style={{
        background: 'transparent',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header row — always visible, clickable to collapse/expand */}
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
          {collapsed ? '\u25B6' : '\u25BC'}
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
          Intent
        </span>

        {/* Confidence badge — only when activeSession is not null */}
        {activeSession !== null && (
          <div
            style={{
              backgroundColor: confidenceColor(activeSession.confidence),
              color: '#ffffff',
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'monospace',
              fontWeight: 600,
              flexShrink: 0,
              lineHeight: '14px',
            }}
          >
            {Math.round(activeSession.confidence * 100) + '%'}
          </div>
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
          {/* Section 1: Objective label */}
          <div style={{ padding: '4px 8px 6px' }}>
            {activeSession !== null ? (
              <>
                {/* Objective text */}
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#ffffffcc',
                    marginBottom: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={activeSession.objective}
                >
                  {activeSession.objective}
                </div>
                {/* Category tag */}
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: '#ffffff66',
                  }}
                >
                  {formatCategory(activeSession.category)}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: '#ffffff44',
                  padding: '8px 0',
                  textAlign: 'center',
                }}
              >
                No activity detected
              </div>
            )}
          </div>

          {/* Section 2: Subtask checklist — only when activityFeed has items */}
          {subtasks.length > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              {subtasks.map(({ label, count }) => (
                <SubtaskItem key={label} label={label} count={count} />
              ))}
            </div>
          )}

          {/* Section 3: Focus-shift notification */}
          {focusShift !== null && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                borderLeft: '2px solid #eab308',
                margin: '4px 8px',
                padding: '4px 6px',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#eab308',
                }}
              >
                Switched from {focusShift.from} to {focusShift.to}
              </span>
            </div>
          )}

          {/* Section 4: Risk correlation — only when unreviewed risks > 0 */}
          {unreviewedRiskCount > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                padding: '4px 8px',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ef4444',
                }}
              >
                {'\u26A0'} {unreviewedRiskCount} active risk{unreviewedRiskCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Section 5: Intent history log — collapsible sub-section */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {/* History sub-header */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setHistoryCollapsed((c) => !c);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
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
                {historyCollapsed ? '\u25B6' : '\u25BC'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#ffffff44',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                History
              </span>
            </div>

            {/* History entries */}
            {!historyCollapsed && (
              <div>
                {visibleHistory.length === 0 ? (
                  <div
                    style={{
                      padding: '6px 8px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: '#ffffff44',
                    }}
                  >
                    No history yet
                  </div>
                ) : (
                  visibleHistory.map((session) => (
                    <div
                      key={session.sessionId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '4px 8px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        gap: 1,
                      }}
                    >
                      {/* Category + timestamp row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: '#ffffff55',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {formatCategory(session.category)}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: '#ffffff33',
                          }}
                        >
                          {formatTime(session.startedAt)}
                        </span>
                      </div>
                      {/* Objective text */}
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: '#ffffff66',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={session.objective}
                      >
                        {session.objective}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
