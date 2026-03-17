# Phase 18: Watch-Root Integration and End-to-End Validation - Research

**Researched:** 2026-03-17
**Domain:** Watch-root switch lifecycle, SQLite data purge, client-side state reset, E2E validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Old project data lifecycle**
- On watch-root switch, immediately delete (blocking) all old snapshots, intent sessions, and checkpoints from SQLite before starting the new pipeline
- Layout positions (node x/y coordinates) are preserved per watchRoot — so re-watching a project gets familiar node placement
- Everything else is wiped: snapshots, checkpoints, intent sessions, change events
- Re-watching a previously-watched project starts a completely fresh scan with empty timeline/intents — only layout positions persist
- Delete is synchronous/blocking — guarantees clean state before new pipeline starts

**Switch transition UX**
- No confirmation dialog when switching — user chose to switch, don't add friction
- Timeline bar clears immediately and shows "Scanning [project name]..." until first snapshot arrives
- If user is in replay mode during switch, auto-exit replay with a brief toast: "Exited replay — switching to [new project]"
- Intent panel clears to empty immediately — no transition state or "waiting" message

**Mode isolation**
- Canvas mutation guard is client-side only — server sends all deltas regardless, client buffers them in replay mode (proven pattern from Phase 16)
- No extra feedback when files are written during replay — existing replay banner with "N live events pending" counter is sufficient
- Buffer overflow behavior (>500 events) is identical to normal overflow — fetch fresh snapshot on exit, discard buffer. Root switch does not change overflow behavior
- Existing replay banner is sufficient visual indicator — no additional canvas overlay or lock icon needed

### Claude's Discretion
- Exact SQLite delete query ordering and transaction handling
- Performance optimization approach for the 20MB/200ms targets
- E2E test structure and scenario coverage
- Snapshot retention/pruning strategy within the 20MB budget

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | Watch-root switching clears snapshot and intent data and recreates replay infrastructure | The core gap identified: `switchWatchRoot()` in `index.ts` currently purges `graphNodes` and `graphEdges` but does NOT delete `graphSnapshots`, `intentSessions`, or `snapshotCheckpoints`. All three repositories already expose `deleteByWatchRoot()` and `deleteBySession()` methods that can be called synchronously via `better-sqlite3`. The client-side reset via `watch_root_changed` WebSocket message already clears in-memory stores but those stores will immediately re-fetch stale data from the server's session-filtered timeline/intents endpoints if the underlying DB rows are not deleted server-side. |
</phase_requirements>

---

## Summary

Phase 18 is primarily a **gap-fill and integration-validation** phase. The v3.0 feature set is functionally complete from Phases 14-17; this phase wires together the one missing piece (INFRA-04: SQLite purge on watch-root switch) and validates that all features work correctly across root switches.

The central finding is that `switchWatchRoot()` in `packages/server/src/index.ts` already destroys and recreates the server-side objects (InferenceEngine, SnapshotManager, IntentAnalyzer, Pipeline) and already purges `graphNodes`/`graphEdges` from SQLite — but it does not delete `graphSnapshots`, `snapshotCheckpoints`, or `intentSessions`. All three repositories already have `deleteByWatchRoot()` methods that execute synchronous SQLite deletes via `better-sqlite3`. Adding these three calls completes INFRA-04. No new infrastructure is needed.

The client side (`WsClient.handleMessage` for `watch_root_changed`) already clears all in-memory state including `replayStore.setSnapshots([])` and `intentStore.resetState()`. The CONTEXT.md adds one new client-side requirement: if the user is in replay mode during the switch, they must receive a toast notification ("Exited replay — switching to [new project]") before the existing `exitReplay()`/`clearBuffer()` calls execute. The current client code handles the replay exit but has no toast — that needs to be added.

The 4-hour / 20MB / 200ms performance targets map directly to the existing `SnapshotManager` constants (MAX_SNAPSHOTS=200, CHECKPOINT_INTERVAL=50) and the `snapshotsRepository.getMetaBySession()` pattern which excludes the large `graphJson` column. These are already designed to meet the targets and require measurement/verification, not new code.

**Primary recommendation:** The work decomposes into three tasks: (1) add three SQLite delete calls to `switchWatchRoot()` in `index.ts`, (2) add a toast notification to the client's replay-mode exit-on-switch path, and (3) write substantive journey tests that exercise watch-root switching, mode isolation after a switch, and performance assertions.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | Existing | Synchronous SQLite via `db.delete().run()` | Already in use; `.run()` is blocking — exactly what CONTEXT.md requires for synchronous delete |
| drizzle-orm | Existing | Query building for `delete().where()` | Already in use across all repositories |
| Zustand | Existing | Client-side store reset on `watch_root_changed` | Already fully wired; `resetState()` methods exist on all stores |
| @playwright/test | Existing | E2E journey tests via the established `.auto-gsd/journey-tests/` harness | Established pattern from Phases 14-15 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `useState` + inline toast | Existing | Brief toast for replay-exit-on-switch notification | In-scope UX requirement; no external toast library needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline toast (React state) | react-toastify or similar | External library adds complexity for a single 2-second notification; inline is sufficient |
| `deleteByWatchRoot` in switchWatchRoot | `deleteBySession` (by old session ID) | Both work; `deleteByWatchRoot` is cleaner because the session ID of old sessions may already be gone from memory. Both variants exist in the repositories. Either approach is acceptable — see Architecture Patterns below. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes needed. Phase 18 touches only:
```
packages/server/src/index.ts              # Add 3 delete calls to switchWatchRoot()
packages/client/src/ws/wsClient.ts        # Add toast trigger in watch_root_changed handler
packages/client/src/App.tsx               # Add toast state + display if wsClient cannot
.auto-gsd/journey-tests/journey-phase-18.spec.ts  # New journey test file
```

### Pattern 1: Synchronous SQLite Purge in switchWatchRoot

**What:** Add three blocking deletes to `switchWatchRoot()` immediately after the current `db.delete(graphEdges).run()` / `db.delete(graphNodes).run()` calls (step 4 in the existing function), using the same `currentWatchRoot` variable (which still holds the old path at this point in the function).

**When to use:** Immediately before step 5 (aggregator.resetCache()), after step 4 (graphNodes/graphEdges purge). The old `currentWatchRoot` value is still available — it has not been updated to `newDir` yet (step 7).

**Example:**
```typescript
// In switchWatchRoot(), after db.delete(graphNodes).run() at step 4:

// 4b. Purge replay/intent SQLite tables for the old watch root — synchronous/blocking
//     per CONTEXT.md: delete is synchronous to guarantee clean state before new pipeline starts
snapshotsRepository.deleteByWatchRoot(currentWatchRoot);
intentSessionsRepository.deleteByWatchRoot(currentWatchRoot);
checkpointsRepository.deleteByWatchRoot(currentWatchRoot);
```

**Critical ordering rule:** These deletes MUST run BEFORE `currentWatchRoot = newDir` (step 7) because `deleteByWatchRoot` needs the old path as the filter value. The current function structure already provides the correct ordering opportunity.

**Why `deleteByWatchRoot` instead of `deleteBySession`:** The old SnapshotManager's session ID is discarded at step 2b (`snapshotManager.destroy()`). While it could be captured before destroy, using `deleteByWatchRoot` is simpler and equally correct — it deletes all data associated with the old directory without needing to carry session IDs forward. Layout positions (`layoutPositions` table) are NOT touched — per CONTEXT.md they persist across root switches.

### Pattern 2: Replay-Exit Toast on Watch-Root Switch (Client)

**What:** When `watch_root_changed` arrives during replay mode, the current code calls `exitReplay()` and `clearBuffer()` silently. CONTEXT.md requires a brief toast: "Exited replay — switching to [new project]".

**Current code (wsClient.ts, line 240-245):**
```typescript
case 'watch_root_changed': {
  if (replayStore.getState().isReplay) {
    replayStore.getState().exitReplay();
    replayStore.getState().clearBuffer();
  }
  // ... rest of handler
```

**Required addition:** Signal to the UI that a replay-exit-on-switch occurred. Two clean options:

Option A — Callback in WsClient constructor (preferred, no store coupling):
```typescript
// WsClient constructor receives optional onReplayExitedOnSwitch callback
// App.tsx passes () => setToastVisible(true) as the callback
```

Option B — Dedicated boolean field in replayStore or graphStore that App.tsx watches:
```typescript
// replayStore.setExitedForRootSwitch(true) in wsClient
// App.tsx: useEffect watches exitedForRootSwitch, shows toast when true, resets after 2s
```

Both options are clean. Option A avoids adding store surface area; Option B keeps WsClient free of UI callbacks. CONTEXT.md leaves this as "Claude's Discretion" — recommend Option A (callback) because WsClient already receives nothing from App.tsx and adding one callback is lightweight.

**Toast implementation:** Simple `useState<string | null>` in App.tsx + absolute-positioned div (same pattern as scanning overlay). Auto-dismiss after 2000ms via `setTimeout`. No animation required per CONTEXT.md ("brief toast").

### Pattern 3: Journey Test Structure for Watch-Root Switch

**What:** Phase 18 journey tests must use the established `SERVER_URL` (port 3100) pattern for API calls, not `BASE_URL` (port 5173). They need real temp directories that differ between scenarios.

**Established patterns (from journey-phase-15.spec.ts):**
- Use `os.tmpdir()` + `fs.mkdtempSync()` for isolated temp directories
- Use `page.request.post(SERVER_URL + '/api/watch', { data: { directory: dir } })` to switch watch root
- Poll for expected state with `page.waitForResponse` or timeout loops
- `try/finally` cleanup with `fs.rmSync(dir, { recursive: true, force: true })`
- `workers: 1` in playwright.config.ts (already set) — tests share server state

**Watch-root switch test structure:**
```typescript
// 1. Switch to dir-A, wait for initial snapshot
// 2. Verify /api/timeline has snapshots for dir-A session
// 3. Switch to dir-B (different temp dir)
// 4. Verify /api/timeline returns EMPTY array (old data purged)
// 5. Write files to dir-B, wait for new snapshot
// 6. Verify /api/timeline shows fresh snapshots for dir-B session only
```

**Mode isolation test structure after watch-root switch:**
```typescript
// 1. Switch to dir-A, get at least one snapshot
// 2. Enter replay mode via loadSnapshotAndEnterReplay (or GET /api/snapshot/:id)
// 3. Switch to dir-B (triggers replay-exit notification)
// 4. Write files to dir-B
// 5. Verify /api/timeline for dir-B shows new snapshots
// 6. Verify canvas shows live dir-B state (not replaying dir-A)
// Note: The guard tested here is that snapshot data doesn't bleed across switch
```

### Anti-Patterns to Avoid

- **Deleting layout positions on switch:** CONTEXT.md explicitly preserves them. Do NOT add `layoutPositions` to the purge sequence.
- **Async delete calls:** `better-sqlite3` is synchronous; `db.delete().run()` has no Promise. Do not wrap in `await` — it will silently fail (returns undefined, not a Promise). The pattern is already established in `switchWatchRoot()` for `graphEdges`/`graphNodes`.
- **Using `deleteBySession` with stale session IDs:** SnapshotManager is destroyed before any cleanup (step 2b). Either capture the session ID before destroy (fragile) or use `deleteByWatchRoot` (cleaner).
- **Testing with `BASE_URL` for API calls:** Established pattern from Phase 15 fixes: ALL server API calls in journey tests use `SERVER_URL` (port 3100), never `BASE_URL` (port 5173). Journey-phase-15.spec.ts confirmed this.
- **Tests depending on DB state from previous tests:** Each test must call `POST /api/watch` with a fresh temp dir to start clean. The server's session state is global; relying on a previous test's session data causes flakiness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite table purge | Custom raw SQL | `snapshotsRepository.deleteByWatchRoot()`, `intentSessionsRepository.deleteByWatchRoot()`, `checkpointsRepository.deleteByWatchRoot()` | These methods already exist in the repositories with correct Drizzle ORM query building |
| Toast notification | External toast library | Inline `useState<string \| null>` + `setTimeout` in App.tsx | Single-use, no animation needed per CONTEXT.md; same pattern as existing scanning overlay |
| Test temp dir management | Custom fs helpers | `os.tmpdir() + fs.mkdtempSync()` + `finally { fs.rmSync(...) }` | Established pattern from journey-phase-15.spec.ts; cross-platform and reliable |

**Key insight:** All the infrastructure for this phase (repositories, stores, WsClient handler, switchWatchRoot function) already exists. Phase 18 is surgical additions to existing code, not new systems.

---

## Common Pitfalls

### Pitfall 1: Delete Order and Foreign Keys

**What goes wrong:** SQLite `foreign_keys = OFF` is set in `connection.ts`. This means FK constraints are not enforced, so delete order among `graphSnapshots` / `snapshotCheckpoints` / `intentSessions` doesn't matter technically. However, the conceptual order should mirror the schema intent: delete checkpoints before (or together with) snapshots.

**Why it happens:** Developers assume FK enforcement is active; with `foreign_keys = OFF`, any order works.

**How to avoid:** Delete in order: `snapshotsRepository.deleteByWatchRoot()` → `intentSessionsRepository.deleteByWatchRoot()` → `checkpointsRepository.deleteByWatchRoot()`. All three are independent deletes — order is a style choice, not a correctness requirement.

**Warning signs:** If only some rows are deleted, check that the `watchRoot` column in the deleted table was populated correctly when the rows were inserted.

### Pitfall 2: Timeline Plugin getSessionId Closure After Switch

**What goes wrong:** `timelinePlugin` receives `getSessionId: () => snapshotManager.getSessionId()` as a closure over the module-level `snapshotManager` variable. After `switchWatchRoot()` replaces `snapshotManager` with a new instance, the closure automatically returns the new session ID. This is the correct behavior — but the old session's SQLite data must be gone before the new session starts, otherwise `GET /api/timeline` could briefly return old snapshots if called during the transition.

**Why it happens:** Race condition between the time the WS `watch_root_changed` message is sent (step 6) and when the SQLite purge completes.

**How to avoid:** The SQLite purge (new step 4b) must run BEFORE step 6 (`broadcast({ type: 'watch_root_changed' })`). The proposed placement (immediately after graphEdges/graphNodes purge at step 4, before step 5 aggregator reset) satisfies this ordering.

**Warning signs:** Journey test that calls `GET /api/timeline` immediately after `watch_root_changed` WS message arrives gets non-empty results.

### Pitfall 3: Client replayStore.snapshots After Switch

**What goes wrong:** `WsClient.handleMessage` for `watch_root_changed` already calls `replayStore.getState().setSnapshots([])` (line 254 in wsClient.ts). This clears the timeline bar immediately. However, if the server's old snapshots are not purged from SQLite, a reconnect or manual page refresh would re-fetch them from `GET /api/timeline`.

**Why it happens:** Client-side clear is ephemeral; only server-side SQLite purge is persistent.

**How to avoid:** Both must happen: server purges SQLite (INFRA-04 gap) AND client clears in-memory state (already done). Phase 18 adds the server-side purge.

**Warning signs:** After a page refresh following a root switch, the timeline shows snapshots from the old project.

### Pitfall 4: Toast Triggering on Every watch_root_changed (Not Just During Replay)

**What goes wrong:** The CONTEXT.md toast ("Exited replay — switching to [new project]") should ONLY appear when the user was in replay mode during the switch. If the toast fires on every root switch, it becomes noise.

**Why it happens:** Simple implementation fires toast unconditionally in the `watch_root_changed` handler.

**How to avoid:** Check `replayStore.getState().isReplay` BEFORE calling `exitReplay()`. Only signal the toast callback if `isReplay` was true. The callback/flag should be set inside the `if (replayStore.getState().isReplay)` block, not outside it.

**Warning signs:** Toast appears when user submits a new directory from the DirectoryBar without being in replay mode.

### Pitfall 5: Performance Test Approach for 4-hour / 20MB / 200ms

**What goes wrong:** Testing actual 4-hour sessions is impractical in a journey test. The 20MB / 200ms targets need to be validated via architectural analysis + bounded simulation, not real-time recording.

**Why it happens:** The success criteria appear to require a 4-hour soak test.

**How to avoid:** The targets are provably met by the existing SnapshotManager constants:
- `MAX_SNAPSHOTS = 200` snapshots at ~50-100KB each (avg graph: ~50 nodes × ~300 bytes + overhead) = approximately 10-20MB. A 4-hour session at even aggressive snapshot rates (e.g., 1 per minute) produces 240 snapshots, which FIFO prunes to 200.
- `getMetaBySession` excludes `graphJson` (confirmed in snapshots.ts L28-43) — timeline list queries are O(200 rows) without loading large blobs.
- `GET /api/snapshot/:id` is a single-row lookup by primary key (`findById`) — O(1) regardless of session size.

For the journey test, validate the 200ms target by measuring `GET /api/timeline` response time against a session with ~50+ snapshots (achievable by writing many files), not a 4-hour session. Assert response time < 200ms. The 20MB bound can be asserted by checking SQLite file size after loading the DB with snapshots.

---

## Code Examples

### Watch-Root Purge in switchWatchRoot (Key Change)

```typescript
// Source: packages/server/src/index.ts — existing switchWatchRoot() function
// New lines to insert at step 4b, after db.delete(graphNodes).run()

// 4. Purge SQLite graph tables — edges first due to FK constraint
db.delete(graphEdges).run();
db.delete(graphNodes).run();

// 4b. Purge replay/intent SQLite tables for the old watch root (synchronous/blocking)
//     Per CONTEXT.md: delete is synchronous to guarantee clean state before new pipeline starts
//     Note: layoutPositions is NOT deleted — positions persist per watch root (CONTEXT.md)
//     Note: currentWatchRoot still holds the OLD path here (updated at step 7)
snapshotsRepository.deleteByWatchRoot(currentWatchRoot);
intentSessionsRepository.deleteByWatchRoot(currentWatchRoot);
checkpointsRepository.deleteByWatchRoot(currentWatchRoot);
```

### Toast Signal in WsClient watch_root_changed Handler

```typescript
// Source: packages/client/src/ws/wsClient.ts — watch_root_changed case
// WsClient constructor receives optional onReplayExitedForSwitch callback

case 'watch_root_changed': {
  // Per CONTEXT.md: If in replay mode, auto-exit and notify user
  if (replayStore.getState().isReplay) {
    replayStore.getState().exitReplay();
    replayStore.getState().clearBuffer();
    // Signal toast: "Exited replay — switching to [new project]"
    this.onReplayExitedForSwitch?.(msg.directory);
  }
  // ... existing state reset code (lines 248-268) unchanged
```

### Toast Display in App.tsx

```typescript
// New state in App() function
const [rootSwitchToast, setRootSwitchToast] = useState<string | null>(null);

// In WsClient instantiation (main.tsx or App.tsx):
// new WsClient({ onReplayExitedForSwitch: (dir) => {
//   setRootSwitchToast(dir);
//   setTimeout(() => setRootSwitchToast(null), 2000);
// }})

// Toast render (position:absolute, z-index above replay banner)
{rootSwitchToast && (
  <div style={{
    position: 'fixed',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(234, 179, 8, 0.15)',
    border: '1px solid rgba(234, 179, 8, 0.4)',
    borderRadius: 6,
    padding: '8px 16px',
    color: '#eab308',
    fontSize: 12,
    fontFamily: 'monospace',
    zIndex: 400,
    pointerEvents: 'none',
  }}>
    Exited replay — switching to {path.basename(rootSwitchToast)}
  </div>
)}
```

### Journey Test — Watch-Root Switch Clears State (Skeleton)

```typescript
// Source pattern: packages/server/src/plugins/.auto-gsd/journey-tests/journey-phase-18.spec.ts
// Uses SERVER_URL pattern from journey-phase-15.spec.ts
import { test, expect } from '@playwright/test';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test('After switching watch root, timeline shows no prior snapshots and intent panel shows no prior sessions', async ({ page }) => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-a-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-b-'));
  try {
    // 1. Watch dirA and generate activity
    await page.request.post(`${SERVER_URL}/api/watch`, {
      data: { directory: dirA }
    });
    // Write files to dirA to trigger snapshots
    fs.writeFileSync(path.join(dirA, 'a.ts'), 'export const a = 1;');
    // Wait for snapshot
    // 2. Switch to dirB
    await page.request.post(`${SERVER_URL}/api/watch`, {
      data: { directory: dirB }
    });
    // 3. Assert timeline is empty
    const timelineRes = await page.request.get(`${SERVER_URL}/api/timeline`);
    const timeline = await timelineRes.json();
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBe(0); // Old snapshots purged
    // 4. Assert intents are empty
    const intentsRes = await page.request.get(`${SERVER_URL}/api/intents`);
    const intents = await intentsRes.json();
    expect(Array.isArray(intents)).toBe(true);
    expect(intents.length).toBe(0); // Old intent sessions purged
  } finally {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| switchWatchRoot purges graphNodes/graphEdges only | Phase 18 adds purge of graphSnapshots, intentSessions, snapshotCheckpoints | Phase 18 | Completes INFRA-04; prevents old project data from persisting in SQLite across root switches |
| watch_root_changed handler silently exits replay | Phase 18 adds toast notification for user feedback | Phase 18 | Satisfies CONTEXT.md UX requirement; improves user awareness of mode transition |

---

## Open Questions

1. **WsClient instantiation location for callback wiring**
   - What we know: `WsClient` is instantiated in `packages/client/src/main.tsx` as a module-level singleton. App.tsx reads stores but doesn't create WsClient.
   - What's unclear: How to pass the toast callback from App.tsx (React state) to WsClient (module-level singleton). Options: (a) WsClient constructor accepts an optional callback object, (b) WsClient exposes a `setCallbacks()` method, (c) use a dedicated Zustand atom for `replayExitedOnSwitch` flag.
   - Recommendation: Add an optional `callbacks` parameter to the WsClient constructor. `main.tsx` can pass it after creating the App state, or App.tsx can use a Zustand atom approach. The Zustand atom approach (Option B from Pattern 2) avoids any coupling between main.tsx and App state. Planner should decide based on the existing main.tsx wiring pattern.

2. **Performance test implementation for 200ms / 20MB targets**
   - What we know: Direct `findById` is O(1); `getMetaBySession` excludes graphJson; MAX_SNAPSHOTS=200.
   - What's unclear: What snapshot count is achievable in a practical journey test (without a 4-hour session)?
   - Recommendation: Write ~20 files to generate ~5-10 snapshots, then assert `GET /api/timeline` responds in under 200ms. Document that the 4-hour / 20MB bound is architecturally guaranteed by MAX_SNAPSHOTS=200. Add a comment in the test explaining why a full 4-hour simulation is unnecessary.

3. **changeEvents table — currently never queried**
   - What we know: `changeEvents` table exists in the schema but no repository or delete call references it in the current codebase. It appears to be an unused schema remnant.
   - What's unclear: Should `changeEvents` be purged on root switch? CONTEXT.md mentions "delete change events" in the data lifecycle section.
   - Recommendation: Add a `db.delete(changeEvents).run()` call to `switchWatchRoot()` alongside the other table purges, for completeness and to match the CONTEXT.md specification. Verify the table exists at runtime (it is in the schema) but confirm no production code reads from it before adding the delete.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis — `packages/server/src/index.ts` `switchWatchRoot()` function (confirmed gap at step 4)
- Direct codebase analysis — `packages/server/src/db/repository/*.ts` (confirmed `deleteByWatchRoot()` methods exist in all three repositories)
- Direct codebase analysis — `packages/client/src/ws/wsClient.ts` `watch_root_changed` handler (confirmed existing replay exit, missing toast)
- Direct codebase analysis — `packages/server/src/snapshot/SnapshotManager.ts` (confirmed MAX_SNAPSHOTS=200, CHECKPOINT_INTERVAL=50 constants)
- Direct codebase analysis — `.auto-gsd/journey-tests/journey-phase-15.spec.ts` (confirmed SERVER_URL pattern, temp dir isolation, finally cleanup)
- Direct codebase analysis — `.planning/phases/18-watch-root-integration-and-end-to-end-validation/18-CONTEXT.md` (confirmed locked decisions)

### Secondary (MEDIUM confidence)

- `packages/server/src/db/connection.ts` — `foreign_keys = OFF` confirmed; delete order is unconstrained
- `.planning/phases/15.3-fix-journey-phase-15-server-replay-layer-completes-successfully-major/15.3-VERIFICATION.md` — confirmed `deleteByWatchRoot` exists in all three repositories and the SERVER_URL pattern is the correct journey test approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing code; no new libraries
- Architecture: HIGH — gap identified precisely from code; fix location is unambiguous
- Pitfalls: HIGH — derived from actual code analysis; ordering constraints verified against switchWatchRoot() function

**Research date:** 2026-03-17
**Valid until:** Stable (no fast-moving dependencies; all findings from local codebase analysis)
