# Phase 4: Architectural Inference Engine - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Classify file-level graph nodes into semantic zones, detect meaningful architectural events with corroboration thresholds, and identify risk signals. This is the intelligence layer that transforms raw dependency data (from Phase 3's graph) into architectural understanding consumed by the WebSocket layer (Phase 5) and UI (Phase 7). Does not include streaming, visualization, or user interaction.

</domain>

<decisions>
## Implementation Decisions

### Zone definitions & classification signals
- Exactly 6 zones: frontend, API, services, data stores, infrastructure, external
- Path patterns are the primary classification signal; import topology refines or confirms
- When path says "API" but imports say "frontend", path wins the tie
- Generic language-level heuristics only — no framework-specific detection (no Next.js/Express/FastAPI recognition)
- Unclassifiable files start in an "unknown" zone but are re-evaluated when more graph data arrives
- Files may migrate out of "unknown" over time as the graph grows and provides more signal

### Event corroboration
- All 5 event types treated equally: component created, split, merged, dependency added, dependency removed
- Minimum 2 corroborating signals required before an architectural event fires
- A single file edit must never trigger an architectural event on its own
- Events fire immediately when the corroboration threshold is met — no time-window batching
- Binary pass/fail model — events either fire or don't, no confidence scores exposed

### Risk thresholds & severity
- Fan-out risk: flag when a component has more than 8 outgoing dependencies
- Boundary violations use strict layering: frontend → API → services → data stores. Any layer skip is a violation (e.g., frontend importing data store directly)
- Risks have severity levels (e.g., warning vs critical) — circular deps are critical, high fan-out is warning, boundary violations are warning
- Circular dependency risk wraps Phase 3's existing cycle detection — no independent re-detection, just enriches with zone context and severity

### Claude's Discretion
- Override configuration (.archlens.json) structure and behavior
- Exact path pattern rules for zone classification
- Internal signal weighting mechanics
- How split/merge events are detected from graph deltas
- Severity level assignments beyond the examples above

</decisions>

<specifics>
## Specific Ideas

- The success criteria requires <20% unknown classification on standard Express+React and Next.js+FastAPI projects — the auto-reclassify behavior should help achieve this over time
- Strict layering model reflects a clean architecture philosophy — the boundary rules should encode a directional dependency flow from presentation to persistence

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-architectural-inference-engine*
*Context gathered: 2026-03-15*
