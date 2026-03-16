---
phase: 07-react-ui-shell-and-activity-feed
plan: 02
subsystem: ui
tags: [zustand, react, typescript, panels, node-inspector, risk-panel, inline-styles]

# Dependency graph
requires:
  - phase: 07-react-ui-shell-and-activity-feed
    provides: inferenceStore with risks Map, markRiskReviewed, activityFeed (Plan 01)
  - phase: 05-websocket-streaming-and-client-state
    provides: graphStore Zustand with nodes/edges Maps
provides:
  - NodeInspector panel component with files, dependencies, and recent changes sections
  - RiskPanel component with severity colors, reviewed state, and node highlight callback
affects:
  - 07-react-ui-shell-and-activity-feed (Plan 03 sidebar layout will mount these panels)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel components accept props (selectedNodeId, onHighlightNode) — contrast with ActivityFeed which reads directly from store"
    - "Sub-components (InspectorContent, RiskItemRow, ReviewedCounter) defined locally within panel file"
    - "All styles inline — no CSS modules (project convention)"
    - "Cross-panel navigation via onHighlightNode callback prop — panels remain decoupled"

key-files:
  created:
    - packages/client/src/panels/NodeInspector.tsx
    - packages/client/src/panels/RiskPanel.tsx
  modified: []

key-decisions:
  - "NodeInspector accepts selectedNodeId prop (not reads from store) — allows parent to control selection state"
  - "InspectorContent is a separate sub-component that conditionally renders — avoids calling hooks conditionally in NodeInspector"
  - "RiskItemRow stopPropagation on Mark reviewed button — prevents row click (highlight node) from firing simultaneously"
  - "ReviewedCounter uses local showReviewed state — reviewed risks expand/collapse independently from the panel collapse"

patterns-established:
  - "Dependency navigation pattern: clicking a dependency name/risk calls onHighlightNode(nodeId) — callback propagates up to canvas layer"
  - "Severity-to-color mapping via pure helper function severityColor(severity) — keeps JSX clean"
  - "Risk type label mapping via riskTypeLabel(type) pure helper — readable display names decoupled from const values"

requirements-completed: [UI-05, UI-06, UI-07]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 7 Plan 02: NodeInspector and RiskPanel Summary

**NodeInspector panel with three-section node drill-down (files/dependencies/recent-changes) and RiskPanel with severity colors, reviewed state collapse, and cross-panel node highlight callback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T04:07:21Z
- **Completed:** 2026-03-16T04:09:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `NodeInspector.tsx` — collapsible panel showing selected node's file list (max 10 with +N more counter), outgoing/incoming dependency lists with click-to-highlight, and last 5 matching activity feed items as recent changes; reads from both `useGraphStore` and `useInferenceStore`
- Created `RiskPanel.tsx` — collapsible panel displaying unreviewed risks with severity color circles (red/orange/yellow), "Mark reviewed" button per risk, reviewed risks collapsed into a `ReviewedCounter` row with expand toggle, red unreviewed count badge on header, and `onHighlightNode` callback when clicking a risk row

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NodeInspector panel component** - `404a206` (feat)
2. **Task 2: Create RiskPanel component** - `14054b8` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `packages/client/src/panels/NodeInspector.tsx` - Node inspector panel: SectionHeader, RecentChangeItem, InspectorContent sub-components; files section with truncation, dependencies split into outgoing/incoming with onHighlightNode support, recent changes filtered from activityFeed
- `packages/client/src/panels/RiskPanel.tsx` - Risk panel: RiskItemRow with severity circle + details + type label + mark-reviewed button, ReviewedCounter with local expand state, empty state; reads risks Map and markRiskReviewed from inferenceStore

## Decisions Made

- `NodeInspector` accepts `selectedNodeId` as a prop rather than reading a selection store directly — the parent (sidebar layout, Plan 03) owns selection state and passes it down
- `InspectorContent` is a separate internal sub-component so hooks (`useGraphStore`, `useInferenceStore`) are called unconditionally inside it, while `NodeInspector` switches between `InspectorContent` and `EmptyState` based on `selectedNodeId`
- `stopPropagation` on the "Mark reviewed" button click in `RiskItemRow` — prevents the row's `onClick` (which calls `onHighlightNode`) from also firing when the user only wants to mark a risk reviewed
- `ReviewedCounter` has its own local `showReviewed` state — toggling the reviewed section is independent from the panel-level collapse state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `NodeInspector` and `RiskPanel` are ready to be mounted in the sidebar layout (Plan 03)
- Both panels expose `onHighlightNode` callback for the canvas layer to implement node pan/highlight
- Plan 03 will need to wire `selectedNodeId` state (from canvas click events or graphStore) to `NodeInspector`
- All three sidebar panels (ActivityFeed, NodeInspector, RiskPanel) are now complete

## Self-Check: PASSED

- FOUND: packages/client/src/panels/NodeInspector.tsx
- FOUND: packages/client/src/panels/RiskPanel.tsx
- FOUND commit: 404a206 feat(07-02): create NodeInspector panel component
- FOUND commit: 14054b8 feat(07-02): create RiskPanel component
- TSC: PASS (pnpm --filter @archlens/client exec tsc --noEmit → zero errors)

---
*Phase: 07-react-ui-shell-and-activity-feed*
*Completed: 2026-03-16*
