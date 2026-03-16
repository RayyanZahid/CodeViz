---
phase: 12-edge-interaction-and-component-glow
plan: "02"
subsystem: ui
tags: [konva, react, canvas, animation, glow, legend]

# Dependency graph
requires:
  - phase: 12-01
    provides: EdgeRenderer with getAllLines()/resetLineStyle(), ArchCanvas edge interaction wiring, AnimationQueue foundation with 30s linear glow decay

provides:
  - EdgeLegend component: always-visible semi-transparent card in bottom-left corner with three line samples (thin/medium/thick) and labels 1-3/4-8/9+ deps
  - AnimationQueue 2.5s pulse phase (sine-wave oscillation of shadow opacity/blur) before 30s decay
  - Bright node border in zone glow color immediately on change, fades over 30s
  - origStroke/origStrokeWidth restore on decay complete and destroy()

affects:
  - Phase 13 (any further canvas work) will build on this glow/animation foundation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-phase animation pattern: PULSE_MS sine-wave phase followed by DECAY_MS linear fade
    - Direct Konva Rect stroke manipulation from AnimationQueue (graph layer rect, not anim layer)
    - Store origStroke/origStrokeWidth on activate(), restore on Phase 3 complete and destroy()
    - React component with minimapVisible prop for dynamic bottom offset positioning

key-files:
  created:
    - packages/client/src/canvas/EdgeLegend.tsx
  modified:
    - packages/client/src/canvas/AnimationQueue.ts
    - packages/client/src/App.tsx

key-decisions:
  - "PULSE_MS=2_500 (2.5s) with PULSE_CYCLES=3 gives 3 sine oscillations — visible pulsing without being jarring"
  - "nodeRect cached directly in GlowEntry (not re-queried each frame) — avoids findOne overhead in RAF loop"
  - "Phase 1 re-applies bright border each tick to survive clearSelection stomping the stroke"
  - "Border fade uses strokeWidth interpolation from 2.5 to original, keeping glowColor throughout decay — avoids rgba parsing complexity"
  - "EdgeLegend uses minimapVisible prop to set bottom:180 vs bottom:16 — keeps it above minimap"
  - "No changes to clearSelection needed — tick() re-applies border within 16ms, imperceptible flicker"

patterns-established:
  - "Konva animation phase guard: elapsed < PULSE_MS → pulse, PULSE_MS <= elapsed < totalMs → decay, elapsed >= totalMs → complete"
  - "origStroke/origStrokeWidth capture-and-restore pattern for imperative Konva state manipulation"

requirements-completed: [EDGE-03, GLOW-01, GLOW-02]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 12 Plan 02: Edge Interaction and Component Glow Summary

**EdgeLegend corner card with three edge-thickness samples (1-3/4-8/9+ deps), plus AnimationQueue 2.5s sine-wave pulse then 30s bright-border fade in zone glow color on changed nodes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T22:19:02Z
- **Completed:** 2026-03-16T22:22:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created EdgeLegend.tsx: semi-transparent card (absolute bottom-left, z-index 200) with SVG line samples at strokeWidth 1.5/3/5 and monospace labels; repositions above minimap via minimapVisible prop
- Enhanced AnimationQueue.ts: added 2.5s pulse phase (3 sine oscillations per PULSE_CYCLES, shadow opacity 40-100%, shadow blur 50-100%) before the existing 30s linear decay
- AnimationQueue now stores nodeRect reference and zone glowColor, applies bright border (strokeWidth 2.5) immediately on activate(), restores origStroke/origStrokeWidth on completion and destroy()
- App.tsx imports and renders EdgeLegend in canvas container div

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EdgeLegend component for bottom-left corner** - `410bfea` (feat)
2. **Task 2: Enhance AnimationQueue with 2-3s pulse and bright node border fade** - `c19a0ee` (feat)

## Files Created/Modified
- `packages/client/src/canvas/EdgeLegend.tsx` - Always-visible legend card in bottom-left corner with three SVG line samples and labels for edge thickness tiers
- `packages/client/src/canvas/AnimationQueue.ts` - Extended GlowEntry with nodeShape/nodeRect/glowColor/origStroke/origStrokeWidth; added PULSE_MS/PULSE_CYCLES constants; three-phase tick() with pulse, decay, and complete stages
- `packages/client/src/App.tsx` - Added EdgeLegend import and render in canvas container div

## Decisions Made
- PULSE_MS=2_500 (2.5 seconds) chosen as midpoint of the CONTEXT.md 2-3 second range
- nodeRect cached on GlowEntry rather than re-queried via findOne() on every RAF tick to avoid overhead
- Phase 1 re-applies border each tick to handle clearSelection() stomping (simpler than coupling clearSelection to AnimationQueue's isActive method)
- Border fade via strokeWidth interpolation: avoids rgba string parsing, uses same glowColor throughout, origStrokeWidth already known
- EdgeLegend placed below PipelineStatusDot in z-order since both are independent absolutely-positioned overlays at bottom-left with different positions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled with zero errors on first pass for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 12 complete: edge interaction (plan 01) and edge legend + glow animation (plan 02) both shipped
- EDGE-01, EDGE-02 (edge hover tooltip + click highlight) from plan 01 satisfied
- EDGE-03 (thickness legend), GLOW-01 (pulse glow), GLOW-02 (fading bright border) from plan 02 satisfied
- Ready for Phase 13: ARCHLENS_WATCH_ROOT UI + endpoint work

---
*Phase: 12-edge-interaction-and-component-glow*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: `packages/client/src/canvas/EdgeLegend.tsx`
- FOUND: `packages/client/src/canvas/AnimationQueue.ts`
- FOUND: `.planning/phases/12-edge-interaction-and-component-glow/12-02-SUMMARY.md`
- FOUND commit: `410bfea` (feat(12-02): add EdgeLegend component)
- FOUND commit: `c19a0ee` (feat(12-02): enhance AnimationQueue pulse/border fade)
