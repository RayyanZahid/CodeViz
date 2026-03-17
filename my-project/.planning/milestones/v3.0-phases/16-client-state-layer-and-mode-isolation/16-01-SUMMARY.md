---
phase: 16-client-state-layer-and-mode-isolation
plan: 01
subsystem: ui
tags: [zustand, websocket, replay, state-machine, react]

# Dependency graph
requires:
  - phase: 15-server-replay-layer
    provides: GET /api/snapshot/:id endpoint and snapshot data model that replayStore is built around
provides:
  - Zustand replayStore slice with isReplay mode gate, buffer, and overflow protection
  - WsClient delta interception — graph_delta and inference buffered during replay
  - WsClient initial_state silent update during replay for accurate exit-replay state
  - watch_root_changed auto-exits replay in both WsClient and DirectoryBar
affects: [16-02, 16-03, 17-timeline-slider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "replayStore Zustand double-paren slice following graphStore.ts/inferenceStore.ts pattern"
    - "bufferedEventCount as primitive counter for efficient React selector updates without array.length"
    - "Buffer cap (500) with bufferOverflowed flag for graceful degradation on exit-replay"
    - "WsClient.handleMessage replay guard: check isReplay before dispatch, maintain version continuity"

key-files:
  created:
    - packages/client/src/store/replayStore.ts
  modified:
    - packages/client/src/ws/wsClient.ts
    - packages/client/src/App.tsx

key-decisions:
  - "replayStore is a separate Zustand slice (not merged into graphStore) — mode state is a different concern; avoids coupling"
  - "bufferedEventCount is a dedicated counter (not array.length) — prevents React selector re-render on every buffer push"
  - "exitReplay() deliberately preserves buffers — caller reads them before calling clearBuffer() after drain"
  - "initial_state during replay: silently applies to graphStore (for exit-replay accuracy) without scanning/summary side effects"
  - "Buffer cap at 500 entries matches RESEARCH.md Open Question 3 recommendation — overflow triggers snapshot fetch path on exit"

patterns-established:
  - "WsClient replay guard pattern: if (replayStore.getState().isReplay) { buffer; break; } before normal dispatch"
  - "lastQueuedVersion must be updated even when buffering graph_delta — prevents false version gap on exit-replay"

requirements-completed: [REPLAY-03, REPLAY-04]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 16 Plan 01: Client State Layer and Mode Isolation Summary

**Zustand replayStore state machine with WsClient delta interception, buffer overflow protection, and auto-exit-replay on watch-root switch**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T07:31:31Z
- **Completed:** 2026-03-17T07:34:16Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created replayStore.ts — complete Zustand slice with isReplay mode gate, historical graph Maps, dual message buffers, 500-entry cap with overflow flag, and all 5 actions (enterReplay, exitReplay, bufferGraphDelta, bufferInference, clearBuffer)
- Wired WsClient.handleMessage with replay guards in all 4 message cases (initial_state, graph_delta, inference, watch_root_changed) with lastQueuedVersion maintained during buffering
- Added DirectoryBar.handleSubmit auto-exit-replay so switching watch directory always exits replay first

## Task Commits

Each task was committed atomically:

1. **Task 1: Create replayStore Zustand slice with mode state and buffer** - `478ea1c` (feat)
2. **Task 2: Wire WsClient delta interception and watch-root auto-exit** - `b32ca58` (feat)

## Files Created/Modified
- `packages/client/src/store/replayStore.ts` - New Zustand slice: isReplay mode gate, replayNodes/replayEdges Maps, message buffers with 500-entry overflow cap, 5 actions
- `packages/client/src/ws/wsClient.ts` - Added replayStore import; 4 replay guards in handleMessage for initial_state/graph_delta/inference/watch_root_changed
- `packages/client/src/App.tsx` - Added replayStore import; auto-exit-replay in DirectoryBar.handleSubmit before POST /api/watch

## Decisions Made
- `bufferedEventCount` added as separate primitive counter (not using `bufferedGraphDeltas.length + bufferedInferenceMessages.length`) — Zustand selector equality on primitives prevents React re-render on every buffer push
- `exitReplay()` does not clear buffers — this is intentional; caller reads `bufferedGraphDeltas`/`bufferedInferenceMessages` before calling exitReplay, then calls `clearBuffer()` after draining (Plan 02 implements the drain logic)
- `initial_state` during replay applies to `graphStore` silently — ensures live graph is current on exit without ArchCanvas re-render (Plan 03 adds the ArchCanvas guard to skip visual updates during replay)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- replayStore API is complete and ready for Plan 02 (ReplayBanner component + exitReplay handler + Escape key)
- WsClient interception is live — entering replay mode (via `replayStore.getState().enterReplay(...)`) will correctly buffer all live messages from the moment of entry
- Note: ArchCanvas still subscribes to graphStore and will re-render if graphStore changes during replay (initial_state case); Plan 03 adds the ArchCanvas guard

---
*Phase: 16-client-state-layer-and-mode-isolation*
*Completed: 2026-03-17*
