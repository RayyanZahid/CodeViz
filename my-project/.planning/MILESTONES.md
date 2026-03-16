# Milestones

## v1.0 MVP (Shipped: 2026-03-16)

**Delivered:** Real-time architecture visualization for AI coding agents — a local web app that transforms code edits into an interactive architectural map with semantic zones, activity overlays, and risk detection.

**Phases completed:** 7 phases, 21 plans
**Lines of code:** 9,540 TypeScript
**Files modified:** 33
**Git range:** 3de11eb → 7fa0ec7
**Timeline:** 2026-03-16 (1 day)

**Key accomplishments:**
- TypeScript monorepo with SQLite/WAL persistence and Fastify v5 server
- Agent-agnostic file watching with tree-sitter incremental parsing (TS/JS/Python)
- Incremental dependency graph with cycle detection and delta computation
- Architectural inference engine: zone classification, event corroboration, risk detection
- Real-time WebSocket delta streaming with Zustand client state and reconnect recovery
- 60fps Konva canvas with semantic zone layout, d3-force positioning, and glow animations
- React UI shell with activity feed, node inspector, risk panel, and cross-panel navigation

**Archives:**
- `milestones/v1.0-ROADMAP.md` — full phase details
- `milestones/v1.0-REQUIREMENTS.md` — all 48 requirements (complete)

---


## v2.0 Make It Live (Shipped: 2026-03-16)

**Delivered:** Fixed the data pipeline between backend inference and frontend rendering so all downstream interactive features receive correct, component-level data.

**Phases completed:** 1 phase (of 6 planned), 2 plans, 4 tasks
**Code changes:** 4 files, +202/-4 lines
**Git range:** 5e59d3f → c8ca9f2
**Timeline:** 2026-03-16 (same day as v1.0)

**Key accomplishments:**
- Fixed Zod schema gaps — client now validates and passes fileCount, keyExports, and dependencyCount fields
- Exposed file-to-component lookup map from ComponentAggregator for ID translation
- Server-side inference ID translation from file-level paths to component-level IDs in WebSocket broadcast path
- Added pipeline health status dot (green/yellow/red) to client canvas UI

### Known Gaps

Milestone completed with 22 of 26 requirements unfinished (Phases 9-13 not started):

- INSP-01 through INSP-06: Inspector Panel (Phase 9)
- RISK-01 through RISK-03: Risk Panel (Phase 10)
- FEED-01 through FEED-04: Activity Feed (Phase 11)
- EDGE-01 through EDGE-03, GLOW-01, GLOW-02: Edge Interaction and Visual Feedback (Phase 12)
- WATCH-01 through WATCH-04: Watch Any Project (Phase 13)

**Archives:**
- `milestones/v2.0-ROADMAP.md` — full phase details
- `milestones/v2.0-REQUIREMENTS.md` — 4/26 requirements complete

---


## v2.1 Make It Live — Inspector Panel (Shipped: 2026-03-16)

**Delivered:** Interactive Inspector Panel — click any component node on the canvas to see full architectural details including files, key exports, and dependency graph with wiki-style navigation.

**Phases completed:** 1 phase, 2 plans, 4 tasks
**Code changes:** 3 files, +435/-296 lines
**Total LOC:** 9,877 TypeScript
**Git range:** c2c5b80 → 1fca4c0
**Timeline:** 2026-03-16 (same day)

**Key accomplishments:**
- Redesigned NodeInspector with zone badge, 4 collapsible sections, and 3-way dismissal (X, ESC, empty canvas click)
- Dependency aggregation with count badges and clickable navigation to pan+select target components
- DependencyRow component with per-row hover highlights for wiki-style dependency browsing
- Smooth Konva.Tween pan animation (0.3s EaseInOut) replacing hard position jumps
- Self-referencing edge exclusion from both outgoing and incoming dependency lists
- Singular/plural count badges with parentheses formatting

**Scope Note:** Originally planned as Phases 9-13. Rescoped to Phase 9 only. Phases 10-13 carry over to next milestone.

**Archives:**
- `milestones/v2.1-ROADMAP.md` — full phase details
- `milestones/v2.1-REQUIREMENTS.md` — 6/6 INSP requirements (complete)

---
