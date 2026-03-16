---
phase: 10-risk-panel
verified: 2026-03-16T21:00:00Z
status: human_needed
score: 3/4 must-haves verified (4th requires runtime observation)
re_verification: false
human_verification:
  - test: "Open the app with active risks, click a risk row in the Risk Panel"
    expected: "The offending canvas node becomes highlighted with a selection stroke and the viewport smoothly pans to center on it within ~0.3s"
    why_human: "Canvas highlight and Konva.Tween pan animation cannot be verified by static code inspection; requires visual confirmation in the running app"
  - test: "When new risks arrive via the WebSocket inference message (trigger by saving a file with a circular dependency), observe the Risk Panel"
    expected: "New risk items appear in the panel without a page reload"
    why_human: "Real-time WebSocket push behavior requires a live runtime environment to confirm the full inference → applyInference → Zustand re-render pipeline fires correctly"
---

# Phase 10: Risk Panel Verification Report

**Phase Goal:** Users can see live architectural risks with severity context and act on them from the panel
**Verified:** 2026-03-16T21:00:00Z
**Status:** human_needed — all automated checks passed; 2 items require human observation in a running app
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Risk panel lists every detected risk with a red badge for critical severity and an orange badge for warning severity | VERIFIED | `severityBadgeStyle()` in RiskPanel.tsx (line 22) returns `backgroundColor: '#ef4444'` for critical and `backgroundColor: '#f97316'` (via `severityColor()`) for warning. Badge span rendered at line 86: `<span style={severityBadgeStyle(risk.signal.severity)}>{risk.signal.severity}</span>`. |
| 2 | Clicking a risk in the panel highlights the offending component on the canvas and pans to it | HUMAN NEEDED | Wiring is fully in place: `handleRowClick` (line 65) calls `onHighlightNode?.(targetId)` with `nodeId \|\| affectedNodeIds?.[0]` fallback; App.tsx `handleHighlightNode` (line 136) calls `canvasRef.current?.selectNodeOnCanvas(nodeId)` + `viewportControllerRef.current.panToNode(pos.x, pos.y)`; `selectNodeOnCanvas` implemented at ArchCanvas.tsx line 296; `panToNode` implemented at ViewportController.ts line 188. Visual confirmation of canvas highlight + Konva pan animation requires the running app. |
| 3 | Each risk entry has a "mark as reviewed" control that removes it from the active list | VERIFIED | Checkmark button (U+2713) rendered at RiskPanel.tsx line 119 for all unreviewed risks. On click: calls `markRiskReviewed(risk.id)` (line 122) which sets `reviewed: true` in the Zustand store; `unreviewedRisks` filter at line 282 excludes reviewed items from the active list. `saveReviewedRisks` called at line 321 persists to localStorage immediately. |
| 4 | When new risks are detected via WebSocket, they appear in the panel without a page reload | HUMAN NEEDED | Wiring verified: wsClient.ts line 198 routes `inference` message type to `inferenceStore.getState().applyInference()`, which updates the Zustand `risks` Map; RiskPanel subscribes via `useInferenceStore((s) => s.risks)` (line 277), so any Zustand state update triggers a re-render. The full real-time path requires the server running and a live WebSocket connection to confirm in practice. |

**Automated score:** 2/4 truths fully verified programmatically; 2 require human observation (wiring is confirmed correct)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/client/src/store/inferenceStore.ts` | localStorage persistence for reviewed risk IDs and resurface logic | VERIFIED | `REVIEWED_RISKS_KEY`, `loadReviewedRisks()`, `saveReviewedRisks()`, `persistedReviewedIds` module-level Set (lines 58–84). Resurface logic at lines 208–234: compares `nodeId` and sorted `affectedNodeIds` of reviewed risks against incoming signal. `saveReviewedRisks` called at line 262 (post-applyInference) and line 321 (markRiskReviewed). |
| `packages/client/src/panels/RiskPanel.tsx` | Severity badges, checkmark button, green empty/all-clear states | VERIFIED | `severityBadgeStyle()` at line 22; checkmark `\u2713` button at lines 119–145; `EmptyState` with green checkmark at line 229; `AllClearState` component at lines 239–256; all-clear rendered at line 381 when `unreviewedRisks.length === 0 && reviewedRisks.length > 0`. |
| `packages/client/src/App.tsx` | `handleHighlightNode` wiring between RiskPanel and canvas | VERIFIED | `handleHighlightNode` defined at line 136; passed as `onHighlightNode` prop to `<RiskPanel>` at line 262. Calls `canvasRef.current?.selectNodeOnCanvas(nodeId)` and `viewportControllerRef.current.panToNode(pos.x, pos.y)` with proper guards. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RiskPanel.tsx` | `inferenceStore.ts` | `useInferenceStore` selector reads risks Map, calls `markRiskReviewed` | WIRED | Line 2: `import { useInferenceStore }`. Lines 277–278: `useInferenceStore((s) => s.risks)` and `useInferenceStore((s) => s.markRiskReviewed)`. Both selectors used in render and event handler. |
| `inferenceStore.ts` | localStorage | `localStorage.getItem/setItem` with `archlens-reviewed-risks` key | WIRED | `loadReviewedRisks` at line 63: `localStorage.getItem(REVIEWED_RISKS_KEY)`. `saveReviewedRisks` at line 79: `localStorage.setItem(REVIEWED_RISKS_KEY, JSON.stringify(reviewed))`. Called from `markRiskReviewed` (line 321) and `applyInference` (line 262). |
| `RiskPanel.tsx` | `App.tsx` | `onHighlightNode` prop callback | WIRED | RiskPanel declares `onHighlightNode?: (nodeId: string) => void` prop (line 263). `handleRowClick` calls `onHighlightNode?.(targetId)` (line 68). App.tsx passes `handleHighlightNode` at line 262: `<RiskPanel onHighlightNode={handleHighlightNode} />`. |
| `App.tsx` | `ArchCanvas.tsx` + `ViewportController.ts` | `canvasRef.current.selectNodeOnCanvas(nodeId)` + `viewportControllerRef.current.panToNode()` | WIRED | App.tsx lines 138–143: `canvasRef.current?.selectNodeOnCanvas(nodeId)` followed by `viewportControllerRef.current.panToNode(pos.x, pos.y)` guarded by `if (pos && viewportControllerRef.current)`. `selectNodeOnCanvas` implemented at ArchCanvas.tsx line 296. `panToNode` implemented at ViewportController.ts line 188. |
| `wsClient.ts` | `inferenceStore.ts` | `case 'inference'` branch calls `applyInference` | WIRED | wsClient.ts line 197–199: `case 'inference': { inferenceStore.getState().applyInference(msg as unknown as InferenceMessage); break; }`. WsClient instantiated and connected in main.tsx lines 8–9. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RISK-01 | 10-01-PLAN.md | Risk panel displays detected risks with severity badges (red for critical, orange for warning) | SATISFIED | `severityBadgeStyle()` returns `#ef4444` for critical, `#f97316` for warning via `severityColor()`. Badge rendered on every risk row. TypeScript compiles cleanly. |
| RISK-02 | 10-02-PLAN.md | User can click a risk to highlight the offending component on the canvas and pan to it | SATISFIED (wiring verified; visual confirmation is human-needed) | Full call chain traced from `handleRowClick` through `onHighlightNode` prop → `handleHighlightNode` → `selectNodeOnCanvas` + `panToNode`. `targetId` fallback (`nodeId \|\| affectedNodeIds?.[0]`) prevents silent no-ops for multi-node risks. |
| RISK-03 | 10-01-PLAN.md | User can mark a risk as reviewed to dismiss it from the active list | SATISFIED | Checkmark button calls `markRiskReviewed`; store sets `reviewed: true` and persists to localStorage; `unreviewedRisks` filter excludes reviewed items from the rendered active list. |

No orphaned requirements — RISK-01, RISK-02, and RISK-03 are all claimed by plans in this phase and are the only RISK-prefixed requirements in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `RiskPanel.tsx` line 22 | `React.CSSProperties` used without `import React` | Info | Ambient type access works under the React 18 JSX transform + `@types/react` global types. `npx tsc --noEmit` passes with zero errors. Not a runtime risk. |

No stub patterns, no TODO/FIXME comments, no empty implementations, no console.log-only handlers found in any of the three modified files.

---

## Commit Verification

All documented commits exist in git history:

| Commit | Message | Status |
|--------|---------|--------|
| `3e97ad2` | feat(10-01): add localStorage persistence and resurface logic to inferenceStore | VERIFIED |
| `6981a7b` | feat(10-01): enhance RiskPanel with severity badges, checkmark button, and positive states | VERIFIED |
| `0d0383b` | fix(10-02): harden risk click-to-highlight with affectedNodeIds fallback | VERIFIED |

---

## Human Verification Required

### 1. Click-to-highlight and pan (RISK-02)

**Test:** Start `pnpm dev` from the project root. Open `http://localhost:5173`. Trigger at least one risk (e.g., introduce a circular dependency). Click an unreviewed risk row in the Risk Panel.

**Expected:** The corresponding node on the canvas gains a visible selection stroke (blue/highlight outline from `selectNodeOnCanvas`). The viewport smoothly pans to center on that node within approximately 0.3 seconds (Konva.Tween EaseInOut animation).

**Why human:** The canvas highlight and Konva.Tween viewport animation are visual runtime behaviors that cannot be confirmed by reading source code alone. The wiring is fully verified; the visual output requires a running browser.

### 2. Live WebSocket risk delivery without page reload (Success Criterion 4)

**Test:** With the app running and a project being watched, modify a file to introduce a circular dependency between two components. Observe the Risk Panel without refreshing the page.

**Expected:** A new risk entry (with severity badge) appears in the panel within a few seconds, driven by the server's inference message delivered over the WebSocket connection.

**Why human:** The real-time push path traverses the server-side watcher, parser, inference engine, and WebSocket broadcast — components outside the client codebase. Code tracing confirms the client-side handler is wired correctly (`case 'inference'` → `applyInference` → Zustand → React re-render), but the full end-to-end behavior with a live server requires runtime observation.

---

## Gaps Summary

No gaps. All phase goals are structurally complete:

- Severity badges (RISK-01): red/orange pill spans rendered from `severityBadgeStyle()` — fully implemented.
- Mark-as-reviewed with localStorage (RISK-03): checkmark button, `markRiskReviewed` action, `saveReviewedRisks`/`loadReviewedRisks` helpers, and resurface logic all implemented and interconnected.
- Click-to-highlight and pan (RISK-02): complete call chain from risk row click through to `selectNodeOnCanvas` + `panToNode` — wiring verified, visual output is human-needed.
- Live WebSocket updates: `case 'inference'` routes to `applyInference` which updates the Zustand store subscribed by `RiskPanel` — wiring verified, live behavior is human-needed.

The human verification items are runtime observations, not code gaps. If the two human tests pass, phase status upgrades to `passed`.

---

_Verified: 2026-03-16T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
