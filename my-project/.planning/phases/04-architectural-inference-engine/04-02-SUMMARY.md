---
phase: 04-architectural-inference-engine
plan: 02
subsystem: inference
tags: [typescript, zone-classification, path-patterns, micromatch, chokidar, config-override]

# Dependency graph
requires:
  - phase: 04-architectural-inference-engine
    provides: ZoneName type, ZoneUpdate interface, DependencyGraph topology accessors (getPredecessors/getSuccessors), micromatch installed
  - phase: 03-dependency-graph-model
    provides: DependencyGraph class with GraphDelta, graphlib internal state
provides:
  - ConfigLoader class loading .archlens.json with zone overrides, exact path + glob match via micromatch, live chokidar watching
  - ZoneClassifier class with path-first/topology-second classification, two-pass delta processing, unknown re-evaluation, in-memory zone cache
  - ZONE_PATH_PATTERNS exported array covering all 6 semantic zones
affects:
  - 04-03
  - 04-04
  - 05-websocket

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Path-first classification with topology fallback — override > path > topology priority chain
    - Two-pass delta processing — Pass 1 classifies added/modified nodes, Pass 2 re-evaluates unknown neighbors
    - In-memory zone cache (Map<string, ZoneName>) as single source of truth during delta processing (not SQLite)
    - Majority-vote topology classification — count non-unknown neighbor zones from cache, return zone with highest count
    - Graceful config degradation — missing or invalid .archlens.json produces empty config, not an error

key-files:
  created:
    - packages/server/src/inference/ConfigLoader.ts
    - packages/server/src/inference/ZoneClassifier.ts
  modified: []

key-decisions:
  - "classifyDelta two-pass design: Pass 1 updates zoneCache immediately after each node classification so subsequent topology lookups within the same pass see fresh data, preventing stale-zone Pitfall 4"
  - "classifyByTopology filters out __ext__/ nodes — external stubs provide no informational signal for internal node zone inference"
  - "ConfigLoader uses persistent:false chokidar watcher — the pipeline's file watcher owns process lifecycle, config watcher must not extend it"
  - "Exact match before glob in getOverride() — exact match is O(1) and covers the most common override case without running micromatch"

patterns-established:
  - "Pattern: ZoneClassifier.updateZoneCache() for InferenceEngine to seed zone state from SQLite on startup before first delta"
  - "Pattern: ConfigLoader constructor calls loadConfig() synchronously — first classify() has overrides without async initialization"
  - "Pattern: ZONE_PATH_PATTERNS as exported const for testability and extensibility by Plans 03/04"

requirements-completed: [ARCH-01, ARCH-02, ARCH-06]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 4 Plan 02: Zone Classification System Summary

**ZoneClassifier with path-first/topology-second two-pass delta classification across 6 semantic zones, plus ConfigLoader with .archlens.json override support via micromatch glob matching and chokidar live reloading**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T00:36:45Z
- **Completed:** 2026-03-16T00:38:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created ConfigLoader with synchronous initial load, micromatch-based exact+glob override matching, and chokidar live reloading for .archlens.json
- Created ZoneClassifier implementing the override > path > topology priority chain with ZONE_PATH_PATTERNS covering all 6 zones
- Implemented two-pass classifyDelta: Pass 1 classifies added/modified nodes (updating zoneCache immediately), Pass 2 re-evaluates unknown-zone nodes whose neighbors became classified in Pass 1
- Topology classifier uses majority-vote over in-memory zoneCache (not SQLite) and excludes external __ext__/ stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement ConfigLoader for .archlens.json zone overrides** - `9f48264` (feat)
2. **Task 2: Implement ZoneClassifier with path-first, topology-second classification** - `fab3f20` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `packages/server/src/inference/ConfigLoader.ts` - Loads .archlens.json from watchRoot, getOverride() with exact+glob match, destroy() for graceful shutdown
- `packages/server/src/inference/ZoneClassifier.ts` - ZONE_PATH_PATTERNS (6 zones), classify() override>path>topology chain, classifyDelta() two-pass, updateZoneCache() for startup seeding

## Decisions Made
- Two-pass delta design: zoneCache updated immediately after each node in Pass 1 so topology lookups see fresh data within the same delta processing run. This prevents stale-zone issues described as Pitfall 4 in RESEARCH.md.
- classifyByTopology excludes __ext__/ nodes — external stubs are already classified as 'external' by path patterns and carry no signal about the zone of the internal node being classified.
- ConfigLoader uses `persistent: false` with chokidar to avoid extending the process lifetime — the pipeline's file watcher owns lifecycle management.
- Exact path match before glob iteration in getOverride() — exact match is an O(1) hasOwnProperty check, covers the most common override case, and avoids running micromatch on every lookup unnecessarily.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - typecheck passed on first run for both tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ConfigLoader is ready for injection into ZoneClassifier in Plans 03/04
- ZoneClassifier.classifyDelta() is the entry point InferenceEngine will call in Plan 04
- updateZoneCache() is ready for InferenceEngine's startup SQLite seeding
- ZONE_PATH_PATTERNS is exported and testable for Plans 03/04 unit tests
- Zero typecheck errors — clean foundation for remaining Phase 4 plans

---
*Phase: 04-architectural-inference-engine*
*Completed: 2026-03-16*

## Self-Check: PASSED

- packages/server/src/inference/ConfigLoader.ts: FOUND
- packages/server/src/inference/ZoneClassifier.ts: FOUND
- Commit 9f48264 (Task 1): FOUND
- Commit fab3f20 (Task 2): FOUND
