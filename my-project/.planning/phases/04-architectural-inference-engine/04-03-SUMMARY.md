---
phase: 04-architectural-inference-engine
plan: 03
subsystem: inference
tags: [typescript, event-corroboration, risk-detection, architectural-events, graphlib]

# Dependency graph
requires:
  - phase: 04-architectural-inference-engine (Plan 01)
    provides: ArchitecturalEvent, ZoneUpdate, RiskSignal, ZoneName shared types from @archlens/shared/types
  - phase: 03-dependency-graph-model
    provides: GraphDelta with cyclesAdded, addedNodes, removedNodeIds, addedEdges, removedEdgeIds

provides:
  - EventCorroborator class: multi-signal corroboration at threshold=2 for all 5 architectural event types
  - RiskDetector class: circular dependency (critical), boundary violation (warning), excessive fan-out (warning)
  - ZONE_LAYER_ORDER exported constant: strict layer ordering for frontend/api/services/data-stores
  - FAN_OUT_THRESHOLD=8 exported constant: internal out-degree limit

affects:
  - 04-04
  - 05-websocket
  - InferenceEngine (orchestrator that wires EventCorroborator + RiskDetector together)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - EventCorroborator uses Map<string, {count, deltaVersion}> keyed by canonical event string for O(1) counter lookups
    - MAX_STALE_VERSIONS=10 eviction prevents unbounded counter memory growth
    - RiskDetector is a pure stateless function of delta + topology callbacks — no cross-call state
    - External stub nodes (__ext__/ prefix) excluded from both boundary and fan-out checks

key-files:
  created:
    - packages/server/src/inference/EventCorroborator.ts
    - packages/server/src/inference/RiskDetector.ts
  modified: []

key-decisions:
  - "EventCorroborator THRESHOLD=2 locked: binary pass/fail, no confidence scores — single file edit can never trigger an event"
  - "EventCorroborator evicts counters for removed nodes during the eviction pass — prevents stale counters after node deletion"
  - "RiskDetector ZONE_LAYER_ORDER has exactly 4 entries (frontend/api/services/data-stores) — infrastructure and external excluded by design"
  - "Boundary violation allows diff=0 (same zone) and diff=1 (adjacent forward) — all other diffs are violations"
  - "Fan-out counts only internal edges (non-__ext__/ targets) — external stubs inflate out-degree and cause false positives on server entry points"
  - "RiskDetector is stateless (no instance state) — pure function of delta and topology callbacks for testability"

patterns-established:
  - "Pattern: EventCorroborator counter key format: {event_type}:{nodeId} or {event_type}:{v}:{w}"
  - "Pattern: RiskDetector accepts topology via callbacks (getZone, getOutEdges) rather than direct graph reference"
  - "Pattern: Eviction before processing in EventCorroborator.processDelta — always clean state before accumulating new signals"

requirements-completed: [ARCH-03, ARCH-04, ARCH-05]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 4 Plan 03: Event Corroboration and Risk Detection Summary

**EventCorroborator with threshold=2 multi-signal corroboration across 5 architectural event types plus stateless RiskDetector for circular dependency (critical), boundary violation (warning), and excessive fan-out (warning) risks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T00:36:46Z
- **Completed:** 2026-03-16T00:38:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created EventCorroborator with threshold=2 corroboration: fires component_created, component_split, component_merged, dependency_added, and dependency_removed events only after 2 separate delta signals — a single file edit can never trigger an event
- Implemented stale counter eviction (MAX_STALE_VERSIONS=10) and removed-node eviction to prevent unbounded memory growth
- Created RiskDetector wrapping Phase 3 cycle output (critical severity) plus boundary violation detection with strict layer ordering and fan-out detection with internal-only edge counting (threshold=8)
- Both modules use only @archlens/shared/types — zero new dependencies, typecheck passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement EventCorroborator with signal counter and threshold-based event firing** - `01439dc` (feat)
2. **Task 2: Implement RiskDetector with cycle enrichment, boundary violations, and fan-out detection** - `9a1bf39` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `packages/server/src/inference/EventCorroborator.ts` - Multi-signal corroboration with Map-based counters, THRESHOLD=2, MAX_STALE_VERSIONS=10, all 5 event types, eviction on node removal and stale version
- `packages/server/src/inference/RiskDetector.ts` - ZONE_LAYER_ORDER (4 entries), FAN_OUT_THRESHOLD=8, three risk detectors as private methods, stateless design

## Decisions Made
- EventCorroborator: The eviction pass for removed nodes checks the first node segment of the counter key (before `:` or `->`), ensuring that counters for any event type involving a deleted node are cleaned up
- RiskDetector: diff === 0 (same zone) allowed in addition to diff === 1 (adjacent) — same-zone imports are legitimate and must not produce false-positive boundary violations
- RiskDetector: Candidate set for fan-out (addedNodes + modifiedNodes + source nodes of addedEdges) covers all nodes that may have gained new outgoing connections in this delta

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - typecheck passed on first run for both tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EventCorroborator is ready to be wired into the InferenceEngine orchestrator (Plan 04) — accepts GraphDelta + ZoneUpdate[], returns ArchitecturalEvent[]
- RiskDetector is ready to be wired into the InferenceEngine orchestrator — accepts GraphDelta + getZone/getOutEdges callbacks, returns RiskSignal[]
- Both modules follow stateless/minimal-state patterns established in Phase 4 Plans 01 and 02
- Plan 04 (InferenceEngine) can now orchestrate ZoneClassifier + EventCorroborator + RiskDetector into a single inference cycle

---
*Phase: 04-architectural-inference-engine*
*Completed: 2026-03-16*

## Self-Check: PASSED

- packages/server/src/inference/EventCorroborator.ts: FOUND
- packages/server/src/inference/RiskDetector.ts: FOUND
- .planning/phases/04-architectural-inference-engine/04-03-SUMMARY.md: FOUND
- Commit 01439dc (Task 1): FOUND
- Commit 9a1bf39 (Task 2): FOUND
