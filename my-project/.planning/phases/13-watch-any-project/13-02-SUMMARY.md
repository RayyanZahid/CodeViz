---
phase: 13-watch-any-project
plan: 02
subsystem: ui
tags: [react, zustand, typescript, websocket, fetch]

# Dependency graph
requires:
  - phase: 13-watch-any-project-plan-01
    provides: GET /api/watch, POST /api/watch endpoints, WatchRootChangedMessage type in shared messages and client Zod schema, broadcast() on watch-root switch
provides:
  - DirectoryBar component in App.tsx — top bar with directory input, Watch button, error display, scanning indicator
  - graphStore.resetState() — clears nodes, edges, version back to initial state on watch-root switch
  - graphStore.watchRoot / setWatchRoot() — stores and exposes current watched directory for UI
  - graphStore.scanning / setScanning() — tracks scanning state between watch_root_changed and first delta
  - inferenceStore.resetState() — clears activityFeed, risks, activeNodeIds on watch-root switch
  - WsClient watch_root_changed handler — resets both stores, enters scanning mode, resets version tracking
  - Canvas scanning overlay — centered message when scanning=true and nodes=0
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DirectoryBar reads watchRoot from graphStore (useGraphStore hook) — syncs with WsClient-driven store updates automatically via reactive subscription"
    - "DirectoryBar useEffect on watchRoot dep syncs inputValue when server-side watch_root_changed arrives — input stays in sync with actual watched directory"
    - "Void operator on async handleSubmit in onClick/onKeyDown handlers to satisfy no-floating-promises lint patterns"

key-files:
  created: []
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/store/graphStore.ts
    - packages/client/src/store/inferenceStore.ts
    - packages/client/src/ws/wsClient.ts

key-decisions:
  - "DirectoryBar component co-located in App.tsx following NavButton/PipelineStatusDot pattern — small UI components in same file"
  - "scanning turns off on first graph_delta (not initial_state) — gives live scanning feel as components appear incrementally"
  - "scanning ALSO turned off on initial_state arrival for safety — handles edge case where server sends initial_state after switch"
  - "DirectoryBar useEffect([]) fetches GET /api/watch on mount and sets both store.watchRoot and local inputValue — component is self-contained"
  - "Outer App div changed to flexDirection:column; inner horizontal div wraps canvas+sidebar — DirectoryBar sits above both"

patterns-established:
  - "Store field + useEffect([dep]) sync pattern: graphStore.watchRoot drives inputValue when changed externally by WsClient"

requirements-completed: [WATCH-01, WATCH-02, WATCH-03, WATCH-04]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 13 Plan 02: Watch Any Project Summary

**DirectoryBar top-bar input pre-filled via GET /api/watch, POST /api/watch on Enter/button, with store resetState actions and WsClient watch_root_changed handler clearing canvas and rebuilding graph incrementally**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T22:54:14Z
- **Completed:** 2026-03-16T22:57:52Z
- **Tasks:** 2
- **Files modified:** 4 modified, 0 created

## Accomplishments
- Added `resetState()` to graphStore (clears nodes, edges, version, changeSummary) and inferenceStore (clears activityFeed, risks, activeNodeIds) — called by WsClient on watch_root_changed
- Added `watchRoot`/`setWatchRoot()` and `scanning`/`setScanning()` fields to graphStore for UI state tracking
- Added `watch_root_changed` case to WsClient switch: resets both stores, sets watchRoot, enters scanning mode, resets lastQueuedVersion/previousVersion, clears pending deltas
- Scanning exits on first `graph_delta` received after watch-root switch (and also on `initial_state` as fallback)
- Created `DirectoryBar` component in App.tsx: fetches GET /api/watch on mount, syncs input with store's watchRoot, sends POST /api/watch on Enter/Watch button
- Inline red error display below bar for invalid paths (400 responses)
- Scanning indicator in top bar and centered canvas overlay when scanning=true and nodeCount=0
- Layout restructured: outer vertical flex with DirectoryBar above horizontal canvas+sidebar flex

## Task Commits

Each task was committed atomically:

1. **Task 1: Add resetState to stores, watchRoot/scanning fields, handle watch_root_changed in WsClient** - `c6672a6` (feat)
2. **Task 2: Create DirectoryBar UI component in App.tsx** - `6648451` (feat)

## Files Created/Modified
- `packages/client/src/store/graphStore.ts` - Added resetState(), watchRoot, setWatchRoot(), scanning, setScanning() to interface and implementation
- `packages/client/src/store/inferenceStore.ts` - Added resetState() to interface and implementation clearing all inference state
- `packages/client/src/ws/wsClient.ts` - Added watch_root_changed case; scanning off on first graph_delta/initial_state after switch
- `packages/client/src/App.tsx` - DirectoryBar component, scanning overlay, vertical flex layout restructure; imported graphStore vanilla ref

## Decisions Made
- `DirectoryBar` co-located in App.tsx following existing NavButton/PipelineStatusDot pattern — no separate file needed for small UI component
- `scanning` turns off on first `graph_delta` (gives live scanning feel as components appear) AND on `initial_state` (safety fallback)
- `useEffect([watchRoot])` keeps inputValue in sync when WsClient receives `watch_root_changed` and updates store externally
- Outer App container changed from horizontal-only flex to vertical flex (column), inner div holds canvas+sidebar in horizontal flex — DirectoryBar naturally sits above both without affecting existing layout proportions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None — TypeScript compiled cleanly on both tasks with no errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 is complete: server-side (Plan 01) and client-side (Plan 02) watch-root switching fully implemented
- Users can type any directory path in the top bar and press Enter to switch watching — satisfies WATCH-01 through WATCH-04
- The ARCHLENS_WATCH_ROOT env var value is reflected in the initial input on page load (via GET /api/watch)
- No blockers

## Self-Check: PASSED

- packages/client/src/App.tsx: FOUND
- packages/client/src/store/graphStore.ts: FOUND
- packages/client/src/store/inferenceStore.ts: FOUND
- packages/client/src/ws/wsClient.ts: FOUND
- .planning/phases/13-watch-any-project/13-02-SUMMARY.md: FOUND
- Commit c6672a6: FOUND
- Commit 6648451: FOUND

---
*Phase: 13-watch-any-project*
*Completed: 2026-03-16*
