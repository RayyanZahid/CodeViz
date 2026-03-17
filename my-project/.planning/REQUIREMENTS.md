# Requirements: ArchLens

**Defined:** 2026-03-16
**Core Value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.

## v3.0 Requirements

Requirements for v3.0 Architecture Intelligence milestone. Each maps to roadmap phases.

### Time-Travel Replay

- [x] **REPLAY-01**: User can scrub through architecture evolution via a timeline slider with event-count axis
- [x] **REPLAY-02**: User can play/pause/step through architecture changes automatically
- [x] **REPLAY-03**: User sees a clear "REPLAY" mode indicator when viewing historical state
- [x] **REPLAY-04**: User can return to live view with a single action from replay mode
- [x] **REPLAY-05**: User sees timestamp labels on the timeline showing when events occurred
- [x] **REPLAY-06**: User sees only events from the current watch root session during replay
- [x] **REPLAY-07**: User sees the activity feed synchronized with the current scrubber position
- [x] **REPLAY-08**: User sees auto-detected epoch markers on the timeline at significant moments
- [ ] **REPLAY-09**: User can see architecture diff overlay showing added/removed/changed components between two points
- [x] **REPLAY-10**: User can control replay speed (0.5x, 1x, 2x, 4x)

### Intent Inference

- [x] **INTENT-01**: User sees an inferred objective label describing what the AI agent is working on
- [x] **INTENT-02**: User sees a confidence indicator on the inferred intent
- [x] **INTENT-03**: User can view inferred intent in a dedicated sidebar panel
- [x] **INTENT-04**: User sees inferred subtasks derived from architectural event clusters
- [x] **INTENT-05**: Intent panel auto-updates as new architectural events stream in
- [x] **INTENT-06**: User sees when the agent's focus shifts ("switched from X to Y")
- [x] **INTENT-07**: User sees risk-correlated intent linking detected risks to the current objective
- [x] **INTENT-08**: User can review an intent history log of past objectives with timestamps

### Infrastructure

- [x] **INFRA-01**: Graph snapshots are persisted to SQLite with layout positions included
- [x] **INFRA-02**: Snapshot storage uses delta-threshold triggering (not wall-clock) to control growth
- [x] **INFRA-03**: Snapshot reconstruction uses checkpoints for O(50-max) performance
- [ ] **INFRA-04**: Watch-root switching clears snapshot and intent data and recreates replay infrastructure

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Time-Travel Enhancements

- **REPLAY-11**: User can export architecture snapshot at any point as SVG/PNG
- **REPLAY-12**: User can compare architecture across multiple sessions

### Intent Enhancements

- **INTENT-09**: User sees subtask completion indicators (done/in-progress/not-started)
- **INTENT-10**: User can optionally enhance intent descriptions via LLM (when online)

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based intent inference | Violates offline constraint; adds latency, cost, API key management |
| File-level replay (individual file edits) | Wrong abstraction level — ArchLens operates at architecture level |
| Video recording of evolution | Out of scope per PROJECT.md; replay mode is the interactive equivalent |
| Manual intent labeling | Creates hybrid human/machine model that complicates UX |
| Per-node time-travel | Activity feed and Inspector already cover per-component history |
| Predictive intent ("what will agent do next") | Shifts from observation to prediction — different value proposition |
| Cross-session comparison | High complexity for medium value; defer to v4+ after time-travel proves valuable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 14 | Complete |
| INFRA-02 | Phase 14 | Complete |
| INFRA-03 | Phase 15 | Complete |
| REPLAY-03 | Phase 16 | Complete |
| REPLAY-04 | Phase 16 | Complete |
| REPLAY-01 | Phase 17 | Complete |
| REPLAY-02 | Phase 17 | Complete |
| REPLAY-05 | Phase 17 | Complete |
| REPLAY-06 | Phase 17 | Complete |
| REPLAY-07 | Phase 17 | Complete |
| REPLAY-08 | Phase 17 | Complete |
| REPLAY-09 | Phase 17 | Pending |
| REPLAY-10 | Phase 17 | Complete |
| INTENT-01 | Phase 17 | Complete |
| INTENT-02 | Phase 17 | Complete |
| INTENT-03 | Phase 17 | Complete |
| INTENT-04 | Phase 17 | Complete |
| INTENT-05 | Phase 17 | Complete |
| INTENT-06 | Phase 17 | Complete |
| INTENT-07 | Phase 17 | Complete |
| INTENT-08 | Phase 17 | Complete |
| INFRA-04 | Phase 18 | Pending |

**Coverage:**
- v3.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation (phases 14-18)*
