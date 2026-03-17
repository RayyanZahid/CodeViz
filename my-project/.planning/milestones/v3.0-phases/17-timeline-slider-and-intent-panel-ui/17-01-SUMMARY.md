---
phase: 17-timeline-slider-and-intent-panel-ui
plan: 01
subsystem: ui
tags: [zustand, typescript, websocket, intent, timeline, replay]

# Dependency graph
requires:
  - phase: 16-client-state-layer-and-mode-isolation
    provides: replayStore with isReplay/enterReplay/exitReplay mode state machine
  - phase: 15-server-replay-layer
    provides: IntentSession, SnapshotMeta shared types, snapshot_saved/intent_updated/intent_closed WS messages
provides:
  - intentStore Zustand slice with activeSession, intentHistory, focus-shift detection
  - replayStore extended with snapshots[], currentSnapshotIndex, isPlaying, playbackSpeed, diffBaseSnapshotId
  - WsClient routing for all 8 ServerMessage types including 3 new Phase 17 types
affects:
  - 17-02 (TimelineSlider component consumes replayStore.snapshots, setCurrentSnapshotIndex, isPlaying)
  - 17-03 (IntentPanel component consumes intentStore.activeSession, intentHistory)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand double-paren pattern (mirrors graphStore/inferenceStore/replayStore)"
    - "Vanilla store reference export for WsClient (intentStore = useIntentStore)"
    - "Focus-shift detection: category change on applyIntentUpdated archives old session before replacing"

key-files:
  created:
    - packages/client/src/store/intentStore.ts
  modified:
    - packages/client/src/store/replayStore.ts
    - packages/client/src/ws/wsClient.ts

key-decisions:
  - "intentStore focus-shift detection checks category change (not just sessionId change) — archives old session to history before replacing active session"
  - "replayStore.snapshots persists across replay sessions (cleared only on watch_root_changed) — user preference for playbackSpeed also persists"
  - "appendSnapshot called even during replay — live edge must grow regardless of replay state"
  - "exitReplay() resets currentSnapshotIndex=-1, isPlaying=false, diffBaseSnapshotId=null but preserves snapshots and playbackSpeed"
  - "watch_root_changed clears both intentStore and replayStore.snapshots — old project timeline and sessions are invalid after root switch"

patterns-established:
  - "WsClient switch: new message types added BEFORE case 'error' (last case is catch-all guard)"
  - "Store reset on watch_root_changed: all project-specific state cleared (graph, inference, intent, timeline)"

requirements-completed: [INTENT-05, REPLAY-01, REPLAY-02, REPLAY-10]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 17 Plan 01: Foundation Stores and WsClient Routing Summary

**Zustand intentStore (new) + replayStore extended with timeline/playback state + WsClient routing all 8 ServerMessage types including snapshot_saved, intent_updated, intent_closed**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T09:54:10Z
- **Completed:** 2026-03-17T09:56:40Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created intentStore.ts with activeSession, intentHistory (cap 50), focus-shift detection in applyIntentUpdated, applyIntentClosed, loadHistory, and resetState
- Extended replayStore with 5 new state fields (snapshots, currentSnapshotIndex, isPlaying, playbackSpeed, diffBaseSnapshotId) and 6 new actions
- Updated enterReplay() to set isPlaying=false; updated exitReplay() to reset timeline scrubbing state while preserving snapshots and playbackSpeed
- Wired WsClient to route snapshot_saved, intent_updated, and intent_closed to the correct stores
- watch_root_changed now resets intentStore and clears replayStore.snapshots in addition to existing graph/inference resets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create intentStore and extend replayStore with timeline/playback state** - `d4a6e9f` (feat)
2. **Task 2: Wire WsClient to route snapshot_saved, intent_updated, intent_closed to stores** - `b6b6e65` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `packages/client/src/store/intentStore.ts` - New Zustand slice: active intent session + history management with focus-shift detection
- `packages/client/src/store/replayStore.ts` - Extended with timeline data (snapshots[]), playback state (isPlaying, playbackSpeed, currentSnapshotIndex, diffBaseSnapshotId), and 6 new actions
- `packages/client/src/ws/wsClient.ts` - Added intentStore import; wired snapshot_saved, intent_updated, intent_closed cases; watch_root_changed extended with intent/timeline resets

## Decisions Made
- **intentStore focus-shift detection** checks `category` field, not sessionId. When a new intent_updated arrives with a different category from the current activeSession, the old session is archived before the new session replaces it. This captures focus-shift semantics without needing server-side notification.
- **snapshots[] persists across replay sessions** (not cleared by exitReplay). Only watch_root_changed clears the timeline — switching projects invalidates the old timeline. playbackSpeed is also preserved as a user preference.
- **appendSnapshot called even during replay** — the live edge of the timeline must grow in real time regardless of whether the user is viewing a historical snapshot.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- intentStore and extended replayStore are ready for UI consumption
- WsClient routing is complete for all 8 message types
- Phase 17 Plan 02 (TimelineSlider component) can consume replayStore.snapshots, setCurrentSnapshotIndex, isPlaying, setIsPlaying, setPlaybackSpeed immediately
- Phase 17 Plan 03 (IntentPanel component) can consume intentStore.activeSession and intentHistory immediately

---
*Phase: 17-timeline-slider-and-intent-panel-ui*
*Completed: 2026-03-17*
