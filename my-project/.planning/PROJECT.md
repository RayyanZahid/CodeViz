# ArchLens — Real-Time Architecture Visualization for AI Coding Agents

## What This Is

A real-time architecture visualization system that monitors AI coding agents as they work and displays what they're building at a human-meaningful architectural level. It transforms low-level code edits through a pipeline — file watching, tree-sitter parsing, dependency graph, architectural inference — into an interactive 2D map with semantic zones, activity overlays, and risk detection. Runs as a local web app alongside the developer's editor.

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

### Active

- [ ] Interactive Inspector Panel — click a component node to see full details (files, exports, dependencies)
- [ ] Live Risk Panel — mapped risks with severity badges, click-to-highlight, mark-as-reviewed
- [ ] Live Activity Feed — real-time architectural events with colored dots and relative timestamps
- [ ] Edge interaction — hover tooltips with dependency details, click-to-highlight endpoints, thickness legend
- [ ] Watch any project — directory input in UI, env var support, fresh scan on change
- [ ] Component glow on change — pulse/fade animations when files in a component are modified

### Future

- [ ] Time-travel replay — scrub through architecture evolution over time
- [ ] Intent inference from code change patterns (commit messages, file groupings)
- [ ] Intent panel showing inferred agent objectives and subtasks
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

## Current Milestone: v2.1 Make It Live

**Goal:** Turn the static architecture poster into a live, interactive system that a human can actually use to supervise an AI coding agent in real time.

**Target features:**
- Interactive Inspector Panel — click a component node to see full details (files, exports, dependencies in/out)
- Live Risk Panel — mapped risks with severity badges, click-to-highlight offending components, mark-as-reviewed
- Live Activity Feed — real-time architectural events with colored dots and relative timestamps
- Edge Interaction — hover tooltips with dependency details, click-to-highlight endpoints, thickness legend
- Watch Any Project — directory input in UI, env var support, fresh scan on directory change
- Component Glow on Change — pulse/fade animations when files in a component are modified

## Context

Shipped v1.0 MVP with 9,540 LOC TypeScript and v2.0 data pipeline repair in a single day.
Tech stack: Fastify v5, SQLite/WAL + Drizzle ORM, tree-sitter (TS/JS/Python), @dagrejs/graphlib, Konva + d3-force, React 19 + Zustand, WebSocket streaming.
Architecture: pnpm monorepo with 3 packages (server, client, shared).
All 48 v1 requirements delivered. v2.0 delivered 4/26 requirements (data pipeline repair). Remaining 22 requirements carry over to next milestone.
Known technical debt: Phases 9-13 not started — all interactive features still pending.

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
| Infer intent from changes (not agent hooks) | No agent integration needed, works universally | — Deferred to v2 |
| Persistent graph with time-travel | Users can review architecture evolution across sessions | ⚠️ Revisit — persistence works, time-travel deferred to v2 |
| TS/JS + Python first | Most common languages for AI-assisted development | ✓ Good — covers primary use cases |
| Semantic zone layout | Provides stable, predictable positioning based on component role | ✓ Good — d3-force with zone constraints works well |
| SQLite WAL + Drizzle ORM | Sync API correct for write-heavy event logging | ✓ Good — write-through persistence reliable |
| Zustand for client state | Lightweight, imperative subscriptions for Konva integration | ✓ Good — avoids React re-render overhead |
| WebSocket delta-only streaming | Minimal bandwidth, version-tagged for ordering | ✓ Good — reconnect recovery works cleanly |
| Strict Zod schemas (no passthrough) | Strip unknown fields for safety rather than forwarding them | ✓ Good — prevents unexpected data reaching client |
| Server-side inference ID translation | Clients never see file-level IDs, keeping graphStore consistent with canvas | ✓ Good — single translation point at broadcast boundary |
| Rebuild fileToComponentMap on every aggregation | Always current, no staleness risk | ✓ Good — simplicity over caching |
| Skip broadcast when all IDs unmapped | Avoids empty inference messages reaching the client | ✓ Good — reduces no-op client processing |

---
*Last updated: 2026-03-16 after v2.1 milestone start*
