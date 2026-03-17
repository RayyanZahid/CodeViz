# Phase 16: Client State Layer and Mode Isolation - Research

**Researched:** 2026-03-17
**Domain:** React/Zustand state machine, WebSocket message interception, Konva morph animation
**Confidence:** HIGH

## Summary

Phase 16 introduces replay mode to the client: a mode-state machine that gates live WebSocket mutations away from the displayed graph, renders a historical snapshot fetched from the server, and provides an amber banner UI so the user always knows they are viewing the past. The infrastructure it depends on (server endpoints `GET /api/timeline` and `GET /api/snapshot/:id`) was completed in Phase 15. The client already has the Zustand store pattern (`graphStore`, `inferenceStore`), imperative Konva rendering (`NodeRenderer`, `EdgeRenderer`, `AnimationQueue`), and `ViewportController` with Konva.Tween — all the primitives needed for this phase exist and are stable.

The core engineering challenge is delta interception. The `WsClient.handleMessage` method is the single entry point for all WebSocket traffic. During replay, `graph_delta` and `inference` messages must not reach the stores — they must be buffered. The simplest and most reliable approach is to add a `replayStore` (a new Zustand slice) that holds `isReplay: boolean` and a `buffer: ServerMessage[]`. `WsClient.handleMessage` checks `replayStore.getState().isReplay` before dispatching to `graphStore` or `inferenceStore`; if true, graph_delta and inference messages are pushed into the buffer instead.

The morph animation (nodes moving from historical positions to live positions) uses Konva.Tween — the same API already used in `ViewportController.panToNode`. Node-level tweens require iterating over `NodeRenderer.shapes` and animating each `Konva.Group`'s `x` and `y`. The cool blue tint and node-fade-in/out are implementable as Konva opacity/fill overlays or by patching the `Rect`'s fill color transiently on the graph layer. The viewport auto-zoom on replay entry uses the existing `ViewportController.fitToView()`.

**Primary recommendation:** Add a dedicated `replayStore` (new Zustand slice, not merged into `graphStore`) that owns `isReplay`, `replayTimestamp`, `bufferedEvents`, and `bufferedEventCount`. Intercept in `WsClient.handleMessage` by checking `replayStore.getState().isReplay` before dispatching. Render the amber banner as a React component above `DirectoryBar` in `App.tsx` controlled by `useReplayStore`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mode Indicator:**
- Full-width amber/yellow banner across the top of the app when in replay mode
- Banner text: "REPLAY MODE" + the timestamp of the point being viewed (e.g., "REPLAY MODE — Mar 16, 2:30 PM")
- "Return to Live" button right-aligned inside the banner
- Button has a subtle pulse/glow animation to draw attention
- Live event counter displayed in the banner showing buffered events (e.g., "3 live events pending")

**Enter/Exit Replay:**
- Replay mode entered programmatically only (store action) — no UI entry point in Phase 16; Phase 17 adds timeline slider
- Exit is instant — no confirmation dialog
- Escape key as keyboard shortcut to exit replay
- Switching watch directory during replay auto-exits replay mode first, then switches
- Selected node preserved on exit if the node still exists in the live graph; cleared if removed
- Replay mode accessible even when disconnected — works with locally cached snapshot data
- All incoming data during replay is buffered (including reconnection recovery + new deltas) — nothing mutates the displayed graph

**Transition Behavior:**
- Enter replay: Nodes morph/animate from live positions to historical positions; added/removed nodes fade in/out
- Exit replay: Same morph animation back to live positions (consistent both directions)
- Full morph on exit: new nodes fade in, removed nodes fade out, existing nodes animate to new positions
- Viewport auto-zooms (smooth animated, ~500ms) to fit the historical graph on entry
- If snapshot includes stored node positions, use those exact positions (authentic historical view)
- Dragged positions during replay remembered for the current session but not persisted
- Nodes that don't exist at the replay point are hidden — no ghost/overlay
- Subtle cool blue tint on nodes/edges during replay to visually distinguish from live view
- If historical graph has 0 nodes, show empty canvas with centered message: "No architecture at this point in time"
- Smooth animated viewport zoom on replay entry (~500ms)

**Sidebar Behavior During Replay:**
- Activity feed filtered to show only events up to the replayed moment
- Risk panel filtered to show only risks that existed at the replay point
- Node inspector shows historical metadata (file stats as they were at the replay point, if snapshot data includes it)
- Minimap updates to reflect the historical graph

**Catch-up on Exit:**
- Buffered live events applied instantly (no animated catch-up) — graph jumps to current live state
- Activity feed shows both: a highlighted separator with summary ("12 events during replay") followed by individual events
- Events capped at 50 (matching existing feed cap) — summary shows total count if more
- Highlighted divider line with "Events during replay" label provides clear visual break

### Claude's Discretion

- Exact animation timing and easing curves for morph transitions
- Cool blue tint intensity and CSS implementation
- Pulse animation style for the "Return to Live" button
- Buffer data structure for holding live events during replay
- Zustand store architecture for mode state (new store vs extending existing)
- How to intercept WebSocket messages at the entry point during replay

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPLAY-03 | User sees a clear "REPLAY" mode indicator when viewing historical state | Amber full-width banner component in App.tsx; controlled by `replayStore.isReplay` and `replayStore.replayTimestamp` |
| REPLAY-04 | User can return to live view with a single action from replay mode | "Return to Live" button in banner calls `exitReplay()` store action; Escape key handler in App.tsx (same pattern as existing ESC for node inspector) |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 (installed) | New `replayStore` for mode state, buffer, timestamp | Already in project; double-paren pattern established |
| konva | ^10.2.1 (installed) | Konva.Tween for node morph animation, opacity for tint | Already powers all canvas rendering |
| react-konva | ^19.2.3 (installed) | React layer for Stage/Layer (no change) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useState/useEffect | built-in | Banner component, Escape key listener, pulse animation | Replay banner UI chrome |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New replayStore slice | Merge into graphStore | graphStore is already large; mode state is a different concern — new slice is cleaner and avoids coupling |
| Konva.Tween per node | CSS transitions | Canvas nodes are Konva shapes, not DOM — Konva.Tween is the correct tool |
| Intercepting in WsClient | Middleware in Zustand | WsClient.handleMessage is the single entry point; checking replayStore there is simpler and avoids Redux-style middleware complexity |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
packages/client/src/
├── store/
│   └── replayStore.ts          # New Zustand slice for replay mode state
└── panels/
    └── ReplayBanner.tsx        # Amber banner component shown during replay
```

Modified files:
```
packages/client/src/
├── ws/wsClient.ts              # Add buffer check in handleMessage
├── App.tsx                    # Mount ReplayBanner, wire Escape key for replay exit
├── store/inferenceStore.ts    # Add replayFilter helpers for feed/risk filtering
└── canvas/ArchCanvas.tsx      # Wire replay graph rendering (morph, tint)
```

### Pattern 1: replayStore Zustand Slice

**What:** A dedicated Zustand store slice that owns all replay mode state. Follows the exact same double-paren pattern established in `graphStore.ts` and `inferenceStore.ts`.

**When to use:** Entry point is `enterReplay(snapshotId, timestamp, nodes, edges)` called by Phase 17 timeline slider. Exit is `exitReplay()` called by banner button or Escape key.

```typescript
// Source: packages/client/src/store/replayStore.ts — new file following graphStore.ts pattern
import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '@archlens/shared/types';
import type { GraphDeltaMessage, InferenceMessage } from '@archlens/shared/types';

export interface ReplayStore {
  isReplay: boolean;
  replaySnapshotId: number | null;
  replayTimestamp: number | null;   // epoch ms — displayed in banner
  // The historical graph displayed while in replay
  replayNodes: Map<string, GraphNode>;
  replayEdges: Map<string, GraphEdge>;
  // Buffer of live messages that arrived during replay
  bufferedGraphDeltas: GraphDeltaMessage[];
  bufferedInferenceMessages: InferenceMessage[];

  // Actions
  enterReplay: (snapshotId: number, timestamp: number, nodes: GraphNode[], edges: GraphEdge[]) => void;
  exitReplay: () => void;
  bufferGraphDelta: (msg: GraphDeltaMessage) => void;
  bufferInference: (msg: InferenceMessage) => void;
  clearBuffer: () => void;
}

export const useReplayStore = create<ReplayStore>()((set, get) => ({
  isReplay: false,
  replaySnapshotId: null,
  replayTimestamp: null,
  replayNodes: new Map(),
  replayEdges: new Map(),
  bufferedGraphDeltas: [],
  bufferedInferenceMessages: [],

  enterReplay: (snapshotId, timestamp, nodes, edges) => {
    const nodesMap = new Map(nodes.map(n => [n.id, n]));
    const edgesMap = new Map(edges.map(e => [e.id, e]));
    set({
      isReplay: true,
      replaySnapshotId: snapshotId,
      replayTimestamp: timestamp,
      replayNodes: nodesMap,
      replayEdges: edgesMap,
      bufferedGraphDeltas: [],
      bufferedInferenceMessages: [],
    });
  },

  exitReplay: () => {
    set({
      isReplay: false,
      replaySnapshotId: null,
      replayTimestamp: null,
      replayNodes: new Map(),
      replayEdges: new Map(),
    });
    // Caller is responsible for draining the buffer into graphStore/inferenceStore
  },

  bufferGraphDelta: (msg) => {
    set(s => ({ bufferedGraphDeltas: [...s.bufferedGraphDeltas, msg] }));
  },

  bufferInference: (msg) => {
    set(s => ({ bufferedInferenceMessages: [...s.bufferedInferenceMessages, msg] }));
  },

  clearBuffer: () => {
    set({ bufferedGraphDeltas: [], bufferedInferenceMessages: [] });
  },
}));

export const replayStore = useReplayStore;
```

### Pattern 2: WsClient Delta Interception

**What:** In `WsClient.handleMessage`, check `replayStore.getState().isReplay` before dispatching `graph_delta` and `inference` messages. If replay is active, push to buffer instead.

**When to use:** This is the ONLY change needed to `WsClient`. All other message types (`initial_state`, `watch_root_changed`, `snapshot_saved`, `intent_updated`, `intent_closed`) continue to be processed normally — live graph state must still update behind the scenes so exit-replay can jump to current state.

```typescript
// Source: packages/client/src/ws/wsClient.ts — modified handleMessage switch cases

case 'graph_delta': {
  // Check replay mode FIRST — buffer instead of applying if in replay
  if (replayStore.getState().isReplay) {
    replayStore.getState().bufferGraphDelta(msg as unknown as GraphDeltaMessage);
    // Still track version for gap detection continuity
    this.lastQueuedVersion = msg.version;
    break;
  }
  // ... existing logic unchanged
  break;
}

case 'inference': {
  if (replayStore.getState().isReplay) {
    replayStore.getState().bufferInference(msg as unknown as InferenceMessage);
    break;
  }
  inferenceStore.getState().applyInference(msg as unknown as InferenceMessage);
  break;
}
```

**CRITICAL INSIGHT — version tracking during replay:** The `lastQueuedVersion` must still be updated when buffering `graph_delta` messages, otherwise a false version gap will be detected on replay exit when we resume normal operation. Update `lastQueuedVersion` even when buffering.

**CRITICAL INSIGHT — `initial_state` during replay:** If WS reconnects during replay and an `initial_state` arrives, it should NOT clear the displayed historical graph. The `initial_state` during replay is the live state — buffer it or handle it so the live graph store is updated silently (for exit-replay accuracy) but the displayed canvas is not changed. This is the trickiest edge case.

### Pattern 3: Konva Node Morph Animation

**What:** On replay entry/exit, animate each existing `Konva.Group`'s position from current coords to target coords using `Konva.Tween`. The `ViewportController.panToNode` already demonstrates this pattern correctly.

**When to use:** Called immediately after `replayStore.enterReplay()` is invoked in the ArchCanvas subscription or effect.

```typescript
// Source: packages/client/src/canvas/ArchCanvas.tsx — replay transition helper
// Pattern from existing ViewportController.panToNode which uses Konva.Tween

function morphNodeToPosition(
  nodeId: string,
  targetX: number,
  targetY: number,
  nodeRenderer: NodeRenderer,
  duration: number = 0.5,  // ~500ms per CONTEXT.md
): void {
  const shape = nodeRenderer.getShape(nodeId);
  if (!shape) return;
  const tween = new Konva.Tween({
    node: shape,
    x: targetX,
    y: targetY,
    duration,
    easing: Konva.Easings.EaseInOut,
    onFinish: () => tween.destroy(),
  });
  tween.play();
}
```

**For fade-in/out of added/removed nodes:** Use `opacity` property on the `Konva.Group`. Set opacity to 0 first, then tween to 1 for appearing nodes. Tween from 1 to 0 then `destroy()` for disappearing nodes.

### Pattern 4: Cool Blue Tint During Replay

**What:** Apply a subtle blue tint to all node rects and edges while in replay mode. Two approaches:

Option A (recommended): After loading the historical snapshot into `NodeRenderer`, iterate all shapes and adjust the `Rect` fill color toward `rgba(100, 160, 255, 0.85)` — a blue-shifted version of each zone color. Restore originals on exit.

Option B: Add a semi-transparent blue overlay `Konva.Rect` covering the entire canvas on a new layer above the graph layer. Simpler, but a full-canvas overlay is less targeted and can obscure click interactions.

**Recommendation:** Option A (per-node tint) is more authentic to the "historical view" feeling. Store the original fill colors before tinting; restore them on exit. The blue tint is a one-time post-snapshot operation, not per-frame.

### Pattern 5: Amber Banner Component

**What:** A React component that reads from `useReplayStore`. Renders above the `DirectoryBar` in the App flex column layout.

```typescript
// Source: packages/client/src/panels/ReplayBanner.tsx — new file
// Rendered in App.tsx as first child of the outer flex column

function ReplayBanner() {
  const isReplay = useReplayStore(s => s.isReplay);
  const replayTimestamp = useReplayStore(s => s.replayTimestamp);
  const bufferedCount = useReplayStore(s => s.bufferedGraphDeltas.length);
  const exitReplay = useReplayStore(s => s.exitReplay);

  if (!isReplay) return null;

  const formattedTime = replayTimestamp
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      }).format(new Date(replayTimestamp))
    : '';

  return (
    <div style={{
      width: '100%',
      height: 44,
      background: '#92400e',  // amber-800 — dark amber per dark UI
      borderBottom: '1px solid #d97706',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
      zIndex: 500,
    }}>
      <span style={{ color: '#fef3c7', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', flex: 1 }}>
        REPLAY MODE{formattedTime ? ` — ${formattedTime}` : ''}
        {bufferedCount > 0 && (
          <span style={{ marginLeft: 16, fontSize: 11, color: '#fde68a', fontWeight: 'normal' }}>
            {bufferedCount} live event{bufferedCount !== 1 ? 's' : ''} pending
          </span>
        )}
      </span>
      <ReturnToLiveButton onClick={exitReplay} />
    </div>
  );
}
```

### Pattern 6: Escape Key for Replay Exit

**What:** The existing ESC handler in `App.tsx` currently exits node inspector selection. It needs to be extended so that when `isReplay` is true, Escape exits replay mode instead (or in addition to).

```typescript
// In App.tsx — modify existing keydown handler
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (isReplay) {
        handleExitReplay();  // exit replay takes priority
        return;
      }
      if (selectedNodeId) {
        setSelectedNodeId(null);
      }
    }
  }
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedNodeId, isReplay]);
```

### Pattern 7: Catch-up Feed Separator on Exit

**What:** On `exitReplay()`, before draining the buffer, insert a separator activity item into `inferenceStore.activityFeed`. The separator is a special `ActivityItem` with a distinct style flag.

```typescript
// In inferenceStore.ts — add a separator item type
export interface ActivityItem {
  id: string;
  nodeId: string;
  sentence: string;
  iconColor: string;
  timestamp: number;
  isReplaySeparator?: boolean;  // NEW — renders as divider row in ActivityFeed
  replayEventCount?: number;    // total count of events during replay
}
```

The `ActivityFeed` component checks `item.isReplaySeparator` to render a divider row with "N events during replay" instead of the normal sentence layout.

### Pattern 8: Sidebar Filtering During Replay

**What:** `ActivityFeed` and `RiskPanel` need to show historical data during replay. Two sub-approaches:

**Activity Feed:** The historical snapshot from `GET /api/snapshot/:id` contains nodes and edges but NOT architectural events. The `inferenceStore.activityFeed` should be cleared/replaced on replay entry with events up to the replay point. Since the snapshot payload doesn't include events, the simplest approach is to **freeze** the current activityFeed at replay entry (don't clear it, just stop updating it because inference messages are buffered). The user sees events up to the moment of replay entry, which approximates "events up to the replayed moment."

**Risk Panel:** Same freeze approach — risks stop updating during replay because `inference` messages are buffered. This is accurate for the "risks at this point in time" requirement.

**Node Inspector:** Historical metadata comes from the snapshot's `nodes` array (which contains `lastModified`, `keyExports`, etc.). The inspector reads from `graphStore.nodes` — since we swap `graphStore` to hold the historical snapshot during replay, the inspector will automatically show historical data.

### Anti-Patterns to Avoid

- **Mutating graphStore during replay without tracking:** Do NOT call `graphStore.getState().applyDelta()` or `applySnapshot()` while in replay. The live state must be rebuilt from buffered deltas on exit — not tracked incrementally against the displayed replay graph.
- **Losing lastQueuedVersion continuity:** Version tracking in `WsClient` must continue even during replay (update `lastQueuedVersion` when buffering). Otherwise a false gap triggers snapshot recovery on exit.
- **Animating all nodes in a single synchronous loop:** Running hundreds of `new Konva.Tween()` synchronously is fine — Konva manages all tweens independently on its animation loop. Do NOT try to sequence them with `setTimeout`.
- **Forgetting the buffer cap:** The buffer is designed for short replay sessions. At-scale (thousands of deltas), the buffer could grow large. Consider a practical cap (500 messages) with overflow handling — if exceeded, note a warning and on exit trigger gap recovery (fetch current snapshot) instead of draining the buffer.
- **Blocking `initial_state` processing:** If WS reconnects during replay, the `initial_state` message contains the current live state. This must update the live graph store (`graphStore`) silently (for accurate exit-replay state). Do NOT buffer `initial_state` the same way as `graph_delta`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node position animation | Custom RAF loop | `Konva.Tween` | Already used in ViewportController; handles easing, cleanup, concurrent tweens natively |
| Viewport fit on replay entry | Custom zoom math | `ViewportController.fitToView()` | Already correctly computes bounding rect of graph layer and fits with padding |
| Timestamp formatting in banner | Custom date formatter | `Intl.DateTimeFormat` | Built-in, locale-aware, zero dependencies |
| WebSocket message buffering | Custom queue with dequeue mechanics | Simple array push into Zustand state | Zustand state is already a queue; just `[...prev, msg]` is sufficient |

---

## Common Pitfalls

### Pitfall 1: Live Graph Store Pollution During Replay

**What goes wrong:** `graph_delta` messages continue to arrive during replay and silently mutate `graphStore`. Canvas subscribes to `graphStore` and re-renders with live data, destroying the historical view.

**Why it happens:** ArchCanvas subscribes to `graphStore.subscribe()` imperatively. Any `applyDelta` call will trigger the subscription and update node/edge shapes.

**How to avoid:** In `WsClient.handleMessage`, check `replayStore.getState().isReplay` BEFORE the `graph_delta` dispatch. Buffer the message. The canvas subscription fires only when `graphStore` changes — no change = no re-render.

**Warning signs:** Canvas shows new nodes appearing or disappearing while in replay mode.

### Pitfall 2: Exit-Replay Applies Stale Live State

**What goes wrong:** On exit, the live graph state in `graphStore` is behind the actual current state because deltas were buffered, not applied. Draining the buffer one-by-one may cause version gaps if many messages were dropped or if the server advanced beyond what was buffered.

**Why it happens:** The buffer is append-only; it doesn't handle reconnects gracefully.

**How to avoid:** On exit-replay, do NOT try to replay the entire buffer through `applyDelta` sequentially. Instead: (1) drain inference buffer for feed catch-up, (2) call `fetch('/api/snapshot')` (the live current-state endpoint) to get the definitive live graph state, and apply via `applySnapshot`. This is the same gap-recovery path already in `WsClient.requestSnapshot()`. This guarantees the displayed state is accurate regardless of how many events happened during replay.

**Alternative (simpler):** If the buffer is small (< 50 items), apply deltas sequentially. If large (>= 50), fall back to snapshot fetch. Makes the common case (short replay) fast.

**Warning signs:** Graph appears to jump or flash on exit-replay; nodes appear in wrong positions.

### Pitfall 3: Morph Animation Source Positions Are Wrong

**What goes wrong:** On replay entry, nodes begin animating from position (0,0) instead of their current canvas positions.

**Why it happens:** `NodeRenderer.positions` and `IncrementalPlacer.positions` are two separate position stores. The Konva Group's actual `x()/y()` reflects the placer positions, but a newly created shape may still be at default (0,0).

**How to avoid:** Use `shape.x()` and `shape.y()` as the animation start point (the actual rendered position), not `placer.getPosition(nodeId)`. These are identical in steady state but diverge during incomplete initialization.

### Pitfall 4: Escape Key Conflict with Node Inspector

**What goes wrong:** Pressing Escape during replay exits node selection instead of exiting replay. User has to press Escape twice.

**Why it happens:** The existing ESC handler checks `selectedNodeId` first. If a node is selected during replay, the first ESC clears selection, the second exits replay.

**How to avoid:** Per the Pattern 6 code above — check `isReplay` first in the ESC handler. Replay exit takes absolute priority. The user can re-select nodes after returning to live view.

### Pitfall 5: watch_root_changed Does Not Auto-Exit Replay

**What goes wrong:** User triggers a watch-root switch while in replay. The canvas clears (from `graphStore.resetState()`), but replay mode remains active. The banner shows stale replay timestamp. New live events for the new project are buffered instead of applied.

**Why it happens:** `WsClient.watch_root_changed` handler calls `graphStore.getState().resetState()` but does not touch `replayStore`.

**How to avoid:** In the `watch_root_changed` case in `WsClient.handleMessage`, add an explicit `replayStore.getState().exitReplay()` call BEFORE the reset. The DirectoryBar's `handleSubmit` should also call `exitReplay()` before posting to `POST /api/watch`. Per CONTEXT.md: "Switching watch directory during replay auto-exits replay mode first, then switches."

### Pitfall 6: Banner Buffered Count Shows Stale Value

**What goes wrong:** `bufferedGraphDeltas.length` reads from Zustand state. On high-frequency updates, the React component re-renders very frequently (every delta during replay). This is a perf concern during rapid file edits.

**Why it happens:** React hook `useReplayStore(s => s.bufferedGraphDeltas.length)` re-evaluates on every buffer push.

**How to avoid:** Use selector to access only the count, not the array: `useReplayStore(s => s.bufferedGraphDeltas.length)` — Zustand's selector equality check means the component only re-renders when the number changes (primitive equality), not when the array reference changes. This is already the correct pattern; just don't select the whole array.

---

## Code Examples

### Entering Replay (called by Phase 17 timeline slider, but testable in Phase 16)

```typescript
// Phase 16 exposes this as the programmatic API — Phase 17 calls it from UI
async function loadSnapshotAndEnterReplay(snapshotId: number): Promise<void> {
  const res = await fetch(`/api/snapshot/${snapshotId}`);
  if (!res.ok) throw new Error(`Snapshot ${snapshotId} not found`);
  const data = await res.json() as {
    id: number;
    timestamp: number;
    nodes: GraphNode[];
    edges: GraphEdge[];
    positions: Record<string, { x: number; y: number }>;
  };

  // 1. Enter replay mode in store
  replayStore.getState().enterReplay(data.id, data.timestamp, data.nodes, data.edges);

  // 2. Swap graphStore to hold historical graph
  //    (ArchCanvas subscription fires → triggers morph animation to historical positions)
  graphStore.setState({
    nodes: new Map(data.nodes.map(n => [n.id, n])),
    edges: new Map(data.edges.map(e => [e.id, e])),
  });

  // 3. Load historical positions into placer (ArchCanvas wires this)
  //    viewport auto-zoom is handled by ArchCanvas fitToView() call
}
```

### Exiting Replay

```typescript
// In App.tsx handleExitReplay (or ReplayBanner onClick)
async function handleExitReplay(): Promise<void> {
  const { bufferedGraphDeltas, bufferedInferenceMessages } = replayStore.getState();

  // 1. Exit replay mode — stops buffering
  replayStore.getState().exitReplay();

  // 2. Get current live state (authoritative)
  //    Re-use existing WsClient gap recovery path
  const res = await fetch('/api/snapshot');
  if (res.ok) {
    const data = await res.json() as InitialStateMessage;
    graphStore.getState().applySnapshot(data);
  }

  // 3. Add replay separator to activity feed
  if (bufferedGraphDeltas.length > 0 || bufferedInferenceMessages.length > 0) {
    const totalCount = bufferedGraphDeltas.length + bufferedInferenceMessages.length;
    inferenceStore.getState().insertReplaySeparator(totalCount);
    // Then drain inference messages (up to 50) to update feed
    const toApply = bufferedInferenceMessages.slice(-50);
    for (const msg of toApply) {
      inferenceStore.getState().applyInference(msg);
    }
  }
}
```

### Konva Tween for Node Morph (in ArchCanvas)

```typescript
// Source: Konva.Tween pattern — same as ViewportController.panToNode

function morphNodesToPositions(
  targetPositions: Map<string, { x: number; y: number }>,
  nodeRenderer: NodeRenderer,
  placer: IncrementalPlacer,
  duration = 0.5,
): void {
  for (const [nodeId, targetPos] of targetPositions) {
    const shape = nodeRenderer.getShape(nodeId);
    if (!shape) continue;

    const tween = new Konva.Tween({
      node: shape,
      x: targetPos.x,
      y: targetPos.y,
      duration,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        // Pin position in placer so subsequent layout does not overwrite
        placer['positions'].set(nodeId, targetPos);  // access private via bracket
        tween.destroy();
      },
    });
    tween.play();
  }
}
```

### Replay Banner Pulse Animation (CSS keyframes via inline style injection)

```typescript
// The pulse animation on "Return to Live" button uses CSS animation
// Inject once via a <style> tag or use inline animation with React

const PULSE_KEYFRAMES = `
@keyframes replayButtonPulse {
  0%, 100% { box-shadow: 0 0 4px 0 rgba(234, 179, 8, 0.6); }
  50%       { box-shadow: 0 0 12px 4px rgba(234, 179, 8, 0.9); }
}
`;

// In ReplayBanner component — inject style once
useEffect(() => {
  const style = document.createElement('style');
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, []);
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 16 |
|--------------|------------------|---------------------|
| Redux for mode state machine | Zustand slices (already in project) | replayStore follows existing pattern exactly |
| Class-based animation management | Konva.Tween / Konva.Animation (already in project) | morphNodesToPositions follows ViewportController.panToNode pattern |
| Custom WebSocket managers | WsClient singleton (already in project) | Interception is a single `if` check in handleMessage |
| REST polling for live counter | Zustand buffered count + React selector | Count updates reactively without any polling |

---

## Open Questions

1. **How should historical snapshot positions be used?**
   - What we know: `GET /api/snapshot/:id` returns `positions: Record<string, {x, y}>` in the payload. The `graphJson.positions` is stored as `{}` placeholder per Phase 14 decision (layout persistence was deferred).
   - What's unclear: Will `positions` always be empty `{}` in Phase 16 since layout persistence was deferred to "Phase 6" (which appears to be a future phase beyond 18)? If so, the morph animation starts from live positions and targets d3-force recalculated positions for the historical node set — not authentic historical positions.
   - Recommendation: Plan for `positions` being empty `{}`. On replay entry, clear the `IncrementalPlacer` positions for nodes that no longer exist in the historical snapshot, and let the placer re-run for historical nodes. For nodes that exist in both live and historical graphs, animate from current live position to placer-calculated historical position. This produces a morph that still feels like "watching the architecture devolve."

2. **Should buffered `initial_state` (reconnect during replay) update the live graphStore silently?**
   - What we know: Per CONTEXT.md "All incoming data during replay is buffered (including reconnection recovery + new deltas)". This implies even `initial_state` is buffered.
   - What's unclear: If `initial_state` is fully buffered and not applied to `graphStore`, the live graph store becomes stale. On exit-replay, fetching `GET /api/snapshot` (live) resolves this, but the live graph may be further ahead than what's buffered.
   - Recommendation: Apply `initial_state` to `graphStore` silently during replay (without triggering ArchCanvas subscription re-render), buffer only `graph_delta` and `inference`. On exit, the live `graphStore` is already up to date and no fetch is needed. To prevent ArchCanvas from reacting to the `graphStore` change during replay, check `replayStore.getState().isReplay` in the ArchCanvas subscription callback and skip the visual update.

3. **Buffer overflow handling at high delta velocity**
   - What we know: Buffer grows unbounded currently; 50-event cap applies only to the activity feed, not the delta buffer.
   - What's unclear: At what delta velocity does the buffer become a memory concern?
   - Recommendation: Cap delta buffer at 500 entries. If exceeded, set a `bufferOverflowed: boolean` flag in `replayStore`. On exit-replay, if `bufferOverflowed` is true, skip buffer drain and go straight to `GET /api/snapshot` for live state recovery. Log a warning.

---

## Sources

### Primary (HIGH confidence)

- Source code analysis of `packages/client/src/store/graphStore.ts` — Zustand double-paren pattern, store structure, `applyDelta`/`applySnapshot` interface
- Source code analysis of `packages/client/src/ws/wsClient.ts` — `handleMessage` switch, `replayStore` interception point, `lastQueuedVersion` tracking, `requestSnapshot` gap recovery
- Source code analysis of `packages/client/src/canvas/ArchCanvas.tsx` — `graphStore.subscribe()` imperative subscription, Konva.Tween usage in ViewportController
- Source code analysis of `packages/client/src/canvas/ViewportController.ts` — Konva.Tween pattern for smooth animation (`panToNode` function)
- Source code analysis of `packages/server/src/plugins/timeline.ts` — `GET /api/snapshot/:id` response shape including `positions` field
- Source code analysis of `packages/client/src/App.tsx` — existing ESC key handler pattern, flex column layout structure for banner insertion

### Secondary (MEDIUM confidence)

- Zustand v5 docs pattern (verified by installed version ^5.0.11) — `create<T>()((set, get) => ...)` double-paren is confirmed correct for TS middleware compatibility
- Konva Tween API — confirmed by existing `panToNode` usage in `ViewportController.ts` (in-codebase evidence)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use; no new dependencies required
- Architecture: HIGH — replayStore slice, WsClient interception pattern, and morph animation are all direct extensions of existing patterns; no new paradigms introduced
- Pitfalls: HIGH — pitfalls identified from direct code reading (version tracking, ArchCanvas subscription, ESC key conflict, watch_root_changed flow)
- Open questions: MEDIUM — positions empty-object behavior is a known Phase 14 deferral; buffer overflow is a design decision not requiring external research

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase, no fast-moving external libraries)
