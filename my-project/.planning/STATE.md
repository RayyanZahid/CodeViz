# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** v3.0 Architecture Intelligence — Phase 14: Schema Foundation and Shared Types

## Current Position

Phase: 14 of 18 (Schema Foundation and Shared Types)
Plan: 1 of 2 completed in current phase
Status: In Progress
Last activity: 2026-03-17 — Plan 14-01 (Schema Foundation and Shared Types) complete

Progress: [██░░░░░░░░] 10% (v3.0: Phase 14 in progress, 1/2 plans done)

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

### Pending Todos

None.

### Blockers/Concerns

- [Phase 15]: IntentAnalyzer 90-second activity-gap threshold is a starting estimate — inspect actual changeEvents timing patterns before committing to implementation
- [Phase 17]: Konva auto-play frame budget needs measurement at 200+ nodes before building speed levels

## Session Continuity

**Last session:** 2026-03-17T00:17:19.258Z
**Stopped at:** Completed 14-schema-foundation-and-shared-types/14-01-PLAN.md
**Resume file:** None
