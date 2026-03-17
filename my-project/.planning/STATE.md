# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** v3.0 Architecture Intelligence — Phase 17: Timeline Slider and Intent Panel UI

## Current Position

Phase: 17 of 18 (Timeline Slider and Intent Panel UI)
Plan: 5 of 6 completed in current phase
Status: In Progress
Last activity: 2026-03-17 — Plan 17-05 (PlaybackController auto-play, keyboard shortcuts, diff overlay) complete

Progress: [█████████░] 85% (v3.0: Phase 17 in progress, 5/6 plans done)

## Performance Metrics

**Velocity (reference from prior milestones):**
- Total plans completed: 32 (v1.0: 21, v2.0: 2, v2.1: 2, v2.2: 7)
- v2.2 average: ~3.5 min/plan (most recent baseline)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
See milestone archives for prior phase decisions.

Key v3.0 decisions (pre-planning):
- [Research]: Mode state machine must be Phase 16 — first piece of replay infra; P1 pitfall
- [Research]: Delta-threshold snapshotting (every 5 deltas or structural change), NOT wall-clock
- [Research]: Event-count axis on timeline slider (not wall-clock) to avoid dead zones
- [Research]: 4-6 coarse intent categories only; "Uncertain" is a valid first-class output
- [Research]: zundo@^2.3.0 required for Zustand v5 compatibility
- [Phase 14]: No FK references on startSnapshotId/endSnapshotId in intent_sessions — foreign_keys=OFF in connection.ts; plain integers instead
- [Phase 14]: getMetaBySession excludes graphJson column — avoids loading large JSON blobs when listing snapshots for timeline browsing
- [Phase 14]: GraphDelta.addedNodes is string[] (file path IDs directly) — plan spec said "their id field" but strings ARE the IDs; no .id accessor needed in SnapshotManager
- [Phase 14]: DependencyGraph.getSnapshot() returns {nodes, edges} only — positions field in graphJson snapshot set to {} as placeholder for Phase 6 layout persistence
- [Phase 14]: GraphDelta.addedNodes is string[] (file path IDs directly) — plan spec said 'their id field' but strings ARE the IDs; adapted trigger file collection in SnapshotManager
- [Phase 14]: DependencyGraph.getSnapshot() returns {nodes, edges} only — positions field in SnapshotManager graphJson set to {} as placeholder reserved for Phase 6 layout persistence
- [Phase 15-01]: IntentCategory updated to 6 user-specified categories — DEPENDENCY_UPDATE replaces INFRASTRUCTURE, CLEANUP replaces UNCERTAIN; backward-compatible (SQLite category column is plain text)
- [Phase 15-01]: snapshotCheckpoints uses logical FK (no .references()) — consistent with intentSessions.startSnapshotId pattern; FK enforcement OFF in connection.ts
- [Phase 15-01]: deleteOldestNonCheckpoint guards notInArray with cpIds.length > 0 to prevent invalid NOT IN () SQL
- [Phase 15-02]: IntentAnalyzer re-broadcasts intent_updated only when confidence changes by >0.05 — prevents flooding during steady-state activity
- [Phase 15-02]: Activity gap 90s threshold is implemented as the starting estimate; can be tuned in Phase 16+ based on real timing patterns
- [Phase 15-03]: timelinePlugin uses getSessionId closure over snapshotManager — after switchWatchRoot replaces snapshotManager, closure returns new session ID automatically without plugin re-registration
- [Phase 15-03]: IntentAnalyzer destroyed at step 2c in switchWatchRoot (before graph reset) — ensures closeSession records endSnapshotId from correct session before SQLite tables are purged
- [Phase 14.1-01]: root build script runs pnpm build:workers && tsc -b packages/shared packages/server packages/client — workers must compile before tsc -b
- [Phase 14.1-01]: client tsconfig Option A (modify existing) — remove noEmit: true, add composite: true + outDir: dist; Vite ignores these options so dev workflow unaffected
- [Phase 14.1-01]: tsconfig.workers.json must override composite: false to prevent TS6304 when extending tsconfig.json that has composite: true
- [Phase 14.1-01]: Playwright webServer reuseExistingServer: true — safe for local dev and CI environments
- [Phase 14.2-fix-journey-phase-14-schema-foundation-and-shared-types-completes-successfully]: diagnosticPlugin uses direct Drizzle calls — no repository abstraction needed for test-only diagnostic endpoints
- [Phase 14.2-fix-journey-phase-14-schema-foundation-and-shared-types-completes-successfully]: Journey tests use page.request against SERVER_URL (port 3100) — explicit constant prevents Vite port 5173 confusion
- [Phase 14.3]: Standalone package.json in .auto-gsd/journey-tests/ with @playwright/test isolates Playwright from root pnpm workspace and auto-gsd regeneration
- [Phase 14.3]: webServer.timeout=120s and build timeout=180s are locked overrides — accommodate TypeScript compilation cold start and slower machines
- [Phase 15.1]: IntentCategory validCategories in journey-phase-15.spec.ts must use lowercase snake_case (feature_building etc.) matching enum values — uppercase FEATURE_BUILDING caused test failure when sessions table had data
- [Phase 15.2]: journey-phase-14.spec.ts rewritten fresh per CONTEXT.md — HEAD version had placeholder body-length checks; real diagnostic endpoint assertions required
- [Phase 15.2]: NODE_ENV=development added to playwright.config.ts webServer.env — ensures diagnostic endpoints (/api/debug/*) are available during test runs
- [Phase 15.2]: Delta-threshold test uses FILE_COUNT=18 and fixed 5s wait — files written before POST /api/watch so burst scan triggers threshold
- [Phase 15.3]: workers:1 in playwright.config.ts — tests sharing server state via POST /api/watch cannot run in parallel; watch root is global mutable server state
- [Phase 15.3]: Node IDs are relative paths ('a.ts') not absolute paths — Pipeline.handleBatch passes event.relativePath to parser, not absolute path
- [Phase 15.4]: No regression prevention mechanism added — accept the auto-GSD overwrite pattern and follow the same restore-from-HEAD playbook each time
- [Phase 15.4]: Restore playbook confirmed: git -C .. checkout HEAD -- my-project/<path> handles both staged and unstaged changes simultaneously
- [Phase 15.5]: Restore-from-HEAD playbook confirmed as standard mitigation for auto-gsd journey test overwrites (4th occurrence); OttoGSD journey-test-generator.ts root cause documented; no prevention mechanism added as it requires OttoGSD binary changes
- [Phase 15.6]: journey-canary.spec.ts added as overwrite detector — scans all sibling specs for bodyText.length and page.goto-without-SERVER_URL patterns; canary itself will be overwritten by auto-gsd (it is journey-*.spec.ts) but makes next overwrite immediately visible as test failure
- [Phase 15.6]: journey-build-and-start.spec.ts exempted from page.goto-without-API check in canary — it legitimately uses BASE_URL browser navigation, not SERVER_URL API calls
- [Phase 16-01]: replayStore is a separate Zustand slice (not merged into graphStore) — mode state is a different concern; avoids coupling with live graph state
- [Phase 16-01]: bufferedEventCount is a dedicated primitive counter (not array.length) — prevents React selector re-render on every buffer push; Zustand equality check on primitives is efficient
- [Phase 16-01]: exitReplay() deliberately preserves buffers — caller reads bufferedGraphDeltas/bufferedInferenceMessages before calling exitReplay, then calls clearBuffer() after draining (Plan 02 implements drain logic)
- [Phase 16-01]: initial_state during replay applies silently to graphStore (for exit-replay accuracy) without scanning/summary side effects — ArchCanvas guard to skip visual updates added in Plan 03
- [Phase 16-01]: Buffer cap at 500 entries with bufferOverflowed flag — overflow triggers snapshot fetch path on exit instead of buffer drain
- [Phase 16-02]: handleExitReplay uses bufferOverflowed || bufferedGraphDeltas.length >= 50 threshold — below 50 entries, sequential delta apply is accurate; above, fresh /api/snapshot fetch guarantees correctness
- [Phase 16-02]: insertReplaySeparator inserts separator BEFORE draining inference messages — separator visually separates historical events from live catch-up events in correct chronological order
- [Phase 16-02]: ReplayBanner receives onExitReplay as prop (not calling exitReplay directly) — async exit orchestration (fetch, drain, clearBuffer) belongs to App.tsx coordinator
- [Phase 16-02]: Selected node check happens AFTER graphStore restore — ensures nodes.has(selectedNodeId) reflects live graph state, not stale replay graph
- [Phase 16-03]: NodeRenderer.createShape is private — historical-only nodes added via syncAll with merged Map (live + historical-only), reconciled back on exit via syncAll(liveNodes)
- [Phase 16-03]: Blue replay tint via shadow glow (shadowColor #64a0ff, shadowBlur 8, shadowOpacity 0.5) — preserves zone colors while adding blue overlay; original shadow settings stored as JSON in tintedFills Map for exact restoration
- [Phase 16-03]: ArchCanvas Stage wrapped in relative-positioned div to allow absolute overlay positioning for empty graph message
- [Phase 17-01]: intentStore focus-shift detection checks category change — archives old session to history before replacing active session on applyIntentUpdated
- [Phase 17-01]: replayStore.snapshots persists across replay sessions (cleared only on watch_root_changed) — playbackSpeed also persists as user preference
- [Phase 17-01]: appendSnapshot called even during replay — live edge must grow regardless of replay state
- [Phase 17]: [Phase 17-04]: ActivityFeed epoch-context header embeds count in title text during replay — no separate badge; item count badge hidden in replay mode, shown only in live mode
- [Phase 17-02]: IntentPanel derives subtasks client-side from activityFeed iconColor map — no server API needed; iconColor encodes event category
- [Phase 17-02]: History sub-section starts collapsed (historyCollapsed=true) — reduces visual noise on load
- [Phase 17]: detectEpochs uses prev.endedAt ?? curr.startedAt for focus-shift transition timestamp — handles both closed and ongoing session boundaries
- [Phase 17]: TimelineBar drag thumb uses visual-only fraction update (no fetch during drag); single loadSnapshotAndEnterReplay call on pointerUp — prevents HTTP request flood
- [Phase 17]: App.tsx inner column flex layout: canvas+sidebar row needs minHeight:0 so timeline 60px bar fits within 100vh without overflow
- [Phase 17-05]: PlaybackController uses BASE_INTERVAL_MS/speed for interval — 1000ms at 1x, 500ms at 2x, 250ms at 4x; pure class with no React deps
- [Phase 17-05]: cancelAllTweens uses module-level activeTweens Set registered in morphNodesToPositions — simplest reliable approach without Konva internals
- [Phase 17-05]: applyDiffTint stores original shadow AND group opacity in same OriginalShadowSettings — restoreDiffTint must restore both (removed nodes have opacity 0.4)
- [Phase 17-05]: Diff overlay subscription: async IIFE inside replayStore.subscribe for diffBaseSnapshotId changes — avoids refactoring existing subscribe block structure

### Pending Todos

None.

### Roadmap Evolution

- Phase 14.1 inserted after Phase 14: Fix Journey Build and Start completes successfully (blocker) (URGENT)
- Phase 14.2 inserted after Phase 14: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (URGENT)
- Phase 15.1 inserted after Phase 15: Fix Journey Build and Start completes successfully (blocker) (URGENT)
- Phase 15.2 inserted after Phase 15: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (URGENT)
- Phase 15.3 inserted after Phase 15: Fix: Journey Phase 15: Server Replay Layer completes successfully (major) (URGENT)
- Phase 14.3 inserted after Phase 14: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (major) (URGENT)
- Phase 15.4 inserted after Phase 15: Fix: Journey Build and Start completes successfully (blocker) (URGENT)
- Phase 15.5 inserted after Phase 15: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (URGENT)
- Phase 15.6 inserted after Phase 15: Fix: Journey Phase 15: Server Replay Layer completes successfully (major) (URGENT)

### Blockers/Concerns

- [Phase 17]: Konva auto-play frame budget needs measurement at 200+ nodes before building speed levels

## Session Continuity

**Last session:** 2026-03-17T10:29:34.887Z
**Stopped at:** Phase 18 context gathered
**Resume file:** .planning/phases/18-watch-root-integration-and-end-to-end-validation/18-CONTEXT.md
