# Phase 7: React UI Shell and Activity Feed - Research

**Researched:** 2026-03-15
**Domain:** React UI panels — activity feed, node inspector, risk panel — wired to Zustand stores fed by WebSocket inference messages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Activity Feed Narration**
- Batch rapid successive changes into summaries (e.g., "5 components updated in AuthModule") rather than showing each individually
- Terse technical tone: short, precise descriptions like "AuthService created → depends on UserRepo, TokenStore"
- Color-coded icons per event type (green for creation, orange for risk, blue for dependency change)
- Keep last ~50 events visible, auto-prune older entries for performance

**Panel Layout & Arrangement**
- Right sidebar stack: all three panels stacked vertically, canvas takes the main area
- All panels independently collapsible to give more canvas space
- Fixed sidebar width (no drag-to-resize)
- Panel order top to bottom: Inspector → Risk → Feed

**Risk Panel Presentation**
- Color-coded severity levels: red/orange/yellow for critical/warning/info
- Reviewed risks collapse into a "3 reviewed" counter (expandable if needed), rather than staying visible
- Clicking a risk highlights affected node(s) on the canvas and pans to them
- Badge count on collapsed panel header shows unreviewed risk count

**Node Inspector**
- Shows three sections: affected files, dependency list (depends on / depended by), and recent changes
- Opens by expanding the inspector section in the sidebar (not a floating popover)
- Single-node mode: clicking a different node replaces the current inspector view
- Selecting a node highlights its dependency edges on the canvas

### Claude's Discretion
- Exact color palette and icon choices for event types and severity
- Sidebar width value
- Panel collapse/expand animation style
- Empty state messaging for each panel
- Glow/pulse animation implementation for active components (UI-03, UI-04)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Activity feed displays architectural changes in natural language (e.g., "Created AuthService", "API now depends on AuthService") | `ArchitecturalEvent` type from `InferenceMessage` carries `type` + `nodeId` + `targetNodeId`; event-to-sentence mapping is a pure function |
| UI-02 | Activity feed shows architectural-level events only, not individual file changes | `InferenceMessage.architecturalEvents` is already filtered to corroborated semantic events (EventCorroborator threshold=2); no file-level events are in this array |
| UI-03 | Active components glow or pulse to indicate where the agent is currently working | `AnimationQueue` already handles glow on the canvas; the sidebar needs to show which nodes are "active" in the inspector — this is a client-side derived state from recency of delta updates |
| UI-04 | Glow/pulse animations decay after 30 seconds of inactivity | Canvas glow decay is already implemented in `AnimationQueue` (DECAY_MS=30_000); sidebar active indicators need parallel decay tracking in the new inference store |
| UI-05 | User can click any node to inspect details: affected files, dependencies, recent changes | `GraphNode.fileList` supplies affected files; `graphStore` edges provide dependencies; inference store events keyed by nodeId provide recent changes |
| UI-06 | Risk panel displays architectural warnings (circular deps, boundary violations, fan-out) | `InferenceMessage.risks` array carries `RiskSignal` objects with `type`, `severity`, `details`, `nodeId`, `affectedNodeIds` |
| UI-07 | Risk panel shows only new risks prominently; reviewed risks are dimmed | "Reviewed" state is client-only; no server-side tracking needed; store a `Set<string>` of reviewed risk fingerprints |
</phase_requirements>

---

## Summary

Phase 7 builds the React UI shell that surrounds the existing Konva canvas. The canvas rendering (Phase 6) and WebSocket pipeline (Phase 5) are both complete. This phase's primary work is: (1) creating an `inferenceStore` (Zustand) that consumes `InferenceMessage` payloads already arriving in `wsClient.ts` but currently only `console.log`'d; (2) restructuring `App.tsx` to add a right sidebar with three panels (Inspector, Risk, Feed); and (3) writing three panel components that read from `graphStore` and `inferenceStore`.

The integration points are well-defined. `wsClient.ts` at line 196 already receives `inference` messages but does nothing with them — wiring an `inferenceStore.applyInference()` call there is the primary connection. The `selectedNodeId` is already tracked in `App.tsx` state and passed from `ArchCanvas` — it just needs to flow down to the Inspector panel. Canvas cross-panel interactions (risk click → pan to node, node select → highlight edges) use the `viewportControllerRef` already in `App.tsx`.

The stack is already established: React 19 + Zustand 5 + Zod schemas already written. No new dependencies are needed for the core panels. The only discretionary choice is whether to use CSS transitions for panel collapse (zero deps, appropriate for this scale) or a lightweight animation library. Given that StrictMode is intentionally disabled for Konva compatibility and all styles are inline objects (no CSS modules in the codebase), CSS transitions via inline `style` should be used.

**Primary recommendation:** Extend `graphStore` with an `inferenceStore` (separate Zustand slice), wire it in `wsClient`, restructure `App.tsx` to layout canvas + sidebar, then build three panel components that read from the stores.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | UI component rendering | Already in project; phase adds panel components |
| Zustand | 5.0.11 | State management for inference data | Already in project for `graphStore`; add `inferenceStore` with identical pattern |
| Zod | 3.25.67 | Schema validation for incoming WS messages | Already in project; `RiskSignalSchema`, `ArchitecturalEventSchema` already written in `serverMessages.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React built-in useState/useEffect | N/A | Panel collapse state, reviewed risk Set | All panel interaction state is local or store-backed; no additional library needed |
| CSS transitions via inline style | N/A | Panel collapse animation | Project uses inline styles exclusively (no CSS modules); transitions via `style={{ maxHeight, overflow: 'hidden', transition }}` are idiomatic |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline style transitions | Framer Motion / react-spring | These are valid libraries but add deps. Given StrictMode is disabled, animation libraries that double-invoke effects should be evaluated. For panel collapse (simple height transition), CSS transitions are sufficient. |
| Separate inferenceStore | Adding inference state to graphStore | Concerns of motion: graphStore is consumed imperatively by the Konva canvas; adding mutable inference lists risks breaking the `subscribe()` pattern. Keep stores separate. |

**Installation:** No new packages required for core functionality.

---

## Architecture Patterns

### Recommended Project Structure

```
packages/client/src/
├── store/
│   ├── graphStore.ts          # Existing — nodes, edges, connectionStatus
│   └── inferenceStore.ts      # NEW — activity events, risks, active nodes
├── panels/
│   ├── ActivityFeed.tsx       # NEW — UI-01, UI-02
│   ├── RiskPanel.tsx          # NEW — UI-06, UI-07
│   └── NodeInspector.tsx      # NEW — UI-05
├── App.tsx                    # MODIFY — add sidebar layout, pass selectedNodeId to Inspector
└── ws/
    └── wsClient.ts            # MODIFY — wire inference messages to inferenceStore
```

### Pattern 1: Inference Store (Zustand slice)

**What:** A Zustand store separate from `graphStore` that accumulates activity events and risks from `InferenceMessage` payloads.
**When to use:** Any React component that needs to read inference data (feed items, risk signals, active node set).

```typescript
// packages/client/src/store/inferenceStore.ts
import { create } from 'zustand';
import type { ArchitecturalEvent, RiskSignal } from '@archlens/shared/types';

export interface ActivityItem {
  id: string;                    // unique — timestamp + nodeId
  event: ArchitecturalEvent;
  sentence: string;              // pre-computed natural language
  timestamp: number;
}

export interface RiskItem {
  id: string;                    // fingerprint — type + nodeId
  signal: RiskSignal;
  firstSeen: number;
  reviewed: boolean;
}

export interface InferenceStore {
  activityFeed: ActivityItem[];  // max 50, newest first
  risks: Map<string, RiskItem>;  // keyed by fingerprint
  activeNodeIds: Set<string>;    // nodes with recent delta activity (for UI-03/UI-04)

  applyInference: (msg: InferenceMessage) => void;
  markRiskReviewed: (riskId: string) => void;
  pruneExpiredActive: () => void;
}

export const useInferenceStore = create<InferenceStore>()((set, get) => ({
  activityFeed: [],
  risks: new Map(),
  activeNodeIds: new Set(),

  applyInference: (msg) => {
    const now = Date.now();
    // ... add events, update risks, extend activityFeed (capped at 50)
  },
  markRiskReviewed: (riskId) => {
    const risks = new Map(get().risks);
    const item = risks.get(riskId);
    if (item) risks.set(riskId, { ...item, reviewed: true });
    set({ risks });
  },
  pruneExpiredActive: () => {
    // Remove nodeIds whose last update was > 30s ago
  },
}));

// Vanilla reference for wsClient (same pattern as graphStore)
export const inferenceStore = useInferenceStore;
```

**Key:** Use the same `create<Store>()((set, get) => ...)` double-paren pattern already established in `graphStore.ts`. The vanilla reference pattern (`export const inferenceStore = useInferenceStore`) is already how `wsClient.ts` calls `graphStore.getState().applyDelta(...)` without React context.

### Pattern 2: WsClient Wiring (one-line change)

**What:** Wire inference messages from `wsClient.ts` into `inferenceStore`.

In `wsClient.ts` at line 196-200, the `inference` case currently only does `console.log`. Replace with:

```typescript
// wsClient.ts — inference case
case 'inference': {
  inferenceStore.getState().applyInference(msg as unknown as InferenceMessage);
  break;
}
```

This is identical to how `graphStore.getState().applyDelta(msg)` is called for graph deltas. Import `inferenceStore` at top of file.

### Pattern 3: App Layout Restructure

**What:** Wrap the existing canvas + controls in a flex layout that adds a right sidebar.

```tsx
// App.tsx — layout root
<div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0f' }}>
  {/* Canvas area — flex-grow fills remaining width */}
  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
    <ArchCanvas ... />
    {/* Nav controls overlay stays positioned: top-right within this div */}
    {/* Minimap stays positioned: bottom-right within this div */}
  </div>

  {/* Right sidebar — fixed width, scrollable panels */}
  <div style={{ width: SIDEBAR_WIDTH, display: 'flex', flexDirection: 'column', ... }}>
    <NodeInspector selectedNodeId={selectedNodeId} viewportController={viewportControllerRef.current} />
    <RiskPanel viewportController={viewportControllerRef.current} />
    <ActivityFeed />
  </div>
</div>
```

**IMPORTANT:** The existing `position: fixed` nav buttons in `App.tsx` will need to change to `position: absolute` relative to the canvas container, because `fixed` positioning is relative to the viewport — with a sidebar the buttons will overlap the sidebar at their current `right: 16` positioning.

### Pattern 4: Event-to-Sentence Mapping

**What:** Convert `ArchitecturalEvent.type` to a human-readable sentence (UI-01 requirement).

```typescript
// utils/eventSentence.ts
import { ArchitecturalEventType } from '@archlens/shared/types';
import type { ArchitecturalEvent } from '@archlens/shared/types';

export function toSentence(event: ArchitecturalEvent, nodeNameFn: (id: string) => string): string {
  const name = nodeNameFn(event.nodeId);
  const targetName = event.targetNodeId ? nodeNameFn(event.targetNodeId) : '';

  switch (event.type) {
    case ArchitecturalEventType.COMPONENT_CREATED:
      return `${name} created`;
    case ArchitecturalEventType.COMPONENT_SPLIT:
      return `${name} split`;
    case ArchitecturalEventType.COMPONENT_MERGED:
      return `${name} merged`;
    case ArchitecturalEventType.DEPENDENCY_ADDED:
      return `${name} → depends on ${targetName}`;
    case ArchitecturalEventType.DEPENDENCY_REMOVED:
      return `${name} → removed dep on ${targetName}`;
    default:
      return `${name} updated`;
  }
}
```

The `nodeNameFn` reads from `graphStore.getState().nodes.get(id)?.name ?? id`. This keeps the sentence function pure and testable.

### Pattern 5: Risk Fingerprinting (UI-07)

**What:** Stable identity for risk items so "reviewed" state persists across re-detections of the same risk.

```typescript
function riskFingerprint(signal: RiskSignal): string {
  // For circular_dependency: use the full path set (sorted to handle rotation)
  if (signal.affectedNodeIds && signal.affectedNodeIds.length > 1) {
    return `${signal.type}:${[...signal.affectedNodeIds].sort().join(',')}`;
  }
  return `${signal.type}:${signal.nodeId}`;
}
```

When `applyInference` receives new risks: if the fingerprint already exists in the `risks` Map and is marked reviewed, preserve the `reviewed: true` state. If the fingerprint is new, add with `reviewed: false`.

### Pattern 6: Cross-Panel Interactions

**What:** Risk click → highlight canvas node and pan to it. Node select → highlight dependency edges.

The `viewportControllerRef` in `App.tsx` already provides `fitToView()` and zoom methods. For "pan to node", `ViewportController` needs a `panToNode(nodeId)` method added, or App.tsx exposes a callback that inspects node position from `nodeRenderer.getPosition(nodeId)` and calls `viewport.setPosition(...)`.

**Simpler approach:** Pass a `onHighlightNode: (nodeId: string) => void` callback from `App.tsx` down to `RiskPanel`. In App.tsx, this callback reads node position from `graphStore` and calls the viewport controller. The canvas click-to-select already handles edge highlighting via `highlightDependency()` in `ArchCanvas.tsx` — the Inspector panel just needs the reverse: trigger the canvas's click handler programmatically, or expose `selectNode(nodeId)` as a method.

**Practical pattern:** Add an `onSelectNode` imperative handle. `ArchCanvas` already calls `onSelectNode?.(nodeId)` on click — for cross-panel trigger, add a `selectNodeRef` that can be called from the sidebar. OR: simplest approach is to lift `selectedNodeId` to a writable store field and have `ArchCanvas` react to it.

### Anti-Patterns to Avoid

- **`position: fixed` for sidebar-relative elements:** The existing nav controls use `position: fixed; right: 16`. With a sidebar, the canvas no longer occupies full viewport width. Change nav button container to `position: absolute` within the canvas wrapper div.
- **Storing inference events in `graphStore`:** The canvas uses `graphStore.subscribe()` imperatively. Adding inference arrays to that store's shape would cause unnecessary canvas re-evaluations on every new event. Keep `inferenceStore` completely separate.
- **Re-rendering Inspector on every graphStore update:** Use `useGraphStore(state => state.nodes.get(selectedNodeId))` with a selector to avoid re-renders when unrelated nodes change. Zustand selectors (second argument to `useStore`) prevent this.
- **Batching activity items inside the component:** Batching (collapsing "5 components updated") belongs in `inferenceStore.applyInference()`, not in the React component. The component just renders what the store provides.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence generation for each event type | Ad-hoc string concatenation in component render | `toSentence()` utility function (pure, outside component) | Keeps component lean, testable separately |
| Risk deduplication and fingerprinting | React state management | `inferenceStore.risks` Map keyed by fingerprint | Survives component remounts, consistent with other store patterns |
| Panel collapse animation | Custom JS animation | CSS `max-height` + `overflow: hidden` + `transition` | Already how the project handles UI states (all inline style); CSS handles timing natively |
| Node name lookup in panels | Passing `nodes` Map as prop | `useGraphStore(s => s.nodes)` Zustand selector | Selector subscribes panel to only the `nodes` slice, avoids prop drilling |

**Key insight:** The data pipeline (WS → store → component) is already established. Phase 7 is primarily "read from the correct store, render appropriately" — not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: `position: fixed` nav buttons land inside sidebar

**What goes wrong:** `App.tsx` currently has nav controls at `position: fixed; top: 16; right: 16`. When a 280px-wide sidebar is added, `right: 16` still means 16px from the viewport edge — which is inside the sidebar, not the canvas area.

**Why it happens:** `position: fixed` is viewport-relative, not parent-relative.

**How to avoid:** Change the canvas wrapper `<div>` to `position: relative`. Change nav controls to `position: absolute; top: 16; right: 16` within that div. The controls will then be 16px from the canvas right edge.

**Warning signs:** Buttons appear overlapping the sidebar panels on first render.

### Pitfall 2: InferenceMessage ignored by wsClient until wired

**What goes wrong:** Phase 5 left `case 'inference'` as `console.log('[WS] Inference:', msg)`. Until `inferenceStore` is created and wired, the entire Phase 7 UI will render empty panels — no errors, just no data.

**Why it happens:** The stub was intentionally left for Phase 7.

**How to avoid:** First task in Phase 7 must be: create `inferenceStore`, wire `wsClient.ts` inference case, verify messages arrive in the store before building panel UI.

**Warning signs:** Activity feed renders empty even when code changes are happening; `console.log` still shows inference messages.

### Pitfall 3: Risk items accumulate forever (memory leak)

**What goes wrong:** `inferenceStore.risks` Map grows without bound. `RiskDetector` re-fires risks every delta — a node above the fan-out threshold will emit a new `RiskSignal` on every change.

**Why it happens:** `applyInference` naively pushes to the Map on every message.

**How to avoid:** Use the fingerprint pattern. If a fingerprint already exists in the Map, update the signal's `details` (in case count changed) but don't add a new entry. For resolved risks (circular dep no longer detected), implement a `cyclesRemoved` analogue — but the current `InferenceResult` doesn't include explicit "risk resolved" events. Practical solution: risks in the store are refreshed each inference cycle. Replace the risk Map contents with the latest signals, but preserve `reviewed` state for matching fingerprints.

**Warning signs:** Risk panel shows duplicate entries for the same circular dependency.

### Pitfall 4: Zustand selector over `nodes.get(id)` causes unnecessary re-renders

**What goes wrong:** `useGraphStore(s => s.nodes.get(selectedNodeId))` — the selector function creates a new reference each render because `Map.get()` returns a new value reference even for the same object. Zustand uses `Object.is` for comparison by default.

**Why it happens:** `Map.get()` returns the same object reference if the Map hasn't changed, but if `nodes` is a new Map (which `applyDelta` always creates), the selected node object reference changes even if its data is identical.

**How to avoid:** Use the Zustand `shallow` equality function or select a specific field:
```typescript
const node = useGraphStore(s => s.nodes.get(selectedNodeId ?? ''));
// node will be a stable reference as long as the node data hasn't changed
// because applyDelta only creates new objects for changed nodes
```

This is actually safe: `applyDelta` in `graphStore.ts` only puts new objects in the Map for `addedNodes` and `updatedNodes`. Unchanged nodes keep the same reference. So `Map.get()` on an unchanged node will return the same object reference. The re-render risk is lower than it appears.

**Warning signs:** Inspector panel re-renders on every delta even for unrelated node changes.

### Pitfall 5: Canvas pan-to-node requires node world coordinates

**What goes wrong:** `ViewportController.fitToView()` exists, but "pan to node" (needed for risk click → navigate to node) requires knowing the node's world-space coordinates.

**Why it happens:** Node positions live in `NodeRenderer`'s private `positions` Map inside the `useEffect` closure in `ArchCanvas.tsx`. They are not in `graphStore`.

**How to avoid:** Two options:
1. Read node position from Konva directly: `nodeRenderer.getShape(nodeId)?.position()` — but `nodeRenderer` is not exposed outside `ArchCanvas`.
2. Add a `onNodePositionQuery` callback from `ArchCanvas` to `App.tsx`, or add `panToNode(nodeId: string)` to `ViewportController` that can be called via `viewportControllerRef`.

**Recommended:** Add a `panToNode(x: number, y: number)` method to `ViewportController` (simple transform invert and `stage.position()` update). Add a `getNodeWorldPosition(nodeId: string)` to `ArchCanvas` via an imperative handle. OR: expose `nodePositions` as a separate Map in `graphStore` updated by the canvas subscribe callback. The simplest approach that fits the existing pattern: `ArchCanvas` calls an `onNodePositionUpdate` callback with a `Map<string, {x, y}>` after each layout tick, and `App.tsx` stores this in a ref for sidebar callbacks.

### Pitfall 6: Activity feed "batching" window conflicts with store

**What goes wrong:** User decision: "Batch rapid successive changes into summaries." The `wsClient.ts` already batches deltas at 500ms, but inference messages are not batched — they arrive one per delta (InferenceEngine fires after each delta). Multiple inference messages in quick succession will produce individual feed entries.

**Why it happens:** There is no batch timer for inference messages in `wsClient.ts`.

**How to avoid:** Implement batching in `inferenceStore.applyInference()` rather than `wsClient.ts`. Keep a 1-second debounce window internally — accumulate events, then flush. OR: the simpler approach — when adding to `activityFeed`, if the last item has the same primary node and occurred < 2 seconds ago, replace it with a summary ("N events in AuthModule"). This is a post-hoc merge, not a true batch window, and is simpler to implement.

---

## Code Examples

Verified patterns from existing codebase:

### Zustand store with vanilla reference (matches existing graphStore.ts pattern)

```typescript
// Source: packages/client/src/store/graphStore.ts lines 37, 113
export const useInferenceStore = create<InferenceStore>()((set, get) => ({
  // ... initial state
}));

// Vanilla reference for wsClient (non-React callers)
export const inferenceStore = useInferenceStore;
```

### Zustand selector to subscribe to a specific node (avoids full re-render)

```typescript
// React component — only re-renders when the specific node changes
const node = useGraphStore(s => selectedNodeId ? s.nodes.get(selectedNodeId) : undefined);
const edges = useGraphStore(s => s.edges);
```

### Panel collapse with CSS transition (inline style pattern)

```tsx
// Matches project inline style pattern (no CSS modules)
const [collapsed, setCollapsed] = useState(false);
return (
  <div>
    <div onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer', ... }}>
      Inspector {collapsed ? '▶' : '▼'}
    </div>
    <div style={{
      maxHeight: collapsed ? 0 : 400,
      overflow: 'hidden',
      transition: 'max-height 0.2s ease',
    }}>
      {/* Panel content */}
    </div>
  </div>
);
```

### Wiring inferenceStore in wsClient (one-line change to existing case)

```typescript
// Source: packages/client/src/ws/wsClient.ts line 196
// BEFORE (stub):
case 'inference': {
  console.log('[WS] Inference:', msg);
  break;
}

// AFTER (Phase 7):
case 'inference': {
  inferenceStore.getState().applyInference(msg as unknown as InferenceMessage);
  break;
}
```

### Risk item fingerprint — stable identity across inference cycles

```typescript
function riskFingerprint(signal: RiskSignal): string {
  if (signal.affectedNodeIds && signal.affectedNodeIds.length > 0) {
    return `${signal.type}:${[...signal.affectedNodeIds].sort().join(',')}`;
  }
  return `${signal.type}:${signal.nodeId}`;
}
```

### Sidebar layout with canvas flex-grow

```tsx
// App.tsx root — replaces current single-div layout
<div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0f' }}>
  {/* Canvas area */}
  <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
    <ArchCanvas width={dimensions.width} height={dimensions.height} ... />
    {/* Nav buttons: change from position:fixed to position:absolute */}
    <div style={{ position: 'absolute', top: 16, right: 16, ... }}>
      ...
    </div>
    <MinimapStage ... />
  </div>

  {/* Right sidebar */}
  <div style={{ width: 280, flexShrink: 0, background: '#0d0d14', borderLeft: '1px solid rgba(255,255,255,0.08)', ... }}>
    <NodeInspector selectedNodeId={selectedNodeId} ... />
    <RiskPanel onHighlightNode={handleHighlightNode} ... />
    <ActivityFeed />
  </div>
</div>
```

---

## Data Flow Reference

This diagram captures the complete data flow for Phase 7:

```
Server (InferenceEngine)
  ↓ 'inference' event → websocket.ts broadcasts InferenceMessage
  ↓
wsClient.ts — handleMessage() case 'inference'
  ↓ inferenceStore.getState().applyInference(msg)
  ↓
inferenceStore (Zustand)
  ├── activityFeed[]     → ActivityFeed.tsx (reads via useInferenceStore)
  ├── risks Map          → RiskPanel.tsx (reads via useInferenceStore)
  └── activeNodeIds Set  → could inform Inspector "recently active" badge

graphStore (Zustand) — unchanged from Phase 5/6
  ├── nodes Map          → NodeInspector.tsx (reads node.fileList, edge counts)
  └── edges Map          → NodeInspector.tsx (filters edges by selectedNodeId for deps)

App.tsx
  ├── selectedNodeId state (set by ArchCanvas onSelectNode callback)
  │     ↓ passed to NodeInspector
  ├── viewportControllerRef (set by ArchCanvas)
  │     ↓ used by RiskPanel.onHighlightNode → viewport.panToNode()
  └── dimensions state (ResizeObserver — existing)
        ↓ passed to ArchCanvas (canvas must respect sidebar width reduction)
```

**Canvas dimensions change:** When the sidebar is added, `dimensions.width` must be the canvas wrapper's width (not `window.innerWidth`). The existing `ResizeObserver` in `App.tsx` already measures `containerRef.current.clientWidth` — it just needs `containerRef` to point to the canvas wrapper `<div>` (flex item), not the full viewport div. This is a one-line change.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React class components with local state | React function components + Zustand | 2020+ | All Phase 7 components should be function components |
| Redux for client state | Zustand 5 (already in project) | 2021+ | `create<Store>()((set, get) => ...)` double-paren pattern already established |
| CSS-in-JS libraries (emotion, styled-components) | Inline style objects | Already used in project | Stay consistent — do not introduce CSS-in-JS |
| `useReducer` for complex panel state | Zustand slice | Already used in project | Panel-level state (collapsed, reviewed risks) fits better in component `useState` for collapse; `inferenceStore` for data |

**Deprecated/outdated:**
- `React.StrictMode`: Intentionally disabled in this project (`main.tsx`) to prevent Konva double-mount. Do not add it.
- `react-redux`: Not in project. Zustand is the chosen store.

---

## Open Questions

1. **How does "pan to node" work cross-panel?**
   - What we know: `viewportControllerRef.current` is accessible in `App.tsx`; `ViewportController` has `fitToView()` and `zoomIn/Out()`; node world positions are in `NodeRenderer.positions` (private, inside `ArchCanvas` useEffect closure)
   - What's unclear: How to get a specific node's world coordinates from outside `ArchCanvas`
   - Recommendation: Add `panToNode(x: number, y: number)` to `ViewportController`. Add a `onNodeSelected` callback from `ArchCanvas` that also passes the node's world position. Or, store node positions in a module-level Map that both `ArchCanvas` and sidebar callbacks can read.

2. **Should "active nodes" (UI-03) be tracked in inferenceStore or derived from graphStore deltas?**
   - What we know: `AnimationQueue` already tracks which nodes are "glowing" for the canvas. The sidebar needs to show which nodes are "currently active" (recently modified). `graphStore.subscribe()` fires on every delta.
   - What's unclear: Whether to mirror `AnimationQueue`'s 30-second window in `inferenceStore`, or track it in `graphStore` as a `recentlyModifiedNodeIds: Set<string>` field.
   - Recommendation: Add `recentlyModifiedNodeIds: Set<string>` to `graphStore` itself (updated in `applyDelta` with a setTimeout cleanup after 30s). This keeps active tracking next to the graph data and avoids duplicating the window logic.

3. **What is the sidebar width?**
   - What we know: User decision says "fixed sidebar width (no drag-to-resize)" — exact value is Claude's discretion.
   - Recommendation: 280px. Enough for file paths and dependency lists to be readable without feeling cramped. The canvas area will be `windowWidth - 280` pixels.

4. **How does Inspector show "recent changes" for a selected node?**
   - What we know: `inferenceStore.activityFeed` contains `ActivityItem[]` each with an `event.nodeId`. Filtering by `selectedNodeId` gives recent events for that node.
   - What's unclear: Whether "recent changes" includes graph delta events (file modifications) that did NOT cross the EventCorroborator threshold=2 (and thus never produced an `ArchitecturalEvent`).
   - Recommendation: Scope "recent changes" in the Inspector to events in `inferenceStore.activityFeed` filtered by `nodeId`. This is clean and already available. Sub-threshold file changes are intentionally excluded (UI-02: feed shows architectural-level events only).

---

## Sources

### Primary (HIGH confidence)

- Project source code (`packages/client/src/`) — direct inspection of existing patterns
  - `graphStore.ts` — Zustand store pattern; double-paren create; vanilla reference
  - `wsClient.ts` lines 195-201 — confirmed `inference` case stub awaiting wiring
  - `App.tsx` — existing layout, `selectedNodeId` state, `viewportControllerRef`, ResizeObserver pattern
  - `ArchCanvas.tsx` — `onSelectNode` callback, `graphStore.subscribe()` imperative pattern
  - `AnimationQueue.ts` — 30-second decay already implemented, DECAY_MS constant
  - `schemas/serverMessages.ts` — `RiskSignalSchema`, `ArchitecturalEventSchema` already written
  - `packages/shared/src/types/inference.ts` — `ArchitecturalEvent`, `RiskSignal`, `InferenceResult` shapes confirmed
  - `packages/shared/src/types/messages.ts` — `InferenceMessage` wire type confirmed

### Secondary (MEDIUM confidence)

- Zustand 5 documentation patterns — confirmed by existing project usage of `create<T>()((set, get) => ...)` pattern and `.getState()` vanilla access

### Tertiary (LOW confidence)

- CSS `max-height` transition for collapse — widely used browser-native pattern; confirmed idiomatic for inline-style React components. Performance on 3 panels is negligible.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; no new deps needed
- Architecture: HIGH — integration points fully mapped from source code inspection; data flow is clear
- Pitfalls: HIGH — pitfalls derived from direct code inspection (fixed positioning, inference stub, risk deduplication); not speculative

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable libraries; no fast-moving dependencies)
