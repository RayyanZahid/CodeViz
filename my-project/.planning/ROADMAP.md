# Roadmap: ArchLens

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-16)
- ✅ **v2.0 Make It Live** — Phase 8 (shipped 2026-03-16)
- ✅ **v2.1 Make It Live — Inspector Panel** — Phase 9 (shipped 2026-03-16)
- 🚧 **v2.2 Make It Live — Interactive** — Phases 10-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-03-16</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-15
- [x] Phase 2: File Watching and Parsing Pipeline (3/3 plans) — completed 2026-03-15
- [x] Phase 3: Dependency Graph Model (2/2 plans) — completed 2026-03-15
- [x] Phase 4: Architectural Inference Engine (4/4 plans) — completed 2026-03-16
- [x] Phase 5: WebSocket Streaming and Client State (2/2 plans) — completed 2026-03-16
- [x] Phase 6: Canvas Renderer and Layout Engine (4/4 plans) — completed 2026-03-16
- [x] Phase 7: React UI Shell and Activity Feed (3/3 plans) — completed 2026-03-16

See `milestones/v1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0 Make It Live (Phase 8) — SHIPPED 2026-03-16</summary>

- [x] Phase 8: Data Pipeline Repair (2/2 plans) — completed 2026-03-16

See `milestones/v2.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.1 Make It Live — Inspector Panel (Phase 9) — SHIPPED 2026-03-16</summary>

- [x] Phase 9: Inspector Panel (2/2 plans) — completed 2026-03-16

See `milestones/v2.1-ROADMAP.md` for full phase details.

</details>

### 🚧 v2.2 Make It Live — Interactive (In Progress)

**Milestone Goal:** Complete all remaining interactive features so the architecture map becomes a live, usable supervision tool — risks surface with severity context, the activity feed streams live events, edges are interactive, changed components glow, and the user can point the tool at any codebase.

- [x] **Phase 10: Risk Panel** - Live risk list with severity badges, click-to-highlight on canvas, mark-as-reviewed (completed 2026-03-16)
- [x] **Phase 11: Activity Feed** - Streaming architectural events with colored dots, natural language, and relative timestamps (completed 2026-03-16)
- [ ] **Phase 12: Edge Interaction and Component Glow** - Edge hover/click on canvas plus pulse/fade animations for changed components
- [ ] **Phase 13: Watch Any Project** - Directory input in UI, env var support, fresh scan on directory change

## Phase Details

### Phase 10: Risk Panel
**Goal**: Users can see live architectural risks with severity context and act on them from the panel
**Depends on**: Phase 9 (Inspector Panel patterns established; inference engine already detects risks)
**Requirements**: RISK-01, RISK-02, RISK-03
**Success Criteria** (what must be TRUE):
  1. The risk panel lists every detected risk with a red badge for critical severity and an orange badge for warning severity
  2. Clicking a risk in the panel highlights the offending component on the canvas and pans to it
  3. Each risk entry has a "mark as reviewed" control that removes it from the active list
  4. When new risks are detected via WebSocket, they appear in the panel without a page reload
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Risk panel UI: severity badges, localStorage-persisted reviewed state, checkmark button, positive empty states
- [ ] 10-02-PLAN.md — Canvas highlight and pan-to integration for risk click + end-to-end verification

### Phase 11: Activity Feed
**Goal**: Users see a live stream of architectural events described in natural language within 3 seconds of a file save
**Depends on**: Phase 10 (panel layout patterns; event pipeline already corroborates events server-side)
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. Saving a file causes a new event to appear in the activity feed within 3 seconds
  2. Each feed entry reads as a natural-language sentence (e.g., "Parser modified — 2 files changed")
  3. Each entry has a colored dot: green for component creation, blue for dependency change, orange for risk
  4. Each entry shows a relative timestamp that updates over time ("3s ago", "1m ago", "5m ago")
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Wire graph delta + risk events into activity feed, enhanced natural-language sentences, live timestamp ticking

### Phase 11.3: Fix journey test - Phase 11 Activity Feed - no matching test files found (INSERTED)

**Goal:** [Urgent work - to be planned]
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11.3 to break down)

### Phase 11.2: Fix journey test Phase 10 Risk Panel no matching test files found (INSERTED)

**Goal:** [Urgent work - to be planned]
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11.2 to break down)

### Phase 11.1: Fix: Journey Build and Start completes successfully (blocker) (INSERTED)

**Goal:** [Urgent work - to be planned]
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11.1 to break down)

### Phase 12: Edge Interaction and Component Glow
**Goal**: Users can interact with edges to understand dependencies, and changed components pulse visually to draw attention
**Depends on**: Phase 11 (canvas interaction patterns; AnimationQueue already exists)
**Requirements**: EDGE-01, EDGE-02, EDGE-03, GLOW-01, GLOW-02
**Success Criteria** (what must be TRUE):
  1. Hovering over an edge shows a tooltip with source component, target component, dependency count, and import symbols
  2. Clicking an edge highlights both endpoint components on the canvas
  3. A thickness legend in a canvas corner explains what thin, medium, and thick edges represent
  4. When files in a component change, the node pulses or glows for 2-3 seconds
  5. A component that changed recently has a visible bright border that fades over 30 seconds
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Edge hover tooltip and click-to-highlight endpoints (EDGE-01, EDGE-02)
- [ ] 12-02-PLAN.md — Edge thickness legend, component glow pulse, and 30-second fade border (EDGE-03, GLOW-01, GLOW-02)

### Phase 13: Watch Any Project
**Goal**: Users can point the tool at any directory and immediately begin watching it without restarting the server
**Depends on**: Phase 12 (UI patterns complete; ARCHLENS_WATCH_ROOT env var already implemented server-side)
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04
**Success Criteria** (what must be TRUE):
  1. Typing a directory path in the UI input and pressing Enter starts watching that directory
  2. Setting the ARCHLENS_WATCH_ROOT environment variable before starting sets the initial watched directory
  3. After changing the watched directory, the canvas clears, the graph resets, and a fresh scan begins
  4. The tool correctly builds and displays the architecture graph for an external project (not the ArchLens codebase itself)
**Plans**: TBD

Plans:
- [ ] 13-01: Server-side watch-root switching endpoint and fresh scan on directory change
- [ ] 13-02: Client-side directory input UI, env var initial value, and canvas reset on change

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-15 |
| 2. File Watching and Parsing Pipeline | v1.0 | 3/3 | Complete | 2026-03-15 |
| 3. Dependency Graph Model | v1.0 | 2/2 | Complete | 2026-03-15 |
| 4. Architectural Inference Engine | v1.0 | 4/4 | Complete | 2026-03-16 |
| 5. WebSocket Streaming and Client State | v1.0 | 2/2 | Complete | 2026-03-16 |
| 6. Canvas Renderer and Layout Engine | v1.0 | 4/4 | Complete | 2026-03-16 |
| 7. React UI Shell and Activity Feed | v1.0 | 3/3 | Complete | 2026-03-16 |
| 8. Data Pipeline Repair | v2.0 | 2/2 | Complete | 2026-03-16 |
| 9. Inspector Panel | v2.1 | 2/2 | Complete | 2026-03-16 |
| 10. Risk Panel | 2/2 | Complete    | 2026-03-16 | - |
| 11. Activity Feed | 1/1 | Complete    | 2026-03-16 | - |
| 12. Edge Interaction and Component Glow | v2.2 | 0/2 | Not started | - |
| 13. Watch Any Project | v2.2 | 0/2 | Not started | - |
