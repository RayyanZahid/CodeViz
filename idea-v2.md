# Milestone 2: Make It Live

## Where We Are

CodeViz/ArchLens shows a static architecture map with 8 component nodes and 13 dependency edges. You can see "Graph Engine depends on Database" and "Pipeline connects to Parser and File Watcher." That's a good start — but it's a dead diagram. Nothing moves. The sidebar says "No architectural events yet." Clicking nodes does nothing useful. The three panels on the right (Inspector, Risks, Activity) are empty shells.

It's a poster, not air traffic control.

## What This Milestone Delivers

Turn the static poster into a live, interactive system that a human can actually use to supervise an AI coding agent in real time.

### 1. Fix the Data Pipeline (Critical Bugs)

The Zod validation schema in `packages/client/src/schemas/serverMessages.ts` silently strips `fileCount`, `keyExports`, and `dependencyCount` from WebSocket messages. The server computes these fields, sends them over the wire, and the client throws them away. Add these as optional fields to `GraphNodeSchema` and `GraphEdgeSchema`.

The inference engine (risk detection, event corroboration, zone updates) emits file-level node IDs like `src/parser/worker.ts`, but the client only knows component IDs like `src/parser`. The WebSocket plugin in `packages/server/src/plugins/websocket.ts` must translate file IDs to component IDs when broadcasting inference messages. The `ComponentAggregator` already has `fileToComponentId()` — use it.

### 2. Make the Inspector Panel Useful

When you click a component node on the canvas, the Inspector panel (`packages/client/src/panels/NodeInspector.tsx`) should show:

- Component name and zone (e.g., "Inference Engine — Services")
- File count ("5 files")
- List of files in this component with clickable entries
- Key exports (the important symbols this component provides)
- Outgoing dependencies: which other components it depends on, with edge weight ("Database × 4 imports")
- Incoming dependencies: which components depend on it

This gives you instant context — click a component and understand what it is, what it contains, and how it connects.

### 3. Make the Risk Panel Real

The risk detector already detects three kinds of architectural smells:
- Circular dependencies (critical)
- Boundary violations — e.g., frontend directly accessing data stores (warning)
- Excessive fan-out — a component with > 8 dependencies (warning)

But the Risk Panel shows nothing because the file-level risk signals don't map to component nodes. Fix the mapping (see #1 above), then:

- Show detected risks with severity badges (red for critical, orange for warning)
- Clicking a risk highlights the offending component on the canvas and pans to it
- "Mark as reviewed" button to dismiss acknowledged risks

### 4. Make the Activity Feed Live

When an AI agent (or a human) saves a file in the watched project, the Activity Feed should show architectural events in natural language:

- "Parser modified — 2 files changed"
- "New dependency: Inference Engine → Database"
- "Graph Engine created"

The event corroborator already detects `component_created`, `dependency_added`, `dependency_removed`, `component_split`, `component_merged` — but they never reach the feed because of the file-to-component ID mismatch. Fix the pipeline and wire it through.

Each feed item should have a colored dot (green = creation, blue = dependency change, orange = risk) and a relative timestamp ("3s ago", "1m ago").

### 5. Edge Interaction

Edges are currently just static lines. Add:

- **Hover tooltip**: When you hover over an edge, show a tooltip with: source → target, dependency count, and the specific import symbols if available (e.g., "Pipeline → Parser: ParserPool, parseBatch")
- **Click to highlight**: Clicking an edge highlights both endpoint components
- **Thickness legend**: A small legend in the corner showing what thin/medium/thick edges mean

### 6. Watch Any Project

Right now the system watches `packages/server` (its own code). Make it trivially easy to point at any project:

- Accept `ARCHLENS_WATCH_ROOT` environment variable (already implemented)
- Add a simple text input at the top of the UI where you can type/paste a directory path and hit Enter to start watching it
- On directory change: clear the canvas, reset the graph, start fresh scan
- Test with at least 2 external projects to verify it works beyond self-watching

### 7. Component Glow on Change

When files in a component change:
- The component node should pulse/glow briefly (2-3 seconds)
- Recently changed components should have a subtle bright border that fades over 30 seconds
- This gives you instant visual feedback: "something just changed in the Database layer"

The AnimationQueue system already exists (`packages/client/src/canvas/AnimationQueue.ts`) — it just needs to work with component node IDs instead of file IDs.

## Technical Notes

- Monorepo: `packages/server`, `packages/client`, `packages/shared`
- Server: Fastify 5 + WebSocket on port 3100, tsx watch for dev
- Client: React 19 + Konva canvas + Zustand, Vite on port 5173
- ComponentAggregator: `packages/server/src/graph/ComponentAggregator.ts`
- CJS worker wrapper for tree-sitter: `packages/server/dist/parser/worker-cjs.cjs`
- DB: SQLite at `packages/server/archlens.db`, schema push via `npx drizzle-kit push`
- Start: `pnpm dev` from project root

## Success Criteria

- [ ] Zod schemas validate all component fields (fileCount, keyExports, dependencyCount)
- [ ] Clicking a component node shows full details in the Inspector panel
- [ ] Risk panel shows at least one detected risk when watching a real project
- [ ] Activity feed shows events within 3 seconds of a file save
- [ ] Hovering an edge shows a tooltip with dependency details
- [ ] `ARCHLENS_WATCH_ROOT=/path/to/project pnpm dev` works with an external project
- [ ] Component nodes glow when their files are modified
- [ ] All three sidebar panels are populated and interactive — no empty states during active development

## Non-Goals (Save for Later)

- Time-travel replay (scrubbing through architecture evolution)
- Agent intent panel (showing what the AI is trying to accomplish)
- Multi-agent tracking (color-coding changes by agent identity)
- SVG/PNG export
- CI integration
