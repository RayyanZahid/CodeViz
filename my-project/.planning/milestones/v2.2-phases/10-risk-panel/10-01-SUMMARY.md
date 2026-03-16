---
phase: 10-risk-panel
plan: 01
subsystem: ui
tags: [react, zustand, localStorage, typescript]

# Dependency graph
requires:
  - phase: 07-risk-panel
    provides: base RiskPanel.tsx and inferenceStore.ts with RiskItem type and markRiskReviewed action
provides:
  - localStorage persistence for reviewed risk IDs (archlens-reviewed-risks key)
  - Resurface logic: reviewed risks become active again when signal nodeId or affectedNodeIds change
  - Severity badge pills (red=critical, orange=warning) replacing small circle dots
  - Checkmark button (U+2713) replacing 'Mark reviewed' text button, turns green on hover
  - Empty state: green checkmark + 'No risks detected — architecture looks clean'
  - All-clear state: green 'All clear' message above collapsed reviewed section
affects: [11-event-feed, future risk-related phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level Set initialized from localStorage once at store creation — avoids repeated localStorage reads in hot paths"
    - "Resurface by signal comparison: compare sorted affectedNodeIds and nodeId to detect changed risk identity"
    - "saveReviewedRisks called from both markRiskReviewed and applyInference (after resurface) for consistent persistence"

key-files:
  created: []
  modified:
    - packages/client/src/store/inferenceStore.ts
    - packages/client/src/panels/RiskPanel.tsx

key-decisions:
  - "Used module-level persistedReviewedIds Set (initialized once from localStorage) instead of reading localStorage on every applyInference call — avoids hot-path I/O"
  - "Resurface comparison uses sorted affectedNodeIds join and nodeId — matches existing riskFingerprint logic for consistency"
  - "saveReviewedRisks called at end of applyInference after all risk processing completes — single write per inference message even if multiple risks resurface"
  - "severityBadgeStyle() returns full CSSProperties object — consistent with inline styles pattern throughout app"

patterns-established:
  - "Severity badge: inline pill with uppercase monospace text, red=#ef4444 critical, orange=#f97316 warning"
  - "Checkmark button: 20x20 circle, U+2713 character, default color #ffffff44, hover color #22c55e with rgba(255,255,255,0.1) background"
  - "Positive empty state: green U+2713 at fontSize 14 + descriptive message"

requirements-completed: [RISK-01, RISK-03]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 10 Plan 01: Risk Panel Enhancement Summary

**localStorage-persisted reviewed risks with resurface logic, severity badge pills, checkmark button, and green empty/all-clear states in inferenceStore and RiskPanel**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T20:36:23Z
- **Completed:** 2026-03-16T20:40:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- inferenceStore now persists reviewed risk fingerprints to localStorage on every markRiskReviewed call and resurfaced risk change
- Resurface logic: when an incoming risk signal differs from the stored reviewed signal (different nodeId or affectedNodeIds), reviewed flag is cleared automatically
- RiskPanel severity badges replace circle dots — red "CRITICAL" and orange "WARNING" pills with monospace uppercase text
- Checkmark button (U+2713) replaces "Mark reviewed" text — small circle, green on hover, positive visual affordance
- Empty state updated: green checkmark icon + "No risks detected — architecture looks clean"
- AllClearState component: green "All clear" message with checkmark appears above collapsed reviewed section when all risks reviewed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add localStorage persistence and resurface logic to inferenceStore** - `3e97ad2` (feat)
2. **Task 2: Enhance RiskPanel with severity badges, checkmark button, and positive states** - `6981a7b` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `packages/client/src/store/inferenceStore.ts` - Added REVIEWED_RISKS_KEY, loadReviewedRisks/saveReviewedRisks helpers, persistedReviewedIds module-level Set, localStorage hydration for new risks, resurface logic for reviewed risks with changed signal, persistence call in markRiskReviewed
- `packages/client/src/panels/RiskPanel.tsx` - Added severityBadgeStyle() helper, replaced circle dot with severity badge span, replaced text button with U+2713 circle button, updated EmptyState with green checkmark, added AllClearState component

## Decisions Made
- Module-level `persistedReviewedIds` Set avoids reading localStorage on every applyInference call — only one read at store initialization
- Resurface comparison uses sorted affectedNodeIds join and nodeId to detect signal identity changes — matches existing riskFingerprint() logic
- `saveReviewedRisks` called once at end of applyInference after all risk processing completes — single write per inference message
- `severityBadgeStyle()` helper returns full `React.CSSProperties` object — consistent with inline styles pattern throughout the app

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compilation passed cleanly (`npx tsc --noEmit`) after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Risk panel fully implements RISK-01 (severity badges) and RISK-03 (checkmark mark-as-reviewed with localStorage persistence and resurface logic)
- Ready for Phase 11 (Event Feed) — activity feed panel work is independent of risk panel
- No blockers

## Self-Check: PASSED

- `packages/client/src/store/inferenceStore.ts` — FOUND
- `packages/client/src/panels/RiskPanel.tsx` — FOUND
- `.planning/phases/10-risk-panel/10-01-SUMMARY.md` — FOUND
- Commit `3e97ad2` — FOUND
- Commit `6981a7b` — FOUND

---
*Phase: 10-risk-panel*
*Completed: 2026-03-16*
