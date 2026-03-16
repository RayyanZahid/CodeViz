# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** v2.2 — Phase 11: Event Feed

## Current Position

Phase: 11 of 13 (Activity Feed) — IN PROGRESS
Plan: 1 of 1 in current phase — COMPLETE
Status: Phase 11 Plan 01 complete. Activity feed fully wired.
Last activity: 2026-03-16 — Phase 11 Plan 01 complete (FEED-01/02/03/04 satisfied)

Progress: [███████████░░] 84% (11/13 phases complete)

## Performance Metrics

**Velocity (reference):**
- Total plans completed: 26 (v1.0: 21, v2.0: 2, v2.1: 2, v2.2: 1)
- v1.0 average: ~30 min/plan
- v2.0 average: ~1.5 min/plan
- v2.1 average: ~3 min/plan

**By Phase:**

| Phase | Plans | Duration | Status |
|-------|-------|----------|--------|
| 08 P01 | 1 | 1 min | Complete |
| 08 P02 | 2 | 2 min | Complete |
| 09 P01 | 2 | 3 min | Complete |
| 09 P02 | 2 | 3 min | Complete |
| 10 P01 | 2 | 4 min | Complete |
| 10 P02 | 1 | 3 min | Complete (human-verified) |
| 11 P01 | 2 | 3 min | Complete |
| Phase 12-edge-interaction-and-component-glow P01 | 4 | 1 tasks | 3 files |
| Phase 12-edge-interaction-and-component-glow P02 | 4 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
See `milestones/v1.0-ROADMAP.md` for v1.0 phase-level decisions.
See `milestones/v2.0-ROADMAP.md` for v2.0 phase-level decisions.
See `milestones/v2.1-ROADMAP.md` for v2.1 phase-level decisions.

Recent decisions relevant to v2.2:
- Risk detector already fires circular deps, boundary violations, excessive fan-out — no server work needed for Phase 10
- Event corroborator already fires component_created, dependency_added, etc. — no server work needed for Phase 11
- ARCHLENS_WATCH_ROOT already implemented server-side — Phase 13 is primarily a UI + endpoint concern
- AnimationQueue already exists — Phase 12 glow work is integration, not greenfield

Phase 10 Plan 01 decisions:
- Module-level persistedReviewedIds Set (initialized once from localStorage) avoids hot-path I/O on every applyInference call
- Resurface comparison uses sorted affectedNodeIds join + nodeId — matches existing riskFingerprint() logic for consistency
- saveReviewedRisks called once at end of applyInference after all risk processing — single write per inference message
- severityBadgeStyle() returns full CSSProperties object — consistent with inline styles pattern throughout app
- [Phase 10-risk-panel]: nodeId || affectedNodeIds[0] fallback in risk click handler for safe multi-node risk highlighting

Phase 11 Plan 01 decisions:
- batchPrependItem() extracted as shared helper used by both applyInference and applyGraphDelta
- ActivityItem.event made optional and nodeId added as first-class field for clean batching
- applyGraphDelta called immediately (not batched with queueDelta) for <3s feed latency (FEED-01)
- Risk feed entries prepended directly without architectural-event batching (separate concerns)
- [Phase 12-01]: listening:true on Konva.Arrow replaces listening:false — edges now participate in hit detection; hitStrokeWidth:15 extends clickable area invisibly
- [Phase 12-01]: HTML tooltip overlay (not Konva text) for crisp text and full CSS styling; tooltip position clamped to canvas bounds
- [Phase 12-01]: clearEdgeHighlight() resets both edge style and node selection — unified clear path prevents visual state leakage
- [Phase 12-02]: PULSE_MS=2_500 with PULSE_CYCLES=3 gives 3 sine oscillations during pulse phase
- [Phase 12-02]: nodeRect cached in GlowEntry to avoid findOne overhead in RAF loop; Phase 1 re-applies border each tick to handle clearSelection stomping
- [Phase 12-02]: EdgeLegend uses minimapVisible prop for bottom:180 vs bottom:16 offset to stay above minimap

### Pending Todos

None.

### Roadmap Evolution

- Phase 11.1 inserted after Phase 11: Fix: Journey "Build and Start" completes successfully (blocker) (URGENT)
- Phase 11.2 inserted after Phase 11: Fix journey test Phase 10 Risk Panel no matching test files found (URGENT)
- Phase 11.3 inserted after Phase 11: Fix journey test - Phase 11 Activity Feed - no matching test files found (URGENT)

### Blockers/Concerns

None — all v2.2 server-side infrastructure is in place. All four phases are UI-forward work building on existing pipelines.

## Session Continuity

**Last session:** 2026-03-16T22:24:27.607Z
**Stopped at:** Completed 12-edge-interaction-and-component-glow-02-PLAN.md
**Resume file:** None
