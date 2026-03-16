---
phase: 08-data-pipeline-repair
plan: 02
subsystem: api
tags: [websocket, inference, typescript, react, zustand, ui, pipeline, translation]

# Dependency graph
requires:
  - phase: 08-01
    provides: ComponentAggregator.getFileToComponentMap() returning Map<string, string>
provides:
  - translateInferenceToComponentIds() in websocket.ts — file-level to component-level ID translation for inference messages
  - Pipeline health status dot in App.tsx — green/yellow/red indicator for connection state
affects: [client-inference-store, client-inspector-panel, client-risk-panel, client-activity-feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Translate inference IDs at the broadcast boundary (server-side) so clients never see file-level IDs"
    - "Deduplicate zone updates by component ID after translation — multiple files in same component collapse to one update"
    - "Skip broadcast entirely when nothing survives ID translation — avoids empty inference messages"
    - "Status dots show labels only for non-healthy states (yellow/red) — green stays silent to keep UI unobtrusive"

key-files:
  created: []
  modified:
    - packages/server/src/plugins/websocket.ts
    - packages/client/src/App.tsx

key-decisions:
  - "Translation happens server-side in the broadcast path — clients never receive file-level IDs"
  - "Unmapped file IDs silently skipped (per user decision) — they appear after next inference cycle once aggregator maps them"
  - "Broadcast skipped entirely when all IDs are unmapped — avoids empty inference messages reaching the client"
  - "Status dot label hidden when connected (green) to stay unobtrusive; shown for yellow/red states only"
  - "Bottom offset of status dot accounts for both minimap height and selected-node indicator height dynamically"

patterns-established:
  - "ID translation at broadcast boundary: translate server IDs to client IDs before any JSON serialization"
  - "Deduplication after translation: when N files collapse to 1 component, keep first zone update only"

requirements-completed: [PIPE-03, PIPE-04]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 8 Plan 02: Inference ID Translation and Pipeline Status Dot Summary

**Server-side inference ID translation (file-path to component-level) in WebSocket broadcast path, plus green/yellow/red pipeline health dot in client canvas UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T19:14:13Z
- **Completed:** 2026-03-16T19:16:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Inference messages now arrive at the client with component-level IDs (e.g., `src/parser`) instead of file-level paths (e.g., `src/parser/worker.ts`), fixing empty/broken Inspector, Risk Panel, and Activity Feed
- `translateInferenceToComponentIds()` helper translates all three inference event types (zone updates, architectural events, risks) using the ComponentAggregator's file-to-component map built in Plan 01
- Zone updates are deduplicated per component after translation — multiple files in the same component collapse to one update
- Pipeline health status dot added to the bottom-left corner of the canvas — green when connected, yellow when connecting/syncing, red when disconnected

## Task Commits

Each task was committed atomically:

1. **Task 1: Translate inference IDs from file-level to component-level in WebSocket plugin** - `e971b2d` (feat)
2. **Task 2: Add pipeline health status dot to client UI** - `d3572af` (feat)

## Files Created/Modified
- `packages/server/src/plugins/websocket.ts` - Added `translateInferenceToComponentIds()` module-private helper; updated inference event handler to call translation before broadcast; added `InferenceResult` to imports
- `packages/client/src/App.tsx` - Added `useGraphStore` and `ConnectionStatus` imports; added `connectionStatus` selector; added `PipelineStatusDot` component with `statusColor()` and `statusLabel()` helpers

## Decisions Made
- Translation happens server-side in the broadcast path — the client never receives file-level node IDs, keeping the client's graphStore consistent with the canvas
- Unmapped file IDs are silently skipped (per user decision from Plan context): they appear after the next inference cycle once the aggregator has processed them
- Broadcast is skipped entirely when all IDs are unmapped — avoids sending empty inference messages that would cause no-op client processing
- Status dot label is hidden when `connected` (green) to stay unobtrusive during normal operation; labels appear for yellow and red states so users know why the dot is not green
- Bottom offset for the status dot dynamically accounts for both minimap visibility (164px offset) and selected-node indicator visibility (40px offset) to avoid visual overlap

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both packages compiled clean on first attempt after implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Inference messages now carry component-level IDs that match rendered canvas nodes — Inspector, Risk Panel, and Activity Feed should now show real data instead of empty/broken content
- Plan 03 and Plan 04 can proceed: the full translation pipeline (PIPE-01 through PIPE-04) is now in place
- Both packages (client and server) compile clean — no TypeScript errors

---
*Phase: 08-data-pipeline-repair*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: packages/server/src/plugins/websocket.ts
- FOUND: packages/client/src/App.tsx
- FOUND: .planning/phases/08-data-pipeline-repair/08-02-SUMMARY.md
- FOUND commit: e971b2d (Task 1 - inference ID translation)
- FOUND commit: d3572af (Task 2 - pipeline status dot)
