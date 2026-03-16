# Requirements: ArchLens

**Defined:** 2026-03-16
**Core Value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.

## v2.2 Requirements

Requirements for v2.2 "Make It Live — Interactive." Each maps to roadmap phases.

### Risk Panel

- [x] **RISK-01**: Risk panel displays detected risks with severity badges (red for critical, orange for warning)
- [x] **RISK-02**: User can click a risk to highlight the offending component on the canvas and pan to it
- [x] **RISK-03**: User can mark a risk as reviewed to dismiss it from the active list

### Activity Feed

- [x] **FEED-01**: Activity feed shows architectural events within 3 seconds of a file save
- [x] **FEED-02**: Events display in natural language (e.g., "Parser modified — 2 files changed")
- [x] **FEED-03**: Each feed item has a colored dot indicating event type (green = creation, blue = dependency change, orange = risk)
- [x] **FEED-04**: Each feed item shows a relative timestamp ("3s ago", "1m ago")

### Edge Interaction

- [x] **EDGE-01**: User can hover over an edge to see a tooltip with source, target, dependency count, and import symbols
- [x] **EDGE-02**: User can click an edge to highlight both endpoint components
- [ ] **EDGE-03**: A thickness legend in the corner explains what thin/medium/thick edges mean

### Watch Any Project

- [ ] **WATCH-01**: User can type a directory path in a text input at the top of the UI and press Enter to start watching it
- [ ] **WATCH-02**: `ARCHLENS_WATCH_ROOT` environment variable sets the initial watched directory
- [ ] **WATCH-03**: On directory change, the canvas clears, graph resets, and a fresh scan begins
- [ ] **WATCH-04**: The system works correctly when watching external projects (not just self-watching)

### Visual Feedback

- [ ] **GLOW-01**: Component node pulses/glows briefly (2-3 seconds) when files in it change
- [ ] **GLOW-02**: Recently changed components have a subtle bright border that fades over 30 seconds

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Time Travel

- **TIME-01**: User can scrub through architecture evolution over time
- **TIME-02**: User can replay a session's architectural changes

### Intent Inference

- **INTENT-01**: System infers agent objectives from code change patterns
- **INTENT-02**: Intent panel shows inferred subtasks and progress

### Language Support

- **LANG-01**: Go language support via tree-sitter
- **LANG-02**: Rust language support via tree-sitter

### Export

- **EXPORT-01**: User can export architecture map as SVG or PNG

## Out of Scope

| Feature | Reason |
|---------|--------|
| Time-travel replay | High complexity, deferred to v3.0 |
| Agent intent inference | Requires time-travel foundation, deferred |
| Multi-agent color coding | No multi-agent use case yet |
| SVG/PNG export | Nice-to-have, not core to live supervision |
| CI integration | Local-only tool |
| Manual node drag-to-reposition | Conflicts with semantic zone layout |
| Real-time chat/collaboration | Single-user local app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RISK-01 | Phase 10 | Complete |
| RISK-02 | Phase 10 | Complete |
| RISK-03 | Phase 10 | Complete |
| FEED-01 | Phase 11 | Complete |
| FEED-02 | Phase 11 | Complete |
| FEED-03 | Phase 11 | Complete |
| FEED-04 | Phase 11 | Complete |
| EDGE-01 | Phase 12 | Complete |
| EDGE-02 | Phase 12 | Complete |
| EDGE-03 | Phase 12 | Pending |
| GLOW-01 | Phase 12 | Pending |
| GLOW-02 | Phase 12 | Pending |
| WATCH-01 | Phase 13 | Pending |
| WATCH-02 | Phase 13 | Pending |
| WATCH-03 | Phase 13 | Pending |
| WATCH-04 | Phase 13 | Pending |

**Coverage:**
- v2.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after v2.2 roadmap creation*
