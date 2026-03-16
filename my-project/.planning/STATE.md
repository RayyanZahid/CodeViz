# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.
**Current focus:** Phase 7 — React UI Shell and Activity Feed

## Current Position

**Phase:** 7 of 7 (React UI Shell and Activity Feed)
**Current Plan:** Not started
**Total Plans in Phase:** 3
**Status:** Milestone complete
**Last Activity:** 2026-03-16

Progress: [████████░░] 79%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4min
- Total execution time: 8min

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 1 P1 | 4min | 2 tasks | 18 files |
| Phase 02 P01 | 4min | 2 tasks | 7 files |

**Recent Trend:**
- Last 5 plans: 4min
- Trend: —

*Updated after each plan completion*
| Phase 1 P1 | 4min | 2 tasks | 18 files |
| Phase 01-foundation P02 | 4min | 2 tasks | 7 files |
| Phase 01-foundation P03 | 2min | 1 tasks | 3 files |
| Phase 02-file-watching P01 | 4min | 2 tasks | 7 files |
| Phase 02 P02 | 4min | 2 tasks | 7 files |
| Phase 02-file-watching-and-parsing-pipeline P03 | 4min | 2 tasks | 3 files |
| Phase 03-dependency-graph-model P01 | 6min | 2 tasks | 4 files |
| Phase 03-dependency-graph-model P02 | 3min | 2 tasks | 3 files |
| Phase 04 P01 | 2min | 2 tasks | 4 files |
| Phase 04 P02 | 2min | 2 tasks | 2 files |
| Phase 04-architectural-inference-engine P03 | 2min | 2 tasks | 2 files |
| Phase 04-architectural-inference-engine P04 | 2min | 2 tasks | 2 files |
| Phase 05-websocket-streaming-and-client-state P01 | 15 | 2 tasks | 7 files |
| Phase 05-websocket-streaming-and-client-state P02 | 3 | 2 tasks | 7 files |
| Phase 06-canvas-renderer-and-layout-engine P01 | 3 | 2 tasks | 9 files |
| Phase 06-canvas-renderer-and-layout-engine P02 | 2 | 2 tasks | 4 files |
| Phase 06-canvas-renderer-and-layout-engine P03 | 2 | 1 tasks | 4 files |
| Phase 06-canvas-renderer-and-layout-engine P04 | 5 | 2 tasks | 6 files |
| Phase 07-react-ui-shell-and-activity-feed P01 | 2 | 2 tasks | 4 files |
| Phase Phase 07-react-ui-shell-and-activity-feed PP02 | 2 | 2 tasks | 2 files |
| Phase 07-react-ui-shell-and-activity-feed P03 | 3 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- All phases: Agent-agnostic via file watchers (chokidar v5) — no AI agent integrations required
- All phases: Canvas/WebGL rendering via Konva — DOM/SVG rejected for performance at 200+ nodes
- Phase 1: SQLite with WAL mode + Drizzle ORM — sync API correct for write-heavy event logging
- Phase 2: tree-sitter incremental parsing in worker threads — only parser meeting 1-2s latency target
- Phase 6: Sticky node coordinates from first render — layout instability is a full rewrite to fix retroactively
- Phase 1 Plan 01: pnpm 10 requires onlyBuiltDependencies field to permit native build scripts (better-sqlite3, esbuild)
- Phase 1 Plan 01: Shared types use const objects + derived types (not enums) for string values and discriminated unions
- Phase 1 Plan 01: Live types pattern — shared package exports raw .ts source, no compilation in dev
- [Phase 1]: pnpm 10 requires onlyBuiltDependencies in package.json to allow native build scripts (better-sqlite3, esbuild)
- [Phase 1]: Shared types use const objects plus derived type aliases (not enums) for string values compatible with discriminated unions
- [Phase 1]: Live types pattern: shared package exports raw .ts source via exports field — no compilation step needed in dev
- [Phase 01-foundation]: WAL pragma set in connection.ts persists across database reconnects — drizzle-kit push creates DB without WAL, connection.ts sets it durably on first open
- [Phase 01-foundation]: Repository pattern: plain objects with synchronous methods, one file per entity, single shared db instance from connection.ts
- [Phase 01-foundation]: Append-only semantics for changeEvents enforced structurally — eventsRepository exposes no update/delete methods
- [Phase Phase 01-foundation Plan 03]: Health plugin uses plain FastifyPluginAsync (no fastify-plugin wrapper) — route-only plugins stay encapsulated in Fastify v5
- [Phase Phase 01-foundation Plan 03]: DB connection imported eagerly in index.ts to trigger WAL pragma setup at server startup before any request handling
- [Phase 02 Plan 01]: tree-sitter pinned to 0.21.1 — v0.25.0 fails native compilation on Node 24/Windows (C++17/C++20 MSVC conflict); v0.21.1 ships prebuilt binaries
- [Phase 02 Plan 01]: @archlens/shared/types is the correct import subpath — shared package.json only exports ./types subpath, not package root
- [Phase 02 Plan 01]: chokidar ignoreInitial: false — emit 'add' for existing files on startup to enable initial directory scan
- [Phase 02]: Named { Piscina } import used instead of default import — under NodeNext resolution, default import of piscina resolves to the module object from esm-wrapper.mjs, not the class; named export works correctly
- [Phase 02]: Pass-oldTree incremental parsing strategy (no tree.edit()): file watcher provides full file contents, making byte-offset computation unnecessary; parser.parse(source, oldTree) achieves incremental subtree reuse
- [Phase 02]: childForFieldName() used for Python call callee extraction — fieldName property not on SyntaxNode in tree-sitter@0.21.1
- [Phase 02]: Pipeline async error boundary: handleBatch wrapped in .catch() at watcher callback level — unhandled rejections log to console.error without crashing the pipeline
- [Phase 03-dependency-graph-model]: File path as node ID (project-relative, forward slashes) — natural key from pipeline output
- [Phase 03-dependency-graph-model]: 50ms debounce consolidation window for rapid batch accumulation before delta computation
- [Phase 03-dependency-graph-model]: Cycle severity thresholds: HIGH >= 10 in-degree sum, MEDIUM >= 4, LOW < 4 (in-degree as centrality proxy)
- [Phase 03-dependency-graph-model]: External/builtin imports map to __ext__/specifier stub nodes — monorepo workspace imports deferred to Phase 4+
- [Phase 03-dependency-graph-model]: onDeltaComputed protected hook: no-op base, Plan 02 persistence layer overrides without coupling DependencyGraph to SQLite
- [Phase 03-dependency-graph-model]: External stub nodes excluded from SQLite persistence — __ext__/ prefixed nodes have no FK rows, persisting them has no Phase 3 value
- [Phase 03-dependency-graph-model]: Direct onDeltaComputed override in DependencyGraph (not subclass) — persistence is a core graph concern, subclass indirection eliminated
- [Phase 03-dependency-graph-model]: activeCycles rebuilt after loadFromDatabase via alg.findCycles() — ensures correct cycle diffs on first post-startup delta
- [Phase 04-architectural-inference-engine]: Phase 4 shared types use const-object + derived type pattern (ZoneName, ArchitecturalEventType, RiskType, RiskSeverity) consistent with CycleSeverity and ChangeEventType
- [Phase 04-architectural-inference-engine]: DependencyGraph exposes 6 minimal public topology accessors (getPredecessors, getSuccessors, getOutDegree, getInDegree, getOutEdges, getAllNodeIds) keeping graphlib private while enabling inference engine queries
- [Phase 04-02]: classifyDelta two-pass design: zoneCache updated immediately after each node in Pass 1 prevents stale-zone issues during burst delta processing
- [Phase 04-02]: classifyByTopology filters __ext__/ nodes — external stubs have no signal for internal node zone inference
- [Phase 04-02]: ConfigLoader uses persistent:false chokidar watcher — pipeline file watcher owns process lifecycle, config watcher must not extend it
- [Phase 04-architectural-inference-engine]: EventCorroborator THRESHOLD=2 locked: binary pass/fail, no confidence scores — single file edit can never trigger an event
- [Phase 04-architectural-inference-engine]: RiskDetector ZONE_LAYER_ORDER has exactly 4 entries (frontend/api/services/data-stores) — infrastructure and external excluded by design
- [Phase 04-architectural-inference-engine]: Fan-out counts only internal edges (non-__ext__/ targets) — external stubs inflate out-degree and cause false positives on server entry points
- [Phase 04-04]: InferenceEngine subscribes to graph.on('delta') in constructor before pipeline.start() ensuring every delta is processed
- [Phase 04-04]: processDelta is synchronous - O(edges) operations with no async needed matching DependencyGraph pattern
- [Phase 04-04]: Zone SQLite writes are fire-and-forget - no transaction coupling with Phase 3 delta persistence; zone column is nullable so missed write is recoverable
- [Phase 04-04]: getZoneForNode() delegates to classifier.classify() for full override>path>topology chain rather than reading zoneCache directly
- [Phase 05-websocket-streaming-and-client-state]: Module-level Set<WebSocket> with single graph.on('delta') and inferenceEngine.on('inference') subscriptions at plugin registration time prevents O(N^2) listener leak
- [Phase 05-websocket-streaming-and-client-state]: Internal GraphDeltaEdge {v,w,symbols} mapped to wire GraphEdge {id,sourceId,targetId,edgeType} at plugin broadcast boundary; __ext__/ stubs filtered at both snapshot and delta boundaries
- [Phase 05-02]: Zod schema uses z.string() for NodeType/EdgeType fields to tolerate future enum additions without breaking client validation
- [Phase 05-02]: Type cast (as unknown as InitialStateMessage/GraphDeltaMessage) at WsClient call sites bridges relaxed Zod output to strict shared types
- [Phase 05-02]: lastQueuedVersion (not store version) used for version gap detection — batch window may advance lastQueuedVersion ahead of applied store state
- [Phase 06-canvas-renderer-and-layout-engine]: konva pinned to 10.2.1 (10.2.2 not published); quadtree-js pinned to 1.2.6 (2.2.0 not published)
- [Phase 06-canvas-renderer-and-layout-engine]: No StrictMode wrapper in main.tsx — avoids Konva double-mount breaking imperative graphStore.subscribe() calls
- [Phase 06-canvas-renderer-and-layout-engine]: Animation layer listening=false, graph layer listening=true — glow overlays skip hit detection; node click events preserved
- [Phase 06-canvas-renderer-and-layout-engine]: CullingIndex.setEdges() decouples edge data from EdgeRenderer — CullingIndex stores its own edge map for visibility computation
- [Phase 06-canvas-renderer-and-layout-engine]: EdgeRenderer stores sourceId/targetId as Konva custom attributes on each Arrow for updatePositions() without external data
- [Phase 06-canvas-renderer-and-layout-engine]: @types/d3-force installed — d3-force 3.0.0 ships no TypeScript declarations
- [Phase 06-canvas-renderer-and-layout-engine]: d3-force-boundary type stub created locally — package has no .d.ts; default export pattern
- [Phase 06-canvas-renderer-and-layout-engine]: forceBoundary applied globally (canvas bounds) — per-zone boundary replaced by soft forceX/forceY + post-tick clamping
- [Phase 06-canvas-renderer-and-layout-engine]: Zone attr stored on Konva.Group (setAttr zone) in NodeRenderer — AnimationQueue.activateFromDelta reads glow color without graphStore access
- [Phase 06-canvas-renderer-and-layout-engine]: Forward-declared let viewport pattern breaks circular dependency between handleViewportChange closure and ViewportController constructor parameter
- [Phase 06-canvas-renderer-and-layout-engine]: TypeScript non-null const capture (const gl: Konva.Layer = graphLayerRaw) after guard eliminates TS18047 in nested closures
- [Phase 07-01]: toSentence takes nodeNameFn parameter (not graphStore import) to keep the function pure and testable
- [Phase 07-01]: iconColor pre-computed in applyInference and stored on ActivityItem — ActivityFeed component has zero business logic
- [Phase 07-01]: Activity feed batching: last item with same nodeId within 2s is replaced with "N events for ${name}" summary
- [Phase 07-01]: inferenceStore vanilla reference is export const inferenceStore = useInferenceStore (mirrors graphStore pattern)
- [Phase 07-01]: Activity feed caps at 50 items via slice(0, 50) after prepend
- [Phase 07-01]: Risk deduplication via fingerprint — type+affectedNodeIds(sorted) or type+nodeId fallback
- [Phase Phase 07-02]: NodeInspector accepts selectedNodeId prop (not reads from store) — parent owns selection state
- [Phase Phase 07-02]: InspectorContent is a separate sub-component so hooks called unconditionally — avoids conditional hook calls in NodeInspector
- [Phase Phase 07-02]: stopPropagation on Mark reviewed button — prevents row highlight callback from firing simultaneously
- [Phase Phase 07-02]: ReviewedCounter has own local showReviewed state — toggling reviewed section is independent from panel-level collapse
- [Phase 07-03]: handleHighlightNode calls canvasRef.current.selectNodeOnCanvas() which internally fires handleSelectNodeRef.current(nodeId) — no separate setSelectedNodeId call needed to avoid redundant state update
- [Phase 07-03]: Navigation controls, selected-node indicator, and MinimapStage changed from position:fixed to position:absolute within canvas wrapper div — prevents overlap with 280px sidebar

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: tree-sitter worker thread serialization pattern needs verification — parse trees cannot be transferred via structured clone, only plain-object extracted results
- Phase 2: tree-sitter grammar peer dependency mismatch (0.23.x grammar packages want tree-sitter@^0.21, 0.25.x want tree-sitter@^0.25) — verify grammar initialization works in Plan 02
- Phase 4: Inference confidence thresholds require calibration against real agent sessions — plan for a calibration period after Phase 4 is functional
- Phase 6: Verify whether @dagrejs/dagre is used for initial layout only or replaced entirely by zone-constrained force simulation (affects Phase 6 scope)
- RESOLVED: Vite 8 (Rolldown-based) stability verified — used successfully in Phase 1 Plan 01

## Session Continuity

**Last session:** 2026-03-16T04:17:24.764Z
**Stopped at:** Completed 07-03-PLAN.md (App sidebar layout, cross-panel navigation, panToNode)
**Resume file:** None
