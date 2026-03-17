// ---------------------------------------------------------------------------
// TimelineBar — Full-width 60px timeline strip for replay scrubbing
//
// Layout (horizontal flex, 60px height):
//   [ PlaybackControls (~120px) ] [ Timeline Track (flex: 1, relative) ]
//
// On mount: fetches GET /api/timeline and GET /api/intents in parallel.
//   - Sets replayStore.snapshots via setSnapshots
//   - Seeds intentStore.intentHistory via loadHistory
//
// Features:
//   - Draggable thumb: pointer capture, no fetch during drag, loadSnapshotAndEnterReplay on release
//   - Click-to-scrub: nearest snapshot index, calls loadSnapshotAndEnterReplay
//   - Shift-click: sets replayStore.diffBase (amber diamond marker)
//   - Heatmap background: per-bucket opacity based on snapshot density
//   - Epoch tick marks: colored vertical lines at focus_shift / gap boundaries
//   - Timestamp axis labels: formatted "2:15 PM" at regular intervals
//   - Live-edge green pulsing dot at rightmost position
//   - PlaybackControls: play/pause, step forward, step backward, speed selector
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useReplayStore, replayStore } from '../store/replayStore.js';
import { useIntentStore, intentStore } from '../store/intentStore.js';
import { loadSnapshotAndEnterReplay } from '../canvas/ArchCanvas.js';
import { detectEpochs } from './epochDetection.js';
import { PlaybackController } from './PlaybackController.js';
import { cancelAllTweens } from '../canvas/replayTransitions.js';
import type { IntentSession, SnapshotMeta } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelineBarProps {
  onExitReplay: () => void;
}

// ---------------------------------------------------------------------------
// CSS keyframe injection — pulse animation for live-edge dot
// Cleanup removes <style> tag on unmount (same pattern as ReplayBanner.tsx)
// ---------------------------------------------------------------------------

function useTimelinePulseAnimation(): void {
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes timelineLiveEdgePulse {
        0%, 100% { opacity: 1.0; }
        50%       { opacity: 0.4; }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// TimelineBar — main export
// ---------------------------------------------------------------------------

export function TimelineBar({ onExitReplay }: TimelineBarProps) {
  useTimelinePulseAnimation();

  // Track ref stores intent sessions for epoch detection (avoids stale closure)
  const intentSessionsRef = useRef<IntentSession[]>([]);

  // PlaybackController ref — manages auto-play interval timer
  const playbackRef = useRef(new PlaybackController());

  // Local drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragVisualFraction, setDragVisualFraction] = useState(0);
  const [dragTooltipLabel, setDragTooltipLabel] = useState('');

  // Track area ref for width measurement
  const trackRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Store selectors
  // -------------------------------------------------------------------------
  const snapshots = useReplayStore((s) => s.snapshots);
  const currentSnapshotIndex = useReplayStore((s) => s.currentSnapshotIndex);
  const isReplay = useReplayStore((s) => s.isReplay);
  const isPlaying = useReplayStore((s) => s.isPlaying);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const diffBaseSnapshotId = useReplayStore((s) => s.diffBaseSnapshotId);
  const intentHistory = useIntentStore((s) => s.intentHistory);

  // -------------------------------------------------------------------------
  // PlaybackController cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => () => playbackRef.current.stop(), []);

  // -------------------------------------------------------------------------
  // onTick — advance one snapshot per interval; returns false at live edge
  // -------------------------------------------------------------------------
  const handlePlaybackTick = useCallback(async (): Promise<boolean> => {
    const { snapshots, currentSnapshotIndex } = replayStore.getState();
    const nextIndex = currentSnapshotIndex + 1;

    if (nextIndex >= snapshots.length) {
      // Reached live edge — exit replay and stop playback
      replayStore.getState().setIsPlaying(false);
      onExitReplay();
      return false;
    }

    // At high speeds (2x+), cancel in-flight Konva tweens to prevent animation pile-up
    const { playbackSpeed } = replayStore.getState();
    if (playbackSpeed >= 2) {
      cancelAllTweens();
    }

    replayStore.getState().setCurrentSnapshotIndex(nextIndex);
    await loadSnapshotAndEnterReplay(snapshots[nextIndex].id);
    return true;
  }, [onExitReplay]);

  // -------------------------------------------------------------------------
  // Play/pause effect — start or stop the PlaybackController when isPlaying or
  // playbackSpeed changes. Speed changes restart the timer with a new interval.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isPlaying) {
      playbackRef.current.start(playbackSpeed, handlePlaybackTick);
    } else {
      playbackRef.current.stop();
    }
    return () => playbackRef.current.stop();
  }, [isPlaying, playbackSpeed, handlePlaybackTick]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts — Space=play/pause, Left/Right=step, +/-=speed
  // -------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Guard: only handle if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const { snapshots } = replayStore.getState();

      switch (e.key) {
        case ' ': { // Space = play/pause
          e.preventDefault();
          if (snapshots.length === 0) break;
          const { isPlaying: playing } = replayStore.getState();
          if (playing) {
            replayStore.getState().setIsPlaying(false);
          } else {
            // If not in replay, enter at first snapshot then start playing
            if (!replayStore.getState().isReplay) {
              if (snapshots.length > 0) {
                replayStore.getState().setCurrentSnapshotIndex(0);
                void loadSnapshotAndEnterReplay(snapshots[0].id).then(() => {
                  replayStore.getState().setIsPlaying(true);
                });
              }
            } else {
              replayStore.getState().setIsPlaying(true);
            }
          }
          break;
        }
        case 'ArrowRight': { // Step forward
          e.preventDefault();
          if (snapshots.length === 0) break;
          const { currentSnapshotIndex: idx, isReplay: inReplay } = replayStore.getState();
          if (!inReplay) {
            replayStore.getState().setCurrentSnapshotIndex(0);
            void loadSnapshotAndEnterReplay(snapshots[0].id);
          } else if (idx < snapshots.length - 1) {
            const next = idx + 1;
            replayStore.getState().setCurrentSnapshotIndex(next);
            void loadSnapshotAndEnterReplay(snapshots[next].id);
          }
          break;
        }
        case 'ArrowLeft': { // Step backward
          e.preventDefault();
          if (snapshots.length === 0) break;
          const { currentSnapshotIndex: idx2, isReplay: inReplay2 } = replayStore.getState();
          if (inReplay2 && idx2 > 0) {
            const prev = idx2 - 1;
            replayStore.getState().setCurrentSnapshotIndex(prev);
            void loadSnapshotAndEnterReplay(snapshots[prev].id);
          }
          break;
        }
        case '+':
        case '=': { // Increase speed
          e.preventDefault();
          const speeds: Array<0.5 | 1 | 2 | 4> = [0.5, 1, 2, 4];
          const currentSpeed = replayStore.getState().playbackSpeed;
          const idx3 = speeds.indexOf(currentSpeed);
          const nextSpeed = speeds[Math.min(idx3 + 1, speeds.length - 1)];
          replayStore.getState().setPlaybackSpeed(nextSpeed);
          break;
        }
        case '-': { // Decrease speed
          e.preventDefault();
          const speeds: Array<0.5 | 1 | 2 | 4> = [0.5, 1, 2, 4];
          const currentSpeed = replayStore.getState().playbackSpeed;
          const idx4 = speeds.indexOf(currentSpeed);
          const prevSpeed = speeds[Math.max(idx4 - 1, 0)];
          replayStore.getState().setPlaybackSpeed(prevSpeed);
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onExitReplay]);

  // -------------------------------------------------------------------------
  // On mount: fetch timeline and intents data in parallel
  // -------------------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      try {
        const [timelineRes, intentsRes] = await Promise.all([
          fetch('/api/timeline'),
          fetch('/api/intents'),
        ]);

        if (timelineRes.ok) {
          const metas = (await timelineRes.json()) as SnapshotMeta[];
          replayStore.getState().setSnapshots(metas);
        }

        if (intentsRes.ok) {
          const sessions = (await intentsRes.json()) as IntentSession[];
          intentSessionsRef.current = sessions;
          intentStore.getState().loadHistory(sessions);
        }
      } catch (err) {
        console.warn('[TimelineBar] Failed to fetch timeline/intents on mount:', err);
      }
    })();
  }, []);

  // Keep intentSessionsRef current when intentHistory changes
  useEffect(() => {
    intentSessionsRef.current = intentHistory;
  }, [intentHistory]);

  // -------------------------------------------------------------------------
  // Epoch detection — memoized on snapshots + intentHistory
  // -------------------------------------------------------------------------
  const epochs = useMemo(
    () => detectEpochs(snapshots, intentHistory),
    [snapshots, intentHistory],
  );

  // -------------------------------------------------------------------------
  // Timestamp formatter — "2:15 PM" format
  // -------------------------------------------------------------------------
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  );

  // -------------------------------------------------------------------------
  // Heatmap buckets — group snapshots into ~100 buckets, compute density
  // -------------------------------------------------------------------------
  const heatmapBuckets = useMemo(() => {
    if (snapshots.length === 0) return [];

    const BUCKET_COUNT = Math.min(100, snapshots.length);
    const buckets: number[] = new Array(BUCKET_COUNT).fill(0);
    const bucketSize = snapshots.length / BUCKET_COUNT;

    for (let i = 0; i < snapshots.length; i++) {
      const bucketIdx = Math.min(Math.floor(i / bucketSize), BUCKET_COUNT - 1);
      buckets[bucketIdx]++;
    }

    const maxCount = Math.max(...buckets, 1);
    // Map counts to opacity range [0.1, 0.6]
    return buckets.map((count) => 0.1 + (count / maxCount) * 0.5);
  }, [snapshots]);

  // -------------------------------------------------------------------------
  // Pointer capture drag handlers
  // -------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (snapshots.length === 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragVisualFraction(fraction);

      // Compute tooltip label
      const idx = Math.round(fraction * (snapshots.length - 1));
      const snap = snapshots[Math.min(idx, snapshots.length - 1)];
      if (snap) {
        const msAgo = Date.now() - snap.timestamp;
        setDragTooltipLabel(formatRelativeTime(msAgo));
      }
    },
    [snapshots],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || snapshots.length === 0) return;

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragVisualFraction(fraction);

      // Tooltip updates during drag (no fetch)
      const idx = Math.round(fraction * (snapshots.length - 1));
      const snap = snapshots[Math.min(idx, snapshots.length - 1)];
      if (snap) {
        const msAgo = Date.now() - snap.timestamp;
        setDragTooltipLabel(formatRelativeTime(msAgo));
      }
    },
    [isDragging, snapshots],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || snapshots.length === 0) {
        setIsDragging(false);
        return;
      }

      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.round(fraction * (snapshots.length - 1));
      const clampedIdx = Math.min(idx, snapshots.length - 1);

      replayStore.getState().setCurrentSnapshotIndex(clampedIdx);
      void loadSnapshotAndEnterReplay(snapshots[clampedIdx].id).catch((err) => {
        console.warn('[TimelineBar] Failed to load snapshot on drag release:', err);
      });
    },
    [isDragging, snapshots],
  );

  // -------------------------------------------------------------------------
  // Track click handler (not during drag)
  // -------------------------------------------------------------------------
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging || snapshots.length === 0) return;

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.round(fraction * (snapshots.length - 1));
      const clampedIdx = Math.min(idx, snapshots.length - 1);

      // Shift-click: set diff base instead of navigating
      if (e.shiftKey && isReplay) {
        replayStore.getState().setDiffBase(snapshots[clampedIdx].id);
        return;
      }

      replayStore.getState().setCurrentSnapshotIndex(clampedIdx);
      void loadSnapshotAndEnterReplay(snapshots[clampedIdx].id).catch((err) => {
        console.warn('[TimelineBar] Failed to load snapshot on click:', err);
      });
    },
    [isDragging, snapshots, isReplay],
  );

  // -------------------------------------------------------------------------
  // Compute thumb position fraction
  // -------------------------------------------------------------------------
  const thumbFraction =
    isDragging
      ? dragVisualFraction
      : snapshots.length > 1 && currentSnapshotIndex >= 0
        ? currentSnapshotIndex / (snapshots.length - 1)
        : snapshots.length === 1
          ? 0
          : null;

  // -------------------------------------------------------------------------
  // Diff base position
  // -------------------------------------------------------------------------
  const diffBaseFraction = useMemo(() => {
    if (diffBaseSnapshotId === null || snapshots.length <= 1) return null;
    const idx = snapshots.findIndex((s) => s.id === diffBaseSnapshotId);
    if (idx === -1) return null;
    return idx / (snapshots.length - 1);
  }, [diffBaseSnapshotId, snapshots]);

  // -------------------------------------------------------------------------
  // Timestamp axis label positions (every ~25% of width)
  // -------------------------------------------------------------------------
  const timestampLabels = useMemo(() => {
    if (snapshots.length === 0) return [];
    const positions = [0, 0.25, 0.5, 0.75, 1.0];
    return positions.map((fraction) => {
      const idx = Math.round(fraction * (snapshots.length - 1));
      const snap = snapshots[Math.min(idx, snapshots.length - 1)];
      return {
        fraction,
        label: snap ? timeFormatter.format(new Date(snap.timestamp)) : '',
      };
    });
  }, [snapshots, timeFormatter]);

  // -------------------------------------------------------------------------
  // Is the view at the live edge (not in replay or at last snapshot)?
  // Used to hide the live-edge dot when already at the end.
  // -------------------------------------------------------------------------
  const isAtLiveEdge =
    !isReplay || (currentSnapshotIndex >= snapshots.length - 1 && snapshots.length > 0);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        height: 60,
        display: 'flex',
        flexShrink: 0,
        background: '#0d0d14',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Playback controls — left ~120px */}
      <PlaybackControls
        snapshots={snapshots}
        currentSnapshotIndex={currentSnapshotIndex}
        isReplay={isReplay}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onExitReplay={onExitReplay}
      />

      {/* Timeline track — flex: 1 */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          position: 'relative',
          cursor: snapshots.length > 0 ? 'crosshair' : 'default',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* 1. Heatmap background */}
        {heatmapBuckets.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            {heatmapBuckets.map((opacity, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: `rgba(100, 160, 255, ${opacity})`,
                }}
              />
            ))}
          </div>
        )}

        {/* 2. Epoch tick marks */}
        {snapshots.length > 1 &&
          epochs.map((epoch, i) => {
            const frac = epoch.snapshotIndex / (snapshots.length - 1);
            const color = epoch.type === 'focus_shift' ? '#eab308' : 'rgba(255, 255, 255, 0.4)';
            return (
              <div
                key={i}
                title={epoch.label}
                onClick={(e) => {
                  e.stopPropagation();
                  replayStore.getState().setCurrentSnapshotIndex(epoch.snapshotIndex);
                  void loadSnapshotAndEnterReplay(epoch.snapshotId).catch((err) => {
                    console.warn('[TimelineBar] Failed to load epoch snapshot:', err);
                  });
                }}
                style={{
                  position: 'absolute',
                  left: `${frac * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: color,
                  cursor: 'pointer',
                  zIndex: 10,
                }}
              >
                {/* Epoch label */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 4,
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 80,
                    pointerEvents: 'none',
                  }}
                >
                  {epoch.label.length > 15 ? epoch.label.slice(0, 15) + '\u2026' : epoch.label}
                </div>
              </div>
            );
          })}

        {/* 3. Timestamp axis labels */}
        {snapshots.length > 0 &&
          timestampLabels.map(({ fraction, label }, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${fraction * 100}%`,
                top: 4,
                transform: fraction === 1 ? 'translateX(-100%)' : fraction > 0 ? 'translateX(-50%)' : 'none',
                fontSize: 9,
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.35)',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </div>
          ))}

        {/* 4. Diff base marker — amber diamond */}
        {diffBaseFraction !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${diffBaseFraction * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: 10,
              height: 10,
              background: '#eab308',
              border: '1px solid rgba(255,255,255,0.4)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 5. Draggable thumb — only visible in replay or while dragging */}
        {thumbFraction !== null && (isReplay || isDragging) && (
          <div
            style={{
              position: 'absolute',
              left: `${thumbFraction * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#64a0ff',
              border: '2px solid #ffffff',
              zIndex: 30,
              pointerEvents: 'none',
              boxShadow: '0 0 6px rgba(100, 160, 255, 0.8)',
            }}
          >
            {/* Drag tooltip above thumb */}
            {isDragging && dragTooltipLabel && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(10, 10, 15, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#ffffffcc',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {dragTooltipLabel}
              </div>
            )}
          </div>
        )}

        {/* 6. Live-edge pulsing green dot */}
        {snapshots.length > 0 && !isAtLiveEdge && (
          <div
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#22c55e',
              zIndex: 25,
              pointerEvents: 'none',
              animation: 'timelineLiveEdgePulse 2s ease-in-out infinite',
              boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)',
            }}
          />
        )}

        {/* Empty state hint */}
        {snapshots.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none',
            }}
          >
            No snapshots yet — timeline will populate as you work
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaybackControls — left section with play/pause, step, speed selector
// ---------------------------------------------------------------------------

interface PlaybackControlsProps {
  snapshots: SnapshotMeta[];
  currentSnapshotIndex: number;
  isReplay: boolean;
  isPlaying: boolean;
  playbackSpeed: 0.5 | 1 | 2 | 4;
  onExitReplay: () => void;
}

function PlaybackControls({
  snapshots,
  currentSnapshotIndex,
  isReplay,
  isPlaying,
  playbackSpeed,
}: PlaybackControlsProps) {
  const isEmpty = snapshots.length === 0;
  const isAtFirst = currentSnapshotIndex <= 0;
  const isAtLast = currentSnapshotIndex >= snapshots.length - 1;

  const handlePlayPause = useCallback(() => {
    if (isEmpty) return;

    // If not in replay, enter replay at first snapshot when play is clicked
    if (!isReplay && snapshots.length > 0) {
      replayStore.getState().setCurrentSnapshotIndex(0);
      void loadSnapshotAndEnterReplay(snapshots[0].id).catch((err) => {
        console.warn('[PlaybackControls] Failed to enter replay:', err);
      });
      replayStore.getState().setIsPlaying(true);
      return;
    }

    replayStore.getState().setIsPlaying(!isPlaying);
  }, [isEmpty, isReplay, isPlaying, snapshots]);

  const handleStepForward = useCallback(() => {
    if (isEmpty || isAtLast) return;
    const newIdx = Math.min(currentSnapshotIndex + 1, snapshots.length - 1);
    replayStore.getState().setCurrentSnapshotIndex(newIdx);
    void loadSnapshotAndEnterReplay(snapshots[newIdx].id).catch((err) => {
      console.warn('[PlaybackControls] Failed to step forward:', err);
    });
  }, [isEmpty, isAtLast, currentSnapshotIndex, snapshots]);

  const handleStepBackward = useCallback(() => {
    if (isEmpty || isAtFirst) return;
    const newIdx = Math.max(currentSnapshotIndex - 1, 0);
    replayStore.getState().setCurrentSnapshotIndex(newIdx);
    void loadSnapshotAndEnterReplay(snapshots[newIdx].id).catch((err) => {
      console.warn('[PlaybackControls] Failed to step backward:', err);
    });
  }, [isEmpty, isAtFirst, currentSnapshotIndex, snapshots]);

  const handleSpeedCycle = useCallback(() => {
    const speeds: Array<0.5 | 1 | 2 | 4> = [1, 2, 4, 0.5];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    replayStore.getState().setPlaybackSpeed(nextSpeed);
  }, [playbackSpeed]);

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderRadius: 3,
    padding: '0 6px',
    color: disabled ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontFamily: 'monospace',
    cursor: disabled ? 'not-allowed' : 'pointer',
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  return (
    <div
      style={{
        width: 120,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '0 8px',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Step backward */}
      <button
        onClick={handleStepBackward}
        disabled={isEmpty || isAtFirst}
        title="Step backward"
        style={buttonStyle(isEmpty || isAtFirst)}
      >
        {'\u25c4\u2502'}
      </button>

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        disabled={isEmpty}
        title={isPlaying ? 'Pause' : 'Play'}
        style={buttonStyle(isEmpty)}
      >
        {isPlaying ? '\u275a\u275a' : '\u25b6'}
      </button>

      {/* Step forward */}
      <button
        onClick={handleStepForward}
        disabled={isEmpty || isAtLast}
        title="Step forward"
        style={buttonStyle(isEmpty || isAtLast)}
      >
        {'\u2502\u25ba'}
      </button>

      {/* Speed selector */}
      <button
        onClick={handleSpeedCycle}
        title={`Playback speed: ${playbackSpeed}x (click to cycle)`}
        style={{
          ...buttonStyle(false),
          fontSize: 10,
          color: 'rgba(255, 255, 255, 0.5)',
          minWidth: 28,
        }}
      >
        {playbackSpeed}x
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// formatRelativeTime — converts millisecond age to "3 minutes ago" etc.
// ---------------------------------------------------------------------------

function formatRelativeTime(msAgo: number): string {
  const sec = Math.round(msAgo / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`;
  const hr = Math.round(min / 60);
  return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
}
