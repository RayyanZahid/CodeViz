# ArchLens — Real-Time Architecture Visualization for AI Coding Agents

## What This Is

A real-time architecture visualization system that monitors AI coding agents as they work and displays what they're building at a human-meaningful architectural level. It transforms low-level code edits through a pipeline — file watching, tree-sitter parsing, dependency graph, architectural inference — into an interactive 2D map with semantic zones, activity overlays, and risk detection. Users can click any component node to inspect its files, exports, and full dependency graph. The architecture map is fully interactive: risks surface with severity badges, edges show dependency details on hover, changed components pulse and glow, a live activity feed streams events in natural language, and the tool can be pointed at any codebase directory. Users can replay the entire architecture evolution over time via a timeline slider with drag-scrub, auto-playback, and diff overlay. An AI intent inference engine classifies code change patterns into objectives (feature building, bug fixing, refactoring, etc.) displayed in a dedicated sidebar panel with confidence scores, subtasks, and focus-shift notifications. Runs as a local web app alongside the developer's editor.

## Core Value

A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.

## Requirements

### Validated

- ✓ Real-time architecture map that updates as code changes — v1.0
- ✓ Stable 2D layout with semantic zones (frontend, API, services, data stores, infrastructure) — v1.0
- ✓ Architectural event detection (component created, dependency added, etc.) — v1.0
- ✓ Natural-language activity feed describing architectural changes — v1.0
- ✓ File system watcher for agent-agnostic code change detection — v1.0
- ✓ Tree-sitter-based parsing for TypeScript/JavaScript and Python — v1.0
- ✓ Incremental dependency graph updates (not full rebuilds) — v1.0
- ✓ Click-to-inspect node details (affected files, recent changes) — v1.0
- ✓ Persistent graph state across sessions — v1.0
- ✓ Zoom and pan navigation on the architecture canvas — v1.0
- ✓ Risk detection heuristics (circular deps, boundary violations, excessive fan-out) — v1.0
- ✓ Risk panel displaying architectural warnings — v1.0
- ✓ WebSocket streaming from backend to frontend — v1.0
- ✓ Semantic zone layout: frontend (left), API (center-left), services (center), data stores (right), external (outer), infrastructure (bottom) — v1.0
- ✓ Sticky node coordinates — no full graph reshuffles — v1.0
- ✓ Activity overlay (glow, pulse, progress indicators on active components) — v1.0
- ✓ Fix data pipeline — Zod schemas pass all component fields, file-to-component ID mapping in WebSocket broadcasts — v2.0
- ✓ Pipeline health status dot (green/yellow/red) for connection state — v2.0
- ✓ Interactive Inspector Panel — click a component node to see full details (files, exports, dependencies in/out) — v2.1
- ✓ Inspector zone badge with color classification — v2.1
- ✓ Dependency aggregation with count badges and clickable navigation — v2.1
- ✓ Smooth pan animation when navigating to components — v2.1
- ✓ Risk panel with severity badges (red=critical, orange=warning) and click-to-highlight — v2.2
- ✓ Mark-as-reviewed with localStorage persistence and auto-resurface on signal change — v2.2
- ✓ Activity feed streams events within 3s of file save with natural-language sentences — v2.2
- ✓ Colored dots on feed entries (green=creation, blue=dependency, orange=risk) — v2.2
- ✓ Live-updating relative timestamps on feed entries — v2.2
- ✓ Edge hover tooltip with source/target/dependency count/import symbols — v2.2
- ✓ Edge click-to-highlight both endpoint components — v2.2
- ✓ Edge thickness legend (thin/medium/thick) — v2.2
- ✓ Component pulse glow (2.5s sine-wave) on file change — v2.2
- ✓ Bright border fade (30s decay) on recently changed components — v2.2
- ✓ Directory input bar to watch any project directory — v2.2
- ✓ ARCHLENS_WATCH_ROOT env var for initial directory — v2.2
- ✓ Full graph/DB/pipeline reset on directory switch — v2.2
- ✓ Scanning indicator during fresh scan — v2.2
- ✓ Works correctly on external projects (not just self-watching) — v2.2
- ✓ Time-travel replay — scrub through architecture evolution via timeline slider with auto-playback and diff overlay — v3.0
- ✓ Intent inference from code change patterns using heuristic classification into 6 categories — v3.0
- ✓ Intent panel showing inferred agent objectives, confidence, subtasks, focus-shifts, and history — v3.0
- ✓ Graph snapshot persistence to SQLite with layout positions and delta-threshold triggering — v3.0
- ✓ Checkpoint-based snapshot reconstruction for O(50-max) performance — v3.0
- ✓ Replay mode state machine with full delta isolation (live events buffered, not applied) — v3.0
- ✓ Watch-root switching clears all replay/intent data and recreates infrastructure — v3.0

### Active

(None — planning next milestone)

### Future

- [ ] Go and Rust language support via tree-sitter
- [ ] Export architecture map as SVG or PNG screenshot

### Out of Scope

- Mobile app — web-first, desktop only
- Specific agent integrations (Claude Code hooks, Cursor extension API) — agent-agnostic file watching only
- Manual node arrangement / drag-to-reposition — conflicts with semantic zone layout
- OAuth or multi-user auth — single-user local app
- Cloud deployment — localhost only
- Video/screen recording of architecture evolution
- AI-generated architectural suggestions — observation is the core value, not prescription
- Plugin/extension API — internal event system must stabilize first

## Context

Shipped v1.0-v2.2 (2026-03-16) and v3.0 Architecture Intelligence (2026-03-17).
Tech stack: Fastify v5, SQLite/WAL + Drizzle ORM, tree-sitter (TS/JS/Python), @dagrejs/graphlib, Konva + d3-force, React 19 + Zustand, WebSocket streaming.
Architecture: pnpm monorepo with 3 packages (server, client, shared).
Total LOC: 13,661 TypeScript across all packages.
All requirements delivered: v1.0 (48), v2.0 (4), v2.1 (6), v2.2 (16), v3.0 (22 — 10 REPLAY, 8 INTENT, 4 INFRA).
v3.0 added time-travel replay (timeline slider, auto-playback, diff overlay), heuristic intent inference (6 categories, EWMA confidence), and full watch-root isolation.
26 end-to-end journey tests passing across all milestones.

## Constraints

- **Rendering performance**: Must handle hundreds of nodes smoothly on a 2D canvas — Canvas/WebGL rendering, not DOM-based graphs
- **Layout stability**: Graph must never fully reshuffle — only local adjustments when nodes are added/removed
- **Language support**: Tree-sitter for parsing — initial support for TypeScript/JavaScript and Python only
- **Deployment**: Local web app on localhost — no cloud infrastructure
- **Codebase scale**: Optimized for medium-large codebases (500-5000 files)
- **Real-time latency**: Architecture map should update within 1-2 seconds of file changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Agent-agnostic via file watchers | Works with any AI coding agent without custom integrations | ✓ Good — chokidar v5 works reliably |
| Local web app (not Electron/extension) | Simplest delivery, any browser works, no IDE lock-in | ✓ Good — zero install friction |
| Tree-sitter for parsing | Multi-language support, incremental parsing, widely adopted | ✓ Good — TS/JS/Python working; pinned to 0.21.1 for stability |
| Canvas/WebGL rendering (not DOM) | Performance at scale with hundreds of nodes | ✓ Good — Konva delivers 60fps at 300 nodes |
| Infer intent from changes (not agent hooks) | No agent integration needed, works universally | ✓ Good — heuristic EWMA classifier works well for 6 categories; no LLM needed |
| Persistent graph with time-travel | Users can review architecture evolution across sessions | ✓ Good — SQLite snapshots + timeline slider + auto-playback all shipped in v3.0 |
| Delta-threshold snapshotting (not wall-clock) | Controls storage growth, triggers on meaningful changes | ✓ Good — structural changes immediate, minor at 10 threshold, FIFO at 200 |
| Event-count axis on timeline (not wall-clock) | Avoids dead zones in timeline when no activity occurs | ✓ Good — heatmap shows event density, no gaps |
| Separate replayStore Zustand slice | Mode state is different concern from live graph state | ✓ Good — clean isolation, no coupling with graphStore |
| Buffer-then-drain on replay exit | Preserves live events during replay for catch-up | ✓ Good — handles both small (apply deltas) and large (fetch snapshot) buffers |
| TS/JS + Python first | Most common languages for AI-assisted development | ✓ Good — covers primary use cases |
| Semantic zone layout | Provides stable, predictable positioning based on component role | ✓ Good — d3-force with zone constraints works well |
| SQLite WAL + Drizzle ORM | Sync API correct for write-heavy event logging | ✓ Good — write-through persistence reliable |
| Zustand for client state | Lightweight, imperative subscriptions for Konva integration | ✓ Good — avoids React re-render overhead |
| WebSocket delta-only streaming | Minimal bandwidth, version-tagged for ordering | ✓ Good — reconnect recovery works cleanly |
| Strict Zod schemas (no passthrough) | Strip unknown fields for safety rather than forwarding them | ✓ Good — prevents unexpected data reaching client |
| Server-side inference ID translation | Clients never see file-level IDs, keeping graphStore consistent with canvas | ✓ Good — single translation point at broadcast boundary |
| Rebuild fileToComponentMap on every aggregation | Always current, no staleness risk | ✓ Good — simplicity over caching |
| Skip broadcast when all IDs unmapped | Avoids empty inference messages reaching the client | ✓ Good — reduces no-op client processing |
| Zone badge colors as inline constant | Matches app palette, no CSS variable overhead | ✓ Good — simple, co-located with component |
| DependencyRow as extracted component | Isolates per-row hover state without parent tracking | ✓ Good — clean separation of concerns |
| Konva.Tween for pan animation | Smooth 0.3s EaseInOut replaces jarring hard jumps | ✓ Good — much better UX for dependency navigation |
| Module-level localStorage Set for reviewed risks | Avoids hot-path I/O on every applyInference call | ✓ Good — single read at store init |
| Resurface by signal comparison | Clears reviewed flag when risk signal identity changes | ✓ Good — matches riskFingerprint() logic |
| batchPrependItem() shared helper | Unified 2s batching for both inference and graph delta feed entries | ✓ Good — DRY activity feed processing |
| applyGraphDelta called immediately (not batched) | Ensures <3s feed latency for FEED-01 | ✓ Good — user sees events instantly |
| Konva.Arrow listening:true + hitStrokeWidth:15 | Wider invisible hit area for edge interaction | ✓ Good — natural click targets |
| HTML tooltip overlay (not Konva text) | Crisp text and full CSS styling for edge tooltips | ✓ Good — better than Konva text rendering |
| Two-phase glow: 2.5s pulse then 30s decay | Visible pulsing draws attention, then fades gracefully | ✓ Good — not jarring |
| watchRoot plugin receives callbacks | Plugin decoupled from module-level state, testable | ✓ Good — clean plugin pattern |
| graph/aggregator const, pipeline/inferenceEngine let | Stable graph refs across watch-root switches | ✓ Good — minimal re-wiring needed |
| DirectoryBar co-located in App.tsx | Follows NavButton/PipelineStatusDot small-component pattern | ✓ Good — no unnecessary file sprawl |

---
*Last updated: 2026-03-17 after v3.0 milestone*
