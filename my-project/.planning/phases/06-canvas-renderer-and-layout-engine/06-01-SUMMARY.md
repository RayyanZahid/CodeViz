---
phase: 06-canvas-renderer-and-layout-engine
plan: 01
subsystem: ui
tags: [react, konva, react-konva, d3-force, zustand, canvas, vite]

# Dependency graph
requires:
  - phase: 05-websocket-streaming-and-client-state
    provides: graphStore Zustand store with subscribe(), WsClient singleton, Vite 8 client setup
provides:
  - React 19 + react-konva 19 rendering foundation with two-layer Konva Stage
  - Imperative graphStore.subscribe() wired to canvas (no React re-renders for graph updates)
  - ZoneConfig module with 6 semantic zones (bounds, centers, fill/bg/glow colors)
  - App component with ResizeObserver-driven viewport dimensions
  - main.tsx React root mount preserving WsClient singleton pattern
affects:
  - 06-02 (NodeRenderer/EdgeRenderer will wire into graphLayer in ArchCanvas.tsx)
  - 06-03 (AnimationQueue will add to animLayer in ArchCanvas.tsx)
  - 06-04 (ViewportController zoom/pan will attach to Stage in ArchCanvas.tsx)

# Tech tracking
tech-stack:
  added:
    - react ^19.1.0
    - react-dom ^19.1.0
    - konva ^10.2.1 (10.2.2 not published; 10.2.1 is latest)
    - react-konva ^19.2.3
    - d3-force ^3.0.0
    - d3-force-boundary ^0.0.1
    - "@timohausmann/quadtree-js" ^1.2.6 (2.2.0 not published; 1.2.6 is latest)
    - "@vitejs/plugin-react" ^6.0.1
    - "@types/react" ^19.0.0
    - "@types/react-dom" ^19.0.0
  patterns:
    - Two-layer Konva Stage (graph layer + animation layer) for static vs animated content
    - Imperative Zustand subscribe() from useEffect for canvas updates (bypass React re-renders)
    - Module-level WsClient singleton preserved when migrating main.ts -> main.tsx
    - No React StrictMode to avoid Konva double-mount issues
    - Animation layer listening=false to save hit detection draw pass

key-files:
  created:
    - packages/client/src/main.tsx
    - packages/client/src/App.tsx
    - packages/client/src/canvas/ArchCanvas.tsx
    - packages/client/src/layout/ZoneConfig.ts
  modified:
    - packages/client/package.json (added React/Konva/d3-force deps)
    - packages/client/tsconfig.json (added jsx: react-jsx)
    - packages/client/vite.config.ts (added @vitejs/plugin-react)
    - packages/client/index.html (script src main.ts -> main.tsx)
    - pnpm-lock.yaml

key-decisions:
  - "konva pinned to ^10.2.1 — 10.2.2 not published; 10.2.1 is the actual latest"
  - "@timohausmann/quadtree-js pinned to ^1.2.6 — 2.2.0 not published; 1.2.6 is actual latest"
  - "No StrictMode wrapper in main.tsx — avoids Konva double-mount breaking imperative subscriptions"
  - "Animation layer listening=false — glow overlays need no hit detection, saves draw pass"
  - "Graph layer listening=true — click-to-select on nodes requires hit detection on graph layer"
  - "CANVAS_WIDTH=2400, CANVAS_HEIGHT=1600 — virtual canvas space matching zone layout design"
  - "Infrastructure zone spans full width at bottom (y: 1200-1560) — consistent with CONTEXT.md layout"

patterns-established:
  - "Pattern 1: Two-layer Konva Stage — graph layer redraws on delta, anim layer runs continuous RAF"
  - "Pattern 2: Imperative graphStore.subscribe in useEffect with unsub cleanup — no React re-renders for canvas"
  - "Pattern 3: ResizeObserver in App for live viewport dimensions piped to ArchCanvas"
  - "Pattern 4: ZoneConfig getZoneLayout()/getZoneCenter() helpers with 'external' fallback for unknowns"

requirements-completed: [REND-01, REND-04, REND-05]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 6 Plan 01: Canvas Renderer and Layout Engine Setup Summary

**React 19 + react-konva two-layer Konva Stage with imperative Zustand subscription and six-zone canvas geometry constants (frontend/api/services/data-stores/external/infrastructure)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T03:03:06Z
- **Completed:** 2026-03-16T03:06:06Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed React 19, Konva 10, react-konva 19, d3-force 3, and supporting packages into the client workspace
- Converted client from plain TypeScript (main.ts) to React+JSX (main.tsx) with WsClient singleton pattern preserved
- Created two-layer Konva Stage (graph-layer + anim-layer) with imperative graphStore.subscribe() — canvas updates bypass React re-renders entirely
- Defined ZoneConfig module with 6 semantic zone geometries on a 2400x1600 virtual canvas

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, configure React JSX toolchain** - `b9802a4` (chore)
2. **Task 2: Create React root, App shell, ArchCanvas with two layers, ZoneConfig** - `39a10ef` (feat)

## Files Created/Modified
- `packages/client/src/main.tsx` - React 19 createRoot mount; WsClient singleton initialized before mount; no StrictMode
- `packages/client/src/App.tsx` - Root component with ResizeObserver tracking container dims; renders ArchCanvas
- `packages/client/src/canvas/ArchCanvas.tsx` - Two-layer Konva Stage; imperative graphStore.subscribe() in useEffect
- `packages/client/src/layout/ZoneConfig.ts` - 6 zone layouts with bounds/centers/colors; getZoneLayout()/getZoneCenter() helpers
- `packages/client/package.json` - Added React/Konva/d3-force production and dev deps
- `packages/client/tsconfig.json` - Added jsx: react-jsx compilerOption
- `packages/client/vite.config.ts` - Added @vitejs/plugin-react plugin
- `packages/client/index.html` - Script src updated to /src/main.tsx
- `pnpm-lock.yaml` - Updated with new dependency tree

## Decisions Made
- konva version corrected to 10.2.1 (10.2.2 not published to npm; latest is 10.2.1)
- @timohausmann/quadtree-js version corrected to 1.2.6 (2.2.0 not published; latest is 1.2.6)
- No React StrictMode per RESEARCH.md Pitfall 1 (double-mount breaks Konva imperative subscriptions)
- Animation layer listening=false per RESEARCH.md Pitfall 2 (glow overlays need no hit detection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] konva version 10.2.2 does not exist**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Plan specified konva@^10.2.2 but npm registry only has 10.2.1 as latest
- **Fix:** Changed version to ^10.2.1 in package.json
- **Files modified:** packages/client/package.json
- **Verification:** pnpm install completed successfully; konva/package.json present in node_modules
- **Committed in:** b9802a4 (Task 1 commit)

**2. [Rule 1 - Bug] @timohausmann/quadtree-js version 2.2.0 does not exist**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Plan specified @timohausmann/quadtree-js@^2.2.0 but npm registry latest is 1.2.6
- **Fix:** Changed version to ^1.2.6 in package.json
- **Files modified:** packages/client/package.json
- **Verification:** pnpm install completed successfully; @timohausmann/quadtree-js present in node_modules
- **Committed in:** b9802a4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - package version corrections)
**Impact on plan:** Both auto-fixes necessary for install to complete. No functional impact — both packages installed at their actual latest versions. Research document versions slightly ahead of npm registry.

## Issues Encountered
- pnpm install required two attempts due to version mismatches (konva, quadtree-js) — resolved with auto-fixes above

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- React 19 + react-konva Stage with two layers ready for Plan 02 (NodeRenderer/EdgeRenderer)
- graphStore.subscribe() in ArchCanvas.tsx is the hook point — Plans 02/03 add renderers there
- ZoneConfig exported and ready for use by IncrementalPlacer in Plan 04
- TypeScript compiles clean with zero errors
- Vite dev server ready to serve the app (requires browser to verify visual output)

---
*Phase: 06-canvas-renderer-and-layout-engine*
*Completed: 2026-03-16*
