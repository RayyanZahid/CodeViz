# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** v3.0 Architecture Intelligence — Phase 15: Server Replay Layer

## Current Position

Phase: 15.2 of 18 (Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully)
Plan: 1 of 1 completed in current phase
Status: Phase Complete
Last activity: 2026-03-17 — Plan 15.2-01 (rewrite journey-phase-14.spec.ts with real diagnostic assertions, restore 3 infra files, add NODE_ENV=development) complete

Progress: [████░░░░░░] 19% (v3.0: Phase 15.2 complete, 1/1 plans done)

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

**Last session:** 2026-03-17T04:31:20Z
**Stopped at:** Completed 15.2-01-PLAN.md
**Resume file:** .planning/phases/15.2-fix-journey-phase-14-schema-foundation-and-shared-types-completes-successfully/15.2-01-SUMMARY.md
