---
phase: 13-watch-any-project
verified: 2026-03-16T23:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 13: Watch Any Project — Verification Report

**Phase Goal:** Users can point the tool at any directory and immediately begin watching it without restarting the server
**Verified:** 2026-03-16T23:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Typing a directory path in the UI input and pressing Enter starts watching that directory | VERIFIED | `DirectoryBar` in `App.tsx` line 487 — `onKeyDown` with `e.key === 'Enter'` calls `handleSubmit()`, which POSTs to `/api/watch` |
| 2 | Setting `ARCHLENS_WATCH_ROOT` env var before starting sets the initial watched directory | VERIFIED | `index.ts` line 33: `let currentWatchRoot = process.env.ARCHLENS_WATCH_ROOT ?? process.cwd()`. `DirectoryBar` fetches `GET /api/watch` on mount and pre-fills input from server response |
| 3 | After changing the watched directory, the canvas clears, the graph resets, and a fresh scan begins | VERIFIED | Server: `switchWatchRoot()` calls `graph.reset()`, purges SQLite tables, resets aggregator, broadcasts `watch_root_changed`. Client `wsClient.ts` lines 213-232: handles `watch_root_changed` by calling `graphStore.getState().resetState()` and `inferenceStore.getState().resetState()` |
| 4 | The tool correctly builds and displays the architecture graph for an external project | VERIFIED | `POST /api/watch` validates directory with `fs.access` + `fs.stat`, resolves to absolute path, then stops old pipeline and starts `new Pipeline(newDir, ...)`. No hardcoded paths — any readable directory is accepted |

**Score:** 4/4 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `packages/server/src/plugins/watchRoot.ts` | POST /api/watch and GET /api/watch endpoints | Yes | Yes — 79 lines, full validation logic, `fs.access`, `fs.stat`, `path.resolve`, calls `setWatchRoot` | Yes — registered in `index.ts` line 155 via `fastify.register(watchRootPlugin, {...})` | VERIFIED |
| `packages/server/src/graph/DependencyGraph.ts` | `reset()` method clearing all in-memory graph state | Yes | Yes — `reset()` at line 587, clears nodes, `prevFileResults`, `activeCycles`, `consolidateTimer`, `pendingBatches`, `version` | Yes — called in `switchWatchRoot()` step 3 in `index.ts` line 125 | VERIFIED |
| `packages/shared/src/types/messages.ts` | `WatchRootChangedMessage` in `ServerMessage` union | Yes | Yes — interface defined at line 36-39, added to union at line 41 | Yes — used by `index.ts` broadcast call and parsed by client Zod schema | VERIFIED |
| `packages/client/src/schemas/serverMessages.ts` | Zod schema for `watch_root_changed` message type | Yes | Yes — `WatchRootChangedMessageSchema` at line 90-93, included in discriminated union at line 104 | Yes — `WsClient` uses `ServerMessageSchema.safeParse()` which parses all 5 message types including `watch_root_changed` | VERIFIED |

### Plan 02 Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `packages/client/src/App.tsx` | `DirectoryBar` component with input, submit, error display, scanning indicator | Yes | Yes — `DirectoryBar` function at line 394-556. Full implementation: `useEffect` for GET on mount, `handleSubmit` for POST, error state, scanning indicator, `Watching:` label | Yes — rendered as first child of root `div` at line 215: `<DirectoryBar />` | VERIFIED |
| `packages/client/src/ws/wsClient.ts` | Handler for `watch_root_changed` resetting both stores | Yes | Yes — `case 'watch_root_changed'` at line 213-232, resets `graphStore`, `inferenceStore`, sets `watchRoot`, sets `scanning=true`, resets version tracking, clears pending deltas | Yes — within `handleMessage` switch that processes all WS messages | VERIFIED |
| `packages/client/src/store/graphStore.ts` | `resetState` action clearing nodes, edges, version | Yes | Yes — `resetState` at line 117-125, clears nodes, edges, version, changeSummary; also adds `watchRoot`, `setWatchRoot`, `scanning`, `setScanning` | Yes — called by `wsClient.ts` on `watch_root_changed` | VERIFIED |
| `packages/client/src/store/inferenceStore.ts` | `resetState` action clearing activityFeed, risks, activeNodeIds | Yes | Yes — `resetState` at line 435-441, clears all three fields with fresh empty collections | Yes — called by `wsClient.ts` on `watch_root_changed` | VERIFIED |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `watchRoot.ts` | `index.ts` | `fastify.register(watchRootPlugin, {...})` | WIRED | `index.ts` line 155: `fastify.register(watchRootPlugin, { getWatchRoot: () => currentWatchRoot, setWatchRoot: switchWatchRoot })` |
| `watchRoot.ts` | `DependencyGraph.ts` | `graph.reset()` call in POST handler | WIRED | `switchWatchRoot()` in `index.ts` line 125 calls `graph.reset()`. The plugin's `setWatchRoot` callback IS `switchWatchRoot`, which performs the reset. |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `App.tsx` | `/api/watch` (GET) | `fetch('/api/watch')` on mount | WIRED | `App.tsx` line 405: `fetch('/api/watch')` in `useEffect([], [])` |
| `App.tsx` | `/api/watch` (POST) | `fetch` POST on Enter key press | WIRED | `App.tsx` lines 429-433: `fetch('/api/watch', { method: 'POST', ... })` inside `handleSubmit` |
| `wsClient.ts` | `graphStore.ts` | `graphStore.getState().resetState()` on `watch_root_changed` | WIRED | `wsClient.ts` line 216: `graphStore.getState().resetState()` in the `watch_root_changed` case |

---

## Supporting Implementation Details

The following supporting changes were required by the plan and are confirmed present:

| Component | Change | Evidence |
|-----------|--------|----------|
| `ComponentAggregator.ts` | `resetCache()` method | Line 57-60: clears `lastSnapshot` and `fileToComponentMap` |
| `InferenceEngine.ts` | Named `deltaHandler` for clean `destroy()` | Line 66-67: `private readonly deltaHandler` defined; `destroy()` calls `graph.off('delta', this.deltaHandler)` |
| `websocket.ts` | `broadcast` exported | Line 102: `export function broadcast(message: ServerMessage): void` |
| `index.ts` | `wireInferenceBroadcast()` helper | Lines 53-72: extracts inference event binding for re-wiring after each switch |
| `index.ts` | `let pipeline/inferenceEngine` (mutable) | Lines 39, 102: `let inferenceEngine`, `let pipeline` |
| `index.ts` | `switchWatchRoot()` full 10-step sequence | Lines 117-152: stop, destroy, reset, purge SQLite, resetCache, broadcast, update root, new engine, wire inference, new pipeline |
| `App.tsx` | Canvas scanning overlay | Lines 335-355: renders centered "Scanning project..." when `scanning && nodeCount === 0` |
| `App.tsx` | Outer vertical flex layout | Lines 204-213: `flexDirection: 'column'` outer div wraps `DirectoryBar` above horizontal canvas+sidebar |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WATCH-01 | 13-02 | User can type a directory path in a text input at the top of the UI and press Enter to start watching it | SATISFIED | `DirectoryBar` in `App.tsx` with full input + Enter handler + POST to `/api/watch` |
| WATCH-02 | 13-01, 13-02 | `ARCHLENS_WATCH_ROOT` environment variable sets the initial watched directory | SATISFIED | `index.ts` line 33 reads `process.env.ARCHLENS_WATCH_ROOT`; `GET /api/watch` returns this value; `DirectoryBar` pre-fills from GET response |
| WATCH-03 | 13-01, 13-02 | On directory change, the canvas clears, graph resets, and a fresh scan begins | SATISFIED | `switchWatchRoot()` resets graph+DB+aggregator; broadcasts `watch_root_changed`; `wsClient.ts` resets both stores; new `Pipeline` starts on new directory |
| WATCH-04 | 13-01, 13-02 | The system works correctly when watching external projects (not just self-watching) | SATISFIED | `POST /api/watch` validates with `fs.access`+`fs.stat`, resolves to absolute path, passes to `new Pipeline(resolvedPath, ...)` — any readable directory accepted |

No orphaned requirements — all four WATCH requirements are addressed by the plans and verified in the codebase.

---

## Anti-Patterns Found

No anti-patterns detected across all modified files:

- No TODO/FIXME/PLACEHOLDER comments in any phase 13 files
- No stub implementations (no `return null`, `return {}`, `return []` in handlers)
- No console.log-only handlers
- All fetch calls have response handling
- All async handlers await results and handle errors

---

## Human Verification Required

The following items require runtime verification and cannot be confirmed statically:

### 1. Enter Key Triggers Watch

**Test:** Open the app, type a valid directory path in the top bar input, press Enter.
**Expected:** Canvas clears, "Scanning..." appears next to the input, components from the new directory appear incrementally within a few seconds.
**Why human:** Requires running server + browser; E2E flow from keystroke through WebSocket message to canvas re-render.

### 2. ARCHLENS_WATCH_ROOT Pre-fill

**Test:** Start the server with `ARCHLENS_WATCH_ROOT=/some/other/dir pnpm dev`, open the browser.
**Expected:** The directory input in the top bar shows `/some/other/dir` (not the default cwd).
**Why human:** Requires process environment variable injection and live browser check.

### 3. Invalid Path Shows Red Error

**Test:** Type `/this/path/does/not/exist` in the input and press Enter or click Watch.
**Expected:** A red error message appears immediately below the top bar reading "Directory does not exist or is not readable: /this/path/does/not/exist".
**Why human:** Requires live server + browser to observe the 400 response and inline error rendering.

### 4. Scanning State Lifecycle

**Test:** Switch to a directory with many TypeScript files. Observe the "Scanning..." yellow indicator.
**Expected:** "Scanning..." appears immediately after pressing Enter, and disappears when the first components arrive on the canvas (on first `graph_delta` received).
**Why human:** Timing of WS message receipt and React state transitions requires live browser observation.

### 5. External Project Graph Correctness

**Test:** Point the tool at a real external TypeScript project (e.g., a monorepo or library not in this codebase), wait for scanning to complete.
**Expected:** The canvas shows components from that project's directory structure — not artifacts from the previous ArchLens graph.
**Why human:** Correctness of the resulting graph for an arbitrary external project cannot be verified statically.

---

## Gaps Summary

None. All automated checks passed at all three verification levels (exists, substantive, wired).

The phase goal is achieved: the server exposes `GET /api/watch` and `POST /api/watch`, all in-memory and SQLite state resets cleanly on switch, the client UI renders a directory bar pre-filled from the server, keyboard submission triggers the API call, and WebSocket clients receive and process the `watch_root_changed` message. All four requirement IDs (WATCH-01 through WATCH-04) are satisfied.

---

_Verified: 2026-03-16T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
