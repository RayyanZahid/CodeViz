---
phase: 10-risk-panel
plan: 02
subsystem: ui
tags: [react, konva, risk-panel, click-to-highlight, pan-to-node]

# Dependency graph
requires:
  - phase: 10-01
    provides: RiskPanel with severity badges, mark-as-reviewed, localStorage persistence
  - phase: 07
    provides: selectNodeOnCanvas + panToNode wiring in handleHighlightNode (App.tsx)
provides:
  - Hardened risk click handler with affectedNodeIds fallback for multi-node risks
  - RISK-02 verified: click-to-highlight + pan-to-node integration confirmed working
affects: [11-event-feed, 12-glow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "targetId fallback: risk.signal.nodeId || risk.signal.affectedNodeIds?.[0] for safe multi-node risk handling"

key-files:
  created: []
  modified:
    - packages/client/src/panels/RiskPanel.tsx

key-decisions:
  - "nodeId || affectedNodeIds?.[0] fallback chosen over always using affectedNodeIds[0] — nodeId is the primary offending node per design; affectedNodeIds is a safety net only"
  - "App.tsx handleHighlightNode requires no changes — optional chaining already correct from Phase 7"

patterns-established:
  - "Risk click handler guards with: const targetId = nodeId || affectedNodeIds?.[0]; if (targetId) callback?.(targetId)"

requirements-completed:
  - RISK-02

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 10 Plan 02: Risk Panel Click-to-Highlight Integration Summary

**Hardened risk click-to-highlight with affectedNodeIds fallback; confirmed end-to-end wiring from risk row click to canvas selectNodeOnCanvas + panToNode**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T20:43:10Z
- **Completed:** 2026-03-16T20:46:00Z
- **Tasks:** 1 automated + 1 human-verify checkpoint
- **Files modified:** 1

## Accomplishments
- Added `nodeId || affectedNodeIds?.[0]` fallback in `RiskItemRow.handleRowClick` — ensures multi-node circular dependency risks always have a target for highlighting even if `nodeId` is empty
- Verified `if (targetId)` guard prevents `onHighlightNode` calls with empty strings
- Confirmed App.tsx `handleHighlightNode` already has correct optional chaining (`canvasRef.current?.selectNodeOnCanvas` + `if (pos && viewportControllerRef.current)` guard)
- TypeScript check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify and harden risk click-to-highlight integration** - `0d0383b` (fix)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `packages/client/src/panels/RiskPanel.tsx` - Added nodeId || affectedNodeIds fallback in handleRowClick; reviewed-risk click gate unchanged

## Decisions Made
- `nodeId || affectedNodeIds?.[0]` fallback chosen: `nodeId` is primary offending node per the type schema (`RiskSignal.nodeId: string`), `affectedNodeIds?.[0]` is a safety net for the edge case where `nodeId` is an empty string at runtime
- No changes needed in App.tsx — `handleHighlightNode` optional chaining was already correct from Phase 7

## Deviations from Plan

None - plan executed exactly as written. The task was primarily verification with a minor safety improvement to the click handler, exactly as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Risk panel click-to-highlight integration is verified and hardened
- Full end-to-end risk panel feature (Plans 01 + 02) ready for human verification checkpoint
- Phase 11 (Event Feed) can proceed after human verification of full risk panel interaction

---
*Phase: 10-risk-panel*
*Completed: 2026-03-16*
