# Pitfalls Research

**Domain:** Real-time architecture visualization (file watching, AST parsing, incremental graph updates, architectural inference, WebSocket streaming, 2D canvas rendering)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (core technical pitfalls verified through official documentation and community sources; architectural inference accuracy pitfalls based on general static analysis community knowledge)

---

## Critical Pitfalls

### Pitfall 1: Layout Instability — Full Graph Reshuffle on Every Update

**What goes wrong:**
The architecture map rearranges all node positions whenever a new node is added or an edge changes. Users who have built spatial memory of where components live lose their mental model on every code change. The visualization becomes disorienting and unusable for the core use case (glancing at the screen to understand where the agent is working).

**Why it happens:**
Force-directed layout algorithms (D3 force, etc.) are iterative simulations that run to convergence from scratch when the graph changes. Without explicit pinning/fixing of existing node positions, the algorithm treats every graph update as a new layout problem and explores globally different configurations. This is the default behavior of every major graph layout library.

**How to avoid:**
- Implement sticky node positions from day one: once a node has been placed, fix its x/y coordinates with `node.fx` / `node.fy` semantics (D3 terminology) or equivalent.
- Only run layout on NEW nodes, constraining them to their semantic zone's bounding box.
- Never run a global re-layout after initial placement. When a node is removed, do not re-flow the remaining nodes.
- Treat layout as a one-time placement decision per node, not an ongoing simulation.
- Assign semantic zone gravity: frontend nodes cluster left, API center-left, services center, data stores right. New nodes in a zone spawn near their zone centroid and then stop.

**Warning signs:**
- Users report "the map keeps jumping around"
- Nodes visibly animate to new positions when unrelated files change
- Running the same scenario twice produces different final layouts
- Zoom/pan state is disrupted on updates (viewport jumps)

**Phase to address:** Core graph foundation phase (initial canvas + layout system). This must be correct from the very first node rendered — retrofitting stable layout onto a force-simulation-based system is a rewrite.

---

### Pitfall 2: File Watcher Event Storms Causing Parsing/Update Cascades

**What goes wrong:**
AI coding agents write many files in rapid succession (often 5-50 files in under a second). Each file-change event triggers a parse + graph update. Without debouncing and coalescing, the system fires hundreds of sequential parsing jobs, flooding the message queue, saturating CPU, and pushing WebSocket updates faster than the frontend can consume them. The visualization flickers, lags, or becomes unresponsive.

**Why it happens:**
File watchers (chokidar, fsevents) emit individual events per file. A single agent "write a module" action may save an `index.ts`, 3 related files, and update a `package.json` — that's 5+ events within 200ms. The naive implementation processes each event independently. Chokidar v5 (released Nov 2025, ESM-only, Node.js ≥20) does not coalesce events automatically.

**How to avoid:**
- Debounce file-change events with a 150-300ms window before triggering any parse. Use a per-file debounce map so rapid changes to the same file don't stack.
- Implement a change batch collector: accumulate all file events within a debounce window into a single batch, then process the batch as one unit.
- Process the deduplicated set of changed files — if the same file changed 3 times in the window, parse it once.
- After batch processing, emit a single consolidated graph diff over WebSocket, not one message per changed file.
- Rate-limit WebSocket message emission: max one graph update message per 200ms (frontend animation frame budget).

**Warning signs:**
- CPU spikes to 100% during rapid agent activity
- WebSocket message queue depth grows without bound
- Frontend shows rapid-fire partial updates that interfere with each other
- Parse job queue depth exceeds 10+ items during normal agent operation

**Phase to address:** File watcher + parsing pipeline phase. The debounce/batch architecture must be specified before implementing the watcher, or the naive event-per-file approach will be built and the event storm problem will only appear under real agent load.

---

### Pitfall 3: Tree-sitter Memory Growth Without Explicit Tree Lifecycle Management

**What goes wrong:**
Each `parser.parse()` call allocates a syntax tree in native memory (C heap, or WebAssembly linear memory). In the Node.js bindings, trees are NOT garbage-collected automatically when the JS reference is dropped. Watching a codebase of 500-5000 files over a multi-hour session causes memory to grow continuously — potentially consuming 300MB+ for large files alone — until the process crashes or becomes unresponsive.

**Why it happens:**
Tree-sitter's Node.js bindings wrap native C allocations. The documented pattern requires calling `tree.delete()` explicitly when a tree is no longer needed. Community analysis confirms: "JavaScript developers can rely on garbage collection, but WebAssembly operates outside the engine's standard GC process and requires explicit freeing of resources." The 1.6MB JSON file case in tree-sitter's own issue tracker showed ~300MB memory for two consecutive parse trees.

**How to avoid:**
- Call `oldTree.delete()` before replacing it with a new parse result.
- Keep exactly ONE current tree per file; never accumulate trees.
- Use a parse cache with explicit eviction: when a file is removed from the watch list, delete its cached tree.
- For incremental parsing (the primary use case here), pass the previous tree as `options.previousTree` to the parse call — this is the correct API for incremental reuse. Then immediately delete the old tree after the new one is obtained.
- Test memory usage explicitly: watch a directory of 100+ files changing repeatedly over 30 minutes and profile heap + RSS.

**Warning signs:**
- Backend process RSS grows steadily during active agent sessions (never plateaus)
- Memory does not recover when agent pauses
- Large generated files (e.g., `dist/bundle.js`, lock files) cause RSS spikes
- Process memory exceeds 500MB after a few hours

**Phase to address:** Tree-sitter parsing integration phase. Memory lifecycle must be part of the parser wrapper design, not added later. Add a memory test to the definition of done for this phase.

---

### Pitfall 4: Architectural Inference Producing Noise — Too Many False-Positive "Architecture Events"

**What goes wrong:**
The system infers high-level architectural events (component created, service split, dependency added) from low-level code patterns. Without conservative thresholds and corroboration requirements, it fires architectural events for normal coding activity: adding a helper function fires "new component created", renaming a file fires "service split detected", adding a test fires "new subsystem", etc. The activity feed becomes noise and users stop trusting or reading it.

**Why it happens:**
Heuristic-based inference from AST patterns suffers from pattern ambiguity. A `class DatabaseService` in a utility file looks identical to a `class DatabaseService` that is architecturally significant. Path-based heuristics (`/services/`, `/api/`, `/db/`) are conventions, not requirements — projects break them constantly. Single-file changes are poor signals; significance emerges from clusters of related changes. Research confirms: "even state-of-the-art architectures struggle to infer implicit knowledge from standalone code snippets."

**How to avoid:**
- Require multiple corroborating signals before firing an architectural event: e.g., "new component" requires new directory + new entry point file + at least 2 files in directory within 5 minutes.
- Implement an "architectural significance threshold": small files (<50 lines), test files, config files, and files matching common non-architectural patterns (`.test.ts`, `.spec.ts`, `.config.ts`, `types.ts`) should never trigger component-creation events.
- Never infer architectural semantics from a single file edit in isolation.
- Add a suppression window: if a "component created" event fires, suppress it for 30 seconds to see if the files are deleted (agent reconsidering) before showing it.
- Distinguish "file-level activity" (always shown) from "architectural events" (shown only when confidence is high). The activity feed can show file-level changes without claiming architectural significance.
- Build confidence scoring: only promote inferences above 0.7 confidence to architectural events.

**Warning signs:**
- Activity feed fires events on every file save during normal refactoring
- Test file additions appear as "new service component"
- Renaming a file triggers "service split"
- Users report the activity feed as "spammy" or start ignoring it in early demos

**Phase to address:** Architectural inference engine phase. The inference thresholds and multi-signal corroboration requirements must be designed before implementing inference rules. Plan for a calibration period against real agent sessions.

---

### Pitfall 5: Incremental Graph Updates That Don't Remain Truly Incremental Under Load

**What goes wrong:**
The system starts with incremental graph updates but gradually accumulates "full rebuild" fallback paths: on error recovery, on startup, on reconnect, and whenever the diff algorithm hits an edge case. Over time, the fallback paths become the common path (especially on startup and after reconnects), causing the graph to flash/reload completely. With 500+ nodes, a full rebuild takes 2-5 seconds and produces the layout instability described in Pitfall 1.

**Why it happens:**
Incremental diff algorithms are hard to make exhaustive. Developers add fallback full-rebuilds for correctness, never removing them because "it only happens on reconnect." The fallback accumulates. Meanwhile, reconnects happen more than expected (browser tab sleep, network interruption, first load).

**How to avoid:**
- Design the graph state as an append-only event log from the beginning. The frontend reconstructs its view by replaying events, not by receiving a snapshot.
- Make the initial load itself incremental: send the persisted graph state as a stream of events (not a single JSON blob), so the frontend handles initial load and reconnect identically to incremental update.
- If a full snapshot is unavoidable (e.g., first ever startup), apply sticky positions immediately so the initial placement is canonical and never re-run.
- Test reconnect scenarios explicitly: disconnect WebSocket mid-session and verify the graph state recovers without re-layout.

**Warning signs:**
- "Full rebuild" code paths appear in error handling or reconnect logic
- Graph "flashes" when browser tab is backgrounded and foregrounded
- Memory of node positions is lost after WebSocket reconnect
- Initial load looks visually different from subsequent updates

**Phase to address:** WebSocket streaming + graph state management phase.

---

### Pitfall 6: Canvas Rendering Performance Collapse at 200+ Nodes During Animation

**What goes wrong:**
The canvas renders correctly with 50 nodes but drops below 30 FPS at 200+ nodes, and becomes sluggish at 500 nodes. Activity overlays (glow, pulse animations on active nodes) make this worse because they require redrawing the entire canvas on every animation frame even when only 2-3 nodes are active.

**Why it happens:**
Canvas 2D rendering is CPU-bound. Every `requestAnimationFrame` call redraws the full canvas: clear, draw all edges, draw all nodes, draw all labels. At 200 nodes with edges, this means thousands of `beginPath`/`arc`/`stroke` calls per frame. Activity animations (pulse, glow) force re-renders even when nothing structurally changed. The xyflow performance docs note: "use canvas renderer on low zoom for better performance on graphs with 100+ nodes."

**How to avoid:**
- Implement viewport culling immediately, not later: only draw nodes within the current viewport bounding box. Maintain a spatial index (quadtree or simple grid hash) for fast viewport queries.
- Separate the animation layer from the static layer using two overlaid canvases: the bottom canvas (static graph) is only redrawn on structural changes; the top canvas (activity overlays) animates independently.
- Use `requestAnimationFrame` only when animations are active. When the graph is idle, stop the animation loop entirely — only redraw on graph change events.
- Precompute node and edge geometry on graph change, not on every render call.
- Cap label rendering: only render node labels above a zoom threshold (e.g., don't render text when a node is < 15px). Text rendering is expensive.
- Test rendering performance benchmarks at 100, 300, 500 nodes as part of the canvas phase definition of done.

**Warning signs:**
- FPS drops below 60 when scrolling or zooming with 100+ nodes
- CPU fan spins up while viewing the visualization at rest
- Activity glow animations cause FPS drops even on fast machines
- The visualization feels laggy when the agent is idle

**Phase to address:** Canvas rendering phase. Culling and layer separation must be built into the rendering architecture, not added as an optimization after the fact. Performance benchmarks must be part of the initial milestone.

---

### Pitfall 7: Semantic Zone Assignment Is Too Rigid for Non-Standard Project Structures

**What goes wrong:**
The system assigns nodes to semantic zones (frontend, API, services, data stores) based on file path patterns (`/frontend/`, `/api/`, `/services/`). Many real projects don't use these conventions: monorepos use package names, Next.js apps co-locate API routes with pages, Python projects use flat `src/` structures. Nodes end up in the wrong zones or in a catch-all "unknown" zone, making the layout meaningless.

**Why it happens:**
Zone classification by file path is the easy first implementation. It works for the examples the developer had in mind when writing the rules. It fails for projects organized differently. There's no feedback loop to tell the developer it's wrong — the visualization just looks confusing without a clear error.

**How to avoid:**
- Implement zone classification as a multi-signal heuristic, not a path pattern only: combine path patterns + import relationships + file naming conventions + framework-specific signals (e.g., `page.tsx` in Next.js = frontend, `route.ts` = API).
- Add an explicit "unknown" zone that is visually distinct (bottom of canvas) rather than silently misclassifying nodes into wrong zones.
- Make zone assignment configurable: allow a `.archlens.json` config file at the project root to override zone rules.
- Test zone assignment against at least 3 real project structures: standard Express + React, Next.js, and a Python FastAPI project.
- Plan for reclassification: when new evidence arrives (e.g., a file starts being imported by many other services), re-evaluate zone assignment and animate the node moving to its new zone.

**Warning signs:**
- Most nodes end up in the "unknown" zone on a real project
- Frontend nodes appear in the services zone or vice versa
- Monorepo projects produce layouts with all nodes clustered in one zone
- Team reports "the zones don't match our project at all"

**Phase to address:** Architectural inference + layout phase. Zone assignment logic needs to be tested against real projects before the layout system uses it as a hard constraint.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full graph rebuild on every file change instead of incremental diff | Simpler implementation, always correct | Blocking 2-5s rebuilds at 500+ files, visible layout resets | Never — the project's core promise is incremental |
| DOM-based graph rendering (React nodes) instead of Canvas | Faster to build, easy to style | Performance collapse at 100+ nodes, 60 FPS impossible | Never — project.md explicitly rules out DOM graphs |
| Single WebSocket message per file change (no batching) | Simplest possible backend | Frontend overwhelmed by high-frequency messages during agent bursts | Never — will break under real agent load |
| Path-only zone classification (no multi-signal) | 2-hour implementation | Fails on non-standard projects silently | Acceptable for prototype phase only, must be replaced before v1 |
| Synchronous Tree-sitter parsing in event handler (blocking) | No queue complexity | Blocks the Node.js event loop during parse, stalls all other operations | Never — even small files can block for 50-200ms |
| No spatial index for canvas culling | Simpler render loop | Renders all nodes every frame regardless of viewport | Acceptable up to ~50 nodes, must be added before 200+ nodes |
| Skip `oldTree.delete()` for simplicity | Avoids lifecycle complexity | Unbounded memory growth; process dies in long sessions | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Chokidar v5 (ESM-only) | Mixing CommonJS `require()` with ESM-only package causes runtime crash | Project must be fully ESM (`"type": "module"` in package.json) or use dynamic `import()` for chokidar |
| Tree-sitter node bindings | Using `web-tree-sitter` (WASM) in a Node.js backend for performance | Use `node-tree-sitter` (native bindings) on backend; WASM is for browser-only scenarios |
| Tree-sitter TypeScript grammar | Importing `tree-sitter-typescript` gives TWO grammars: `typescript` and `tsx` | Must load the correct grammar based on file extension (`.ts` vs `.tsx`), not just "TypeScript" |
| WebSocket reconnect | Treating reconnect as a fresh connection, discarding client graph state | Track client state server-side; send only the delta since last known client sequence number on reconnect |
| SQLite concurrent writes from watcher + API | WAL mode not enabled by default; concurrent write locks cause errors | Always enable WAL mode (`PRAGMA journal_mode=WAL`) for SQLite in this use case |
| Canvas devicePixelRatio | Drawing at CSS pixel resolution on HiDPI/Retina displays causes blurry rendering | Always multiply canvas dimensions by `window.devicePixelRatio` and scale the context |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all nodes regardless of viewport | High CPU even when graph is zoomed in on a subset | Quadtree spatial index, viewport AABB culling before drawing | ~150 nodes |
| Re-parsing unchanged files on watcher restart | Full parse of entire codebase on every server restart | Persist parse results (AST fingerprint by file hash); skip parse if hash unchanged | ~200 files in codebase |
| Storing full AST in graph state database | Database size grows proportionally to codebase size; queries slow down | Store only extracted dependency graph data, not ASTs. ASTs are transient. | ~500 files |
| Accumulating all graph change events for time-travel without pruning | Database grows without bound; time-travel queries slow | Implement event compaction: compact events older than N days into snapshots | ~1000 events |
| String concatenation to build WebSocket JSON messages | GC pressure from string allocation on every graph update | Build message objects, serialize once with `JSON.stringify` | Not a threshold issue — constant overhead from first message |
| Force simulation running continuously in background | Constant CPU usage even when graph is stable and idle | Stop simulation when it converges (`alpha < alphaMin`); restart only on structural changes | Immediate — will drain battery/spin fans |
| Parsing node_modules / .git / build output | Thousands of files trigger parses that contribute nothing | Configure watcher ignore patterns before starting watch: `node_modules`, `.git`, `dist`, `build`, `*.min.js` | Immediate — will overwhelm the parser on any real project |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing the WebSocket server on `0.0.0.0` instead of `127.0.0.1` | Other machines on the local network (or attackers on the same network) can read the architecture map of a private codebase | Always bind to `127.0.0.1` (localhost only); project.md explicitly specifies local-only |
| Serving arbitrary file content through the "click to inspect" API without path sanitization | Path traversal: attacker in the browser can request `../../../.ssh/id_rsa` | Validate that requested file paths are within the watched project root before reading |
| Logging parsed code content or AST node text to disk | Source code fragments accumulate in log files in plain text | Log structural metadata only (file paths, node types, counts) — never log source text fragments |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing every file change as an activity feed item | Feed scrolls too fast to read; users stop looking at it | Show only architectural-level events; group file-level changes into batches ("Agent modified 12 files in UserService") |
| Activity glow that persists indefinitely on nodes | After 10 minutes of agent activity, every node is glowing; the visual signal loses meaning | Decay glow intensity over 30 seconds; the most recently-modified nodes are brightest |
| Risk panel that is always visible and always has items | Risk warnings become background noise; users ignore them | Only show risk panel when there are NEW risks since last viewing; add explicit "reviewed" state |
| Graph that fills the entire viewport with no padding | Nodes at viewport edges are hard to click; labels clip | Always maintain 50-100px padding around the rendered graph extent |
| Zoom/pan that resets on graph update | Users who have zoomed into a specific area are thrown back to the default view on every change | Preserve viewport state (zoom level + pan offset) across all graph updates; only auto-fit on explicit user request |
| Time-travel slider that shows calendar time (absolute) instead of change count | Long periods of no activity create dead zones on the slider; hard to navigate to interesting moments | Show time-travel slider as change count (event N of M) with timestamp tooltip, not as a time axis |

---

## "Looks Done But Isn't" Checklist

- [ ] **Layout stability:** Verify by watching a codebase with an AI agent for 10 minutes — no node should change position unless it was newly created
- [ ] **Memory management:** Run a 30-minute watch session on a 200+ file project; verify backend RSS does not grow continuously
- [ ] **Event storm handling:** Simulate rapid file writes (10 files in 100ms) and verify only one graph update is emitted and the frontend does not flicker
- [ ] **Incremental parsing:** Modify a single file in a 500-file project and verify parse time is <50ms (not proportional to full codebase size)
- [ ] **Canvas performance:** Render 300 nodes and verify steady 60 FPS on a mid-range laptop; verify FPS does not drop during activity animations
- [ ] **Zone assignment:** Test zone classification on a Next.js project and a Python FastAPI project — verify less than 20% of nodes land in "unknown"
- [ ] **WebSocket reconnect:** Close and reopen browser tab mid-session; verify graph state is fully restored within 2 seconds without re-layout
- [ ] **Viewport culling:** Zoom into a 10-node subgraph in a 500-node layout; verify CPU drops significantly vs. viewing the full graph
- [ ] **Watcher ignore patterns:** Start watcher on a project with `node_modules`; verify no files from `node_modules` trigger parse jobs

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Layout instability (force simulation) | HIGH | Remove force simulation entirely; implement static zone-based placement with sticky coordinates from scratch. This is effectively a rewrite of the layout subsystem. |
| Memory leak (undisposed trees) | MEDIUM | Add `oldTree.delete()` calls throughout parser wrapper; run leak sanitizer to find all sites. Requires thorough testing — leaks may not be obvious in short-run tests. |
| Event storm causing system unresponsiveness | MEDIUM | Add debounce/coalesce layer between file watcher and parser; requires architectural change to the event pipeline but no UI changes needed. |
| DOM-based rendering (if chosen despite recommendations) | HIGH | Migrating from DOM to Canvas is a complete frontend rewrite. All node components, edge rendering, zoom/pan, and interaction must be rebuilt. |
| Architectural inference noise | LOW-MEDIUM | Tune confidence thresholds and add suppression rules. Iterative — requires real-project test data. No architectural changes needed. |
| Zone misclassification | LOW | Update zone classification heuristics to add multi-signal rules. Existing nodes may need reclassification — add a "re-evaluate zones" pass. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Layout instability (P1) | Core graph foundation — canvas + layout system | Run 10-minute agent session; confirm zero node position changes except new nodes |
| File watcher event storms (P2) | File watcher + parsing pipeline | Simulate 10-file burst in 100ms; verify single consolidated graph update |
| Tree-sitter memory leaks (P3) | Tree-sitter parsing integration | 30-minute watch session; RSS delta < 50MB |
| Architectural inference noise (P4) | Architectural inference engine | Calibrate against real agent session; < 20% false-positive rate on activity feed events |
| Full-rebuild fallback accumulation (P5) | WebSocket streaming + graph state management | Reconnect test; verify graph state recovers without re-layout |
| Canvas performance collapse (P6) | Canvas rendering phase | 300-node render at 60 FPS on mid-range hardware with animations active |
| Rigid zone assignment (P7) | Architectural inference + layout | Zone test on Next.js + FastAPI projects; < 20% unknown-zone rate |

---

## Sources

- Tree-sitter pain points (memory management, large file performance, error recovery): [Modern Tree-sitter, part 7: the pain points and the promise](https://blog.pulsar-edit.dev/posts/20240902-savetheclocktower-modern-tree-sitter-part-7/)
- Tree-sitter large file performance issue (1.6MB, 300MB memory, read function bottleneck): [Tree-sitter on large files #1277](https://github.com/tree-sitter/tree-sitter/issues/1277)
- Incremental parsing and caching strategies: [Incremental Parsing Using Tree-sitter — Strumenta](https://tomassetti.me/incremental-parsing-using-tree-sitter/)
- Graph layout stability and incremental rendering: [Evaluating Graph Layout Algorithms — CGF 2024](https://onlinelibrary.wiley.com/doi/10.1111/cgf.15073)
- Canvas rendering performance (beginPath/arc overhead, quadtree culling): [Optimising HTML5 Canvas Rendering — AG Grid](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/)
- Canvas vs WebGL for 100+ nodes: [xyflow performance recommendation, canvas renderer for 100+ nodes](https://github.com/xyflow/xyflow/issues/5442)
- Graph visualization efficiency benchmarks (3k nodes, 30 FPS): [Graph visualization efficiency of popular web-based libraries](https://vciba.springeropen.com/articles/10.1186/s42492-025-00193-y)
- Sticky force layout implementation: [Sticky Force Layout — D3 Observable](https://observablehq.com/@d3/sticky-force-layout)
- WebSocket backpressure and bufferedAmount: [Node.js + WebSockets Backpressure — Medium](https://medium.com/@hadiyolworld007/node-js-websockets-backpressure-flow-control-patterns-for-stable-real-time-apps-27ab522a9e69)
- Chokidar v5 ESM-only release, debouncing patterns: [chokidar — npm](https://www.npmjs.com/package/chokidar)
- Dependency graph incremental update and circular detection: [Managing dependency graph in a large codebase — Tweag](https://www.tweag.io/blog/2025-09-18-managing-dependency-graph/)
- Architecture drift and real-time sync challenges: [Architecture Diagram Basics — vFunction](https://vfunction.com/blog/architecture-diagram-guide/)
- WebSocket architecture best practices: [WebSocket architecture best practices — Ably](https://ably.com/topic/websocket-architecture-best-practices)

---
*Pitfalls research for: Real-time architecture visualization (ArchLens)*
*Researched: 2026-03-15*
