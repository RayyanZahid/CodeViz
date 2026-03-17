import { useState, useEffect, useMemo, useRef } from 'react';
import { useInferenceStore } from '../store/inferenceStore.js';
import type { ActivityItem } from '../store/inferenceStore.js';
import { useReplayStore } from '../store/replayStore.js';
import { useIntentStore } from '../store/intentStore.js';

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
// FeedItem sub-component — renders a single activity item
// ---------------------------------------------------------------------------

interface FeedItemProps {
  item: ActivityItem;
}

function FeedItem({ item }: FeedItemProps) {
  // Replay separator — rendered as highlighted amber divider row
  if (item.isReplaySeparator) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
          borderTop: '1px solid rgba(234, 179, 8, 0.3)',
          background: 'rgba(234, 179, 8, 0.08)',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#eab308',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          Events during replay
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Color-coded dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: item.iconColor,
          flexShrink: 0,
        }}
      />

      {/* Sentence text */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#ffffffcc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.sentence}
      </span>

      {/* Relative timestamp */}
      <span
        style={{
          fontSize: 11,
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
// EmptyState — shown when no events have arrived yet
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
      No architectural events yet
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReplayEmptyState — shown when no events in current epoch during replay
// ---------------------------------------------------------------------------

function ReplayEmptyState() {
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
      No events in this epoch
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityFeed — main panel component
//
// Reads from inferenceStore directly (no props needed).
// Supports collapse/expand via local useState with CSS max-height transition.
// During replay mode: filters events to the current epoch's time range.
// During auto-playback: new events animate in with feedSlideIn CSS animation.
// ---------------------------------------------------------------------------

export function ActivityFeed() {
  const [collapsed, setCollapsed] = useState(false);
  const activityFeed = useInferenceStore((s) => s.activityFeed);

  // Replay and timeline state
  const isReplay = useReplayStore(s => s.isReplay);
  const replayTimestamp = useReplayStore(s => s.replayTimestamp);
  const snapshots = useReplayStore(s => s.snapshots);
  const currentSnapshotIndex = useReplayStore(s => s.currentSnapshotIndex);
  const isPlaying = useReplayStore(s => s.isPlaying);
  const intentHistory = useIntentStore(s => s.intentHistory);

  // Live timestamp ticking — forces re-render every 10s so relativeTime()
  // recomputes for all visible items (FEED-04: timestamps update live)
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Inject feedSlideIn CSS keyframe animation into the document head
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes feedSlideIn {
        0% {
          opacity: 0;
          transform: translateY(-12px);
          max-height: 0;
        }
        100% {
          opacity: 1;
          transform: translateY(0);
          max-height: 60px;
        }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Compute the current epoch's time range when in replay mode
  const epochRange = useMemo(() => {
    if (!isReplay || currentSnapshotIndex < 0 || snapshots.length === 0) return null;

    const currentTs = snapshots[currentSnapshotIndex]?.timestamp ?? replayTimestamp ?? Date.now();

    // Find the epoch boundaries: the intent session that contains the current timestamp
    // Iterate intentHistory (sorted newest-first) to find the session whose startedAt <= currentTs <= endedAt
    let epochStart = 0;
    let epochEnd = Date.now();
    let epochLabel = 'Unknown';

    for (const session of intentHistory) {
      const sessionEnd = session.endedAt ?? Date.now();
      if (session.startedAt <= currentTs && sessionEnd >= currentTs) {
        epochStart = session.startedAt;
        epochEnd = sessionEnd;
        // Format category: split on '_', capitalize
        epochLabel = session.category
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        break;
      }
    }

    // Fallback: if no matching session, use the snapshot timestamps as range
    // Find surrounding snapshots with > 90s gaps to define epoch boundaries
    if (epochStart === 0) {
      epochStart = snapshots[0]?.timestamp ?? 0;
      epochEnd = snapshots[snapshots.length - 1]?.timestamp ?? Date.now();
      epochLabel = 'Session';
    }

    return { epochStart, epochEnd, epochLabel };
  }, [isReplay, currentSnapshotIndex, snapshots, replayTimestamp, intentHistory]);

  // Filter activity feed to current epoch when in replay mode
  const displayedFeed = useMemo(() => {
    if (!isReplay || !epochRange) return activityFeed;

    return activityFeed.filter(item => {
      if (item.isReplaySeparator) return false; // Hide replay separators during replay
      return item.timestamp >= epochRange.epochStart && item.timestamp <= epochRange.epochEnd;
    });
  }, [activityFeed, isReplay, epochRange]);

  // Track previous displayedFeed length to detect new items during playback
  const prevFeedCountRef = useRef(displayedFeed.length);
  const newItemCount = useRef(0);

  useEffect(() => {
    if (isPlaying && displayedFeed.length > prevFeedCountRef.current) {
      newItemCount.current = displayedFeed.length - prevFeedCountRef.current;
    } else if (!isPlaying) {
      newItemCount.current = 0;
    }
    prevFeedCountRef.current = displayedFeed.length;
  }, [displayedFeed.length, isPlaying]);

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

        {/* Title — shows epoch context during replay */}
        {isReplay && epochRange ? (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#ffffff99', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
            Activity ({epochRange.epochLabel} · {displayedFeed.length} events)
          </span>
        ) : (
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
            Activity
          </span>
        )}

        {/* Item count badge — always visible, more prominent when collapsed */}
        {!isReplay && activityFeed.length > 0 && (
          <div
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#ffffff',
              padding: '0 4px',
            }}
          >
            {activityFeed.length}
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
          {displayedFeed.length === 0 ? (
            isReplay ? <ReplayEmptyState /> : <EmptyState />
          ) : (
            displayedFeed.map((item, index) => {
              const isNewDuringPlayback = isPlaying && index >= displayedFeed.length - newItemCount.current;
              return (
                <div
                  key={item.id}
                  style={{
                    ...(isNewDuringPlayback ? {
                      animation: 'feedSlideIn 0.35s ease-out forwards',
                    } : {}),
                  }}
                >
                  <FeedItem item={item} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
