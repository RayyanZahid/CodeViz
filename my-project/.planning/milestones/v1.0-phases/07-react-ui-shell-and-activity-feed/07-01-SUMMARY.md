---
phase: 07-react-ui-shell-and-activity-feed
plan: 01
subsystem: ui
tags: [zustand, react, websocket, inference, activity-feed, typescript]

# Dependency graph
requires:
  - phase: 05-websocket-streaming-and-client-state
    provides: WsClient WebSocket message handling with inference case stub
  - phase: 06-canvas-renderer-and-layout-engine
    provides: graphStore Zustand pattern and graphStore.getState().nodes for node name resolution
provides:
  - inferenceStore Zustand store with applyInference/markRiskReviewed/pruneExpiredActive
  - toSentence() pure function mapping ArchitecturalEvent to terse technical sentence
  - ActivityFeed panel component rendering inference events as natural-language sentences
  - wsClient wired to call inferenceStore.getState().applyInference() on each inference message
affects:
  - 07-react-ui-shell-and-activity-feed (all remaining plans depend on inferenceStore)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "inferenceStore follows double-paren Zustand pattern identical to graphStore.ts"
    - "vanilla reference export (inferenceStore = useInferenceStore) for non-React callers (wsClient)"
    - "toSentence is pure function — takes nodeNameFn closure so graphStore coupling is deferred to call site"
    - "ActivityFeed reads from useInferenceStore selector; all styles are inline (no CSS modules)"

key-files:
  created:
    - packages/client/src/store/inferenceStore.ts
    - packages/client/src/utils/eventSentence.ts
    - packages/client/src/panels/ActivityFeed.tsx
  modified:
    - packages/client/src/ws/wsClient.ts

key-decisions:
  - "toSentence takes a nodeNameFn parameter (not graphStore import) to keep the function pure and testable"
  - "iconColor is pre-computed in applyInference and stored on ActivityItem — ActivityFeed component has zero business logic"
  - "Batching heuristic: last feed item with same nodeId within 2s is summarized as 'N events for ${name}'"
  - "inferenceStore vanilla reference is just export const inferenceStore = useInferenceStore (same pattern as graphStore)"
  - "Activity feed caps at 50 items via slice(0, 50) after prepend"
  - "Risk deduplication uses fingerprint: type+affectedNodeIds (sorted) or type+nodeId as fallback"

patterns-established:
  - "Panel components: no props, read from store via useInferenceStore selector, all inline styles"
  - "Sub-components (FeedItem, EmptyState) defined locally within the panel file"

requirements-completed: [UI-01, UI-02, UI-03, UI-04]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 7 Plan 01: InferenceStore, EventSentence, and ActivityFeed Summary

**Zustand inferenceStore with 50-item activity feed, risk deduplication by fingerprint, and ReactActivityFeed panel rendering terse architectural event sentences**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T04:01:28Z
- **Completed:** 2026-03-16T04:03:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `inferenceStore.ts` — Zustand store with `applyInference`, `markRiskReviewed`, `pruneExpiredActive`; activity feed capped at 50 items, risk deduplication by fingerprint, 30-second decay tracking for active nodes
- Created `eventSentence.ts` — pure `toSentence()` function mapping ArchitecturalEvent types to terse technical sentences with arrow notation for dependency changes
- Wired `wsClient.ts` — replaced console.log stub with `inferenceStore.getState().applyInference()` call, bridging Zod relaxed types to strict shared types via `as unknown as InferenceMessage`
- Created `ActivityFeed.tsx` — collapsible panel with color-coded dot icons, natural-language sentences, relative timestamps (now/s/m/h), item count badge, and empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create inferenceStore, eventSentence utility, and wire wsClient** - `c081ec6` (feat)
2. **Task 2: Create ActivityFeed panel component** - `b74f738` (feat)

**Plan metadata:** `965be95` (docs: complete plan)

## Files Created/Modified

- `packages/client/src/store/inferenceStore.ts` - Zustand inference store with ActivityItem/RiskItem types, applyInference action with batching, risk fingerprinting, active node tracking
- `packages/client/src/utils/eventSentence.ts` - Pure function converting ArchitecturalEvent to natural-language sentence using switch on ArchitecturalEventType
- `packages/client/src/panels/ActivityFeed.tsx` - Panel component: collapsible with CSS max-height transition, FeedItem with icon dot/sentence/timestamp, EmptyState, item count badge
- `packages/client/src/ws/wsClient.ts` - Added inferenceStore import; replaced console.log inference case with applyInference() dispatch

## Decisions Made

- `toSentence` accepts a `nodeNameFn` parameter rather than importing graphStore directly — keeps the function pure and testable in isolation
- `iconColor` pre-computed in `applyInference` and stored on each `ActivityItem` — panel component has no business logic
- Batching heuristic: if last feed item has same `nodeId` and occurred within 2s, it is replaced with `"N events for ${name}"` summary
- Risk fingerprint uses `type:affectedNodeIds(sorted)` when affectedNodeIds present, falls back to `type:nodeId`
- Vanilla reference `export const inferenceStore = useInferenceStore` mirrors graphStore.ts pattern exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `inferenceStore` is ready for all Phase 7 panels that need inference data (risk panel, node detail panel, status bar)
- `ActivityFeed` is ready to be mounted in the sidebar layout (Plan 02 or App.tsx integration)
- `pruneExpiredActive()` needs to be wired to a `setInterval(30000)` in App.tsx or main.tsx (deferred to sidebar layout plan)
- `markRiskReviewed()` is ready for the risk panel to call

## Self-Check: PASSED

- FOUND: packages/client/src/store/inferenceStore.ts
- FOUND: packages/client/src/utils/eventSentence.ts
- FOUND: packages/client/src/panels/ActivityFeed.tsx
- FOUND: .planning/phases/07-react-ui-shell-and-activity-feed/07-01-SUMMARY.md
- FOUND commit: c081ec6 feat(07-01): create inferenceStore, eventSentence utility, and wire wsClient
- FOUND commit: b74f738 feat(07-01): create ActivityFeed panel component

---
*Phase: 07-react-ui-shell-and-activity-feed*
*Completed: 2026-03-16*
