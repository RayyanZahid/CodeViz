# ArchLens — Real-Time Architecture Visualization for AI Coding Agents

## What This Is

A real-time architecture visualization system that monitors AI coding agents as they work and displays what they're building at a human-meaningful architectural level. It transforms low-level code edits into architectural events shown on a stable 2D map — like air traffic control for software architecture. Runs as a local web app alongside the developer's editor.

## Core Value

A developer supervising an AI coding agent can glance at the screen and instantly understand what the agent is building, where it's working, and how the architecture is evolving — without reading any code.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

- [ ] Real-time architecture map that updates as code changes
- [ ] Stable 2D layout with semantic zones (frontend, API, services, data stores, infrastructure)
- [ ] Architectural event detection (component created, dependency added, service split, etc.)
- [ ] Natural-language activity feed describing architectural changes
- [ ] File system watcher for agent-agnostic code change detection
- [ ] Tree-sitter-based parsing for TypeScript/JavaScript and Python
- [ ] Incremental dependency graph updates (not full rebuilds)
- [ ] Click-to-inspect node details (affected files, recent changes)
- [ ] Persistent graph state across sessions
- [ ] Time-travel replay — scrub through architecture evolution over time
- [ ] Zoom and pan navigation on the architecture canvas
- [ ] Risk detection heuristics (circular deps, boundary violations, excessive fan-out)
- [ ] Risk panel displaying architectural warnings
- [ ] Intent inference from code change patterns (commit messages, file groupings)
- [ ] Intent panel showing inferred agent objectives and subtasks
- [ ] WebSocket streaming from backend to frontend
- [ ] Semantic zone layout: frontend (left), API (center-left), services (center), data stores (right), external (outer), infrastructure (bottom)
- [ ] Sticky node coordinates — no full graph reshuffles
- [ ] Activity overlay (glow, pulse, progress indicators on active components)

### Out of Scope

- Mobile app — web-first, desktop only for v1
- Specific agent integrations (Claude Code hooks, Cursor extension API) — agent-agnostic file watching only for v1
- Go and Rust language support — TS/JS and Python first
- Manual node arrangement / drag-to-reposition — click-to-inspect only for v1
- OAuth or multi-user auth — single-user local app
- Cloud deployment — localhost only
- Video/screen recording of architecture evolution

## Context

- The core problem: AI coding agents write code faster than humans can read. Humans supervising these agents need architectural situational awareness, not file-level diffs.
- The key design principle: never visualize raw file changes directly. Transform code edits through a pipeline: agent events → code change detection → structural analysis → architectural interpretation → visualization update.
- Nodes represent high-level architectural concepts: systems, services, containers, subsystems, major modules, databases, queues, external APIs, infrastructure components. NOT individual functions, classes, or files.
- Edges represent: calls, reads/writes, publishes/subscribes, depends-on, owns.
- The visualization must render smoothly with hundreds of architectural nodes (mapping to codebases of 500-5000 files).
- Intent is inferred from code change patterns in v1 (no agent hook API required).
- Graph state persists in a local database to support time-travel replay across sessions.

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
| Agent-agnostic via file watchers | Works with any AI coding agent without custom integrations | — Pending |
| Local web app (not Electron/extension) | Simplest delivery, any browser works, no IDE lock-in | — Pending |
| Tree-sitter for parsing | Multi-language support, incremental parsing, widely adopted | — Pending |
| Canvas/WebGL rendering (not DOM) | Performance at scale with hundreds of nodes | — Pending |
| Infer intent from changes (not agent hooks) | No agent integration needed, works universally | — Pending |
| Persistent graph with time-travel | Users can review architecture evolution across sessions | — Pending |
| TS/JS + Python first | Most common languages for AI-assisted development | — Pending |
| Semantic zone layout | Provides stable, predictable positioning based on component role | — Pending |

---
*Last updated: 2026-03-15 after initialization*
