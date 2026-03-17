---
phase: 17-timeline-slider-and-intent-panel-ui
plan: 03
subsystem: ui
tags: [react, typescript, zustand, timeline, replay, epoch-detection, animation]

# Dependency graph
requires:
  - phase: 17-01
    provides: replayStore with snapshots[], setSnapshots, setCurrentSnapshotIndex, isPlaying, playbackSpeed, diffBaseSnapshotId; intentStore with loadHistory, intentHistory
  - phase: 16-client-state-layer-and-mode-isolation
    provides: loadSnapshotAndEnterReplay exported from ArchCanvas.tsx
  - phase: 17-02
    provides: IntentPanel.tsx collapsible sidebar panel
provides:
  - epochDetection.ts utility module for detecting focus-shift and activity-gap epoch markers
  - TimelineBar.tsx full-width 60px replay control strip with heatmap, scrubbing, epoch markers, and live-edge dot
  - App.tsx restructured layout with TimelineBar spanning full width below canvas+sidebar row
affects:
  - 17-04 (TimelineBar already mounted; playback autoplay loop can hook into isPlaying)
  - 17-05 (diff overlay reads diffBaseSnapshotId set by shift-click in TimelineBar)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pointer capture drag pattern: onPointerDown setPointerCapture, onPointerMove visual-only update, onPointerUp releasePointerCapture + fetch"
    - "CSS keyframe injection via useEffect + document.createElement('style') — same pattern as ReplayBanner.tsx"
    - "useMemo for epoch detection — snapshots + intentHistory as deps; avoids recalculation on every render"
    - "Heatmap buckets: Math.min(100, snapshots.length) buckets, opacity range 0.1-0.6"
    - "minHeight:0 on flex row child prevents flex layout from overflowing 100vh when timeline is added"

key-files:
  created:
    - packages/client/src/timeline/epochDetection.ts
    - packages/client/src/timeline/TimelineBar.tsx
  modified:
    - packages/client/src/App.tsx

key-decisions:
  - "detectEpochs uses prev.endedAt ?? curr.startedAt for focus-shift transition timestamp — handles both closed and ongoing session boundaries"
  - "Drag thumb uses visual-only update (no fetch) during drag; single loadSnapshotAndEnterReplay call on pointerup — prevents request flood"
  - "Inner column wraps canvas+sidebar row AND TimelineBar; canvas+sidebar row has minHeight:0 — this is the critical CSS to prevent flex overflow"
  - "TimelineBar fetches /api/timeline and /api/intents in parallel on mount — both needed for complete timeline render (snapshots for scrubbing, sessions for epoch detection)"
  - "Live-edge dot hides when NOT in replay (isAtLiveEdge=true when !isReplay) — only visible during replay when not at last snapshot"

patterns-established:
  - "TimelineBar handles both data loading AND display — single component owns its mount fetch lifecycle"
  - "Shift-click path branches before loadSnapshotAndEnterReplay — sets diffBase without navigating"

requirements-completed: [REPLAY-01, REPLAY-05, REPLAY-06, REPLAY-08]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 17 Plan 03: TimelineBar and App Layout Restructure Summary

**Full-width 60px TimelineBar with draggable scrubber, heatmap background, epoch markers, timestamp labels, and live-edge pulse; App.tsx restructured so timeline spans canvas+sidebar width; IntentPanel inserted between Risks and Activity Feed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T10:00:07Z
- **Completed:** 2026-03-17T10:05:04Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Created `epochDetection.ts` with `EpochMarker` interface, `detectEpochs` (intent session category transitions + 90s activity gaps), and `findClosestSnapshotIndex` helper
- Created `TimelineBar.tsx` with full playback controls (play/pause/step/speed cycle), heatmap background (100 opacity-weighted buckets), epoch tick marks (amber for focus_shift, white for gap), timestamp axis labels at 25% intervals, draggable thumb with pointer capture (no fetch during drag), live-edge pulsing green dot, click-to-scrub, and shift-click diff base
- TimelineBar fetches `GET /api/timeline` and `GET /api/intents` in parallel on mount to populate replayStore.snapshots and intentStore.intentHistory
- Restructured App.tsx: inner column flex container wraps canvas+sidebar row (minHeight:0) and TimelineBar (60px), ensuring correct height calculation via ResizeObserver
- IntentPanel inserted between RiskPanel and ActivityFeed in sidebar

## Task Commits

Each task was committed atomically:

1. **Task 1: Create epochDetection module and TimelineBar component** - `cafebcb` (feat)
2. **Task 2: Restructure App.tsx layout and integrate TimelineBar + IntentPanel** - `0382f0b` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `packages/client/src/timeline/epochDetection.ts` - Pure utility: EpochMarker interface, detectEpochs (focus_shift + gap epochs), findClosestSnapshotIndex helper
- `packages/client/src/timeline/TimelineBar.tsx` - Full-width timeline bar: PlaybackControls sub-component + timeline track with heatmap, epoch marks, timestamp labels, draggable thumb, live-edge dot; mounts by fetching /api/timeline and /api/intents
- `packages/client/src/App.tsx` - Restructured layout with inner column + TimelineBar + IntentPanel integration

## Decisions Made
- **Drag thumb uses visual-only fraction update**: No `loadSnapshotAndEnterReplay` calls during drag — only fires once on `pointerUp`. Prevents HTTP request flood when scrubbing.
- **minHeight:0 on canvas+sidebar row**: Without this, the flex row won't shrink to accommodate the 60px timeline, causing overflow beyond 100vh.
- **Live-edge dot visibility**: Hidden when `!isReplay` (user is in live mode, there is no "live edge" concept). Only shown during replay when not at the last snapshot.
- **IntentPanel already existed**: Plan 02 ran before this plan. No deviation needed — file was present at `packages/client/src/panels/IntentPanel.tsx`.

## Deviations from Plan

None - plan executed exactly as written. IntentPanel.tsx already existed from Plan 02 execution.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TimelineBar.tsx is mounted and wired to replayStore — Phase 17 Plan 04 (playback loop) can hook into `isPlaying` and `playbackSpeed` from replayStore immediately
- epochDetection.ts is exported — epoch markers visible on timeline render
- shift-click diff base is wired via `replayStore.setDiffBase` — Phase 17 Plan 05 (diff overlay) reads `diffBaseSnapshotId` from store

---
*Phase: 17-timeline-slider-and-intent-panel-ui*
*Completed: 2026-03-17*
