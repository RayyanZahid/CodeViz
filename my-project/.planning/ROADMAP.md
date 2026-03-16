# Roadmap: ArchLens

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-16)
- 🚧 **v2.0 Make It Live** — Phases 8-13 (in progress)

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

### 🚧 v2.0 Make It Live (In Progress)

**Milestone Goal:** Turn the static architecture poster into a live, interactive system that a developer can use to supervise an AI coding agent in real time.

- [ ] **Phase 8: Data Pipeline Repair** — Fix Zod schema gaps and file-to-component ID translation so all downstream features receive correct data
- [ ] **Phase 9: Inspector Panel** — Click a component node to see its files, exports, and dependency relationships in a sidebar panel
- [ ] **Phase 10: Live Risk Panel** — Display detected architectural risks with severity, click-to-highlight on canvas, and mark-as-reviewed
- [ ] **Phase 11: Live Activity Feed** — Show real-time architectural events in natural language with type dots and relative timestamps
- [ ] **Phase 12: Edge Interaction and Visual Feedback** — Hover/click edges for dependency details, and pulse/glow nodes when their files change
- [ ] **Phase 13: Watch Any Project** — Allow the user to point ArchLens at any directory via UI input or environment variable

## Phase Details

### Phase 8: Data Pipeline Repair
**Goal**: All component data fields flow correctly from backend to frontend so every downstream feature has real data to display
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. The Inspector panel receives `fileCount`, `keyExports`, and `dependencyCount` values (not undefined/null) when a node is clicked
  2. Edges arrive in the client with dependency metadata fields populated
  3. WebSocket inference broadcasts reference component-level IDs, not raw file paths
  4. Risk and activity events at the client carry IDs that match nodes rendered on the canvas
**Plans**: TBD

### Phase 9: Inspector Panel
**Goal**: Users can click any component node and see its full structural details in a sidebar panel
**Depends on**: Phase 8
**Requirements**: INSP-01, INSP-02, INSP-03, INSP-04, INSP-05, INSP-06
**Success Criteria** (what must be TRUE):
  1. Clicking a component node opens the Inspector panel and keeps it open until another node is clicked or the panel is dismissed
  2. Inspector displays the component name and its zone classification (e.g., "API Layer")
  3. Inspector shows the number of files and their names for the selected component
  4. Inspector lists key exports (exported symbols) from the component
  5. Inspector shows outgoing and incoming dependencies with import counts (e.g., "Database x 4 imports")
**Plans**: TBD

### Phase 10: Live Risk Panel
**Goal**: Detected architectural risks are visible with severity context, navigable to on the canvas, and dismissible once reviewed
**Depends on**: Phase 8
**Requirements**: RISK-01, RISK-02, RISK-03
**Success Criteria** (what must be TRUE):
  1. The Risk panel lists detected risks with red badges for critical severity and orange badges for warnings
  2. Clicking a risk item highlights the offending component on the canvas and pans to it
  3. User can mark a risk as reviewed and it disappears from the active risk list
**Plans**: TBD

### Phase 11: Live Activity Feed
**Goal**: Architectural events appear in the feed in real time as the agent works, described in plain language with visual type indicators
**Depends on**: Phase 8
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. A file save triggers a new feed entry within 3 seconds
  2. Feed entries describe the event in natural language (e.g., "Parser modified — 2 files changed")
  3. Each feed item has a colored dot: green for creation events, blue for dependency changes, orange for risk events
  4. Each feed item shows a human-readable relative timestamp ("3s ago", "1m ago") that updates as time passes
**Plans**: TBD

### Phase 12: Edge Interaction and Visual Feedback
**Goal**: Users can explore dependency relationships by hovering and clicking edges, and components visually signal recent change activity
**Depends on**: Phase 8
**Requirements**: EDGE-01, EDGE-02, EDGE-03, GLOW-01, GLOW-02
**Success Criteria** (what must be TRUE):
  1. Hovering an edge shows a tooltip with source component, target component, dependency count, and import symbols
  2. Clicking an edge highlights both endpoint components on the canvas
  3. A thickness legend in the canvas corner explains what thin, medium, and thick edges represent
  4. A component node pulses briefly (2-3 seconds) immediately after any of its files are saved
  5. Components that changed in the last 30 seconds have a visible bright border that gradually fades
**Plans**: TBD

### Phase 13: Watch Any Project
**Goal**: Users can direct ArchLens to watch any directory — from a UI input or environment variable — and the system cleanly resets and rescans for the new target
**Depends on**: Phase 8
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04
**Success Criteria** (what must be TRUE):
  1. Typing a directory path in the UI input and pressing Enter starts watching that directory
  2. Setting `ARCHLENS_WATCH_ROOT` before launching the server sets the initial watched directory without UI interaction
  3. Changing the watched directory clears the canvas, resets the graph, and triggers a fresh file scan
  4. ArchLens correctly builds and displays the architecture map for a project other than itself
**Plans**: TBD

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
| 8. Data Pipeline Repair | v2.0 | 0/TBD | Not started | - |
| 9. Inspector Panel | v2.0 | 0/TBD | Not started | - |
| 10. Live Risk Panel | v2.0 | 0/TBD | Not started | - |
| 11. Live Activity Feed | v2.0 | 0/TBD | Not started | - |
| 12. Edge Interaction and Visual Feedback | v2.0 | 0/TBD | Not started | - |
| 13. Watch Any Project | v2.0 | 0/TBD | Not started | - |
