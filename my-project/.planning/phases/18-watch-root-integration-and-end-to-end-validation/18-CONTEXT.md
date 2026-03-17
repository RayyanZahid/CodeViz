# Phase 18: Watch-Root Integration and End-to-End Validation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Switching the watched directory resets all replay and intent state, and the complete v3.0 feature set is validated end-to-end. Covers INFRA-04: watch-root switching clears snapshot and intent data and recreates replay infrastructure. No new UI capabilities — this phase integrates and validates existing features across root switches.

</domain>

<decisions>
## Implementation Decisions

### Old project data lifecycle
- On watch-root switch, immediately delete (blocking) all old snapshots, intent sessions, and checkpoints from SQLite before starting the new pipeline
- Layout positions (node x/y coordinates) are preserved per watchRoot — so re-watching a project gets familiar node placement
- Everything else is wiped: snapshots, checkpoints, intent sessions, change events
- Re-watching a previously-watched project starts a completely fresh scan with empty timeline/intents — only layout positions persist
- Delete is synchronous/blocking — guarantees clean state before new pipeline starts

### Switch transition UX
- No confirmation dialog when switching — user chose to switch, don't add friction
- Timeline bar clears immediately and shows "Scanning [project name]..." until first snapshot arrives
- If user is in replay mode during switch, auto-exit replay with a brief toast: "Exited replay — switching to [new project]"
- Intent panel clears to empty immediately — no transition state or "waiting" message

### Mode isolation
- Canvas mutation guard is client-side only — server sends all deltas regardless, client buffers them in replay mode (proven pattern from Phase 16)
- No extra feedback when files are written during replay — existing replay banner with "N live events pending" counter is sufficient
- Buffer overflow behavior (>500 events) is identical to normal overflow — fetch fresh snapshot on exit, discard buffer. Root switch does not change overflow behavior
- Existing replay banner is sufficient visual indicator — no additional canvas overlay or lock icon needed

### Claude's Discretion
- Exact SQLite delete query ordering and transaction handling
- Performance optimization approach for the 20MB/200ms targets
- E2E test structure and scenario coverage
- Snapshot retention/pruning strategy within the 20MB budget

</decisions>

<specifics>
## Specific Ideas

- Keep the switch fast and frictionless — no confirmation dialogs, no loading spinners beyond the timeline message
- Consistency is key: overflow behavior, mode isolation, and replay exit should work identically whether or not a root switch just happened
- Layout position persistence is the one "memory" across switches — everything else is clean slate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-watch-root-integration-and-end-to-end-validation*
*Context gathered: 2026-03-17*
