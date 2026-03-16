# Roadmap: ArchLens

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-16)
- ✅ **v2.0 Make It Live** — Phase 8 (shipped 2026-03-16)
- 🚧 **v2.1 Make It Live** — Phases 9-13 (in progress)

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

### 🚧 v2.1 Make It Live (In Progress)

**Milestone Goal:** Turn the static architecture poster into a live, interactive system — clickable nodes, live risk and activity panels, animated canvas feedback, and the ability to watch any project directory.

- [ ] **Phase 9: Inspector Panel** - Component node click opens a detail panel with files, exports, and dependencies
- [ ] **Phase 10: Risk Panel** - Risk list with severity badges, canvas highlight on click, mark-as-reviewed
- [ ] **Phase 11: Activity Feed** - Live architectural events with colored dots, natural language, and relative timestamps
- [ ] **Phase 12: Edge Interaction and Component Glow** - Edge hover/click on canvas plus pulse/fade animations for changed components
- [ ] **Phase 13: Watch Any Project** - Directory input in UI, env var support, fresh scan on change

## Phase Details

### Phase 9: Inspector Panel
**Goal**: Users can click any component node to see its full architectural details in a sidebar panel
**Depends on**: Phase 8 (data pipeline delivers correct component-level fields)
**Requirements**: INSP-01, INSP-02, INSP-03, INSP-04, INSP-05, INSP-06
**Success Criteria** (what must be TRUE):
  1. Clicking a component node on the canvas opens the Inspector panel without navigating away
  2. Inspector displays the component name, zone classification, file count, and list of files
  3. Inspector displays key exports — the symbols that component provides to other components
  4. Inspector displays outgoing dependencies with edge weight (e.g., "Database x4 imports")
  5. Inspector displays incoming dependencies — which other components depend on this one
**Plans**: TBD

Plans:
- [ ] 09-01: Inspector panel React component and Zustand selection state
- [ ] 09-02: Wire component data (exports, dependencies in/out) into inspector from graph store

### Phase 10: Risk Panel
**Goal**: Users can see active architectural risks, navigate to offending components on the canvas, and dismiss reviewed risks
**Depends on**: Phase 9
**Requirements**: RISK-01, RISK-02, RISK-03
**Success Criteria** (what must be TRUE):
  1. Risk panel lists detected risks with severity badges (red for critical, orange for warning)
  2. Clicking a risk entry highlights the offending component on the canvas and pans to it
  3. User can mark a risk as reviewed and it disappears from the active risk list
**Plans**: TBD

Plans:
- [ ] 10-01: Risk panel with severity badges and live risk state from Zustand
- [ ] 10-02: Click-to-highlight and pan-to-component, plus mark-as-reviewed interaction

### Phase 11: Activity Feed
**Goal**: Users see a live stream of architectural events in natural language within seconds of file changes
**Depends on**: Phase 9
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. A new feed entry appears within 3 seconds of saving a file that triggers an architectural event
  2. Each entry reads as natural language describing what changed (e.g., "Parser modified — 2 files changed")
  3. Each entry has a colored dot indicating event type (green = creation, blue = dependency change, orange = risk)
  4. Each entry shows a relative timestamp that updates over time ("3s ago", "1m ago")
**Plans**: TBD

Plans:
- [ ] 11-01: Activity feed panel with live event stream, colored dots, and relative timestamps

### Phase 12: Edge Interaction and Component Glow
**Goal**: Users can inspect dependency edges by hovering and clicking, and recently changed components pulse visually on the canvas
**Depends on**: Phase 9
**Requirements**: EDGE-01, EDGE-02, EDGE-03, GLOW-01, GLOW-02
**Success Criteria** (what must be TRUE):
  1. Hovering over an edge shows a tooltip with source, target, dependency count, and import symbols
  2. Clicking an edge highlights both endpoint components on the canvas
  3. A thickness legend in the canvas corner explains what thin, medium, and thick edges represent
  4. A component node pulses or glows briefly (2-3 seconds) when any file in it is modified
  5. Recently changed components display a bright border that fades over 30 seconds
**Plans**: TBD

Plans:
- [ ] 12-01: Edge hover tooltip and click-to-highlight endpoints in Konva
- [ ] 12-02: Thickness legend overlay and component pulse/fade glow animations

### Phase 13: Watch Any Project
**Goal**: Users can point ArchLens at any project directory from the UI or via environment variable, and the system rescans cleanly on change
**Depends on**: Phase 9
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04
**Success Criteria** (what must be TRUE):
  1. User can type a directory path in a text input at the top of the UI and press Enter to start watching it
  2. The `ARCHLENS_WATCH_ROOT` environment variable sets the initial watched directory on server start
  3. On directory change, the canvas clears, the graph resets, and a fresh file scan begins automatically
  4. The system correctly watches and visualizes an external project directory (not just the ArchLens repo itself)
**Plans**: TBD

Plans:
- [ ] 13-01: Server-side watch-root API endpoint and env var support
- [ ] 13-02: Client directory input UI, canvas reset on directory change, external project validation

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
| 9. Inspector Panel | v2.1 | 0/2 | Not started | - |
| 10. Risk Panel | v2.1 | 0/2 | Not started | - |
| 11. Activity Feed | v2.1 | 0/1 | Not started | - |
| 12. Edge Interaction and Component Glow | v2.1 | 0/2 | Not started | - |
| 13. Watch Any Project | v2.1 | 0/2 | Not started | - |
