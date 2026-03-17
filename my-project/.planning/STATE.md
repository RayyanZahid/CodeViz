# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** v3.0 Architecture Intelligence — Phase 15: Server Replay Layer

## Current Position

Phase: 15 of 18 (Server Replay Layer)
Plan: 1 of 3 completed in current phase
Status: In Progress
Last activity: 2026-03-17 — Plan 15-01 (Checkpoint schema, repository layer, type alignment) complete

Progress: [████░░░░░░] 14% (v3.0: Phase 15 in progress, 1/3 plans done)

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

### Pending Todos

None.

### Roadmap Evolution

- Phase 14.1 inserted after Phase 14: Fix Journey Build and Start completes successfully (blocker) (URGENT)
- Phase 14.2 inserted after Phase 14: Fix Journey Phase 14 Schema Foundation and Shared Types completes successfully (URGENT)

### Blockers/Concerns

- [Phase 15]: IntentAnalyzer 90-second activity-gap threshold is a starting estimate — inspect actual changeEvents timing patterns before committing to implementation
- [Phase 17]: Konva auto-play frame budget needs measurement at 200+ nodes before building speed levels

## Session Continuity

**Last session:** 2026-03-17T01:00:50Z
**Stopped at:** Completed 15-01-PLAN.md (Checkpoint schema, repository layer, type alignment)
**Resume file:** .planning/phases/15-server-replay-layer/15-02-PLAN.md
