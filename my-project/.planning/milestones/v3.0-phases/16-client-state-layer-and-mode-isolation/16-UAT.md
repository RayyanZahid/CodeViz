---
status: complete
phase: 16-client-state-layer-and-mode-isolation
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md
started: 2026-03-17T12:00:00Z
updated: 2026-03-17T12:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Build compiles without errors
expected: Running `npx tsc --noEmit` in the client package completes with zero TypeScript errors. All new files (replayStore.ts, ReplayBanner.tsx, replayTransitions.ts) and modified files (wsClient.ts, App.tsx, inferenceStore.ts, ActivityFeed.tsx, ArchCanvas.tsx) compile cleanly.
result: pass

### 2. App loads without console errors
expected: Starting the dev server and loading the app in the browser produces no new console errors related to replayStore, ReplayBanner, or replayTransitions imports. The existing live graph view works normally.
result: pass

### 3. ReplayBanner hidden in normal mode
expected: When the app is in normal (non-replay) mode, the ReplayBanner component should not be visible. No amber banner appears at the top of the screen during regular use.
result: pass

### 4. Replay mode entry via console triggers banner
expected: Opening browser DevTools and running `window.__replayStore?.getState().enterReplay(new Map(), new Map())` (or equivalent store access) should cause the amber REPLAY MODE banner to appear at the top with a "Return to Live" button featuring a pulse animation.
result: pass

### 5. Buffered event counter on banner
expected: While in replay mode, if live WebSocket messages arrive (e.g. file changes in watched directory), the banner should show a live count of pending/buffered events that updates as new messages are intercepted.
result: pass

### 6. Exit replay via Return to Live button
expected: Clicking the "Return to Live" button on the amber banner exits replay mode — banner disappears, canvas morphs back to live graph positions, and an amber separator line appears in the Activity Feed marking where replay ended.
result: pass

### 7. Exit replay via Escape key
expected: While in replay mode, pressing Escape exits replay (banner disappears, canvas returns to live). If the inspector panel is also open, Escape should exit replay first (priority) rather than dismissing the inspector.
result: pass

### 8. Canvas blue tint during replay
expected: While in replay mode, graph nodes on the canvas display a blue shadow glow overlay while preserving their original zone colors. This visually distinguishes the historical view from the live view.
result: pass

### 9. Empty graph message during replay
expected: If a historical snapshot has zero nodes, entering replay shows a centered message "No architecture at this point in time" instead of an empty canvas.
result: pass

### 10. Watch root change auto-exits replay
expected: While in replay mode, changing the watched directory (via the directory bar) automatically exits replay mode first before switching to the new directory. The banner disappears and the app transitions to the new watch root.
result: pass

### 11. Activity feed separator on replay exit
expected: After exiting replay mode, the Activity Feed shows an amber-tinted divider row with italic text (e.g. "Events during replay") separating historical events from the live catch-up events that follow.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
