import { useState, useEffect } from 'react';
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
// ActivityFeed — main panel component
//
// Reads from inferenceStore directly (no props needed).
// Supports collapse/expand via local useState with CSS max-height transition.
// ---------------------------------------------------------------------------

export function ActivityFeed() {
  const [collapsed, setCollapsed] = useState(false);
  const activityFeed = useInferenceStore((s) => s.activityFeed);

  // Live timestamp ticking — forces re-render every 10s so relativeTime()
  // recomputes for all visible items (FEED-04: timestamps update live)
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

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
          Activity
        </span>

        {/* Item count badge — always visible, more prominent when collapsed */}
        {activityFeed.length > 0 && (
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
          {activityFeed.length === 0 ? (
            <EmptyState />
          ) : (
            activityFeed.map((item) => <FeedItem key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}
