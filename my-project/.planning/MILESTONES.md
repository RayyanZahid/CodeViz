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

## v2.2 Make It Live — Interactive (Shipped: 2026-03-16)

**Delivered:** All remaining interactive features — the architecture map is now a live, usable supervision tool with risk panel, activity feed, edge interaction, component glow, and watch-any-project.

**Phases completed:** 4 phases (10-13), 7 plans, 12 tasks
**Files changed:** 44 (+4,811/-210 lines)
**Total LOC:** 10,086 TypeScript
**Git range:** 3e97ad2 → 3bfbc51
**Timeline:** 2026-03-16 (same day)

**Key accomplishments:**
- Risk panel with severity badges (red/orange), localStorage-persisted mark-as-reviewed with auto-resurface, click-to-highlight + pan-to on canvas
- Activity feed wired to graph deltas and risk events with natural-language sentences, colored dots, and 10s live timestamp ticking
- Edge hover tooltips (source/target/dependency count/imports), click-to-highlight both endpoints, edge thickness legend
- Component glow: 2.5s sine-wave pulse + 30s bright border fade on changed nodes
- Server-side watch-root switching: REST API, SQLite purge, graph/pipeline reset, WebSocket broadcast
- Client-side DirectoryBar with directory input, store reset, scanning indicator, env var pre-fill

**Archives:**
- `milestones/v2.2-ROADMAP.md` — full phase details
- `milestones/v2.2-REQUIREMENTS.md` — 16/16 requirements complete

---


## v3.0 Architecture Intelligence (Shipped: 2026-03-17)

**Delivered:** Time-travel replay and AI intent inference — users can scrub through architecture evolution via a timeline slider and see what the AI agent is working on in a dedicated intent panel.

**Phases completed:** 5 core phases (14-18), 15 plans + 9 decimal fix phases (10 plans)
**Files changed:** 148 (+25,371 lines)
**Total LOC:** 13,661 TypeScript
**Git range:** 5d818de → 35882d7
**Timeline:** 2 days (2026-03-16 → 2026-03-17)
**Requirements:** 22/22 (10 REPLAY, 8 INTENT, 4 INFRA)

**Key accomplishments:**
- SQLite persistence for graph snapshots with layout positions and delta-threshold triggering (FIFO at 200, checkpoints every 50)
- IntentAnalyzer heuristic engine classifying code changes into 6 categories (feature building, bug fixing, refactoring, test writing, dependency update, cleanup) with EWMA confidence scoring
- Replay mode state machine with full delta isolation — live WebSocket events buffered during replay, drained on exit with separator
- Timeline slider with drag-scrub, click-to-jump, heatmap density visualization, epoch markers, auto-playback at 0.5x/1x/2x/4x with keyboard shortcuts
- IntentPanel sidebar showing inferred objectives, confidence badges, derived subtasks, focus-shift notifications, risk correlation, and history log
- Architecture diff overlay showing added (green), removed (red), and changed (amber) components between any two timeline points
- Watch-root switching purges all replay/intent SQLite data and recreates infrastructure cleanly with toast notification
- 26 end-to-end Playwright journey tests validating the complete feature set

**Archives:**
- `milestones/v3.0-ROADMAP.md` — full phase details
- `milestones/v3.0-REQUIREMENTS.md` — 22/22 requirements complete
- `milestones/v3.0-MILESTONE-AUDIT.md` — integration audit report (passed, graphJson bug fixed inline)

---

