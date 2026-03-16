# Codebase Concerns

**Analysis Date:** 2026-03-16

## Tech Debt

**Large Monolithic Files:**
- Issue: Multiple components exceed 300+ lines, making them difficult to test and maintain. `DependencyGraph.ts` (671 lines) contains graph manipulation, delta batching, cycle detection, and persistence logic all in one class.
- Files: `packages/server/src/graph/DependencyGraph.ts` (671 lines), `packages/client/src/panels/NodeInspector.tsx` (456 lines), `packages/client/src/canvas/ArchCanvas.tsx` (385 lines), `packages/client/src/canvas/NodeRenderer.ts` (363 lines), `packages/client/src/panels/RiskPanel.tsx` (340 lines)
- Impact: Increased bug surface area, harder to isolate and test individual responsibilities, harder to onboard new developers
- Fix approach: Extract concerns into separate classes. For `DependencyGraph`, split into: `GraphMutator` (batch processing), `CycleDetector` (cycle analysis), `DeltaBuilder` (delta construction). For React components, extract pure display logic into smaller sub-components and pull inference/store logic into custom hooks.

**Unsafe Type Assertions:**
- Issue: Multiple uses of `as unknown as` type assertions bypass TypeScript type checking, particularly in WebSocket message handling and viewport state restoration.
- Files: `packages/client/src/ws/wsClient.ts` (lines with `as unknown as InitialStateMessage/GraphDeltaMessage/InferenceMessage`), `packages/client/src/utils/viewport.ts` (localStorage JSON parsing), `packages/client/src/layout/IncrementalPlacer.ts` (d3-force type parameter)
- Impact: Silent runtime errors possible if message schema changes or localStorage is corrupted; no compile-time safety
- Fix approach: Create dedicated message validators using Zod (already a dependency). Add runtime schema validation before casting. For d3-force, use proper type generics instead of `any`.

**Unvalidated External Grammar Loading:**
- Issue: `packages/server/src/parser/worker.ts` loads tree-sitter grammars via `require()` with `as unknown` assertions for JavaScript, Python, and TypeScript grammars. No fallback if a grammar fails to load.
- Files: `packages/server/src/parser/worker.ts` (lines 27-34)
- Impact: Silent parser initialization failure could result in entire language support being unavailable without error visibility. Workers would fail cryptically.
- Fix approach: Add explicit error handling and type guards around grammar loading. Throw with descriptive error messages if grammars cannot be loaded or are incorrect version.

**Fire-and-Forget Database Updates:**
- Issue: Zone updates to SQLite are not transactional and don't await completion. If an update fails, the in-memory inference state and database become out of sync silently.
- Files: `packages/server/src/inference/InferenceEngine.ts` (lines 136-151)
- Impact: Long-running server could have corrupted zone state in database that doesn't match in-memory graph. Restart would lose all zone learning.
- Fix approach: Wrap zone updates in explicit transaction with error handling. Log/emit errors rather than silently failing. Consider making async/awaited.

## Known Bugs

**Graph Extension Node Leakage:**
- Symptoms: External stub nodes (prefixed with `__ext__/`) accumulate in the graph indefinitely. If a large file transitions from importing a package to not importing it, the stub node persists forever, consuming memory.
- Files: `packages/server/src/graph/DependencyGraph.ts` (lines 381-386), `packages/server/src/db/schema.ts`
- Trigger: Edit a file to remove all imports of a package; the `__ext__/package-name` node remains in the graph
- Workaround: Server restart clears in-memory graph, but SQLite may still have stale stubs if they were persisted

**Missing Cascade Delete in SQLite:**
- Symptoms: When a node is deleted, if any zone-related state or layout positions referencing it exist, database consistency is not guaranteed.
- Files: `packages/server/src/db/schema.ts` (foreign keys set with `references()` but no cascade)
- Trigger: Delete a file, then query old layout positions or zone history
- Workaround: Manual cleanup in repository functions (e.g., `nodes.ts`), but not enforced at DB level

**Canvas Minimap Positioning on Sidebar Toggle:**
- Symptoms: When sidebar is toggled, minimap position jumps because it's absolutely positioned within canvas container, but canvas width changes.
- Files: `packages/client/src/App.tsx` (line 193 - minimap bottom position depends on `minimapVisible` state), `packages/client/src/minimap/MinimapStage.tsx`
- Trigger: Click minimap toggle button while hovering near bottom-left
- Workaround: None; purely visual glitch

## Security Considerations

**SQLite WAL Mode with `synchronous = NORMAL`:**
- Risk: Potential data loss if server crashes mid-transaction. `NORMAL` mode prioritizes speed over durability.
- Files: `packages/server/src/db/connection.ts` (lines 7-8)
- Current mitigation: Deltas are persisted before emission, so in-memory graph can recover on restart. Database state is non-critical (can be recomputed from files).
- Recommendations: Document this tradeoff clearly. Consider `FULL` mode in production if data preservation is critical. Add explicit transaction wrapping for critical updates.

**Hardcoded Database Path:**
- Risk: Database path is hardcoded to `./archlens.db` relative to current working directory, creating potential for data loss or misplacement if server is run from different directories.
- Files: `packages/server/src/db/connection.ts` (line 5)
- Current mitigation: Documentation should specify required working directory or use `ARCHLENS_WATCH_ROOT` environment variable pattern consistently
- Recommendations: Use `ARCHLENS_DB_PATH` environment variable with fallback to project root or `.config/archlens/archlens.db` XDG standard path.

**WebSocket Broadcast Without Origin Check:**
- Risk: Any WebSocket client connecting to `/ws` receives all graph deltas, inference results, and architectural risks without authentication or authorization.
- Files: `packages/server/src/plugins/websocket.ts` (lines 28-35)
- Current mitigation: Assumes trusted network (localhost or internal deployment)
- Recommendations: Add simple token-based auth or origin checks. Document this is development-only. Consider rate-limiting per connection.

## Performance Bottlenecks

**Incremental Placer Simulation Every Delta:**
- Problem: `IncrementalPlacer.update()` runs a d3-force simulation with `tick()` on every graph delta, even for small changes (1-2 nodes). Simulation cost is O(nodes * iterations) regardless of delta size.
- Files: `packages/client/src/layout/IncrementalPlacer.ts` (lines 100-130)
- Cause: Batching at graph layer but not at layout layer. Each delta triggers a full simulation pass.
- Improvement path: Only run simulation if new nodes > 0. Skip for edge-only or zone-only deltas. Implement early-exit if nodes stabilize before full iteration count.

**Zustand Map Store No Memoization:**
- Problem: Every delta application creates new Map objects for nodes and edges, triggering re-renders of all downstream consumers even if their node/edge subset didn't change.
- Files: `packages/client/src/store/graphStore.ts` (lines 44-79), `packages/client/src/store/inferenceStore.ts`
- Cause: Immutable Map copies for Zustand batching, but Zustand doesn't provide granular selectors for Map entries
- Improvement path: Split store into indexed objects keyed by ID instead of Maps. Add per-component selectors. Or use a different state library with better Map support (e.g., Recoil, Jotai).

**Canvas Culling Index Quadtree Never Rebuilt:**
- Problem: `CullingIndex.update()` is called after every layout, but the quadtree itself is not dynamically rebalanced. As nodes move, the quadtree becomes unbalanced and culling queries degrade.
- Files: `packages/client/src/canvas/CullingIndex.ts`
- Cause: QuadTree-JS library doesn't support deletion and reinsertion; tree degrades with position updates
- Improvement path: Rebuild quadtree every N frames or when node count changes significantly. Track node movement delta and rebuild if > 20% move > 10px.

**Parser Worker Pool Idle Timeout Creates Startup Jitter:**
- Problem: Workers are created with `idleTimeout: 30_000`, so on a slow initial scan, the pool might spin up/down multiple times as batches arrive unevenly.
- Files: `packages/server/src/parser/ParserPool.ts` (line 44)
- Cause: Idle timeout is too aggressive for variable workload
- Improvement path: Increase idle timeout to 2-3 minutes for interactive use. Add telemetry to measure actual utilization. Consider always keeping N workers warm.

**SQLite Full Scan on Zone Snapshot:**
- Problem: `DependencyGraph.getSnapshot()` queries all nodes from SQLite on every WebSocket snapshot request, even though zones rarely change.
- Files: `packages/server/src/graph/DependencyGraph.ts` (lines 214-221)
- Cause: No zone change tracking; assumed zones are queried frequently
- Improvement path: Cache zone map in memory, invalidate only on zone_changed events. Fall back to DB only on startup.

## Fragile Areas

**Cycle Detection Canonicalization:**
- Files: `packages/server/src/graph/DependencyGraph.ts` (lines 639-645)
- Why fragile: The `canonicalizeCycle()` function assumes nodes are comparable strings and performs a lexicographic rotation. If node IDs ever contain spaces or special characters, the ' -> ' delimiter will break the parse on eviction.
- Safe modification: Add unit tests for edge cases (node IDs with delimiters, single-node "cycles", empty cycles). Consider using a more robust serialization (JSON array instead of string).
- Test coverage: Untested; no unit tests for cycle canonicalization

**InferenceEngine Pipeline Chaining:**
- Files: `packages/server/src/inference/InferenceEngine.ts` (lines 118-174)
- Why fragile: The inference pipeline has five sequential steps (classify, persist, corroborate, risk detect, emit). If any step fails silently or throws, downstream steps may not run. Example: if zone persistence fails, risk detection still runs with stale zones.
- Safe modification: Add explicit error handling and logging between each step. Consider making persistence blocking/awaited. Add integration tests for the full pipeline.
- Test coverage: No test coverage for error paths or cross-step consistency

**EventCorroborator Counter Eviction Logic:**
- Files: `packages/server/src/inference/EventCorroborator.ts` (lines 68-82)
- Why fragile: The eviction logic parses counter keys by looking for ':' delimiter, then assumes the part after ':' is a nodeId. For dependency events, the format is "dependency_added:src/a.ts:src/b.ts" — the second ':' is part of the node ID, so `key.indexOf(':')` finds the wrong boundary.
- Safe modification: Define a strict counter key format (e.g., JSON-encoded tuple) and parse with a dedicated function. Add tests for all event types.
- Test coverage: No tests for eviction logic; corner cases with multi-colon keys untested

**ViewportController LocalStorage Parsing:**
- Files: `packages/client/src/utils/viewport.ts`
- Why fragile: Viewport state is persisted to localStorage as JSON and restored on page load. If the schema changes (e.g., new field added), old stored values silently fail to parse or parse with wrong types.
- Safe modification: Version the stored schema and add migration logic. Use Zod schema validation with coercion for missing fields.
- Test coverage: No tests for localStorage corruption or schema mismatch scenarios

## Scaling Limits

**Single SQLite Database Connection:**
- Current capacity: Single better-sqlite3 connection, single-threaded writes from the inference engine
- Limit: If zone classification or risk detection becomes more computationally expensive, the single write thread becomes a bottleneck. Graph can grow to thousands of nodes before SQLite write latency becomes noticeable.
- Scaling path: Migrate to PostgreSQL with connection pooling if multi-process deployment is needed. Or use a message queue (Redis, Kafka) to decouple inference writes from the main thread.

**Canvas Rendering at 300+ Nodes:**
- Current capacity: Culling index and imperative Konva rendering support ~300-500 nodes at 60fps on modern hardware
- Limit: At 1000+ nodes, culling becomes less effective and Konva layer blitting becomes the bottleneck. No virtual windowing for edges (all edges rendered).
- Scaling path: Implement edge clustering/bundling for dense graphs. Use canvas/WebGL instead of Konva for very large graphs. Implement progressive rendering where edges load asynchronously.

**In-Memory Graph Accumulation:**
- Current capacity: Graphlib stores entire graph in memory. ~1000 nodes = ~1MB. ~10,000 nodes = ~20-30MB depending on edge density
- Limit: Very large monorepos (50,000+ files) could consume >100MB. More importantly, cycle detection is O(V+E) using Tarjan's algorithm, which becomes slow above 10,000 nodes.
- Scaling path: Implement lazy loading of graph sections. Cache cycle detection results and only recompute deltas. Consider distributed graph partitioning for monorepos.

**WebSocket Broadcast Latency:**
- Current capacity: ~100 concurrent clients can receive deltas within 100ms for typical graphs
- Limit: Broadcast calls `JSON.stringify()` on every delta for every client. At 1000+ deltas/minute and 100 clients, stringification alone could add 1-2 seconds latency.
- Scaling path: Use incremental JSON encoding or binary protocols (protobuf, msgpack). Implement client subscriptions (only send relevant deltas). Add server-side caching of serialized deltas.

## Dependencies at Risk

**tree-sitter Native Grammar Versions:**
- Risk: Grammar packages (tree-sitter-typescript, tree-sitter-javascript, tree-sitter-python) are pinned to specific versions. If major grammar updates occur, parser behavior may change silently or grammars may become incompatible with tree-sitter core version.
- Impact: Import extraction could fail silently for new syntax (e.g., optional chaining in Python, new TS 5.x syntax). Tests won't catch this because they use fixed test files.
- Migration plan: Add integration tests that parse real-world files from major projects. Monitor tree-sitter releases and test major version upgrades in a branch before pinning.

**better-sqlite3 Native Binding:**
- Risk: better-sqlite3 requires native compilation. Platform-specific binaries (Windows x64, macOS ARM64) could fail to build in CI or on different architectures.
- Impact: Development might work locally but deployment to CI or different machines fails with cryptic "binding not found" error.
- Migration plan: Document build requirements (node-gyp, Python, compiler). Use prebuilt binaries from `onlyBuiltDependencies` pnpm config. Test in CI with multiple architectures. Consider fallback to sql.js (pure JS SQLite) for environments where native doesn't work.

**piscina Worker Pool Stability:**
- Risk: Piscina is less mature than Node.js built-in worker_threads API. Version jumps or API changes could break worker lifecycle.
- Impact: Workers could leak memory, deadlock, or fail to respawn gracefully under load.
- Migration plan: Add memory profiling in dev environment. Implement circuit breaker for parser pool errors. Consider migrating to native `worker_threads` if piscina proves unstable.

**React 19 + Konva + Zustand Interaction:**
- Risk: The combination of React 19, Konva Stage imperative refs, and Zustand store updates is cutting-edge. React 19 introduced new rendering behavior that may conflict with Konva's immediate-mode rendering.
- Impact: Potential for double-renders, state sync issues, or performance regressions with future React updates.
- Migration plan: Add explicit React Profiler instrumentation in dev. Monitor for re-render spikes during deltas. If issues arise, consider extracting Konva rendering into a completely separate context (custom hook + RAF loop detached from React).

## Test Coverage Gaps

**GraphDelta Cycle Detection:**
- What's not tested: Cycle detection logic, canonicalization, severity computation, cycle removal/addition detection across deltas
- Files: `packages/server/src/graph/DependencyGraph.ts` (lines 451-506), helper functions `canonicalizeCycle()`, `resolveImportTarget()`
- Risk: Cycles may be double-counted, incorrectly classified, or missed entirely. Clients may receive stale cycle information.
- Priority: High — cycles are a key deliverable

**EventCorroborator Counter Logic:**
- What's not tested: Counter increment/eviction, threshold crossing, key parsing for different event types (component_created, dependency_added, etc.)
- Files: `packages/server/src/inference/EventCorroborator.ts`
- Risk: Events may fire spuriously or not at all. Counter keys with special characters could break eviction.
- Priority: High — event corroboration is a core feature

**WebSocket Message Routing and Schema Validation:**
- What's not tested: Message type discrimination, server-to-client schema compliance, client reconnect state recovery
- Files: `packages/server/src/plugins/websocket.ts`, `packages/client/src/ws/wsClient.ts`, `packages/client/src/schemas/serverMessages.ts`
- Risk: Client applies invalid deltas, state divergence during reconnect, type mismatches
- Priority: High — protocol is critical for correctness

**Zone Classification Override Loading:**
- What's not tested: .archlens.json file parsing, override application, watcher-triggered reload
- Files: `packages/server/src/inference/ConfigLoader.ts`
- Risk: Overrides silently fail to load or apply, leaving zones unclassified. Config changes on disk not reflected in running server.
- Priority: Medium — feature may not work as intended

**Canvas Node Positioning Stability:**
- What's not tested: d3-force simulation convergence, node pinning with fx/fy, zone boundary constraints, layout during rapid deltas
- Files: `packages/client/src/layout/IncrementalPlacer.ts`, `packages/client/src/canvas/ArchCanvas.tsx`
- Risk: Nodes jump erratically, zones overlap, layout thrashes during fast edits
- Priority: Medium — affects user experience

**Error Recovery Paths:**
- What's not tested: Parser worker crashes, database corruption, network interruptions, malformed file contents
- Files: All server and client pipeline files
- Risk: Silent failures, inconsistent state, hung connections
- Priority: Medium-Low — systems are defensive but no explicit test

---

*Concerns audit: 2026-03-16*
