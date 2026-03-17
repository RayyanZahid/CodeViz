# Phase 17: Timeline Slider and Intent Panel UI - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can scrub through the full architecture evolution timeline via a slider and read the inferred AI agent intent in a dedicated sidebar panel. This phase delivers the timeline slider component, playback controls, intent panel UI, and activity feed synchronization during replay. The underlying replay infrastructure (snapshot storage, replay mode state machine, canvas transitions) was built in Phases 15-16.

</domain>

<decisions>
## Implementation Decisions

### Timeline slider placement & design
- Full-width horizontal bar pinned below the canvas area, always visible (even when not in replay)
- Standard height (~60px) to fit slider, epoch markers, and timestamp axis
- Circular draggable thumb with tooltip showing relative time ("3 minutes ago")
- Absolute timestamps (e.g., "2:15 PM") at regular intervals along the track axis
- Vertical tick marks with short text labels for epoch markers; hovering shows tooltip with epoch details, clicking jumps to that epoch
- Subtle activity heatmap on the slider track background — opacity/color varies to show where architectural activity was concentrated
- Pulsing green dot at the rightmost edge indicating the "live edge" (current real-time position)
- Clicking anywhere on the timeline enters replay at that snapshot position (single click, no double-click required)
- Shift-click sets a second point for diff overlay comparison between two timeline positions

### Diff overlay
- Color-coded nodes on canvas: added nodes glow green, removed nodes glow red (faded), changed nodes glow amber; edges follow same pattern
- Activated by shift-clicking a second point on the timeline while already viewing a replay position

### Playback controls & behavior
- Play/pause, step-forward, and speed selector grouped on the left side of the timeline bar; slider takes remaining width
- Speed selector is clickable text that cycles: 1x → 2x → 4x → 0.5x → 1x
- When playback reaches the live edge, auto-exit replay to live mode (seamless transition)
- Full keyboard shortcuts: Space=play/pause, Left/Right arrows=step backward/forward, +/-=change speed

### Intent panel layout & content
- New fourth collapsible sidebar panel inserted between Risks and Activity Feed
- Always available — shows current inferred intent in live mode, historical intent during replay
- Confidence indicator: colored badge next to objective label (green=high, amber=medium, red=low)
- Subtasks displayed as a checklist with progress — completed subtasks get checkmark, in-progress highlighted
- Focus-shift notifications: marked as epoch on the timeline AND the intent panel updates with new objective (no extra toast/banner — the panel itself + timeline epoch is the notification)
- Intent history log of past objectives with timestamps accessible within the panel

### Activity feed sync during replay
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

</decisions>

<specifics>
## Specific Ideas

- Timeline should feel like a video editor timeline — always visible, interactive, information-rich
- Focus-shift = epoch marker: when the agent's objective changes, that's a significant enough moment to mark on the timeline
- "Watching history unfold" — during playback the activity feed should animate events sliding in, not just statically swap content
- The intent panel is a "what is the agent doing and why" panel — objective + subtask checklist gives at-a-glance understanding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-timeline-slider-and-intent-panel-ui*
*Context gathered: 2026-03-17*
