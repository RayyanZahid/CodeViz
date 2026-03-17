import { useEffect } from 'react';
import { useReplayStore } from '../store/replayStore.js';

// ---------------------------------------------------------------------------
// ReplayBanner — full-width amber banner shown when replay mode is active
//
// Reads isReplay, replayTimestamp, and bufferedEventCount from replayStore.
// Returns null when not in replay mode (hidden during live view).
//
// The banner shows:
//   - "REPLAY MODE — {formatted timestamp}" label on the left
//   - "{N} live events pending" counter when buffered events exist
//   - "Return to Live" button with pulse glow animation on the right
//
// The onExitReplay prop comes from App.tsx because exit involves async
// snapshot fetch + buffer drain logic that cannot live in the banner itself.
// ---------------------------------------------------------------------------

interface ReplayBannerProps {
  onExitReplay: () => void;
}

export function ReplayBanner({ onExitReplay }: ReplayBannerProps) {
  const isReplay = useReplayStore((s) => s.isReplay);
  const replayTimestamp = useReplayStore((s) => s.replayTimestamp);
  const bufferedEventCount = useReplayStore((s) => s.bufferedEventCount);

  // Inject pulse keyframe animation for the Return to Live button.
  // Cleanup removes the style tag when the component unmounts.
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes replayButtonPulse {
        0%, 100% { box-shadow: 0 0 4px 0 rgba(234, 179, 8, 0.6); }
        50%       { box-shadow: 0 0 12px 4px rgba(234, 179, 8, 0.9); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Banner is invisible during live mode
  if (!isReplay) return null;

  const formattedTime = replayTimestamp
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(replayTimestamp))
    : '';

  return (
    <div
      style={{
        background: '#92400e',
        borderBottom: '1px solid #d97706',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        height: 44,
        flexShrink: 0,
        zIndex: 500,
      }}
    >
      {/* Left side — mode label + timestamp + buffered count */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#fef3c7',
            fontSize: 13,
          }}
        >
          REPLAY MODE{formattedTime ? ` \u2014 ${formattedTime}` : ''}
        </span>

        {bufferedEventCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#fde68a',
              fontWeight: 'normal',
              marginLeft: 16,
            }}
          >
            {bufferedEventCount} live event{bufferedEventCount !== 1 ? 's' : ''} pending
          </span>
        )}
      </div>

      {/* Right side — Return to Live button with pulse glow */}
      <button
        onClick={onExitReplay}
        style={{
          background: '#d97706',
          border: 'none',
          borderRadius: 4,
          padding: '5px 14px',
          color: '#ffffff',
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          cursor: 'pointer',
          animation: 'replayButtonPulse 2s ease-in-out infinite',
        }}
      >
        Return to Live
      </button>
    </div>
  );
}
