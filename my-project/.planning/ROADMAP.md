# Roadmap: ArchLens

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-16)
- ✅ **v2.0 Make It Live** — Phase 8 (shipped 2026-03-16)
- ✅ **v2.1 Make It Live — Inspector Panel** — Phase 9 (shipped 2026-03-16)
- ✅ **v2.2 Make It Live — Interactive** — Phases 10-13 (shipped 2026-03-16)
- 🚧 **v3.0 Architecture Intelligence** — Phases 14-18 (in progress)

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

<details>
<summary>✅ v2.2 Make It Live — Interactive (Phases 10-13) — SHIPPED 2026-03-16</summary>

- [x] Phase 10: Risk Panel (2/2 plans) — completed 2026-03-16
- [x] Phase 11: Activity Feed (1/1 plan) — completed 2026-03-16
- [x] Phase 12: Edge Interaction and Component Glow (2/2 plans) — completed 2026-03-16
- [x] Phase 13: Watch Any Project (2/2 plans) — completed 2026-03-16

See `milestones/v2.2-ROADMAP.md` for full phase details.

</details>

### v3.0 Architecture Intelligence (In Progress)

**Milestone Goal:** Add temporal awareness and intent inference — users can replay how the architecture evolved and understand what the AI agent is trying to accomplish.

- [x] **Phase 14: Schema Foundation and Shared Types** - Persist graph snapshots with layout positions and wire new shared TypeScript types for all replay and intent messages (completed 2026-03-17)
- [x] **Phase 15: Server Replay Layer** - Build server-side snapshot recording with checkpoint-based reconstruction and heuristic intent analysis (completed 2026-03-17)
- [x] **Phase 16: Client State Layer and Mode Isolation** - Establish the replay mode state machine so live deltas cannot corrupt historical graph views (completed 2026-03-17)
- [x] **Phase 17: Timeline Slider and Intent Panel UI** - Deliver all user-facing replay controls and intent display in the client (completed 2026-03-17)
- [ ] **Phase 18: Watch-Root Integration and End-to-End Validation** - Clear replay and intent data on directory switch and validate the complete v3.0 feature set

## Phase Details

### Phase 14: Schema Foundation and Shared Types
**Goal**: Snapshot and intent data can be persisted to SQLite with layout positions, and all server/client code shares typed contracts for the new message protocol
**Depends on**: Phase 13
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. A `graph_snapshots` Drizzle table exists with a `positions_json` column, and inserting a row with node positions succeeds without error
  2. An `intent_sessions` Drizzle table exists and a new intent session row can be written and read back
  3. `shared/src/types/timeline.ts` exports `SnapshotMeta`, `IntentSession`, and the three new WebSocket message types, and TypeScript compiles with no errors across all packages
  4. Snapshot writes are triggered only at the delta threshold (not every event), preventing unbounded storage growth from day one
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md -- Schema, shared types, message protocol, and repository modules (INFRA-01)
- [ ] 14-02-PLAN.md -- SnapshotManager delta-threshold logic and server lifecycle wiring (INFRA-02)

### Phase 14.3: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (major) (INSERTED)

**Goal:** Install @playwright/test in standalone package.json, restore regressed test files (playwright.config.ts, journey-build-and-start.spec.ts, journey-phase-14.spec.ts), and rewrite Phase 15 journey tests with real API endpoint assertions so all 12 journey tests pass
**Depends on:** Phase 14
**Plans:** 1/1 plans complete

Plans:
- [ ] 14.3-01-PLAN.md -- Install @playwright/test, restore regressed files, rewrite Phase 15 journey tests

### Phase 14.2: Fix: Journey Phase 14 Schema Foundation and Shared Types completes successfully (INSERTED)

**Goal:** Replace placeholder Phase 14 journey tests with real tests that verify all four success criteria via diagnostic REST endpoints: graph_snapshots CRUD with positions, intent_sessions CRUD, shared type compilation, and delta-threshold snapshot behavior
**Depends on:** Phase 14
**Plans:** 1/1 plans complete

Plans:
- [ ] 14.2-01-PLAN.md -- Diagnostic plugin endpoints and real journey test rewrites

### Phase 14.1: Fix Journey Build and Start completes successfully (blocker) (INSERTED)

**Goal:** The "Build and Start" journey test passes end-to-end: `pnpm build` produces TypeScript output for all packages, Playwright auto-starts the dev server, and all 4 journey tests pass without external setup
**Depends on:** Phase 14
**Requirements:** INFRA-01, INFRA-02
**Plans:** 2 plans

Plans:
- [x] 14.1-01-PLAN.md -- Add root build script, fix tsconfigs for tsc -b, add Playwright webServer block, fix journey test commands
- [ ] 14.1-02-PLAN.md -- Install @playwright/test and browser binaries so all 4 journey tests pass

### Phase 15: Server Replay Layer
**Goal**: The server records graph snapshots automatically, can reconstruct any historical snapshot in O(50-max) operations, and emits inferred intent sessions over WebSocket
**Depends on**: Phase 14
**Requirements**: INFRA-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/timeline` returns a list of snapshot metadata with sequence numbers and timestamps after file changes occur
  2. `GET /api/snapshot/:id` returns a complete graph snapshot (nodes, edges, positions) reconstructed from the nearest checkpoint in at most 50 replay steps
  3. The `IntentAnalyzer` classifies a realistic sequence of architectural events into one of the 4-6 coarse categories and returns a confidence score
  4. Writing files during an active session does not cause the pipeline to pause — new events continue to arrive while the replay read path is active
**Plans**: 3 plans
Plans:
- [ ] 15-01-PLAN.md -- Checkpoint schema, repository layer, IntentCategory alignment, and repository extensions (INFRA-03)
- [ ] 15-02-PLAN.md -- IntentAnalyzer heuristic classification engine and SnapshotManager checkpoint integration (INFRA-03)
- [ ] 15-03-PLAN.md -- Timeline REST plugin and server lifecycle wiring for IntentAnalyzer (INFRA-03)

### Phase 15.6: Fix: Journey Phase 15: Server Replay Layer completes successfully (major) (INSERTED)

**Goal:** Restore 4 auto-gsd-overwritten journey test files from git HEAD, add a canary spec file that detects future placeholder overwrites, and verify all 13 tests pass green
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.6-01-PLAN.md -- Restore 4 journey test files from git HEAD, create canary overwrite detector, verify 13/13 pass

### Phase 15.5: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (INSERTED)

**Goal:** Restore 4 auto-gsd-overwritten journey test files from git HEAD, verify all 12 journey tests pass green, and document the root cause of the recurring overwrite pattern (OttoGSD journey-test-generator.ts)
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.5-01-PLAN.md -- Restore journey test files from git HEAD, verify 12/12 pass, document root cause

### Phase 15.4: Fix: Journey Build and Start completes successfully (blocker) (INSERTED)

**Goal:** Restore 4 auto-GSD-overwritten journey test files from git HEAD and verify all 12 tests (build-and-start, phase-14, phase-15) pass green end-to-end
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.4-01-PLAN.md -- Restore journey test files from git HEAD and run full Playwright suite

### Phase 15.3: Fix: Journey Phase 15: Server Replay Layer completes successfully (major) (INSERTED)

**Goal:** Restore 3 regressed infrastructure files from git HEAD and write journey-phase-15.spec.ts with deep CONTEXT.md-level assertions (timeline shape + monotonic sequenceNumbers, snapshot node/edge/positions validation, IntentSession full shape, concurrency write+read, error cases 404/400) so all 12 journey tests pass green
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.3-01-PLAN.md -- Restore infrastructure files from HEAD, write Phase 15 journey tests with deep API assertions

### Phase 15.2: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (INSERTED)

**Goal:** Restore 3 regressed journey test infrastructure files from git HEAD (with NODE_ENV=development addition), rewrite journey-phase-14.spec.ts per updated CONTEXT.md decisions (15-20 files, fixed 5s wait, hasIntentCategory check), and verify all 12 journey tests pass green
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.2-01-PLAN.md -- Restore infrastructure files, rewrite Phase 14 journey tests per CONTEXT.md decisions

### Phase 15.1: Fix Journey Build and Start completes successfully (blocker) (INSERTED)

**Goal:** Restore all 4 auto-gsd-overwritten journey test files from git HEAD so all 12 journey tests (build-and-start, phase-14, phase-15) pass green end-to-end
**Depends on:** Phase 15
**Plans:** 1/1 plans complete

Plans:
- [ ] 15.1-01-PLAN.md -- Restore journey test files from git HEAD and verify all 12 tests pass

### Phase 16: Client State Layer and Mode Isolation
**Goal**: Users can enter and exit replay mode, and live WebSocket deltas are completely blocked from mutating the displayed graph while in replay mode
**Depends on**: Phase 15
**Requirements**: REPLAY-03, REPLAY-04
**Success Criteria** (what must be TRUE):
  1. When replay mode is active, a visible "VIEWING HISTORY" indicator is present on the screen so the user always knows they are not looking at the live state
  2. When the user exits replay mode with a single action, the canvas immediately shows the current live architecture state
  3. Writing a file while in replay mode produces no change on the canvas — live deltas are blocked at the WebSocket entry point until the user exits replay
  4. After exiting replay, any live events that arrived during the replay session are applied and the activity feed catches up
**Plans**: 3 plans
Plans:
- [ ] 16-01-PLAN.md -- replayStore Zustand slice and WsClient delta interception (REPLAY-03, REPLAY-04)
- [ ] 16-02-PLAN.md -- ReplayBanner UI, Escape key, handleExitReplay, activity feed separator (REPLAY-03, REPLAY-04)
- [ ] 16-03-PLAN.md -- ArchCanvas replay transitions: morph animation, blue tint, viewport zoom, subscription guard (REPLAY-03, REPLAY-04)

### Phase 17: Timeline Slider and Intent Panel UI
**Goal**: Users can scrub through the full architecture evolution timeline and read the inferred AI agent intent in a dedicated sidebar panel
**Depends on**: Phase 16
**Requirements**: REPLAY-01, REPLAY-02, REPLAY-05, REPLAY-06, REPLAY-07, REPLAY-08, REPLAY-09, REPLAY-10, INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, INTENT-07, INTENT-08
**Success Criteria** (what must be TRUE):
  1. User can drag a timeline slider to any point in the session and the architecture canvas updates to show the graph at that moment with correct node positions
  2. User can press play and watch the architecture evolve automatically, pause it mid-playback, and step forward one event at a time; speed can be set to 0.5x, 1x, 2x, or 4x
  3. The timeline slider shows timestamp labels, auto-detected epoch markers at significant moments, and the activity feed scrolls in sync with the current scrubber position
  4. The intent panel shows the inferred objective label with a confidence indicator, a list of derived subtasks, and updates automatically as new events stream in during live view
  5. The intent panel shows historical intent during replay (not the current live intent), and displays a focus-shift notification when the agent transitions between objectives
**Plans**: 5 plans
Plans:
- [ ] 17-01-PLAN.md -- intentStore Zustand slice, replayStore timeline/playback extension, WsClient message routing
- [ ] 17-02-PLAN.md -- IntentPanel sidebar component (objective, confidence, subtasks, history, risk correlation)
- [ ] 17-03-PLAN.md -- TimelineBar component, epoch detection, App.tsx layout restructure
- [ ] 17-04-PLAN.md -- Activity feed epoch-based filtering during replay
- [ ] 17-05-PLAN.md -- PlaybackController auto-play, keyboard shortcuts, diff overlay

### Phase 18: Watch-Root Integration and End-to-End Validation
**Goal**: Switching the watched directory resets all replay and intent state, and the complete v3.0 feature set is validated end-to-end
**Depends on**: Phase 17
**Requirements**: INFRA-04
**Success Criteria** (what must be TRUE):
  1. After switching the watch root, the timeline slider shows no prior snapshots and the intent panel shows no prior sessions — no data from the previous directory bleeds through
  2. After switching watch roots and generating new activity, fresh snapshots and intent sessions appear correctly for the new directory
  3. Writing files during replay (mode isolation test) produces no canvas mutation, confirming the guard holds after a watch-root switch
  4. A 4-hour simulated session stores less than 20MB in SQLite snapshots and scrubbing to any position completes in under 200ms
**Plans**: 2 plans
Plans:
- [ ] 18-01-PLAN.md -- SQLite purge for replay/intent tables on watch-root switch and replay-exit toast notification
- [ ] 18-02-PLAN.md -- Journey tests validating all 4 success criteria end-to-end

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
| 10. Risk Panel | v2.2 | 2/2 | Complete | 2026-03-16 |
| 11. Activity Feed | v2.2 | 1/1 | Complete | 2026-03-16 |
| 12. Edge Interaction and Component Glow | v2.2 | 2/2 | Complete | 2026-03-16 |
| 13. Watch Any Project | v2.2 | 2/2 | Complete | 2026-03-16 |
| 14. Schema Foundation and Shared Types | 2/2 | Complete   | 2026-03-17 | - |
| 15. Server Replay Layer | 3/3 | Complete    | 2026-03-17 | - |
| 16. Client State Layer and Mode Isolation | 3/3 | Complete    | 2026-03-17 | - |
| 17. Timeline Slider and Intent Panel UI | 5/5 | Complete    | 2026-03-17 | - |
| 18. Watch-Root Integration and End-to-End Validation | 1/2 | In Progress|  | - |
