---
phase: 17-timeline-slider-and-intent-panel-ui
plan: 05
subsystem: ui
tags: [react, typescript, konva, zustand, timeline, replay, diff-overlay, keyboard-shortcuts, animation]

# Dependency graph
requires:
  - phase: 17-03
    provides: TimelineBar.tsx with shift-click diff base (replayStore.diffBaseSnapshotId), isPlaying/playbackSpeed selectors, onExitReplay prop
  - phase: 16-client-state-layer-and-mode-isolation
    provides: replayStore with enterReplay/exitReplay; replayTransitions.ts with morphNodesToPositions/applyReplayTint/restoreOriginalTint; ArchCanvas.tsx with replayStore.subscribe block
provides:
  - PlaybackController.ts: pure interval-based auto-play engine with start/stop/restart at configurable speed
  - cancelAllTweens(): destroys all in-flight Konva.Tween instances for high-speed playback cleanup
  - applyDiffTint(): green/red/amber shadow glow diff overlay for added/removed/changed nodes
  - restoreDiffTint(): restores pre-diff shadow and opacity settings
  - TimelineBar.tsx keyboard shortcuts: Space=play/pause, Arrow keys=step, +/-=speed
  - ArchCanvas.tsx diff overlay: activates on diffBaseSnapshotId changes, colors edges and nodes
affects:
  - 17-06 (diff overlay and playback complete; remaining UI polish can reference these)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PlaybackController pure class pattern: no React deps, setInterval managed internally, onTick returns boolean to continue/stop"
    - "activeTweens module-level Set: register in morphNodesToPositions onFinish-delete, cancelAllTweens iterates and clears"
    - "Diff tint pattern: applyDiffTint returns Map<id,JSON> for restoration — same as applyReplayTint tintedFills pattern"
    - "Async diff fetch inside replayStore.subscribe: void IIFE pattern matches existing replay fetch pattern in ArchCanvas"
    - "useRef(new PlaybackController()) for timer management — avoids re-creating on every render"
    - "Keyboard shortcut guard: check e.target.tagName INPUT/TEXTAREA before handling Space"

key-files:
  created:
    - packages/client/src/timeline/PlaybackController.ts
  modified:
    - packages/client/src/timeline/TimelineBar.tsx
    - packages/client/src/canvas/replayTransitions.ts
    - packages/client/src/canvas/ArchCanvas.tsx

key-decisions:
  - "PlaybackController uses BASE_INTERVAL_MS/speed for interval — 1000ms at 1x, 500ms at 2x, 250ms at 4x"
  - "cancelAllTweens uses module-level Set registered in morphNodesToPositions — simplest reliable approach without Konva internals"
  - "applyDiffTint saves original shadow AND group opacity in same Map entry (OriginalShadowSettings) — restoreDiffTint restores both"
  - "Diff overlay subscription: async IIFE inside replayStore.subscribe for diffBaseSnapshotId changes — avoids refactoring the subscribe block structure"
  - "Edge diff uses stroke color only (no shadow) — lightweight; nodes get full shadow glow treatment"
  - "Diff cleared on replay exit: restoreDiffTint called before restoreOriginalTint to avoid shadow state contamination"

patterns-established:
  - "cancelAllTweens: call before loadSnapshotAndEnterReplay at speed >= 2 to prevent animation pile-up"
  - "Diff overlay fetches base snapshot lazily on first shift-click — no pre-fetching needed"

requirements-completed: [REPLAY-02, REPLAY-09, REPLAY-10]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 17 Plan 05: PlaybackController, Keyboard Shortcuts, and Diff Overlay Summary

**Auto-play engine (PlaybackController.ts) wired into TimelineBar with Space/Arrow/+- keyboard shortcuts, plus shift-click diff overlay showing green/red/amber nodes and edges comparing two timeline points**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T10:08:46Z
- **Completed:** 2026-03-17T10:12:18Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `PlaybackController.ts`: pure class managing `setInterval` at `BASE_INTERVAL_MS / speed` intervals; `onTick` returns boolean (false at live edge auto-exits to live mode)
- Wired `PlaybackController` into `TimelineBar.tsx`: `useRef(new PlaybackController())`, play/pause `useEffect` reacts to `isPlaying`+`playbackSpeed`, cleanup on unmount
- Added keyboard shortcuts in `TimelineBar.tsx`: Space=play/pause (with input guard), ArrowLeft/ArrowRight=step, +/==speed up, -=speed down
- Added `cancelAllTweens()` to `replayTransitions.ts`: module-level `activeTweens` Set tracks tweens from `morphNodesToPositions`; cancels all at high-speed ticks (2x, 4x)
- Added `applyDiffTint()` + `restoreDiffTint()` to `replayTransitions.ts`: green (added), red+faded (removed), amber (changed) shadow glow on node rects; stores original shadow+opacity for exact restoration
- Extended `ArchCanvas.tsx` `replayStore.subscribe` block: watches `diffBaseSnapshotId` changes, fetches base snapshot, computes added/removed/changed sets, applies diff tint + edge stroke colors; clears on exit replay

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PlaybackController and wire keyboard shortcuts into TimelineBar** - `a5fbccd` (feat)
2. **Task 2: Implement diff overlay in ArchCanvas with cancelAllTweens helper** - `6fc1d52` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `packages/client/src/timeline/PlaybackController.ts` - Pure interval-based auto-play engine: start/stop/restart at configurable speed multiplier
- `packages/client/src/timeline/TimelineBar.tsx` - Added PlaybackController ref, onTick callback, play/pause effect, keyboard shortcuts (Space/Arrow/+/-)
- `packages/client/src/canvas/replayTransitions.ts` - Added activeTweens Set, cancelAllTweens(), applyDiffTint(), restoreDiffTint()
- `packages/client/src/canvas/ArchCanvas.tsx` - Imported applyDiffTint/restoreDiffTint; added diff overlay logic in replayStore.subscribe; diff cleanup on exit replay

## Decisions Made
- **cancelAllTweens module-level Set**: Registered tweens in `morphNodesToPositions` with `onFinish` cleanup — simplest reliable approach that doesn't require Konva internals
- **applyDiffTint stores opacity in same JSON entry**: `OriginalShadowSettings` includes `opacity` field so `restoreDiffTint` can restore group opacity changed by removed nodes (0.4)
- **Edge diff uses stroke color only**: No shadow on edges — lightweight treatment matches the existing edge highlight pattern
- **Diff overlay clears on replay exit**: `restoreDiffTint` called before `restoreOriginalTint` in exit path to avoid shadow contamination

## Deviations from Plan

None - plan executed exactly as written. Task 1 and Task 2 were developed in sequence (Task 2's `cancelAllTweens` was needed to complete Task 1's TypeScript compilation), but both tasks' functionality matches the plan specification exactly.

## Issues Encountered

TypeScript error during Task 1 validation: `cancelAllTweens` not yet exported when TimelineBar.tsx imported it. Resolved by implementing Task 2 immediately after Task 1, then running the combined TypeScript check. Both tasks committed separately with clean verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auto-playback fully wired: press Space to start, auto-exits to live at live edge
- Keyboard shortcuts registered on document: ArrowLeft/ArrowRight step, +/- change speed
- Diff overlay active: shift-click sets diffBaseSnapshotId, overlay shows green/red/amber nodes + edge colors
- `cancelAllTweens()` exported from replayTransitions — available for future use at high speeds
- Full build passes: TypeScript 0 errors, pnpm build succeeds

---
*Phase: 17-timeline-slider-and-intent-panel-ui*
*Completed: 2026-03-17*
