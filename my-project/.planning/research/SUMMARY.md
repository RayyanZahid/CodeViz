# Project Research Summary

**Project:** ArchLens — Real-Time Architecture Visualization for AI Coding Agents
**Domain:** Real-time code analysis, incremental parsing, dependency graph visualization, AI agent supervision tooling
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

ArchLens occupies a genuinely novel niche: it is not a static diagram tool or a post-hoc code analysis tool, but a live architectural dashboard designed for developers supervising AI coding agents. The core value is "glance at the screen and understand what the agent is building right now" — without reading code. Research confirms no existing tool (CodeScene, Sourcetrail, dependency-cruiser, AppMap) serves this use case: all surveyed tools are either retrospective, batch-processed, IDE-bound, or lack real-time streaming. The recommended approach is a local web app with a Node.js backend pipeline feeding a browser-based Canvas renderer over WebSocket, with incremental parsing using tree-sitter as the performance-critical foundation.

The recommended technical approach centers on five non-negotiable choices: (1) tree-sitter for incremental AST parsing — the only parser that avoids full re-parse on every file change and can meet the 1-2 second latency target at 500-5000 file scale; (2) Konva + react-konva for Canvas-based rendering — DOM/SVG renderers fail above ~200 nodes with real-time animation; (3) semantic zone layout with sticky node coordinates — full force-directed resimulation destroys the user's mental map and is the most common failure mode in graph visualization tools; (4) delta-only WebSocket push — full graph snapshots on every update are unacceptable for both latency and bandwidth; and (5) SQLite with an append-only event log — enables both persistence and the time-travel replay feature.

The primary risks are architectural rather than technology-selection risks. The three critical failure modes are: (1) layout instability from naive force-directed relayout — must be avoided from the first rendered node, retrofitting is a rewrite; (2) file watcher event storms causing parse cascades during AI agent burst writes — requires debounce/batch architecture before first line of watcher code; and (3) architectural inference noise producing a spammy activity feed that users learn to ignore — requires multi-signal corroboration thresholds and a confidence scoring system. These are all design decisions that cannot be deferred to a later phase.

---

## Key Findings

### Recommended Stack

The full stack is Node.js 22 LTS + TypeScript 5 on both backend and frontend, sharing types across the WebSocket boundary. The backend pipeline uses Fastify v5 with @fastify/websocket v11, chokidar v5 for file watching (ESM-only, Node 20+ required), tree-sitter 0.25.x with native Node.js bindings for incremental parsing, @dagrejs/graphlib 3.0.x for the in-memory graph model, @dagrejs/dagre 2.0.x for layout, and better-sqlite3 12.8.x with Drizzle ORM 0.40.x for persistence. The frontend uses React 19, Vite 8, Konva 10.2.x + react-konva 19.2.x for Canvas rendering, and Zustand v5 for state management. Key version constraint: react-konva version must mirror React major version (19.x requires React 19).

**Core technologies:**
- **tree-sitter 0.25.x (native Node.js binding):** Incremental AST parsing — the only parser with `tree.edit()` incremental API; avoids full file re-parse on every change; critical for sub-2s latency target at scale
- **Konva 10.2.x + react-konva 19.2.x:** HTML5 Canvas rendering with built-in hit detection, layer system for animation isolation, handles 20,000+ interactive nodes — required because DOM/SVG renderers fail at animation-heavy interactive graphs past ~200 nodes
- **@dagrejs/graphlib 3.0.x + @dagrejs/dagre 2.0.x:** In-memory directed multigraph with topological sort, cycle detection, serializable to JSON; layout engine supports incremental positioning with stable prior-node coordinates
- **Fastify v5 + @fastify/websocket v11:** 2-4x faster than Express; first-class TypeScript; route-scoped WebSocket handlers; local app does not need the complexity overhead of socket.io
- **better-sqlite3 12.8.x + Drizzle ORM 0.40.x:** Synchronous SQLite — the sync API is the correct fit for write-heavy event logging; append-only event table enables time-travel replay; no server process for local-only app
- **chokidar v5:** Cross-platform file watcher normalizing OS-specific events; handles atomic write patterns used by AI agents; requires ESM module project configuration
- **Zustand v5:** Minimal store (~3KB) with `useSyncExternalStore`; suited for graph state + UI state that syncs from WebSocket; avoids React Context re-render cascade on every 1-2 second update

**Critical version compatibility warnings:**
- `chokidar@5` requires Node 20+ and ESM-only project (`"type": "module"`)
- `@fastify/websocket@11` targets Fastify v5 only; do not use v9/v10
- `react-konva@19.2.x` requires `react@19.x` — version mismatch causes runtime failures
- tree-sitter grammar packages must be version-compatible with the core binding (ABI errors on mismatch)
- Vite 8 (Rolldown-based) is very recent; verify current release on project start

### Expected Features

ArchLens's differentiators cluster around three capabilities that no existing tool provides: (1) natural-language narration of architectural changes in real time, (2) semantic zone layout that gives instant spatial orientation, and (3) first-class AI agent supervision as the primary use case rather than an add-on. All table-stakes features from competing tools must also be present or the product feels broken.

**Must have (table stakes — v1 launch):**
- Dependency graph rendering derived from parsed code — the baseline expectation of any visualization tool
- Real-time live updates within 1-2 seconds — the entire value proposition; a static snapshot defeats the purpose
- Stable layout (no reshuffling on update) — a hard UX requirement; instability makes the tool unusable as a live display
- Zoom and pan navigation — universal expectation since 2018; Canvas/WebGL required for smooth performance
- Circular dependency detection — expected minimum correctness signal from any architecture tool
- Node click-to-inspect — drill-down is a standard interaction (Sourcetrail reference pattern)
- Multiple abstraction levels — flat file graphs don't scale mentally; architectural grouping is required
- Activity overlay (glow/pulse on active nodes) — highest-impact visual feature; tells developer exactly where agent is working
- Natural-language activity feed — core differentiator; validates the "without reading code" value claim
- Architectural event detection — backbone intelligence layer powering the activity feed and risk panel
- Risk heuristics panel (circular deps, boundary violations, fan-out) — safety net catching architectural mistakes in real time
- Persistent graph state — visualization must survive process restarts

**Should have (competitive differentiation):**
- Semantic zone layout (frontend left, API center, data right) — key UX innovation absent from all surveyed tools; provides instant orientation with no manual configuration
- Time-travel replay — graph state scrubbing across a session; Gource and CodeScene offer temporal views but not structured architectural replay
- Intent inference panel — higher-level summary of agent objectives inferred from change patterns (v1.x, after activity feed matures)
- Export (SVG/screenshot) — every surveyed tool offers this; useful for sharing with team

**Defer (v2+):**
- Go and Rust language support — tree-sitter grammars exist; add on user demand
- Multi-session architectural diff — time-travel establishes the foundation; comparison UI is a separate problem
- Plugin/extension API — internal event system must stabilize before exposing extension points
- Multi-user/collaboration — scope explosion for v1; single-user local app is the correct architecture

**Anti-features to explicitly reject:**
- Manual node drag-and-drop — conflicts with semantic zone layout; creates position override state management complexity
- IDE extensions — agent-agnostic file-watcher approach is more durable; no IDE lock-in
- AI-generated architectural suggestions — LLM calls add latency and cost; observation/awareness is the core value, not prescription
- Cloud deployment/SaaS — sensitive source code must not leave developer's machine; add only after explicit demand

### Architecture Approach

The system is a two-process local application: a Node.js backend running a sequential analysis pipeline (file watcher → debounce/batch → tree-sitter parser in worker threads → dependency graph builder → architectural inference engine → SQLite persistence → WebSocket server) communicating with a React browser frontend (WebSocket client → Zustand state store → Konva canvas renderer + React UI panels). The critical architectural insight is that the Canvas renderer must NOT go through React's render cycle — React manages the UI panels (activity feed, risk panel, inspector), while Konva/Pixi subscribes to the Zustand store imperatively. This separation is what enables 60fps rendering with real-time graph updates. All pipeline stages communicate through a typed internal event bus (Node.js EventEmitter), which decouples stages for independent testing and replacement.

**Major components:**
1. **File Watcher (chokidar v5 + ChangeQueue)** — detects filesystem changes, debounces 150-400ms, batches events within window, deduplicates same-file changes, emits single batch to parse scheduler
2. **Tree-sitter Parser (worker thread pool)** — incremental AST generation per changed file using `tree.edit()` API; parse cache with explicit `oldTree.delete()` lifecycle management; extracts imports/exports/calls; runs in worker threads to keep main event loop free for WebSocket I/O
3. **Dependency Graph Builder (graphlib + GraphDiff)** — maintains in-memory directed graph; computes delta (added/removed nodes and edges) from each parse result; write-through persistence to SQLite
4. **Architectural Inference Engine** — maps file-level dependencies to architectural concepts (zones, services, boundaries); detects architectural events with multi-signal corroboration; runs risk heuristics; infers agent intent from change patterns
5. **WebSocket Server (Fastify + @fastify/websocket)** — pushes only graph deltas (not full state) with version tags; handles reconnect by sending missed events since last client version
6. **SQLite Persistence (better-sqlite3 + Drizzle)** — append-only event log for time-travel replay; graph node/edge tables; layout position cache; periodic snapshots for fast replay bootstrap; WAL mode required
7. **Client State Store (Zustand v5)** — single source of truth on client; `applyDelta()` patches from WebSocket; separate subscriptions for canvas renderer (imperative) and React panels (declarative)
8. **Konva Canvas Renderer** — layer-separated architecture (static graph layer + animation overlay layer); viewport culling with spatial index; sticky zone-constrained layout with only new nodes free to move; 60fps target with mid-range hardware

**Key patterns to follow:**
- Pipeline with typed event bus decoupling (never direct function call chains between pipeline stages)
- Incremental parse cache with explicit tree lifecycle (never accumulate trees; call `oldTree.delete()` before replacement)
- Graph delta with version-tagged WebSocket push (never send full graph state on every change)
- Stable layout with zone-constrained placement (pin all existing nodes; only new nodes simulate; 50-tick limit)
- Event sourcing for time-travel (append-only event log + periodic snapshots; graph state always reconstructable)

### Critical Pitfalls

1. **Layout instability from force-directed resimulation** — Prevention: implement sticky node coordinates (pin `fx`/`fy`) from the first rendered node; only run simulation on new nodes constrained to their zone bounding box; never run global re-layout after initial placement. Recovery cost is HIGH (complete layout subsystem rewrite).

2. **File watcher event storms during AI agent burst writes** — Prevention: 150-400ms debounce window per file before triggering any parse; accumulate events within window into a single batch; parse deduplicated set of changed files once; emit one consolidated WebSocket message per batch. Must be in the architecture before the first line of watcher code.

3. **Tree-sitter memory leaks from undisposed syntax trees** — Prevention: call `oldTree.delete()` explicitly before replacing any cached tree; keep exactly one tree per file; test RSS growth over a 30-minute session against a 200+ file project. The Node.js GC does not manage native C heap allocations.

4. **Architectural inference noise (spammy activity feed)** — Prevention: require multiple corroborating signals before firing architectural events (e.g., new directory + entry point + 2+ files within 5 minutes); never infer architectural significance from a single file edit; implement confidence scoring (only promote inferences above 0.7); add 30-second suppression window before showing "component created" events.

5. **Canvas performance collapse at 200+ nodes with animation** — Prevention: viewport culling with quadtree spatial index from day one; two-layer canvas (static graph + animation overlay); stop the `requestAnimationFrame` loop when graph is idle; cap label rendering below zoom threshold; benchmark at 100/300/500 nodes as part of the canvas phase definition of done.

6. **Semantic zone assignment failing on non-standard project structures** — Prevention: use multi-signal classification (path patterns + import topology + file naming + framework signals); provide a visible "unknown" zone rather than silent misclassification; support `.archlens.json` configuration override; test against Next.js and Python FastAPI project structures before committing to the layout system.

---

## Implications for Roadmap

The architecture research provides an explicit build order based on component dependencies. The critical path is: Schema → Parser → Graph → Inference → WebSocket → Canvas. UI panels and time-travel are parallelizable after WebSocket is established. The pitfalls research reinforces that certain design decisions (layout stability, parse memory management, debounce architecture) must be correct from the start of their respective phases — they cannot be deferred as "optimizations."

### Phase 1: Foundation — Schema, Persistence, and Project Scaffold

**Rationale:** SQLite schema and repositories are the foundation that all other components write to. Establishing the monorepo structure and shared types early prevents coordination overhead in later phases. This is explicitly the first step in ARCHITECTURE.md's build order.
**Delivers:** Working monorepo (`packages/server`, `packages/client`), shared TypeScript types for graph events and WebSocket messages, Drizzle ORM schema (graph_nodes, graph_edges, change_events, layout_positions), database connection with WAL mode enabled, basic Fastify server skeleton.
**Addresses:** Persistent graph state (table stakes feature), event sourcing schema for time-travel replay
**Avoids:** Schema changes mid-build that require migration of downstream components; missing WAL mode causing write lock errors under concurrent load

### Phase 2: File Watching and Parsing Pipeline

**Rationale:** The file watcher and tree-sitter parser are the system's input — nothing else can be built or tested without them. These two components have no upstream dependencies within the project. The pitfalls research is unambiguous: debounce architecture and tree memory lifecycle management must be built correctly here, not retrofitted.
**Delivers:** chokidar v5 watcher with 200ms debounce and batch accumulation; tree-sitter parser in worker thread pool with incremental parse cache; explicit `oldTree.delete()` lifecycle; TypeScript and Python grammar support; typed `parse:complete` event bus emission; integration test: modify single file in 500-file project, verify parse time <50ms and single event emitted.
**Uses:** chokidar v5, tree-sitter 0.25.x, tree-sitter-typescript 0.23.x, tree-sitter-python 0.25.x, worker_threads, typed EventBus
**Avoids:** Pitfall 2 (event storms), Pitfall 3 (memory leaks), anti-pattern of synchronous parsing on event loop
**Research flag:** Needs phase research — tree-sitter worker thread integration and incremental API usage have specific patterns that benefit from deeper investigation before implementation

### Phase 3: Dependency Graph Model and Incremental Updates

**Rationale:** Depends on the parser output shape established in Phase 2. The in-memory graph model is the data structure that all downstream components (inference, WebSocket, persistence) read from. GraphDiff computation must be implemented here because delta-only push is a core architectural constraint — full graph rebuild is explicitly listed as "never acceptable" in pitfalls.
**Delivers:** @dagrejs/graphlib-based in-memory directed graph; GraphDiff computation (added/removed nodes and edges); write-through persistence to SQLite via GraphRepository; circular dependency detection algorithm; graph state versioning; integration test: simulate 10 rapid file changes and verify single consolidated graph diff is produced.
**Addresses:** Dependency graph rendering, circular dependency detection (table stakes)
**Avoids:** Pitfall 5 (full-rebuild fallback accumulation), anti-pattern of full graph rebuild on every file change

### Phase 4: Architectural Inference Engine

**Rationale:** Depends on a stable graph structure from Phase 3. The inference engine is the system's intelligence layer — zone classification, boundary detection, event detection, risk analysis. Pitfall 4 (inference noise) and Pitfall 7 (rigid zone assignment) must be addressed here with multi-signal heuristics and confidence scoring before the activity feed is built on top.
**Delivers:** ZoneClassifier (multi-signal: path + import topology + framework signals + `.archlens.json` override); BoundaryDetector; EventDetector with multi-signal corroboration and confidence scoring; RiskAnalyzer (circular deps, fan-out, boundary violations); zone assignment tested against Express+React, Next.js, and Python FastAPI project structures; < 20% unknown-zone rate target on real projects.
**Addresses:** Semantic zone layout, architectural event detection, risk heuristics panel (differentiators + table stakes)
**Avoids:** Pitfall 4 (inference noise), Pitfall 7 (zone rigidity)
**Research flag:** May benefit from phase research — architectural inference heuristics for non-standard project layouts are novel territory with limited prior art

### Phase 5: WebSocket Streaming and Client State

**Rationale:** With the full backend pipeline functional (Phases 1-4), the WebSocket layer connects backend to frontend. The delta serialization protocol and client-side patch application must be defined together — they share the GraphDelta message schema. Reconnect handling must be built correctly here to avoid Pitfall 5 (full-rebuild fallback accumulation on reconnect).
**Delivers:** Fastify WebSocket server with delta push and version tagging; DeltaSerializer producing GraphDelta JSON; WebSocket client with reconnect and version-aware sync request; Zustand graphStore with `applyDelta()` patch logic; MessageHandler; reconnect test: close browser tab mid-session, verify graph state restored within 2 seconds without re-layout.
**Uses:** Fastify v5, @fastify/websocket v11, Zustand v5, zod for message validation
**Avoids:** Pitfall 5 (full-rebuild on reconnect), security mistake of binding to 0.0.0.0

### Phase 6: Canvas Renderer and Layout Engine

**Rationale:** Depends on the client state store (Phase 5) providing the node/edge schema. The renderer must be built with Konva's Canvas layer architecture from the start — viewport culling, layer separation (static graph + animation overlay), and the imperative store subscription pattern (bypassing React's render cycle). These cannot be added as optimizations later; performance benchmarks are part of the definition of done.
**Delivers:** Konva Stage with two layers (static graph, animation); NodeRenderer and EdgeRenderer with precomputed geometry; ViewportController with zoom/pan and quadtree spatial index for culling; IncrementalPlacer with zone-constrained force simulation (50 ticks, existing nodes pinned); AnimationQueue for glow/pulse with 30-second decay; performance benchmark: 300 nodes at 60fps on mid-range hardware with animations active; canvas binds imperatively to Zustand store (NOT React re-render).
**Addresses:** Canvas/WebGL renderer (table stakes), zoom/pan, activity overlay glow/pulse (differentiator), stable layout
**Avoids:** Pitfall 1 (layout instability), Pitfall 6 (canvas performance collapse), anti-pattern of rendering graph through React DOM
**Research flag:** Standard patterns — Konva documentation and react-konva examples cover these patterns well; phase research likely not needed

### Phase 7: React UI Shell and Activity Feed

**Rationale:** The React panels (activity feed, intent panel, risk panel, node inspector) can be built in parallel with or after the canvas renderer, once the WebSocket client and Zustand stores are available (Phase 5). This phase completes the MVP by connecting the inference output to the user-facing UI.
**Delivers:** ActivityFeed component (natural-language event narration, architectural-level events only, file-level batching); RiskPanel (new-risk-only visibility, "reviewed" state); NodeInspector (click-to-inspect with file list, dependency list, recent changes); IntentPanel scaffold (placeholder until event stream matures in v1.x); App layout with panel management; UX: viewport state preserved across graph updates; glow decay logic.
**Addresses:** Natural-language activity feed, risk heuristics panel, click-to-inspect (all table stakes + differentiators)
**Avoids:** UX pitfalls: activity feed showing every file change, glow that never decays, risk panel that is always visible

### Phase 8: Time-Travel Replay and v1.x Features

**Rationale:** Time-travel replay depends on the append-only event log established in Phase 1 and the graph state infrastructure from Phases 3-5. It is explicitly a "v1.x" feature (add after validation), not launch-critical. The intent inference panel also belongs here, after the event stream has matured enough to identify patterns.
**Delivers:** ReplayControls component (change-count slider, not time-axis); server-side replay endpoint (load nearest snapshot, stream events to timestamp T); snapshot compaction to prevent unbounded database growth; IntentInferrer (heuristic classification of agent objectives from event patterns); SVG/screenshot export.
**Addresses:** Time-travel replay, intent inference panel, export (v1.x features)

### Phase Ordering Rationale

- Phases 1-3 follow the strict component dependency chain: schema before repositories, repositories before graph, graph before inference
- Phase 4 (inference) must precede Phase 5 (WebSocket) because the WebSocket layer transmits arch events that the inference engine produces — the GraphDelta schema depends on ArchEvent schema
- Phase 6 (canvas) is placed after Phase 5 because it depends on the wire protocol and client store shape; however, Konva canvas scaffolding can begin in parallel with Phase 5 completion
- Phase 7 (React UI) is last among MVP phases because it is the least technically risky — React component work is fast and can absorb scope changes; the hard technical problems are in Phases 2-6
- Phase 8 is explicitly post-validation because time-travel and intent inference require mature data from real agent sessions to tune correctly

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (File Watching + Parsing):** Tree-sitter worker thread integration has specific patterns for passing parse results back from worker threads (structured clone cannot transfer parse trees; only extracted plain-object results). Incremental API (`tree.edit()` call signature) warrants verification against the specific version in use before implementation.
- **Phase 4 (Architectural Inference):** Zone classification heuristics for non-standard project structures (Next.js, Python monorepos, flat `src/` layouts) are novel territory with sparse prior art. The multi-signal corroboration thresholds need calibration against real agent sessions — the research flags this as needing a calibration period, which implies prototype-and-measure approach rather than design-up-front.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Drizzle ORM + better-sqlite3 setup is thoroughly documented; monorepo TypeScript configuration is well-understood
- **Phase 5 (WebSocket):** Fastify WebSocket plugin documentation covers delta sync patterns; zod validation of WebSocket messages is a standard pattern
- **Phase 6 (Canvas):** Konva two-layer architecture and react-konva imperative store subscription patterns are covered in official documentation and community examples
- **Phase 7 (React UI):** Standard React component work; no novel technical territory

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core library choices verified via npm/official sources; version numbers spot-checked; alternatives systematically evaluated with clear rationale |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-researched against 10+ competitor tools; AI agent supervision use case is novel with fewer precedents for "correct" feature set |
| Architecture | MEDIUM-HIGH | Core pipeline patterns well-established and sourced to peer-reviewed benchmarks; ArchLens-specific architectural inference patterns are novel and estimated rather than empirically validated |
| Pitfalls | MEDIUM-HIGH | Critical technical pitfalls verified through official documentation, GitHub issues, and community sources; inference accuracy pitfalls based on general static analysis community knowledge rather than ArchLens-specific data |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Architectural inference thresholds:** The exact confidence thresholds and corroboration signal combinations for zone classification and event detection cannot be determined from research alone — they require calibration against real AI agent sessions. Plan for a "calibration sprint" after Phase 4 MVP is functional.
- **Vite 8 stability:** Vite 8 (Rolldown-based) is marked as very recent in STACK.md. Verify the current release and stability before starting the frontend build setup in Phase 1. If Vite 8 proves unstable, Vite 6/7 is a safe fallback with minimal architectural impact.
- **Worker thread parse result serialization:** The exact API surface for passing tree-sitter extraction results from worker threads back to the main thread needs verification — parse trees themselves cannot be transferred via structured clone, only plain-object extracted data. Verify this constraint against tree-sitter 0.25.x Node.js binding documentation before Phase 2 implementation.
- **@dagrejs/dagre incremental layout:** The research recommends dagre for layout but the primary rendering uses Konva with zone-constrained force placement (IncrementalPlacer). Clarify whether dagre is used for initial layout only, zone layout constraints, or replaced entirely by the custom zone-constrained force simulation. This decision affects the Phase 6 scope.
- **WebSocket reconnect delta strategy:** The research specifies that reconnects should send "events since last known client sequence number" rather than full state, but the exact protocol (sequence numbers in client storage, server-side session state) needs design before Phase 5 implementation.

---

## Sources

### Primary (HIGH confidence)
- [chokidar GitHub / npm](https://github.com/paulmillr/chokidar) — v5 ESM-only, Node 20+, debounce patterns, atomic write handling
- [Fastify npm / OpenJS Foundation](https://openjsf.org/blog/fastifys-growth-and-success) — v5.8.x stable, 70-80k req/s vs Express 20-30k
- [@fastify/websocket npm](https://www.npmjs.com/package/@fastify/websocket) — v11.x built on ws@8, Fastify v5 target
- [konva npm](https://www.npmjs.com/package/konva) + [20,000 nodes demo](https://konvajs.org/docs/sandbox/20000_Nodes.html) — v10.2.1, hitgraph optimization at scale
- [react-konva npm](https://www.npmjs.com/package/react-konva) — v19.2.3, React 19 compatibility
- [@dagrejs/graphlib npm](https://www.npmjs.com/package/@dagrejs/graphlib) — v3.0.2, actively maintained DagreJS org fork
- [@dagrejs/dagre npm](https://www.npmjs.com/package/@dagrejs/dagre) — v2.0.4, incremental layout with prior positions
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — v12.8.0, Node 20+, synchronous API rationale
- [Drizzle ORM SQLite docs](https://orm.drizzle.team/docs/get-started/sqlite-new) — better-sqlite3 driver, TypeScript schema
- [Zustand npm](https://www.npmjs.com/package/zustand) — v5.0.11, useSyncExternalStore
- [Tree-sitter incremental parsing benchmarks](https://dasroot.net/posts/2026/02/incremental-parsing-tree-sitter-code-analysis/) — 70% parse time reduction, 100ms per 10k lines (2026)
- [Graph visualization efficiency — peer reviewed](https://pmc.ncbi.nlm.nih.gov/articles/PMC12061801/) — Canvas/WebGL threshold benchmarks at 3k-10k nodes
- [Martin Fowler EventSourcing](https://martinfowler.com/eaaDev/EventSourcing.html) — event sourcing pattern for time-travel

### Secondary (MEDIUM confidence)
- [Sourcetrail GitHub](https://github.com/CoatiSoftware/Sourcetrail) — archived 2021; feature reference for click-to-inspect, zoom/pan patterns
- [IcePanel top 9 visual modelling tools](https://icepanel.io/blog/2025-09-02-top-9-visual-modelling-tools-for-software-architecture) — feature comparison across 9 tools
- [AppMap documentation](https://appmap.io/docs/appmap-docs.html) — runtime capture approach, IDE plugin constraints
- [Cytoscape.js WebGL preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/) — confirms WebGL renderer is preview-only
- [dependency-cruiser vs Madge maintainer comparison](https://github.com/sverweij/dependency-cruiser/issues/203) — rule enforcement vs simplicity
- [Sticky Force Layout — D3 Observable](https://observablehq.com/@d3/sticky-force-layout) — pinned node position pattern
- [Scale Up D3 with PixiJS](https://graphaware.com/blog/scale-up-your-d3-graph-visualisation-webgl-canvas-with-pixi-js/) — decoupled rendering pattern
- [xyflow performance docs](https://github.com/xyflow/xyflow/issues/5442) — canvas renderer recommendation for 100+ nodes
- [WebSocket architecture best practices — Ably](https://ably.com/topic/websocket-architecture-best-practices) — delta sync, backpressure
- [Tree-sitter large file memory issue #1277](https://github.com/tree-sitter/tree-sitter/issues/1277) — 1.6MB file, 300MB memory, tree lifecycle
- [Canvas optimisation — AG Grid blog](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) — quadtree culling, layer separation
- [Vite 8 announcement / releasebot](https://vite.dev/blog/announcing-vite6) — Rolldown-based build; verify stability on project start

### Tertiary (LOW confidence)
- [Agentic coding trends 2026 — teamday.ai](https://www.teamday.ai/blog/complete-guide-to-agentic-coding-2026) — active monitoring requirements for AI coding agents (single source; validates the supervision use case framing)
- [PixiJS v8 Canvas renderer discussion](https://github.com/pixijs/pixijs/discussions/10682) — Canvas renderer in v8 is experimental (relevant if Konva requires WebGPU upgrade later)

---

*Research completed: 2026-03-15*
*Ready for roadmap: yes*
