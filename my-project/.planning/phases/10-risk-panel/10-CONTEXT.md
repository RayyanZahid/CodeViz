# Phase 10: Risk Panel - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Live risk panel that displays detected architectural risks with severity badges, allows click-to-highlight on canvas with pan, and supports mark-as-reviewed dismissal. The risk detector and inference engine already work server-side — this phase is purely UI binding and interaction.

</domain>

<decisions>
## Implementation Decisions

### Reviewed/dismissed behavior
- Reviewed risks move to a collapsed "Reviewed" section at the bottom of the risk list (collapsed by default)
- Reviewed state persists in localStorage — survives page reloads
- If a previously reviewed risk fires again (e.g., new circular dep introduced for same component), it resurfaces as an active risk
- Mark-as-reviewed interaction: small checkmark button on the right side of each risk row

### Empty and zero-risk state
- When no risks detected at all: positive message with green checkmark — "No risks detected — architecture looks clean"
- When all risks are reviewed: green "All clear" message above the collapsed reviewed section
- New risks arriving via WebSocket show a red badge count on the Risk Panel tab
- Badge shows total active (non-reviewed) risk count, not just "new since last viewed"

### Claude's Discretion
- Panel placement and layout relative to Inspector Panel (sidebar vs tab vs drawer)
- Risk item presentation: detail level, grouping strategy, badge styling
- Exact wording and styling of positive/empty state messages
- Animation or transition for risk appearing/disappearing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing Inspector Panel patterns for panel interaction and layout.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-risk-panel*
*Context gathered: 2026-03-16*
