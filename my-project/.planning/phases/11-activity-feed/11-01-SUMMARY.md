---
phase: 11-activity-feed
plan: "01"
subsystem: client-activity-feed
tags: [activity-feed, inference-store, event-sentence, websocket, react]
dependency_graph:
  requires: []
  provides: [FEED-01, FEED-02, FEED-03, FEED-04]
  affects: [inferenceStore, wsClient, ActivityFeed, eventSentence]
tech_stack:
  added: []
  patterns: [zustand-store, feed-batching, live-timestamp-tick]
key_files:
  created: []
  modified:
    - packages/client/src/store/inferenceStore.ts
    - packages/client/src/utils/eventSentence.ts
    - packages/client/src/ws/wsClient.ts
    - packages/client/src/panels/ActivityFeed.tsx
decisions:
  - "batchPrependItem() extracted as shared helper used by both applyInference and applyGraphDelta"
  - "ActivityItem.event made optional and nodeId added as first-class field for batching"
  - "applyGraphDelta called immediately (not batched with queueDelta) for <3s feed latency"
  - "Risk feed entries prepended directly without architectural-event batching (separate concerns)"
metrics:
  duration: "~3 min"
  completed: "2026-03-16"
  tasks_completed: 2
  files_modified: 4
---

# Phase 11 Plan 01: Activity Feed Wiring Summary

**One-liner:** Graph delta file events and risk signals wired to activity feed with natural-language sentences, colored dots, and 10s live timestamp ticking.

## What Was Built

Completed the activity feed so users see a real-time stream of all codebase events — file changes, architectural events, and risk detections — as natural-language sentences with color-coded dots and live-updating timestamps.

### Task 1: Graph delta and risk event feed processing (inferenceStore + eventSentence)

**eventSentence.ts additions:**
- `deltaToSentence(addedNodes, removedNodeIds, updatedNodes, addedEdges, removedEdgeIds, nodeNameFn)` — converts graph delta arrays to `DeltaSentenceItem[]` objects with sentence, iconColor, and nodeId
  - Added nodes: `"${name} created"` with green dot (#22c55e)
  - Removed nodes: `"${name} removed"` with gray dot (#94a3b8)
  - Updated nodes: `"${name} modified"` with gray dot (#94a3b8)
  - Added edges: `"New dependency: ${sourceName} → ${targetName}"` with blue dot (#3b82f6)
  - Removed edges: `"Removed dependency: ${sourceName} → ${targetName}"` with blue dot — parses `${sourceId}::${targetId}` format
- `riskToSentence(signal, nodeNameFn)` — formats risk signals as `"${SeverityCapitalized}: ${riskTypeLabel} — ${nodeName}"` (e.g., "Critical: Circular dependency — Parser")

**inferenceStore.ts changes:**
- `ActivityItem` interface: added `nodeId: string` field; made `event?: ArchitecturalEvent` optional
- `InferenceStore` interface: added `applyGraphDelta: (msg: GraphDeltaMessage) => void`
- Extracted `batchPrependItem()` helper for 2s same-nodeId batching — shared by both applyInference and applyGraphDelta
- `applyInference()` section 3b: creates orange-dot feed entries for NEW risk detections only (fingerprint dedup prevents duplicates)
- New `applyGraphDelta()` method: converts delta arrays to ActivityItems, applies 2s batching, caps at 50, updates activeNodeIds for glow animations

### Task 2: wsClient wiring + ActivityFeed live ticking

**wsClient.ts:**
- In `graph_delta` handler: added `inferenceStore.getState().applyGraphDelta(msg as unknown as GraphDeltaMessage)` immediately after `queueDelta()` — processes for feed WITHOUT waiting for 500ms graphStore batch, ensuring <3s latency (FEED-01)

**ActivityFeed.tsx:**
- Added `useEffect` import
- Added `const [, setTick] = useState(0)` counter
- Added `setInterval(() => setTick(t => t + 1), 10_000)` with cleanup — forces re-render every 10s so `relativeTime()` recomputes for all visible items (FEED-04)

## Verification Results

- TypeScript: `npx tsc --noEmit -p packages/client/tsconfig.json` — PASS (zero errors)
- `applyGraphDelta` present in inferenceStore.ts (interface + implementation)
- `deltaToSentence` exported from eventSentence.ts
- `riskToSentence` exported from eventSentence.ts
- `nodeId: string` field on ActivityItem interface
- `applyGraphDelta` called in wsClient.ts graph_delta handler
- `setTick` and `setInterval` present in ActivityFeed.tsx

## Requirements Satisfied

- **FEED-01**: File save → graph delta broadcast → wsClient immediately calls applyGraphDelta → feed entry within 3s
- **FEED-02**: Natural-language sentences: "Parser modified", "New dependency: X → Y", "Critical: Circular dependency — Parser"
- **FEED-03**: Colored dots: green (#22c55e) for creation, blue (#3b82f6) for dependency changes, orange (#f97316) for risk events, gray (#94a3b8) for file modifications
- **FEED-04**: setInterval forces relativeTime() recompute every 10s — live-updating timestamps

## Commits

| Hash | Description |
|------|-------------|
| d6c7db9 | feat(11-01): add graph delta and risk event feed processing |
| c4cc84f | feat(11-01): wire graph_delta to feed and add live timestamp ticking |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used correct GraphEdge field names (sourceId/targetId)**
- **Found during:** Task 1, writing deltaToSentence
- **Issue:** Plan referenced `edge.source` / `edge.target` but the `GraphEdge` interface uses `edge.sourceId` / `edge.targetId`
- **Fix:** Used `edge.sourceId` and `edge.targetId` in deltaToSentence, verified against `packages/shared/src/types/graph.ts`
- **Files modified:** packages/client/src/utils/eventSentence.ts
- **Commit:** d6c7db9

## Self-Check: PASSED

- packages/client/src/store/inferenceStore.ts — EXISTS
- packages/client/src/utils/eventSentence.ts — EXISTS
- packages/client/src/ws/wsClient.ts — EXISTS
- packages/client/src/panels/ActivityFeed.tsx — EXISTS
- Commit d6c7db9 — EXISTS
- Commit c4cc84f — EXISTS
