---
phase: 16-client-state-layer-and-mode-isolation
plan: 02
subsystem: ui
tags: [react, zustand, replay, amber-banner, activity-feed, escape-key]

# Dependency graph
requires:
  - phase: 16-01
    provides: replayStore Zustand slice with isReplay gate, bufferedGraphDeltas/bufferedInferenceMessages buffers, exitReplay/clearBuffer actions
provides:
  - ReplayBanner.tsx component — full-width amber banner with REPLAY MODE label, timestamp, buffered event counter, and pulse-animated Return to Live button
  - handleExitReplay in App.tsx — async exit flow: exitReplay, snapshot fetch or buffer drain, selected node preservation, activity feed separator + inference drain, clearBuffer
  - Escape key priority in App.tsx — isReplay checked before selectedNodeId dismissal
  - insertReplaySeparator action in inferenceStore — amber separator item inserted into activity feed on replay exit
  - ActivityFeed separator rendering — highlighted amber divider row for isReplaySeparator items
affects: [16-03, 17-timeline-slider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReplayBanner pulse animation via useEffect style injection (keyframe into document.head, cleanup on unmount)"
    - "handleExitReplay async callback with selectedNodeId dep — preserves node selection across replay exit"
    - "Escape key checks isReplay first, then selectedNodeId — mode exit takes priority over panel dismiss"
    - "insertReplaySeparator inserts amber separator item at head of activityFeed before draining inference messages"

key-files:
  created:
    - packages/client/src/panels/ReplayBanner.tsx
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/store/inferenceStore.ts
    - packages/client/src/panels/ActivityFeed.tsx

key-decisions:
  - "handleExitReplay uses bufferOverflowed || bufferedGraphDeltas.length >= 50 threshold — below threshold applies deltas sequentially, above fetches /api/snapshot for accuracy guarantee"
  - "Escape key checks isReplay before selectedNodeId — replay exit must take priority per CONTEXT.md requirement"
  - "insertReplaySeparator inserts separator BEFORE draining inference messages — separator visually separates historical events from live catch-up events in correct order"
  - "ReplayBanner receives onExitReplay prop (not calling replayStore directly) — exit involves async logic (snapshot fetch, buffer drain) that only App.tsx can coordinate"
  - "Selected node preserved on exit if still in live graph, cleared if removed — checked after graphStore is restored to live state for accurate node existence check"

patterns-established:
  - "Style injection pattern for CSS animations: useEffect creates <style> in document.head, cleanup removes it on unmount"
  - "Async useCallback with void operator in JSX onClick: onExitReplay={() => void handleExitReplay()}"

requirements-completed: [REPLAY-03, REPLAY-04]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 16 Plan 02: Client State Layer and Mode Isolation Summary

**ReplayBanner amber UI with pulse animation, App.tsx exit-replay flow (snapshot fetch + buffer drain + activity separator), and Escape key priority for replay mode**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T07:38:20Z
- **Completed:** 2026-03-17T07:43:46Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created ReplayBanner.tsx — full-width amber banner (#92400e bg, #d97706 border) with REPLAY MODE label + formatted timestamp, live event pending counter, and Return to Live button with CSS pulse glow animation injected via useEffect
- Implemented handleExitReplay in App.tsx — complete async exit flow: exits replay mode, fetches /api/snapshot for large buffers (>=50 or overflowed), applies buffered graph deltas sequentially for small buffers, preserves or clears selected node, inserts replay separator + drains up to 50 inference messages, clears buffer
- Modified ESC key handler to check isReplay first (priority over inspector dismiss), updated deps array to include isReplay and handleExitReplay
- Added isReplaySeparator/replayEventCount fields to ActivityItem interface and insertReplaySeparator action to inferenceStore with amber separator item
- Added separator rendering path in FeedItem — amber-tinted divider row with italic "Events during replay" label

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ReplayBanner component with amber banner, Return to Live button, and pulse animation** - `9cb4204` (feat)
2. **Task 2: Wire banner into App.tsx, modify Escape handler, implement handleExitReplay with separator** - `1e6bbff` (feat)

## Files Created/Modified
- `packages/client/src/panels/ReplayBanner.tsx` - New component: amber banner with REPLAY MODE + timestamp text, buffered event counter, pulse-animated Return to Live button; reads from replayStore; returns null when not in replay mode
- `packages/client/src/App.tsx` - Added ReplayBanner import/mount, useReplayStore isReplay selector, handleExitReplay callback (async exit flow), updated ESC handler with isReplay priority
- `packages/client/src/store/inferenceStore.ts` - Added isReplaySeparator/replayEventCount optional fields to ActivityItem; added insertReplaySeparator action to interface and implementation
- `packages/client/src/panels/ActivityFeed.tsx` - Added separator rendering path in FeedItem before normal render path; amber-tinted divider row with italic centered text

## Decisions Made
- `handleExitReplay` uses `bufferOverflowed || bufferedGraphDeltas.length >= 50` as threshold — below 50 entries, sequential delta apply is accurate and cheaper; above, fresh snapshot guarantees correctness regardless of buffer order or gaps
- `insertReplaySeparator` is called BEFORE draining inference messages — so the separator appears as a visual boundary between historical events and the live catch-up events that follow
- `ReplayBanner` receives `onExitReplay` as a prop rather than reading exitReplay from replayStore directly — the exit involves async orchestration (fetch, delta apply, store calls in order) that cannot be encoded in a UI component
- Selected node check happens AFTER graphStore is restored to live state — ensures `nodes.has(selectedNodeId)` reflects the post-exit live graph, not the stale replay graph

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript compile error from `Parameters<typeof graphStore.getState>` type expression**
- **Found during:** Task 2 (App.tsx handleExitReplay snapshot fetch type)
- **Issue:** The type expression `Parameters<typeof graphStore.getState>['0'] extends never ? unknown : unknown` produced TS2493 tuple-length error
- **Fix:** Imported `InitialStateMessage` from `@archlens/shared/types` and typed the fetch response as `as InitialStateMessage` directly — cleaner and accurate to the actual API response type
- **Files modified:** packages/client/src/App.tsx
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** `1e6bbff` (Task 2 commit)

**2. [Rule 3 - Blocking] Moved handleExitReplay declaration before the ESC key useEffect**
- **Found during:** Task 2 (App.tsx hook ordering)
- **Issue:** ESC key `useEffect` was placed before `handleExitReplay` declaration, causing TS2448 "used before declaration" errors
- **Fix:** Removed ESC handler from its original position (before navigation handlers) and re-inserted it after `handleExitReplay` declaration
- **Files modified:** packages/client/src/App.tsx
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** `1e6bbff` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking TypeScript errors in same file)
**Impact on plan:** Both auto-fixes were TypeScript correctness issues only. No behavior changes, no scope creep.

## Issues Encountered
None beyond the two auto-fixed TypeScript errors above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ReplayBanner and exit-replay flow are complete and fully wired
- Plan 16-03 (ArchCanvas replay tint guard) can now proceed — it needs to add the visual update guard so ArchCanvas ignores graphStore changes during replay (initial_state silent update from Plan 01)
- replayStore.enterReplay() can be called by Phase 17 timeline slider — the banner will appear automatically, and Escape or Return to Live will cleanly exit

---
*Phase: 16-client-state-layer-and-mode-isolation*
*Completed: 2026-03-17*
