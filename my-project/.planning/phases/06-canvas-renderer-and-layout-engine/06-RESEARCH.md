# Phase 6: Canvas Renderer and Layout Engine - Research

**Researched:** 2026-03-15
**Domain:** HTML5 Canvas rendering, React integration, force-directed layout, animation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Node & edge visuals**
- Rounded rectangle nodes — clean boxes with rounded corners, label inside
- Color-coded fills per zone type — each node type (frontend, API, services, data stores, infrastructure) gets a distinct background color
- Node size scaled by connection count — nodes with more dependencies are slightly larger, highlighting hub components
- Curved bezier edges with arrowheads showing dependency direction

**Zone layout presentation**
- Subtle background shading behind each zone — zones visible but don't compete with nodes
- Zone labels (e.g., "Frontend", "Services") visible at low zoom levels, hidden when zoomed in
- Compact layout — nodes close together, maximize visible nodes for big-picture view
- Fixed zone proportions — zones occupy fixed canvas regions regardless of node count, predictable layout

**Activity glow & overlays**
- Glow color matches a brighter version of the node's own zone color — stays cohesive with palette
- Static glow + decay — solid bright glow that slowly dims over 30 seconds, no pulsing
- Edges glow too — when a node glows, its dependency edges also light up showing ripple of activity
- All active nodes glow simultaneously during burst activity — shows full scope

**Navigation & interaction**
- Zoom via scroll wheel + explicit +/− buttons in corner for keyboard users
- Toggleable minimap — small minimap showing full graph with viewport indicator, can be hidden
- Click to select + highlight — clicking a node selects it and highlights its direct dependencies
- Fit-to-view button + auto-fit on initial load — canvas fits the entire graph when first loaded, button to reset

### Claude's Discretion
- Exact color palette for zone fills and node types
- Edge curve tension and routing to avoid overlaps
- Label font sizing and truncation at different zoom levels
- Minimap size, position, and styling
- Glow intensity and exact decay curve
- Node border styling and selection highlight appearance
- Keyboard shortcuts for navigation (if any)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REND-01 | Architecture map renders on an HTML5 Canvas using Konva | Konva 10.2.2 + react-konva 19.x confirmed, Stage/Layer architecture documented |
| REND-02 | User can zoom and pan the architecture map smoothly | Zoom-to-pointer pattern documented: stage.scale() + stage.position() on wheel event; draggable stage for pan |
| REND-03 | Rendering uses viewport culling — only visible nodes are drawn | Konva has no built-in culling; must implement manually using node.visible(false) based on viewport bounds; d3-quadtree recommended for spatial queries |
| REND-04 | Canvas uses layer separation: static graph layer and animation overlay layer | Konva multi-layer architecture confirmed; each Layer is a separate canvas element; only animated layer redraws each frame |
| REND-05 | Renderer subscribes to state store imperatively, not through React re-renders | Zustand's store.subscribe() + Konva refs pattern confirmed; graphStore already exported as vanilla store |
| REND-06 | Map renders at 60fps with 300 nodes and active animations on mid-range hardware | Konva.Animation on animation layer only; layer.listening(false) on static layer; perfectDrawEnabled(false); shadowForStrokeEnabled(false) for glow nodes |
| LAYOUT-01 | Nodes positioned in semantic zones: frontend (left), API (center-left), services (center), data stores (right), external (outer ring), infrastructure (bottom) | d3-force with per-zone forceX/forceY centering forces + d3-force-boundary for hard zone containment; fixed zone proportions map to canvas regions |
| LAYOUT-02 | Existing nodes maintain their coordinates when the graph updates (sticky positions) | d3-force node.fx/node.fy fixes any positioned node; positions stored in a layout map keyed by node ID; loaded from DB via REST snapshot |
| LAYOUT-03 | New nodes are placed near related nodes within their assigned zone | d3-force link force pulls new node toward neighbors; forceX/forceY centers it in its zone; existing nodes have fx/fy so they don't move |
| LAYOUT-04 | The graph never performs a full reshuffle — only local adjustments for new nodes | Only new nodes (no fx/fy) move during simulation; existing nodes pinned with fx/fy; simulation runs briefly (alpha low) for incremental settling |
</phase_requirements>

---

## Summary

Phase 6 adds the visual heart of ArchLens: a Konva-based canvas renderer with a React wrapper, zone-constrained force layout, smooth zoom/pan navigation, and glow decay animations. The project already has Vite 8, TypeScript, and a Zustand graph store — this phase adds React, react-konva, and d3-force on top.

The critical architectural decision is the two-layer Konva setup: a static graph layer (redraws only when graph state changes) and an animation overlay layer (redraws every frame at 60fps). The static layer bypasses React's render cycle by subscribing to Zustand imperatively via `graphStore.subscribe()` and calling Konva node methods directly. The animation layer runs `Konva.Animation` which fires its own RAF loop against only that layer.

For layout, d3-force handles incremental placement through a strict sticky-node contract: existing nodes get `fx`/`fy` set immediately after first placement, so they never move again. New nodes enter with no `fx`/`fy`, get pulled toward their zone center and related neighbors by forces, and have their `fx`/`fy` set once they settle. This makes layout stable across all graph updates.

**Primary recommendation:** Use Konva 10.2.2 + react-konva 19.x with React 19 for rendering; d3-force 3.0 with per-zone forceX/forceY and d3-force-boundary for layout. Mount React only for the Stage shell; drive all node updates imperatively from Zustand subscriptions.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.1.0 | React runtime for component tree | Required by react-konva v19; project already on Vite 8 |
| react-dom | ^19.1.0 | React DOM renderer for mounting root | Pairs with react |
| konva | ^10.2.2 | HTML5 Canvas 2D framework (Stage, Layer, Shape) | Decision locked by REND-01; project decision from Phase 0 |
| react-konva | ^19.2.3 | React bindings for Konva | Maps Konva nodes to React components; provides Stage/Layer/Rect/Text/Line/Group |
| d3-force | ^3.0.0 | Force-directed layout with incremental updates | Native sticky node support via fx/fy; run headlessly (stop + tick); standard for graph layout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | ^6.0.1 | Vite plugin for React JSX transform and Fast Refresh | Required to add JSX/TSX support to existing Vite config |
| @types/react | ^19.0.0 | TypeScript types for React | Required for TSX compilation |
| @types/react-dom | ^19.0.0 | TypeScript types for ReactDOM | Required for ReactDOM.createRoot |
| d3-force-boundary | ^0.0.1 | Zone-based boundary constraints for d3-force | Soft constraint to keep nodes inside zone rectangles |
| @timohausmann/quadtree-js | ^2.2.0 | Spatial index for viewport culling | Fast O(log n) bounding-box queries; find visible nodes without iterating all 300 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force | dagre (already in project via @dagrejs/graphlib) | dagre does hierarchical layout (top-down); zone layout needs force simulation; dagre cannot do sticky incremental placement |
| d3-force | @antv/layout, elkjs | More complex APIs; force + fx/fy is simpler for this exact sticky incremental use case |
| react-konva | Vanilla Konva only (no React) | react-konva provides React component model for Stage shell; fine for imperative inner loop but adds no overhead since we bypass React for updates anyway |
| @timohausmann/quadtree-js | d3-quadtree | d3-quadtree is lower-level; @timohausmann/quadtree-js has simpler insert/retrieve by bounding box API for canvas rectangles |

**Installation:**
```bash
pnpm add react react-dom konva react-konva d3-force d3-force-boundary @timohausmann/quadtree-js
pnpm add -D @vitejs/plugin-react @types/react @types/react-dom
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/client/src/
├── main.tsx              # Changed from .ts → .tsx; mounts React root
├── App.tsx               # Root component: Stage shell + ViewportController
├── canvas/
│   ├── ArchCanvas.tsx    # Stage component; two layers; Zustand subscription
│   ├── NodeRenderer.ts   # Imperative: creates/updates Konva Rect+Text per node
│   ├── EdgeRenderer.ts   # Imperative: creates/updates Konva Line per edge
│   ├── ZoneRenderer.ts   # Imperative: draws zone background Rects with labels
│   ├── AnimationQueue.ts # Tracks active glow timestamps; runs Konva.Animation
│   └── ViewportController.ts  # Zoom/pan handlers; fit-to-view; minimap sync
├── layout/
│   ├── IncrementalPlacer.ts   # d3-force simulation; sticky fx/fy contract
│   ├── ZoneConfig.ts          # Zone name → canvas region mapping
│   └── layoutStore.ts         # Zustand slice: node positions (id → {x,y})
├── minimap/
│   └── MinimapStage.tsx  # Second Konva Stage, small, shows viewport rect
├── store/
│   └── graphStore.ts     # Existing (Phase 5); unchanged
└── ws/
    └── wsClient.ts       # Existing (Phase 5); unchanged
```

### Pattern 1: Two-Layer Architecture (Static + Animation)

**What:** Konva Stage has two Layer elements. The graph layer holds all node/edge shapes and redraws only when graph state changes. The animation layer holds glow overlay shapes (transparent by default) and runs a continuous `Konva.Animation`.

**When to use:** Any time you have static content plus continuous animation. Avoids redrawing 300 nodes every frame.

**Example:**
```typescript
// Source: Konva docs - Layer Management + Optimize Animation
import Konva from 'konva';

const stage = new Konva.Stage({ container: 'app', width: w, height: h });

// Static layer — redraws only on graph delta
const graphLayer = new Konva.Layer();
graphLayer.listening(false); // no event detection needed on this layer

// Animation layer — redraws every RAF
const animLayer = new Konva.Layer();

stage.add(graphLayer);
stage.add(animLayer);

// Konva.Animation scoped to animLayer only
const anim = new Konva.Animation((frame) => {
  // Decay glow opacity based on frame.timeDiff
  animationQueue.tick(frame!.timeDiff);
}, animLayer);

anim.start();
```

### Pattern 2: Imperative Zustand Subscription (Bypass React Render)

**What:** Instead of using `useGraphStore()` inside a React component (which triggers re-renders), call `graphStore.subscribe()` outside React and imperatively update Konva nodes.

**When to use:** For the 300-node graph layer where every React re-render would destroy 60fps.

**Example:**
```typescript
// Source: Zustand docs - subscribe() + react-konva useRef pattern
import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Layer } from 'react-konva';
import { graphStore } from '../store/graphStore.js';

export function GraphLayer() {
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    // One-time initial render
    nodeRenderer.syncAll(graphStore.getState(), layer);

    // Subscribe to future changes — NO React re-render
    const unsub = graphStore.subscribe((state, prev) => {
      nodeRenderer.applyDelta(state, prev, layer);
      layer.batchDraw(); // Konva batches canvas repaints
    });

    return unsub; // Cleanup on unmount
  }, []);

  return <Layer ref={layerRef} listening={false} />;
}
```

### Pattern 3: Sticky Node Layout with d3-force

**What:** Existing nodes get `fx`/`fy` pinned on first placement. New nodes have no `fx`/`fy` — they free-float during a short simulation run, then get pinned once settled.

**When to use:** Any graph layout where position stability is a hard requirement (LAYOUT-02, LAYOUT-04).

**Example:**
```typescript
// Source: d3js.org/d3-force/simulation - fx/fy pinning
import { forceSimulation, forceLink, forceManyBody, forceX, forceY } from 'd3-force';
import { forceBoundary } from 'd3-force-boundary';
import type { SimNode } from './types.js';

export class IncrementalPlacer {
  private simulation = forceSimulation<SimNode>([]);
  private positions = new Map<string, { x: number; y: number }>();

  constructor(private zoneConfig: ZoneConfig) {
    this.simulation
      .force('charge', forceManyBody().strength(-30))
      .force('link', forceLink().id((d: SimNode) => d.id).distance(80))
      .alphaDecay(0.05) // Fast convergence for incremental updates
      .stop(); // Never animate — we run ticks manually
  }

  placeNewNodes(newNodes: GraphNode[], allNodes: GraphNode[], edges: GraphEdge[]): void {
    const simNodes: SimNode[] = allNodes.map(n => {
      const pos = this.positions.get(n.id);
      return {
        id: n.id,
        x: pos?.x ?? this.zoneConfig.getZoneCenter(n.zone).x,
        y: pos?.y ?? this.zoneConfig.getZoneCenter(n.zone).y,
        // Existing nodes: pinned with fx/fy
        ...(pos ? { fx: pos.x, fy: pos.y } : {}),
      };
    });

    this.simulation.nodes(simNodes);

    // Add per-zone boundary forces for new nodes
    for (const zone of this.zoneConfig.zones) {
      const bounds = zone.bounds;
      this.simulation.force(`boundary-${zone.name}`,
        forceBoundary(bounds.x0, bounds.y0, bounds.x1, bounds.y1)
          .strength(0.3)
      );
    }

    // Add zone centering forces
    this.simulation
      .force('x', forceX<SimNode>(n => this.zoneConfig.getZoneCenter(n.zone).x).strength(0.2))
      .force('y', forceY<SimNode>(n => this.zoneConfig.getZoneCenter(n.zone).y).strength(0.2));

    // Run 50 ticks — enough to settle new nodes near their zone centers
    this.simulation.alpha(0.3).tick(50);

    // Pin newly placed nodes
    for (const node of simNodes) {
      if (!this.positions.has(node.id)) {
        this.positions.set(node.id, { x: node.x, y: node.y });
      }
    }
  }
}
```

### Pattern 4: Zoom-to-Pointer Navigation

**What:** When user scrolls, zoom toward the cursor position by computing the cursor in stage coordinates before scaling, then repositioning.

**When to use:** Standard zoom/pan for canvas editors (REND-02).

**Example:**
```typescript
// Source: konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html
const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 0.05;
const MAX_SCALE = 5;

stage.on('wheel', (e) => {
  e.evt.preventDefault();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition()!;

  // Cursor position in stage-local coordinates
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  const direction = e.evt.deltaY < 0 ? 1 : -1;
  const newScale = Math.min(MAX_SCALE,
    Math.max(MIN_SCALE, oldScale * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)));

  stage.scale({ x: newScale, y: newScale });

  // Reposition so the point under cursor stays fixed
  stage.position({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  });
});
```

### Pattern 5: Glow Decay via Konva.Animation

**What:** When a node becomes active, record its activation timestamp. Each animation frame, compute elapsed time and set `shadowBlur` / `shadowOpacity` proportional to `1 - (elapsed / 30000)`. After 30s, remove the glow shape.

**When to use:** REND-04 animation overlay + 30-second decay requirement.

**Example:**
```typescript
// Source: konvajs.org/docs/animations/Create_an_Animation.html
export class AnimationQueue {
  private active = new Map<string, { shape: Konva.Rect; startTime: number; baseColor: string }>();
  private readonly DECAY_MS = 30_000;

  activate(nodeId: string, shape: Konva.Rect, zoneColor: string): void {
    this.active.set(nodeId, { shape, startTime: Date.now(), baseColor: zoneColor });
    shape.shadowEnabled(true);
    shape.shadowColor(zoneColor);
    shape.shadowBlur(20);
    shape.shadowOpacity(1);
  }

  // Called each frame by Konva.Animation with timeDiff
  tick(_timeDiff: number): void {
    const now = Date.now();
    for (const [id, entry] of this.active) {
      const elapsed = now - entry.startTime;
      if (elapsed >= this.DECAY_MS) {
        entry.shape.shadowEnabled(false);
        this.active.delete(id);
      } else {
        const progress = elapsed / this.DECAY_MS; // 0 → 1
        entry.shape.shadowOpacity(1 - progress);
        entry.shape.shadowBlur(20 * (1 - progress));
      }
    }
  }
}
```

### Pattern 6: Fit-to-View

**What:** Compute bounding rect of all nodes, then scale and position stage to fit.

**When to use:** Initial load auto-fit and fit-to-view button.

**Example:**
```typescript
// Source: konvajs.org API - stage.getClientRect(), stage.scale(), stage.position()
function fitToView(stage: Konva.Stage, padding = 40): void {
  const graphLayer = stage.findOne<Konva.Layer>('#graph-layer');
  if (!graphLayer) return;

  const box = graphLayer.getClientRect({ skipTransform: true });
  if (box.width === 0 || box.height === 0) return;

  const scaleX = (stage.width() - padding * 2) / box.width;
  const scaleY = (stage.height() - padding * 2) / box.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

  stage.scale({ x: scale, y: scale });
  stage.position({
    x: -box.x * scale + padding,
    y: -box.y * scale + padding,
  });
}
```

### Anti-Patterns to Avoid

- **React state for every node position:** Never put node x/y in React state or Zustand. Node positions live in `IncrementalPlacer.positions` and are written directly to Konva shape `.x()` / `.y()`. React state mutations would trigger component re-renders and destroy 60fps.
- **Calling layer.draw() in Konva.Animation update function:** The animation callback must only update properties. Konva handles the redraw automatically. Calling `layer.draw()` inside the callback causes double-redraws.
- **Caching every node individually:** Shape caching creates a canvas buffer per node. 300 individual caches = 300 extra canvases. Cache groups or zone containers, not individual nodes unless they have complex filters.
- **Shadows with stroke enabled:** `shadowForStrokeEnabled` defaults to true and adds an extra draw pass. Disable it on all nodes: `shape.shadowForStrokeEnabled(false)`. The visual difference is imperceptible for node rectangles.
- **Running d3-force in animated mode (simulation.restart()):** The simulation's internal timer fires ~300 ticks causing 300 layout updates visible to the user (nodes fly in). Always `simulation.stop()` then `simulation.tick(N)` for silent layout computation.
- **Not pinning new nodes after placement:** If a node lacks `fx`/`fy` it will continue to drift on every subsequent simulation run. Always set `node.fx = node.x; node.fy = node.y` after a node's position is decided.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport culling spatial queries | Custom O(n) loop checking every node against viewport bounds | `@timohausmann/quadtree-js` | Quadtree O(log n) lookup; hand-rolled loop is 300 iterations on every scroll/zoom event |
| Force-directed placement | Grid or bin-packing assignment | `d3-force` with forceX/forceY + forceBoundary | Gravity forces give natural clustering; hand-rolled placement ignores edge relationships |
| Zone boundary enforcement | Clamp positions after each tick | `d3-force-boundary` force | Post-tick clamping fights the simulation; boundary force participates in Verlet integration and resolves naturally |
| Animation timing | `setInterval` or `requestAnimationFrame` directly | `Konva.Animation` | Konva.Animation batches draws to the layer, avoids double-redraws, and integrates with Konva's internal redraw scheduling |
| Zoom-to-pointer math | Custom transform logic | Documented Konva pattern (stage.getPointerPosition + scale + reposition) | Off-by-one in coordinate space causes zoom to drift away from cursor; the exact pattern is well-tested |
| Minimap scaling | Render a thumbnail manually | Second Konva Stage + `layer.toCanvas()` or `stage.getClientRect()` scaling | Konva supports multiple Stage instances; scale down the second stage to show full graph |

**Key insight:** The hardest parts of this phase (layout stability, animation timing, spatial culling) are exactly where hand-rolled solutions fail at edge cases. Use libraries for these and focus implementation effort on the ArchLens-specific concerns (zone config, glow color mapping, delta-to-canvas sync).

---

## Common Pitfalls

### Pitfall 1: React Strict Mode Double-Mount Breaking Konva

**What goes wrong:** React 18+ (and 19) Strict Mode double-invokes `useEffect` in development. If `graphStore.subscribe()` is called inside a `useEffect` and the Stage's imperative Konva objects are initialized there, the second mount runs against a new Stage but the old subscription is still alive pointing at the destroyed layer.

**Why it happens:** Strict Mode unmounts and remounts components to detect side effects. The WsClient already avoids this by being a module-level singleton. The same pattern must apply to the Zustand subscription.

**How to avoid:** Return the `unsub` function from `useEffect` as the cleanup. The subscription setup must be idempotent: check `layerRef.current !== null` before subscribing. The imperative renderer objects (NodeRenderer, EdgeRenderer) should be created inside `useEffect` so they're tied to the component lifecycle.

**Warning signs:** Duplicate Konva shapes appearing after reconnect; shapes not updating when graph changes in dev but working in prod.

---

### Pitfall 2: Layer Listening Mode Breaking Hit Detection

**What goes wrong:** Setting `layer.listening(false)` on the graph layer prevents click events from reaching node shapes. The click-to-select requirement (CONTEXT.md) needs click events on the graph layer.

**Why it happens:** Konva's hit detection uses a hidden canvas on each layer. `listening(false)` disables the entire hit canvas for that layer.

**How to avoid:** Only set `listening(false)` on the animation overlay layer (glow shapes have no interactive purpose). Keep the graph layer's listening enabled. For the animation layer, `animLayer.listening(false)` is correct and saves the hit detection pass.

**Warning signs:** Click events on nodes stop working; nodes cannot be selected.

---

### Pitfall 3: d3-force Mutates Node Objects In-Place

**What goes wrong:** d3-force modifies the node objects you pass to `simulation.nodes()` — it adds `x`, `y`, `vx`, `vy`, `index` properties. If you pass GraphNode objects from the Zustand store directly, d3-force will mutate your canonical state objects.

**Why it happens:** d3-force's design mutates the passed-in array. The shared `GraphNode` type does not have `x`, `y`, `vx`, `vy` fields (and should not).

**How to avoid:** Create a separate `SimNode` type that extends or wraps `GraphNode`. Build the sim node array from the store state each time, mapping to a fresh plain object with the positions from `IncrementalPlacer.positions`. Never pass store nodes directly.

**Warning signs:** TypeScript errors on GraphNode about unexpected `x`/`y` properties; Zustand state diffs showing position mutations.

---

### Pitfall 4: Glow Shadow Performance with Many Active Nodes

**What goes wrong:** During a large refactor, all 300 nodes may be active simultaneously. 300 nodes with `shadowBlur: 20` on the animation layer, each redrawn every frame, drops below 60fps.

**Why it happens:** Canvas `shadowBlur` is expensive because it applies a convolution blur kernel per shape. At 300 active nodes × 60fps, this is significant CPU work.

**How to avoid:** The animation layer should only contain shapes for *currently active* nodes (not all 300). When a node's glow decays to zero, remove its overlay shape from the animation layer entirely. Glow shapes are added on activation and removed after decay. Also: use `shadowForStrokeEnabled(false)` to avoid the extra shadow-for-stroke draw pass.

**Warning signs:** Frame rate drops when many nodes become active simultaneously; profiler shows canvas shadow operations dominating.

---

### Pitfall 5: Viewport Culling Quadtree Staleness

**What goes wrong:** The quadtree is built from node positions at a point in time. After layout updates, positions change but the quadtree still has old coordinates. Viewport culling hides nodes that are now in view (they're still in old positions in the index).

**Why it happens:** Quadtrees are static; insertion is cheap but the entire structure must be rebuilt after bulk position changes.

**How to avoid:** Rebuild the quadtree after each layout run (IncrementalPlacer.placeNewNodes completes). During graph delta updates where positions don't change (node property updates), skip quadtree rebuild. Since layout only runs for new nodes, rebuilds are infrequent.

**Warning signs:** Nodes disappearing when they should be visible after zoom/pan; incorrect visible node set.

---

### Pitfall 6: Vite tsconfig Missing JSX Configuration

**What goes wrong:** The existing `packages/client/tsconfig.json` has no `jsx` compiler option. After adding `.tsx` files, TypeScript errors: "Cannot use JSX unless the '--jsx' flag is provided."

**Why it happens:** The current client is `.ts`-only (main.ts); JSX transform was never needed before.

**How to avoid:** Add `"jsx": "react-jsx"` to the `compilerOptions` in `packages/client/tsconfig.json`. Also add `@vitejs/plugin-react` to `vite.config.ts` and add `react`/`react-dom`/`@types/react`/`@types/react-dom` to the client's `package.json`. Rename `main.ts` → `main.tsx` and update `index.html` script src.

**Warning signs:** TypeScript compiler errors about JSX on `.tsx` files; Vite dev server failing to process JSX syntax.

---

## Code Examples

Verified patterns from official sources:

### React Root Mount (main.tsx)
```typescript
// Source: react.dev - createRoot API (React 19)
import { createRoot } from 'react-dom/client';
import { WsClient } from './ws/wsClient.js';
import { App } from './App.js';

// WsClient stays as module-level singleton (Phase 5 pattern preserved)
const wsClient = new WsClient();
wsClient.connect();

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
```

### Konva Stage Component with Two Layers
```typescript
// Source: konvajs.org/docs/react - Stage + Layer setup
import { useRef, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';

export function ArchCanvas({ width, height }: { width: number; height: number }) {
  const graphLayerRef = useRef<Konva.Layer>(null);
  const animLayerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const graphLayer = graphLayerRef.current;
    const animLayer = animLayerRef.current;
    if (!graphLayer || !animLayer) return;

    // Initialize renderers
    const nodeRenderer = new NodeRenderer(graphLayer);
    const edgeRenderer = new EdgeRenderer(graphLayer);
    const animQueue = new AnimationQueue(animLayer);

    // Subscribe to graph store imperatively
    const unsub = graphStore.subscribe((state, prev) => {
      nodeRenderer.sync(state.nodes, prev.nodes);
      edgeRenderer.sync(state.edges, state.nodes);
      graphLayer.batchDraw();
    });

    // Start animation loop on animation layer only
    const anim = new Konva.Animation((frame) => {
      animQueue.tick(frame!.timeDiff);
    }, animLayer);
    anim.start();

    return () => {
      unsub();
      anim.stop();
    };
  }, []);

  return (
    <Stage width={width} height={height} draggable>
      {/* Graph layer: no listening needed for performance */}
      <Layer ref={graphLayerRef} id="graph-layer" />
      {/* Anim layer: glow overlays, no hit detection */}
      <Layer ref={animLayerRef} id="anim-layer" listening={false} />
    </Stage>
  );
}
```

### Node Shape (Rounded Rect + Label)
```typescript
// Source: konvajs.org/docs/shapes/Rect.html, konvajs.org/api/Konva.Rect.html
import Konva from 'konva';

function createNodeShape(node: GraphNode, pos: Position, size: number): Konva.Group {
  const group = new Konva.Group({ id: node.id, x: pos.x, y: pos.y });

  const rect = new Konva.Rect({
    width: size,
    height: size * 0.6,
    offsetX: size / 2,
    offsetY: size * 0.3,
    fill: ZONE_COLORS[node.zone ?? 'infrastructure'],
    stroke: '#ffffff30',
    strokeWidth: 1,
    cornerRadius: 6,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false, // Performance: skip stroke shadow draw pass
  });

  const label = new Konva.Text({
    text: node.name,
    fontSize: 11,
    fill: '#ffffff',
    align: 'center',
    width: size,
    offsetX: size / 2,
    offsetY: 8,
    listening: false,
  });

  group.add(rect, label);
  return group;
}
```

### Bezier Edge Shape
```typescript
// Source: konvajs.org - Konva.Line with tension (bezier approximation)
import Konva from 'konva';

function createEdgeShape(edge: GraphEdge, srcPos: Position, tgtPos: Position): Konva.Line {
  return new Konva.Line({
    id: edge.id,
    points: [srcPos.x, srcPos.y, tgtPos.x, tgtPos.y],
    stroke: '#ffffff20',
    strokeWidth: 1,
    tension: 0.3,    // Konva cubic bezier approximation
    listening: false,
    perfectDrawEnabled: false,
  });
}
```

### Zone Background
```typescript
// Source: Konva.Rect + Konva.Text (zone labels)
import Konva from 'konva';

function createZoneBackground(zone: ZoneConfig): Konva.Group {
  const group = new Konva.Group({ listening: false });

  group.add(new Konva.Rect({
    x: zone.bounds.x0,
    y: zone.bounds.y0,
    width: zone.bounds.x1 - zone.bounds.x0,
    height: zone.bounds.y1 - zone.bounds.y0,
    fill: zone.bgColor,    // e.g., '#ffffff08'
    cornerRadius: 8,
    listening: false,
  }));

  group.add(new Konva.Text({
    x: zone.bounds.x0 + 8,
    y: zone.bounds.y0 + 8,
    text: zone.label,       // e.g., 'Frontend'
    fontSize: 13,
    fill: '#ffffff30',
    listening: false,
  }));

  return group;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Konva 9 + react-konva 18 | Konva 10.2.2 + react-konva 19.x (React 19 only) | react-konva v19, March 2025 | react-konva v19 requires React 19; peer deps: react ^19.2.0 |
| `@vitejs/plugin-react` v4 (Babel-based) | v6.0.1 (Oxc-based, no Babel dep) | Vite 8 release, 2025 | Smaller install, faster HMR; no Babel config needed unless using React Compiler |
| d3 v6 | d3-force v3.0.0 (ESM-native) | d3 v7 release | Pure ESM; import `{ forceSimulation }` from `'d3-force'` directly (not from `'d3'`) |
| `simulation.restart()` for layout | `simulation.stop(); simulation.tick(N)` | Documented pattern | Silent layout computation; no visual tick-by-tick node movement |
| `layer.draw()` | `layer.batchDraw()` | Konva API best practice | batchDraw coalesces multiple draw calls in same RAF frame |

**Deprecated/outdated:**
- `ReactDOM.render()`: Replaced by `createRoot()` in React 18+; required in React 19
- `Konva.isBrowser` and custom environment detection: Not needed since Konva 10 auto-detects
- `requestAnimationFrame` directly for Konva animation: Use `Konva.Animation` instead; it integrates with Konva's layer redraw scheduling

---

## Open Questions

1. **Layout position persistence and restoration**
   - What we know: PERS-02 says positions are cached in DB. Phase 1 established the layout_positions table via Drizzle. The REST `/api/snapshot` returns `InitialStateMessage` from Phase 5.
   - What's unclear: Does `InitialStateMessage` include layout positions? The shared types show `GraphNode` has no `x`/`y` fields. The server may need a separate `/api/layout` endpoint, OR positions can be included in the snapshot nodes.
   - Recommendation: Add `x?: number; y?: number` to `GraphNode` in shared types (nullable — null means "not yet placed"). Server populates from DB. Client's `IncrementalPlacer` reads these on snapshot and sets `fx`/`fy` immediately.

2. **Quadtree rebuild cost at 300 nodes during rapid deltas**
   - What we know: @timohausmann/quadtree-js rebuild on 1M objects is ~5ms. At 300 nodes it's negligible.
   - What's unclear: Whether to rebuild per-delta or only after layout runs.
   - Recommendation: Rebuild after every `graphStore.subscribe` delta that changes node count; skip if only edge updates. The cost at 300 nodes is under 1ms.

3. **react-konva TypeScript ref typing for Stage**
   - What we know: TypeScript errors occur with naive `useRef<Konva.Stage>()` on `<Stage ref={...}>`.
   - What's unclear: The exact correct typing for react-konva 19's Stage ref.
   - Recommendation: Use `useRef<Konva.Stage>(null)` with `ref={stageRef as React.RefObject<Konva.Stage>}` — this is documented in the react-konva TypeScript discussion. Alternatively, access stage through the layer: `layerRef.current.getStage()`.

4. **Dagre vs force simulation for initial layout**
   - What we know: STATE.md flags "Verify whether @dagrejs/dagre is used for initial layout only or replaced entirely by zone-constrained force simulation."
   - What's unclear: Whether dagre should run once for first-time placement vs pure d3-force.
   - Recommendation: Use d3-force exclusively. Dagre produces hierarchical (top-to-bottom) layouts unsuited to the zone-based left-right layout. d3-force with per-zone forceX/forceY and forceBoundary achieves the desired layout with no additional libraries.

---

## Sources

### Primary (HIGH confidence)
- konvajs.org/docs — Stage/Layer hierarchy, performance tips, Animation API, shadow API, zoom pattern, shape properties
- konvajs.org/api/Konva.Rect.html — cornerRadius, shadow properties confirmed
- d3js.org/d3-force/simulation — Current API, fx/fy fixing, tick(), stop(), incremental node updates
- github.com/konvajs/react-konva — Current version (19.2.3), peer deps (react ^19.2.0, konva ^10)
- github.com/konvajs/konva/releases — Konva latest version (10.2.2)

### Secondary (MEDIUM confidence)
- github.com/john-guerra/d3-force-boundary — forceBoundary API (x0,y0,x1,y1), strength(), hardBoundary() — verified with official repo
- npmjs.com/@timohausmann/quadtree-js — Quadtree library, bounding box insert/retrieve API
- vitejs/vite-plugin-react releases — @vitejs/plugin-react v6.0.1 confirmed current
- WebSearch results on react-konva + zustand imperative subscribe pattern — MEDIUM (confirmed with Zustand docs)

### Tertiary (LOW confidence)
- colinwren.is minimap implementation blog (site unreachable, content from Google description only)
- WebSearch on zone constraint implementation specifics — single sources, not cross-verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All library versions verified from official sources (Konva 10.2.2, react-konva 19.2.3, React 19.1, d3-force 3.0, @vitejs/plugin-react 6.0.1)
- Architecture: HIGH — Two-layer Konva pattern, Zustand subscribe, zoom-to-pointer all verified from official Konva docs
- Layout: MEDIUM-HIGH — d3-force fx/fy sticky pattern verified; d3-force-boundary verified from official repo; zone constraint approach is established pattern
- Pitfalls: HIGH — Based on official Konva performance docs, Konva issue tracker patterns, d3-force mutation behavior (official docs)
- Animation decay: HIGH — Konva.Animation API verified; glow via shadowBlur/shadowOpacity verified

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Konva and react-konva are actively maintained; re-verify versions before install)
