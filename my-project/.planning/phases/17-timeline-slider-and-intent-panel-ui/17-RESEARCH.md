# Phase 17: Timeline Slider and Intent Panel UI - Research

**Researched:** 2026-03-17
**Domain:** React UI components, Zustand client state, Konva canvas, REST/WebSocket integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Timeline slider placement & design**
- Full-width horizontal bar pinned below the canvas area, always visible (even when not in replay)
- Standard height (~60px) to fit slider, epoch markers, and timestamp axis
- Circular draggable thumb with tooltip showing relative time ("3 minutes ago")
- Absolute timestamps (e.g., "2:15 PM") at regular intervals along the track axis
- Vertical tick marks with short text labels for epoch markers; hovering shows tooltip with epoch details, clicking jumps to that epoch
- Subtle activity heatmap on the slider track background — opacity/color varies to show where architectural activity was concentrated
- Pulsing green dot at the rightmost edge indicating the "live edge" (current real-time position)
- Clicking anywhere on the timeline enters replay at that snapshot position (single click, no double-click required)
- Shift-click sets a second point for diff overlay comparison between two timeline positions

**Diff overlay**
- Color-coded nodes on canvas: added nodes glow green, removed nodes glow red (faded), changed nodes glow amber; edges follow same pattern
- Activated by shift-clicking a second point on the timeline while already viewing a replay position

**Playback controls & behavior**
- Play/pause, step-forward, and speed selector grouped on the left side of the timeline bar; slider takes remaining width
- Speed selector is clickable text that cycles: 1x → 2x → 4x → 0.5x → 1x
- When playback reaches the live edge, auto-exit replay to live mode (seamless transition)
- Full keyboard shortcuts: Space=play/pause, Left/Right arrows=step backward/forward, +/-=change speed

**Intent panel layout & content**
- New fourth collapsible sidebar panel inserted between Risks and Activity Feed
- Always available — shows current inferred intent in live mode, historical intent during replay
- Confidence indicator: colored badge next to objective label (green=high, amber=medium, red=low)
- Subtasks displayed as a checklist with progress — completed subtasks get checkmark, in-progress highlighted
- Focus-shift notifications: marked as epoch on the timeline AND the intent panel updates with new objective (no extra toast/banner — the panel itself + timeline epoch is the notification)
- Intent history log of past objectives with timestamps accessible within the panel

**Activity feed sync during replay**
- Feed filters to show only events from the current epoch (between two epoch markers) when scrubbing
- Activity Feed header changes to show epoch context: "Activity (Epoch: Setup · 12 events)"
- During auto-playback, events slide in with animation as the scrubber progresses — feels like watching history unfold
- Feed updates when crossing epoch boundaries during scrub or playback

### Claude's Discretion
- Exact color palette for heatmap opacity levels
- Animation timing and easing for playback transitions between snapshots
- Epoch detection algorithm thresholds
- Intent panel internal spacing and typography
- Slider thumb size and hover states
- Step-backward implementation (if snapshot availability allows)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPLAY-01 | User can scrub through architecture evolution via a timeline slider with event-count axis | TimelineBar component reads SnapshotMeta[] from GET /api/timeline; slider position maps to snapshot index; clicking/dragging calls loadSnapshotAndEnterReplay() |
| REPLAY-02 | User can play/pause/step through architecture changes automatically | PlaybackController with setInterval-based step loop; speed multiplier gates interval timing; step forward = advance snapshotIndex in the loaded SnapshotMeta[] array |
| REPLAY-05 | User sees timestamp labels on the timeline showing when events occurred | SnapshotMeta.timestamp (epoch ms) available; Intl.DateTimeFormat formats to "2:15 PM"; labels placed at regular intervals along the track width |
| REPLAY-06 | User sees only events from the current watch root session during replay | GET /api/timeline already filters by getSessionId(); activity feed epoch filter restricts to events between epoch boundaries |
| REPLAY-07 | User sees the activity feed synchronized with the current scrubber position | ActivityFeed receives currentEpochId prop; filters activityFeed items by epoch timestamp range; animates new entries during playback |
| REPLAY-08 | User sees auto-detected epoch markers on the timeline at significant moments | Epoch = intent session boundary (intent_closed/intent_opened) + heuristic gaps; epoch markers come from IntentSession[] timestamps |
| REPLAY-09 | User can see architecture diff overlay showing added/removed/changed components between two points | Shift-click sets diffBaseSnapshotId in replayStore; DiffOverlay computes node/edge deltas between two snapshots; ArchCanvas applies color overlays to node shapes |
| REPLAY-10 | User can control replay speed (0.5x, 1x, 2x, 4x) | Speed stored in replayStore; PlaybackController reads speed to compute interval (baseInterval / speed); speed selector cycles through 4 values |
| INTENT-01 | User sees an inferred objective label describing what the AI agent is working on | IntentPanel reads active IntentSession from intentStore; ObjectiveLabel sub-component displays category + objective text |
| INTENT-02 | User sees a confidence indicator on the inferred intent | Confidence (0-1 float) from IntentSession; colored badge: green ≥0.7, amber ≥0.4, red <0.4 |
| INTENT-03 | User can view inferred intent in a dedicated sidebar panel | New IntentPanel.tsx collapsible panel inserted between RiskPanel and ActivityFeed in App.tsx sidebar |
| INTENT-04 | User sees inferred subtasks derived from architectural event clusters | IntentSession.subtasks string[] displayed as checklist; subtasks currently empty array from server — Phase 17 adds client-side derivation from activityFeed events grouped by epoch |
| INTENT-05 | Intent panel auto-updates as new architectural events stream in | WsClient already routes intent_updated/intent_closed to store; intentStore subscription triggers re-render |
| INTENT-06 | User sees when the agent's focus shifts ("switched from X to Y") | Focus shift = intent_closed followed by intent_updated with different category; intentStore records transition; IntentPanel shows "Switched from X to Y" notice |
| INTENT-07 | User sees risk-correlated intent linking detected risks to the current objective | IntentPanel reads current risks from inferenceStore; shows risk count badge when active intent session overlaps with unreviewed risks |
| INTENT-08 | User can review an intent history log of past objectives with timestamps | intentStore maintains intentHistory array; IntentPanel has collapsible "History" section listing past IntentSession records with timestamps |
</phase_requirements>

---

## Summary

Phase 17 is a pure client-side UI phase. All backend infrastructure — snapshot storage, intent session persistence, timeline API (`GET /api/timeline`, `GET /api/snapshot/:id`, `GET /api/intents`), and WebSocket push messages (`snapshot_saved`, `intent_updated`, `intent_closed`) — was fully implemented in Phases 14-16. The replayStore state machine and its `enterReplay()`/`exitReplay()` actions are live. `loadSnapshotAndEnterReplay()` is already exported from ArchCanvas.tsx and ready for the timeline slider to call.

The work falls into three areas: (1) the `TimelineBar` component — a full-width 60px strip below the canvas containing the draggable slider, heatmap background, epoch tick marks, playback controls, and live-edge pulsing dot; (2) the `IntentPanel` sidebar panel — a new fourth collapsible panel between Risks and Activity Feed showing objective label, confidence badge, subtask checklist, history log, and risk correlation; and (3) the `intentStore` Zustand slice that receives `intent_updated`/`intent_closed` WebSocket messages and owns intent state for the panel.

The biggest implementation subtlety is the App.tsx layout restructure: the outer flex container must change from a column layout where the canvas and sidebar sit side by side, to a column that contains a row (canvas + sidebar) and below it the full-width TimelineBar. The TimelineBar must span both canvas and sidebar width. The canvas height must shrink by the ~60px timeline bar height to avoid overflow.

**Primary recommendation:** Build in this order: (1) intentStore slice + WsClient wiring, (2) IntentPanel UI, (3) TimelineBar with static snapshot data, (4) playback controller, (5) diff overlay. Store first, UI second keeps the panel immediately testable with live server data before the complex slider work begins.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | Component rendering | Project standard |
| Zustand | ^5.0.11 | Client state management | All existing stores use it |
| Konva / react-konva | ^10.2.1 / ^19.2.3 | Canvas rendering | Existing canvas infrastructure |
| Zod | ^3.25.67 | Schema validation | WsClient message validation |

### No New Libraries Needed
The timeline slider is a custom HTML/CSS component (not a slider library). The project consistently uses inline React styles — no CSS framework. The Konva.Tween API (already used in replayTransitions.ts) handles all animations. No third-party slider or timeline component needed.

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
packages/client/src/
├── store/
│   ├── replayStore.ts          (EXISTS — extend with timeline/playback state)
│   └── intentStore.ts          (NEW — intent session state)
├── panels/
│   ├── IntentPanel.tsx          (NEW — fourth sidebar panel)
│   └── ActivityFeed.tsx         (MODIFY — epoch filter support)
├── timeline/
│   ├── TimelineBar.tsx          (NEW — full-width timeline component)
│   └── PlaybackController.ts    (NEW — auto-play interval logic, pure class)
└── App.tsx                      (MODIFY — layout restructure + TimelineBar)
```

### Pattern 1: Extending replayStore for Timeline State

The replayStore already owns replay mode. Phase 17 extends it with timeline data and playback state. This avoids a new store and keeps all replay-related state co-located.

**New fields to add to replayStore:**

```typescript
// Timeline data (loaded once from GET /api/timeline)
snapshots: SnapshotMeta[];
// Index of the currently displayed snapshot in the snapshots array
currentSnapshotIndex: number;
// Auto-playback state
isPlaying: boolean;
playbackSpeed: 0.5 | 1 | 2 | 4;
// Diff overlay — second snapshot for comparison (shift-click)
diffBaseSnapshotId: number | null;
// Actions
setSnapshots: (metas: SnapshotMeta[]) => void;
appendSnapshot: (meta: SnapshotMeta) => void;  // called on snapshot_saved WS message
setCurrentSnapshotIndex: (index: number) => void;
setIsPlaying: (playing: boolean) => void;
setPlaybackSpeed: (speed: 0.5 | 1 | 2 | 4) => void;
setDiffBase: (snapshotId: number | null) => void;
```

**Why extend replayStore rather than a new store:** All timeline actions trigger replay entry (loadSnapshotAndEnterReplay). The store that owns isReplay must also own snapshots so the timeline bar can read both from one subscription without cross-store synchronization bugs.

### Pattern 2: intentStore — New Zustand Slice

Mirrors the existing pattern from inferenceStore.ts exactly. Created with the double-paren pattern for TypeScript middleware compatibility.

```typescript
// packages/client/src/store/intentStore.ts
import { create } from 'zustand';
import type { IntentSession } from '@archlens/shared/types';

export interface IntentStore {
  /** Currently active intent session (null when no activity detected) */
  activeSession: IntentSession | null;
  /** All closed sessions for history log — newest first */
  intentHistory: IntentSession[];
  /** Applied on intent_updated WS message */
  applyIntentUpdated: (session: IntentSession) => void;
  /** Applied on intent_closed WS message */
  applyIntentClosed: (sessionId: string, endSnapshotId: number | null) => void;
  /** Reset on watch_root_changed */
  resetState: () => void;
}

export const useIntentStore = create<IntentStore>()((set, get) => ({ ... }));
export const intentStore = useIntentStore;
```

### Pattern 3: WsClient Extension — Handle snapshot_saved, intent_updated, intent_closed

The WsClient's `handleMessage` switch statement must handle the three new message types. The Zod schema (`serverMessages.ts`) already validates all three. Currently the switch falls through silently for unhandled types (no default handler).

```typescript
// In wsClient.ts handleMessage switch:
case 'snapshot_saved': {
  replayStore.getState().appendSnapshot(msg.meta);
  break;
}
case 'intent_updated': {
  // During replay, still update intentStore (panel shows historical intent contextually)
  intentStore.getState().applyIntentUpdated(msg.session);
  break;
}
case 'intent_closed': {
  intentStore.getState().applyIntentClosed(msg.sessionId, msg.endSnapshotId);
  break;
}
```

**Note:** `snapshot_saved` should ALWAYS be appended to the snapshots array even during replay — the timeline must grow in real time as new snapshots arrive so the live-edge dot reflects the true current end.

### Pattern 4: App.tsx Layout Restructure

The current outer layout is `flexDirection: 'column'` with:
1. ReplayBanner (conditional, 44px)
2. DirectoryBar (44px)
3. Main content row (flex: 1): canvas area + sidebar

The TimelineBar must be full-width (spanning both canvas and sidebar). This requires inserting it at the bottom of the main content area as a third sibling within the column, NOT inside the canvas div.

```tsx
// NEW layout structure
<div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
  <ReplayBanner onExitReplay={...} />
  <DirectoryBar />

  {/* Content + timeline column */}
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

    {/* Canvas + sidebar row */}
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
        <ArchCanvas ... />
        {/* overlays */}
      </div>
      {/* Sidebar */}
      <div style={{ width: 280, ... }}>
        <NodeInspector ... />
        <RiskPanel ... />
        <IntentPanel />         {/* NEW — between Risk and Activity */}
        <ActivityFeed ... />
      </div>
    </div>

    {/* Timeline bar — full-width strip at the bottom */}
    <TimelineBar onExitReplay={() => void handleExitReplay()} />

  </div>
</div>
```

**Critical:** The canvas height no longer fills `100vh` — it fills the available height after the timeline bar takes its ~60px. The `dimensions.height` state for ArchCanvas is set by ResizeObserver on the canvas container div, which correctly accounts for the timeline bar automatically.

### Pattern 5: TimelineBar Component Structure

```tsx
// packages/client/src/timeline/TimelineBar.tsx
export function TimelineBar({ onExitReplay }: TimelineBarProps) {
  // Read from replayStore: snapshots, currentSnapshotIndex, isPlaying, isReplay, playbackSpeed
  // Read from intentStore: activeSession (for live-edge epoch context)

  // Local state: isDragging, hoverTime (for tooltip), diffBaseIndex

  return (
    <div style={{ height: 60, display: 'flex', ... }}>
      {/* Left: Playback controls (play/pause, step-fwd, speed) */}
      <PlaybackControls ... />

      {/* Center: Timeline track */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Heatmap background — canvas element or gradient divs */}
        <HeatmapTrack snapshots={snapshots} />
        {/* Epoch tick marks */}
        {epochMarkers.map(e => <EpochTick key={e.snapshotId} ... />)}
        {/* Timestamp axis labels */}
        {timestampLabels.map(l => <TimestampLabel key={l.x} ... />)}
        {/* Draggable thumb */}
        <SliderThumb position={thumbX} onDrag={handleDrag} />
        {/* Live-edge pulsing dot */}
        <LiveEdgeDot />
        {/* Diff base marker (when shift-click active) */}
        {diffBaseSnapshotId && <DiffBaseMarker ... />}
      </div>
    </div>
  );
}
```

### Pattern 6: PlaybackController — Pure Class

Auto-playback uses `setInterval`. The interval fires at `BASE_INTERVAL_MS / speed`. On each tick, it increments `currentSnapshotIndex` and calls `loadSnapshotAndEnterReplay()`. When the index reaches the last snapshot (live edge), it calls `onExitReplay()`.

```typescript
// packages/client/src/timeline/PlaybackController.ts
const BASE_INTERVAL_MS = 1000; // 1x speed = 1 snapshot per second

export class PlaybackController {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(speed: number, onTick: () => Promise<void>, onReachedLiveEdge: () => void): void {
    this.stop();
    this.timer = setInterval(async () => {
      await onTick(); // increments snapshot index, calls loadSnapshotAndEnterReplay
      // onTick implementation checks if at live edge and calls onReachedLiveEdge
    }, BASE_INTERVAL_MS / speed);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

**Why a class, not a hook:** The PlaybackController must survive React re-renders without recreating. It lives in a `useRef` inside TimelineBar, mirrors the pattern of ViewportController in ArchCanvas.tsx.

### Pattern 7: Epoch Detection Algorithm

Epochs are auto-detected from two sources:
1. **Intent session boundaries:** Each `IntentSession` has `startedAt` and `endedAt` timestamps. The transition point (when one session closes and another opens) is an epoch.
2. **Activity gaps:** Consecutive snapshots separated by > 90 seconds (matching `ACTIVITY_GAP_MS` in IntentAnalyzer) represent natural pauses — epoch boundaries.

```typescript
function detectEpochs(snapshots: SnapshotMeta[], intentSessions: IntentSession[]): EpochMarker[] {
  const epochs: EpochMarker[] = [];

  // From intent session boundaries
  for (let i = 1; i < intentSessions.length; i++) {
    const prev = intentSessions[i - 1];
    const curr = intentSessions[i];
    // Find the snapshot closest to the transition timestamp
    const transitionTs = prev.endedAt ?? curr.startedAt;
    const snapshotIdx = findClosestSnapshotIndex(snapshots, transitionTs);
    epochs.push({
      snapshotId: snapshots[snapshotIdx].id,
      snapshotIndex: snapshotIdx,
      label: `${prev.category} → ${curr.category}`,
      type: 'focus_shift',
      timestamp: transitionTs,
    });
  }

  // From activity gaps (snapshots with large time deltas between them)
  for (let i = 1; i < snapshots.length; i++) {
    const gap = snapshots[i].timestamp - snapshots[i - 1].timestamp;
    if (gap > 90_000) {
      epochs.push({
        snapshotId: snapshots[i].id,
        snapshotIndex: i,
        label: 'Activity resumed',
        type: 'gap',
        timestamp: snapshots[i].timestamp,
      });
    }
  }

  return epochs.sort((a, b) => a.timestamp - b.timestamp);
}
```

### Pattern 8: Diff Overlay

On shift-click, a `diffBaseSnapshotId` is stored in replayStore. When both `replaySnapshotId` and `diffBaseSnapshotId` are set:
1. Fetch the base snapshot (or read from cache).
2. Compute delta: nodes in current but not base = added (green glow); nodes in base but not current = removed (red glow, faded); nodes in both with changed properties = changed (amber glow).
3. Apply overlays using the existing `applyReplayTint` pattern — but with green/red/amber per-node instead of uniform blue.

The diff overlay is a separate visual state layer, not a new replayStore mode. ArchCanvas's `replayStore.subscribe` handles both the existing tint and the diff overlay in the same subscription block.

### Anti-Patterns to Avoid

- **Putting playback logic in React state with `useState`:** React state updates are asynchronous and batched. `setInterval` in a useEffect with a state-derived callback causes stale closure bugs. Use `useRef` for the PlaybackController instance.
- **Storing `snapshots: SnapshotMeta[]` in React component state:** The timeline needs to grow as `snapshot_saved` arrives. Storing in Zustand (replayStore) allows WsClient to append without prop drilling.
- **Loading all snapshot graph data upfront:** `GET /api/timeline` returns lightweight SnapshotMeta (no graph payload). Full snapshot data is only fetched on demand via `GET /api/snapshot/:id` when the user scrubs to that position. Never pre-fetch all snapshots.
- **Calling `loadSnapshotAndEnterReplay` on every slider drag event:** Debounce or throttle the fetch to prevent flooding the server. Only fetch when the user pauses dragging (mouseup) or when playback ticks.
- **Epoch markers from client-side heuristics only:** Intent session boundaries from the server are the authoritative epoch source. Client-side gap detection is supplementary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag interaction for slider thumb | Custom pointer event math | Standard HTML `<input type="range">` or pointer events on a div with `onPointerDown/Move/Up` | Position math is simple; pointer capture (`element.setPointerCapture()`) handles drag outside bounds |
| Timestamp formatting | Custom date string builder | `Intl.DateTimeFormat` (already used in ReplayBanner.tsx) | Handles locale, AM/PM, DST automatically |
| Animation for playback transitions | requestAnimationFrame loop | Existing `Konva.Tween` + `morphNodesToPositions()` from replayTransitions.ts | Already built and tested; reusing avoids duplicate animation code |
| Heatmap background calculation | Complex canvas gradient | CSS linear-gradient with computed stop positions, or a row of divs with computed opacity | Snapshot density → opacity mapping is simple arithmetic |
| Intent category labeling | Duplicated label map | `OBJECTIVE_LABELS` record from IntentAnalyzer.ts logic | The server already emits human-readable `objective` strings in the IntentSession |

**Key insight:** The server already provides human-readable objective strings (`"Adding Feature"`, `"Bug Fix"`) via `IntentSession.objective`. The client does not need to re-map category enum values — just display the string.

---

## Common Pitfalls

### Pitfall 1: App.tsx Canvas Height Breaks After Layout Restructure
**What goes wrong:** After adding the TimelineBar row, `dimensions.height` (used for ArchCanvas width/height props) stops being updated correctly, causing the canvas to overflow or shrink to zero.
**Why it happens:** ResizeObserver watches `containerRef.current` (the canvas wrapper div). If the flex layout restructure accidentally changes the container's position in the DOM, or if `minHeight: 0` is missing on the inner flex row, height computation fails.
**How to avoid:** Ensure the canvas wrapper div has `flex: 1` and its flex parent has `minHeight: 0`. The ResizeObserver on containerRef automatically measures the correct height excluding the timeline bar. Test: make the browser window very short — the timeline bar and canvas should both be visible without overlap.
**Warning signs:** Canvas either overflows outside visible area, or has zero height after adding TimelineBar.

### Pitfall 2: Stale Snapshot Array on Replay Mode Entry
**What goes wrong:** User clicks timeline but `snapshots` array in replayStore is empty because `GET /api/timeline` was not fetched on mount.
**Why it happens:** The timeline data is not proactively loaded — it requires an explicit fetch on app startup (or on first TimelineBar interaction).
**How to avoid:** Fetch `GET /api/timeline` in a `useEffect` inside TimelineBar (or in App.tsx on mount) and call `replayStore.getState().setSnapshots(data)`. Also fetch `GET /api/intents` at the same time for epoch detection. Re-fetch both on `watch_root_changed` (the existing `resetState` path should clear snapshots and trigger a fresh fetch).
**Warning signs:** TimelineBar renders but clicking has no effect (no snapshots to scrub).

### Pitfall 3: Playback Timer Not Cleaned Up on Unmount
**What goes wrong:** `PlaybackController.stop()` is not called when TimelineBar unmounts or when the user exits replay. The timer keeps firing, calling `loadSnapshotAndEnterReplay` on an unmounted component.
**Why it happens:** `setInterval` survives component unmount unless explicitly cleared.
**How to avoid:** Store `PlaybackController` in `useRef` inside TimelineBar. Return `() => playbackController.current.stop()` from the cleanup function of a `useEffect`. Also call `stop()` whenever `exitReplay` is triggered.
**Warning signs:** Console errors about "state update on unmounted component"; replay keeps advancing after user returns to live view.

### Pitfall 4: loadSnapshotAndEnterReplay Called Too Frequently During Drag
**What goes wrong:** Each pixel of slider drag fires a fetch to `GET /api/snapshot/:id`, causing visible UI jank and network flooding.
**Why it happens:** Naive `onPointerMove` handler calls fetch on every event.
**How to avoid:** Only call `loadSnapshotAndEnterReplay` on `onPointerUp` (drag end) and on playback ticks, not on `onPointerMove`. During drag, update only the visual thumb position (a local CSS variable or state), resolving the snapshot ID to render a preview timestamp in the tooltip without fetching full data.
**Warning signs:** Network tab shows hundreds of requests while dragging; UI becomes unresponsive.

### Pitfall 5: Epoch Detection Inconsistency Between Server and Client
**What goes wrong:** Client-computed epochs differ from what the server's `intent_closed` messages implied, causing timeline tick marks to appear in wrong positions.
**Why it happens:** The client might compute epochs from `intentHistory` entries loaded via `GET /api/intents` at page load, but later `intent_closed`/`intent_updated` WS messages update the store. If the epoch calculation runs once at load time and doesn't re-run when new intent messages arrive, ticks are stale.
**How to avoid:** Epoch calculation must be a derived computation (useMemo or computed inline) from the current `intentHistory` array in intentStore. Whenever `intentHistory` changes (new WS message), epoch markers recompute automatically.
**Warning signs:** Epoch tick marks do not appear at the correct snapshot positions; marks never appear even though sessions exist.

### Pitfall 6: Diff Overlay Not Cleaned Up on Second Shift-Click
**What goes wrong:** After shift-clicking a second time to change the diff base, or after exiting replay, diff color overlays remain on canvas nodes.
**Why it happens:** The diff overlay is applied imperatively to Konva shapes. Without an explicit cleanup path, tints persist.
**How to avoid:** Diff overlay cleanup must be called (1) when `diffBaseSnapshotId` changes to a new value, (2) when `isReplay` changes to false. Mirror the pattern of `tintedFills` Map used for the blue replay tint in ArchCanvas — a `diffTintedFills` Map stores original shadow settings and `restoreOriginalTint` is called before re-applying.

### Pitfall 7: IntentPanel subtasks field is always empty
**What goes wrong:** IntentPanel shows the subtasks checklist section but it is always empty because `IntentSession.subtasks` from the server is always `[]`.
**Why it happens:** The `IntentAnalyzer.ts` always inserts subtasks as an empty array (`subtasks: []`). The server does not populate subtasks.
**How to avoid:** For Phase 17, subtasks should be derived client-side from the activityFeed items that fall within the intent session's time range. Group activityFeed entries between `session.startedAt` and `session.endedAt` into subtask categories. Alternatively, suppress the subtasks section and show only the objective label + confidence if subtasks are empty.

### Pitfall 8: Konva frame budget at 200+ nodes
**What goes wrong:** Auto-playback at 2x or 4x speed triggers rapid `loadSnapshotAndEnterReplay` calls. Each call triggers `morphNodesToPositions` with 200+ Konva.Tween objects. Multiple overlapping Tween animations degrade frame rate.
**Why it happens:** 200+ simultaneous Konva.Tween instances on each playback tick before previous ones finish.
**How to avoid:** Cancel in-flight tweens before starting new ones. Add a `cancelAllTweens()` helper in replayTransitions.ts that iterates all node shapes, checks for active tweens, and calls `.destroy()` on them. Or at high speeds (2x, 4x), skip intermediate animation and snap directly to target positions without tweening.
**Warning signs:** STATE.md records this as a known concern: "Konva auto-play frame budget needs measurement at 200+ nodes before building speed levels."

---

## Code Examples

Verified patterns from existing codebase:

### Fetching Timeline Data on Mount
```typescript
// In TimelineBar or App.tsx useEffect
useEffect(() => {
  void (async () => {
    const [snapshotRes, intentRes] = await Promise.all([
      fetch('/api/timeline'),
      fetch('/api/intents'),
    ]);
    if (snapshotRes.ok) {
      const metas = await snapshotRes.json() as SnapshotMeta[];
      replayStore.getState().setSnapshots(metas);
    }
    if (intentRes.ok) {
      const sessions = await intentRes.json() as IntentSession[];
      // Seed intentStore with historical sessions
      intentStore.getState().loadHistory(sessions);
    }
  })();
}, []); // Re-run on watch_root_changed via a watchRoot dep
```

### Entering Replay from Timeline Slider
```typescript
// loadSnapshotAndEnterReplay is already exported from ArchCanvas.tsx
import { loadSnapshotAndEnterReplay } from '../canvas/ArchCanvas.js';

async function handleSliderClick(snapshotIndex: number): Promise<void> {
  const snapshots = replayStore.getState().snapshots;
  if (snapshotIndex < 0 || snapshotIndex >= snapshots.length) return;
  const meta = snapshots[snapshotIndex];
  replayStore.getState().setCurrentSnapshotIndex(snapshotIndex);
  await loadSnapshotAndEnterReplay(meta.id);
}
```

### Zustand Store Double-Paren Pattern (existing project convention)
```typescript
// Source: packages/client/src/store/replayStore.ts (project convention)
export const useIntentStore = create<IntentStore>()((set, get) => ({
  activeSession: null,
  intentHistory: [],
  applyIntentUpdated: (session) => {
    set({ activeSession: session });
  },
  applyIntentClosed: (sessionId, endSnapshotId) => {
    const current = get().activeSession;
    if (current) {
      const closed: IntentSession = { ...current, endSnapshotId, endedAt: Date.now() };
      set((s) => ({
        activeSession: null,
        intentHistory: [closed, ...s.intentHistory].slice(0, 50),
      }));
    }
  },
  resetState: () => set({ activeSession: null, intentHistory: [] }),
}));
export const intentStore = useIntentStore;
```

### Sidebar Panel Pattern (existing collapsible pattern)
```tsx
// Source: packages/client/src/panels/RiskPanel.tsx — exact pattern to replicate
export function IntentPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const activeSession = useIntentStore((s) => s.activeSession);

  return (
    <div style={{ background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 10, color: '#ffffff66' }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#ffffff99', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>Intent</span>
        {/* Confidence badge */}
      </div>
      <div style={{ maxHeight: collapsed ? 0 : 300, overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
        {/* Panel content */}
      </div>
    </div>
  );
}
```

### Konva.Tween for Replay Entry (existing pattern from replayTransitions.ts)
```typescript
// Source: packages/client/src/canvas/replayTransitions.ts
// Already handles morph, fade-in, fade-out animations.
// Phase 17 PlaybackController reuses this — no new animation code needed.
morphNodesToPositions(targetPositions, nodeRenderer, 0.5);
```

### Pointer Capture for Drag Interactions
```tsx
// Standard DOM pattern — no library needed
function SliderThumb({ position, onDrag }: SliderThumbProps) {
  const thumbRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId); // Keeps events even if cursor leaves
    // Store initial offset
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    // Update visual position only (no snapshot fetch during drag)
    onDrag(computePosition(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Now fetch snapshot at final position
    void handleSliderClick(computeSnapshotIndex(e.clientX));
  };

  return <div ref={thumbRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom range inputs | Pointer-capture div-based slider | Existing pattern in project — inline styles only | Phase 17 should NOT use `<input type="range">` — CSS styling is severely limited; div + pointer events match project style conventions |
| Separate intent store per phase | Co-locate all replay state in replayStore | Phase 16 decision | Phase 17 adds a separate intentStore (different concern: intent panel vs. replay mode) but timeline/playback state extends replayStore |
| Wall-clock axis for timeline | Event-count axis (snapshot sequence) | Phase 14 research decision | Timeline position maps to snapshot index, not wall-clock offset — no dead zones in slider |

**Deprecated/outdated:**
- `<input type="range">` for timeline slider: Not used in this project. Inline styles + pointer events is the project convention for all interactive controls.

---

## Open Questions

1. **Step backward implementation**
   - What we know: `snapshots` array in replayStore is ordered by `sequenceNumber` ascending. Step backward = decrement `currentSnapshotIndex`.
   - What's unclear: The CONTEXT.md marks step-backward as Claude's discretion with "(if snapshot availability allows)" — this means backward navigation requires that earlier snapshots are still in the 200-entry FIFO window. Very old snapshots may have been pruned.
   - Recommendation: Implement step-backward by decrementing the index. If `currentSnapshotIndex === 0`, disable the step-back button. Show a visual indicator when at the earliest available snapshot. No special server work needed.

2. **Subtask derivation for IntentPanel**
   - What we know: `IntentSession.subtasks` is always `[]` from server (IntentAnalyzer never populates it).
   - What's unclear: The CONTEXT.md says "Subtasks displayed as a checklist with progress — completed subtasks get checkmark, in-progress highlighted." This implies the server should provide subtasks, but it does not.
   - Recommendation: For Phase 17, derive subtasks client-side from activityFeed event groups. Events belonging to the current epoch (grouped by event type) become synthetic subtasks. If the activityFeed has 0 events for the current session, hide the subtasks section entirely. Document this as a known gap — proper subtask inference requires server-side work deferred to a future phase.

3. **Activity feed epoch filtering implementation**
   - What we know: The ActivityFeed currently shows all 50 items from `inferenceStore.activityFeed`. Epoch filtering requires knowing which events fall within the current epoch's time range.
   - What's unclear: ActivityItem timestamps exist, but there is no epoch membership field on ActivityItem. Filtering must be done by comparing timestamps against `intentHistory[currentEpoch].startedAt` and `intentHistory[currentEpoch].endedAt`.
   - Recommendation: Pass `epochStart` and `epochEnd` as props to ActivityFeed from TimelineBar/App. ActivityFeed filters displayed items client-side. The `activityFeed` store slice remains unchanged; filtering is view-layer only.

4. **Keyboard shortcut conflicts**
   - What we know: ArchCanvas.tsx handles `Escape` key. App.tsx also handles `Escape` key. WsClient is unrelated to keyboard.
   - What's unclear: Adding `Space`, `Left/Right arrows`, `+/-` for playback will conflict with browser defaults (Space = scroll page) and potentially with ArchCanvas focus.
   - Recommendation: Add keyboard listeners in a `useEffect` inside TimelineBar with `event.preventDefault()` for Space/arrows only when the timeline bar is the intended target. Guard: only intercept `Space` if the active element is not an input/textarea. Use `isReplay` or `snapshots.length > 0` as gate for arrow key handling.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/client/src/store/replayStore.ts` — enterReplay/exitReplay/buffer patterns
- Codebase: `packages/client/src/canvas/ArchCanvas.tsx` — loadSnapshotAndEnterReplay export, replayStore.subscribe pattern
- Codebase: `packages/client/src/canvas/replayTransitions.ts` — morphNodesToPositions, fadeInNodes, applyReplayTint
- Codebase: `packages/client/src/store/inferenceStore.ts` — Zustand double-paren pattern, ActivityItem shape
- Codebase: `packages/client/src/panels/RiskPanel.tsx` — exact collapsible panel pattern for IntentPanel
- Codebase: `packages/client/src/ws/wsClient.ts` — message routing switch, buffer patterns during replay
- Codebase: `packages/server/src/plugins/timeline.ts` — GET /api/timeline, GET /api/snapshot/:id, GET /api/intents endpoints
- Codebase: `packages/server/src/snapshot/IntentAnalyzer.ts` — intent session lifecycle, OBJECTIVE_LABELS, subtasks always []
- Codebase: `packages/shared/src/types/timeline.ts` — SnapshotMeta, IntentSession type shapes
- Codebase: `packages/client/src/schemas/serverMessages.ts` — Zod schemas for snapshot_saved, intent_updated, intent_closed
- Codebase: `packages/client/src/App.tsx` — current layout structure, handleExitReplay, keyboard handler pattern

### Secondary (MEDIUM confidence)
- MDN Web API: `Element.setPointerCapture()` — standard for drag interactions; widely supported
- MDN Web API: `Intl.DateTimeFormat` — already used in ReplayBanner.tsx for timestamp formatting

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all dependencies already in package.json
- Architecture: HIGH — all server infrastructure exists; patterns traced directly from live code
- Pitfalls: HIGH — derived from actual code analysis of existing replay infrastructure + known STATE.md concern
- Subtask derivation: LOW — server never populates subtasks; client-side approach is a workaround

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, no fast-moving dependencies involved)
