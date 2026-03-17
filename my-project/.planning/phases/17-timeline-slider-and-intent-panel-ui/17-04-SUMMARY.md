---
phase: 17-timeline-slider-and-intent-panel-ui
plan: "04"
subsystem: ui
tags: [react, zustand, replay, activity-feed, animation, css-keyframes]

# Dependency graph
requires:
  - phase: 17-01
    provides: replayStore timeline/playback state (snapshots, currentSnapshotIndex, isPlaying, isReplay)
  - phase: 17-01
    provides: intentStore intentHistory for epoch boundary lookup

provides:
  - ActivityFeed epoch filtering synchronized with replay scrubber position
  - Epoch context header showing category label and event count during replay
  - ReplayEmptyState message for empty epochs
  - feedSlideIn CSS keyframe animation for new items during auto-playback
  - Animation only during isPlaying=true; manual scrubbing shows items instantly

affects:
  - 17-05-intent-panel
  - 17-06-timeline-slider

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS keyframe injection via useEffect + document.head.appendChild (same as ReplayBanner.tsx)"
    - "useMemo epoch boundary computation from intentHistory sessions"
    - "useRef + useEffect for tracking new-item count during auto-playback"

key-files:
  created: []
  modified:
    - packages/client/src/panels/ActivityFeed.tsx

key-decisions:
  - "ActivityFeed epoch context header embeds count in title text (no separate badge) — header already shows epoch label so a second badge would be redundant during replay"
  - "Item count badge hidden during replay — epoch count is embedded in header text; badge shown only in live mode"
  - "newItemCount uses useRef (not useState) to avoid extra re-renders when tracking playback slide-in candidates"

patterns-established:
  - "Replay epoch filtering is view-layer only — activityFeed store slice is never modified"
  - "Animation only on isPlaying=true; manual scrub always shows items instantly"

requirements-completed:
  - REPLAY-07

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 17 Plan 04: Epoch-Filtered Activity Feed with Slide-In Animation Summary

**Epoch-synchronized ActivityFeed during replay with intent-session epoch boundaries, context header, and 0.35s feedSlideIn CSS animation during auto-playback**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T09:59:40Z
- **Completed:** 2026-03-17T10:01:07Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- ActivityFeed subscribes to replayStore (isReplay, snapshots, currentSnapshotIndex, isPlaying) and intentStore (intentHistory) to derive epoch range
- displayedFeed filtered to epochStart-epochEnd when in replay; replay separators excluded during replay mode
- Header changes to "Activity (Category Label · N events)" format during replay, using intentHistory session matching to find the epoch label
- Fallback epoch boundaries use full snapshot range with "Session" label when no intent session covers the current timestamp
- ReplayEmptyState "No events in this epoch" shown when displayedFeed is empty during replay
- feedSlideIn keyframe injected via useEffect (opacity 0→1, translateY -12px→0, max-height 0→60px, 0.35s ease-out)
- New items tracked via prevFeedCountRef + newItemCount useRefs; animation only when isPlaying=true
- Non-replay mode and manual scrubbing fully unaffected — plan executed exactly as specified

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Epoch filtering, context header, and slide-in animation** - `3b56b43` (feat)

Note: Both tasks modify the same file and Task 2 depends on displayedFeed from Task 1 — committed together as a single coherent feature.

## Files Created/Modified

- `packages/client/src/panels/ActivityFeed.tsx` - Added epoch filtering, context header, ReplayEmptyState, feedSlideIn animation, and playback-aware new-item detection

## Decisions Made

- Item count badge hidden during replay mode — the epoch event count is embedded in the header text "Activity (Label · N events)", making a separate badge redundant. Badge still shows in live mode as before.
- Both tasks committed in one commit since Task 2 directly extends Task 1's `displayedFeed` variable — splitting would produce a non-compiling intermediate state.
- newItemCount tracked with useRef rather than useState to avoid triggering an extra re-render cycle on each playback tick.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ActivityFeed is now replay-aware and epoch-synchronized — ready for Phase 17 timeline slider to drive currentSnapshotIndex
- feedSlideIn animation established; any future animated list additions can reference the same pattern
- intentHistory epoch-boundary lookup works for the 6 known categories; "Session" fallback handles edge cases where no session covers the current timestamp

---
*Phase: 17-timeline-slider-and-intent-panel-ui*
*Completed: 2026-03-17*
