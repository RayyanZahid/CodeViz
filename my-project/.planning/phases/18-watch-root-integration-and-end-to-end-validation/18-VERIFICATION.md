---
phase: 18-watch-root-integration-and-end-to-end-validation
verified: 2026-03-17T11:05:20Z
status: human_needed
score: 7/8 must-haves verified
human_verification:
  - test: "Switch to an empty directory while the client is actively displaying a replayed snapshot, then write files to the new directory. Observe the canvas."
    expected: "Canvas shows no nodes during the transition, then populates with nodes from the new directory only. No residual graph data from the previous directory's replay state is visible on the canvas at any point."
    why_human: "The automated Test 3 validates SQLite-level data isolation via node IDs in snapshot rows. The replay mode canvas-mutation guard (preventing live graph_delta from mutating the replay canvas) cannot be verified by API inspection — it requires live observation of the Konva rendering layer during the root-switch transition."
  - test: "Run the application continuously for a representative session (at least 30 minutes of file activity). Check the SQLite database file size and observe timeline scrubbing."
    expected: "Database file stays well under 20MB. Scrubbing to any snapshot position completes in under 200ms (no perceptible lag). The automated 200ms test verifies the query path; this test verifies real-world feel with an active application instance."
    why_human: "The 4-hour / 20MB storage bound is architecturally guaranteed by MAX_SNAPSHOTS=200 in SnapshotManager but is not exercised by a direct soak test. The automated test validates query time with 1-3 snapshots; a real session with hundreds of snapshots needs human verification for the storage claim."
---

# Phase 18: Watch-Root Integration and End-to-End Validation Verification Report

**Phase Goal:** Switching the watched directory resets all replay and intent state, and the complete v3.0 feature set is validated end-to-end
**Verified:** 2026-03-17T11:05:20Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After switching watch root, the timeline endpoint returns no prior snapshots from the old directory | VERIFIED | `snapshotsRepository.deleteByWatchRoot(currentWatchRoot)` at line 162 of `index.ts`; Test 1 asserts `timelineAfterSwitch.length === 0` after 500ms |
| 2 | After switching watch root, the intents endpoint returns no prior sessions from the old directory | VERIFIED | `intentSessionsRepository.deleteByWatchRoot(currentWatchRoot)` at line 163 of `index.ts`; Test 1 asserts `intentsAfterSwitch.length === 0` after 500ms |
| 3 | If user was in replay mode during a root switch, a brief toast notification appears saying "Exited replay" | VERIFIED | `setReplayExitedForSwitch(msg.directory)` fires inside `isReplay` guard in `wsClient.ts` line 247; `App.tsx` renders amber toast at lines 300-320 with auto-dismiss at 2s |
| 4 | Layout positions persist across root switches (no layoutPositions delete) | VERIFIED | `layoutPositions` absent from all purge calls in `switchWatchRoot()`; comment at line 160 explicitly confirms this by design |
| 5 | After switching watch roots and generating new activity, fresh snapshots appear correctly for the new directory | VERIFIED | Test 2 polls until snapshot appears for dirB and validates shape: `id` (number), `sequenceNumber` (number), `timestamp` (epoch ms), `triggerFiles` (array) |
| 6 | Snapshot data after a root switch contains only new-directory nodes (no cross-contamination) | VERIFIED | Test 3 writes `alpha-service.ts / beta-service.ts / gamma-service.ts` to dirA, switches to dirB, writes `widget.ts / panel.ts / dashboard.ts`, fetches dirB snapshot and asserts none of the dirA file names are present in node IDs |
| 7 | GET /api/timeline responds in under 200ms with a loaded session | VERIFIED | Test 4 measures `Date.now()` delta around `page.request.get('/api/timeline')` and asserts `responseMs < 200` |
| 8 | A 4-hour simulated session stores less than 20MB in SQLite snapshots | NEEDS HUMAN | MAX_SNAPSHOTS=200 constant enforces an upper bound architecturally; no direct soak test validates the byte count against the 20MB threshold |

**Score:** 7/8 truths verified (1 needs human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/server/src/index.ts` | SQLite purge of graphSnapshots, intentSessions, snapshotCheckpoints, and changeEvents on watch-root switch | VERIFIED | Lines 162-165: all 4 purge calls present; ordered after step 4 (graphNodes purge) and before step 6 (broadcast) exactly as required |
| `packages/client/src/ws/wsClient.ts` | Sets `replayExitedForSwitch` inside `isReplay` guard on `watch_root_changed` | VERIFIED | Line 247: `replayStore.getState().setReplayExitedForSwitch(msg.directory)` inside `if (replayStore.getState().isReplay)` block at lines 242-249 |
| `packages/client/src/App.tsx` | Toast display for replay-exit-on-switch notification, auto-dismiss after 2s | VERIFIED | Lines 67, 116-123, 300-320: selector, useEffect with 2s clearTimeout, conditional render with amber styling |
| `packages/client/src/store/replayStore.ts` | `replayExitedForSwitch: string | null` field and `setReplayExitedForSwitch` action | VERIFIED | Field declared at line 49, default null at line 129, action at lines 225-227 |
| `.auto-gsd/journey-tests/journey-phase-18.spec.ts` | End-to-end journey tests validating all 4 Phase 18 success criteria | VERIFIED | 4 tests in `test.describe('Phase 18: ...')` block; file is substantive (348 lines) with real API calls, polling loops, and assertions |
| `packages/server/src/db/repository/snapshots.ts` | `deleteByWatchRoot` method | VERIFIED | Lines 72-74: `db.delete(graphSnapshots).where(eq(graphSnapshots.watchRoot, watchRoot)).run()` |
| `packages/server/src/db/repository/intentSessions.ts` | `deleteByWatchRoot` method | VERIFIED | Lines 54-56: `db.delete(intentSessions).where(eq(intentSessions.watchRoot, watchRoot)).run()` |
| `packages/server/src/db/repository/checkpoints.ts` | `deleteByWatchRoot` method | VERIFIED | Lines 59-61: `db.delete(snapshotCheckpoints).where(eq(snapshotCheckpoints.watchRoot, watchRoot)).run()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/server/src/index.ts` | `packages/server/src/db/repository/snapshots.ts` | `snapshotsRepository.deleteByWatchRoot(currentWatchRoot)` | WIRED | Line 162; import at line 10; `watchRoot` column exists in `graphSnapshots` schema (schema.ts line 41) |
| `packages/server/src/index.ts` | `packages/server/src/db/repository/intentSessions.ts` | `intentSessionsRepository.deleteByWatchRoot(currentWatchRoot)` | WIRED | Line 163; import at line 11; `watchRoot` column exists in `intentSessions` schema (schema.ts line 55) |
| `packages/server/src/index.ts` | `packages/server/src/db/repository/checkpoints.ts` | `checkpointsRepository.deleteByWatchRoot(currentWatchRoot)` | WIRED | Line 164; import at line 12; `watchRoot` column exists in `snapshotCheckpoints` schema (schema.ts line 71) |
| `packages/server/src/index.ts` | `packages/server/src/db/schema.ts` | `db.delete(changeEvents).run()` | WIRED | Line 165; `changeEvents` imported at line 9 alongside `graphNodes`/`graphEdges` |
| `packages/client/src/ws/wsClient.ts` | `packages/client/src/store/replayStore.ts` | `setReplayExitedForSwitch(msg.directory)` inside `isReplay` guard | WIRED | Line 247; `replayStore` imported at line 4; guard at lines 242-249 ensures toast only fires during replay |
| `packages/client/src/store/replayStore.ts` | `packages/client/src/App.tsx` | `useReplayStore((s) => s.replayExitedForSwitch)` + conditional render | WIRED | Selector at line 67; `useEffect` auto-dismiss at lines 116-123; render at lines 300-320 |
| `.auto-gsd/journey-tests/journey-phase-18.spec.ts` | `packages/server/src/plugins/timeline.ts` | `GET /api/timeline` REST endpoint assertions | WIRED | Pattern `api/timeline` appears at lines 35, 63, 109, 139, 199, 249, 320, 336 in the test file |
| `.auto-gsd/journey-tests/journey-phase-18.spec.ts` | `packages/server/src/plugins/watchRoot.ts` | `POST /api/watch` REST endpoint for switching watch roots | WIRED | Pattern `api/watch` appears at lines 15, 50, 91, 117, 177, 216, 295 in the test file |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-04 | 18-01, 18-02 | Watch-root switching clears snapshot and intent data and recreates replay infrastructure | SATISFIED | (1) `switchWatchRoot()` purges all 4 replay/intent tables before broadcasting; (2) new `SnapshotManager`, `IntentAnalyzer`, and `InferenceEngine` created on new directory path; (3) 4 journey tests confirm clearing and fresh creation via HTTP API |

**REQUIREMENTS.md cross-reference:** INFRA-04 is the only requirement mapped to Phase 18 in the traceability table (row at line 94). No orphaned requirements exist for this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/client/src/App.tsx` | 614 | `placeholder="/path/to/project"` | Info | HTML input placeholder attribute — not a stub pattern, legitimate UX text |

No blocking anti-patterns found. No TODO/FIXME/HACK comments in any phase 18 modified files.

---

### Human Verification Required

#### 1. Canvas mutation guard during replay after watch-root switch

**Test:** Open the application, enter replay mode by clicking a snapshot on the timeline slider. While still in replay mode, switch the watch root via the directory bar to a different directory. After the switch, write files to the new directory.

**Expected:** The canvas displays no mutations during the transition. After the toast disappears and the new session begins scanning, only new-directory nodes appear on the canvas. No old replay-session nodes bleed through.

**Why human:** The automated Test 3 (cross-contamination) verifies SQLite-level data isolation — it confirms that the snapshot stored in the database for the new directory does not contain node IDs from the old directory. It does not exercise the canvas rendering path during the replay-mode transition itself. The mode isolation guard (preventing `graph_delta` from reaching `graphStore.applyDelta` while `isReplay === true`) is tested in Phase 16 journey tests, but the combination of replay-mode + root-switch + immediate new-directory activity cannot be verified by inspecting REST endpoints alone.

#### 2. Storage bound: 4-hour session stays under 20MB

**Test:** Run ArchLens watching an active development directory for 30+ minutes with real or simulated file activity. After the session, check the SQLite database file size (`packages/server/archlens.db` or equivalent). Also note the scrubbing latency when dragging the timeline slider through many snapshots.

**Expected:** Database file remains well under 20MB (the success criterion states < 20MB for a 4-hour session). Scrubbing to any position completes imperceptibly (< 200ms). The system caps snapshot count at MAX_SNAPSHOTS=200 (confirmed at `SnapshotManager.ts` line 21) which bounds storage growth architecturally, but the actual byte size per snapshot has not been measured against the threshold.

**Why human:** The automated Test 4 validates that `GET /api/timeline` responds in under 200ms with 1-3 snapshots. This confirms query performance at the low end. The 20MB storage claim requires knowing the average snapshot blob size multiplied by 200 (the cap). The SnapshotManager prunes oldest non-checkpoint snapshots once the cap is reached, but the actual compressed blob size per snapshot (which varies by graph size) has not been measured or asserted programmatically.

---

### Gaps Summary

No blocking gaps. All 7 automatically-verifiable must-haves pass at all three levels (exists, substantive, wired). The remaining 1 item (4-hour/20MB storage bound) is a soak-test characteristic that is architecturally bounded by MAX_SNAPSHOTS=200 but requires human measurement to confirm the actual byte ceiling. The mode-isolation-during-root-switch canvas behaviour requires live observation.

**Commits verified:**
- `b8aefbd` — feat(18-01): add SQLite purge calls in switchWatchRoot for replay/intent tables
- `000d308` — feat(18-01): add replay-exit toast notification on watch-root switch
- `006d469` — feat(18-02): write journey-phase-18.spec.ts with 4 end-to-end Phase 18 tests
- `d7a6989` — test(18-02): verify full journey suite passes - 26 tests, 0 failures

All 4 commits exist in git history and map to their declared task outputs.

**INFRA-04 satisfied:** Watch-root switching clears snapshot and intent data (4 SQLite purge calls before broadcast), recreates replay infrastructure (new SnapshotManager + IntentAnalyzer + InferenceEngine on new path), and is validated end-to-end by 4 Playwright journey tests.

---

_Verified: 2026-03-17T11:05:20Z_
_Verifier: Claude (gsd-verifier)_
