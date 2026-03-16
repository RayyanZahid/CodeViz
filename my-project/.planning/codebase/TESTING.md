# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

**Status:** No testing framework configured

- No test runner installed (jest, vitest, mocha not found in dependencies)
- No test files in source tree (`packages/server/src`, `packages/client/src`)
- Single test file exists only in GSD hooks: `.claude/get-shit-done/bin/gsd-tools.test.cjs`
- TypeScript strict mode provides compile-time safety; runtime testing deferred

**Configuration:**
- No config file present (no jest.config.js, vitest.config.ts, mocha.opts)
- Build system: TypeScript compiler + Vite for client
- Type checking: `pnpm typecheck` runs `tsc -b packages/server packages/client`

**When to Add Testing:**
- If runtime behavior needs validation (network, state mutations, complex logic)
- Before major refactors to prevent regressions
- For critical paths: graph mutations, cycle detection, inference pipeline

## Test Framework Recommendation

**Vitest** for monorepo:
- Native ESM support (matches `"type": "module"` in package.json)
- TypeScript support without extra config
- Fast parallel execution
- Can be added to `packages/server` and `packages/client` independently

**Mock strategy:** Use Vitest's `vi.mock()` for external dependencies (WebSocket, file I/O, database)

## Test File Organization

**Expected Location (when tests are added):**
- Option 1: Co-located with source
  ```
  packages/server/src/graph/DependencyGraph.ts
  packages/server/src/graph/DependencyGraph.test.ts
  ```
- Option 2: Separate tests directory
  ```
  packages/server/src/graph/DependencyGraph.ts
  packages/server/tests/graph/DependencyGraph.test.ts
  ```

**Naming Convention:**
- `.test.ts` for implementation tests
- `.spec.ts` for behavior/integration tests (not currently used)

## Test Structure (Pattern to Follow)

If tests are added, follow this structure pattern based on existing code organization:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DependencyGraph } from './DependencyGraph.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('onParseResult', () => {
    it('should add nodes from parse result', () => {
      // Given
      const batch = {
        results: [
          {
            filePath: 'src/app.ts',
            dependencies: ['src/utils.ts'],
          },
        ],
      };

      // When
      graph.onParseResult(batch);

      // Then
      const delta = graph.getCurrentDelta();
      expect(delta.addedNodes).toContain('src/app.ts');
    });

    it('should emit delta event on flush', () => {
      // Arrange
      const deltaHandler = vi.fn();
      graph.on('delta', deltaHandler);

      // Act
      graph.onParseResult(testBatch);

      // Assert
      expect(deltaHandler).toHaveBeenCalled();
    });
  });
});
```

## Mocking Strategy

**Candidates to mock:**
- File system operations: `chokidar` watch events, `fs` methods
- Database: `drizzle-orm` queries, SQLite operations
- Network: WebSocket, HTTP requests, REST snapshots
- Tree-sitter parsing: Parser worker pool
- External modules: `@dagrejs/graphlib`, `d3-force`

**Pattern for database mocks:**
```typescript
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
```

**Pattern for event/callback mocks:**
```typescript
const mockHandler = vi.fn();
graph.on('delta', mockHandler);
// Trigger delta...
expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
  version: 1,
  addedNodes: expect.any(Array),
}));
```

**What NOT to mock:**
- Pure utility functions (testable as-is): `toSentence()`, `relativeTime()`, `clamp()`
- TypeScript/Zod type validation (compile-time safe)
- Zustand store operations (test via `getState()` calls)
- Core algorithm logic (test with minimal fixtures)

## Fixtures and Test Data

**Test data location (when created):**
- `packages/server/tests/fixtures/` for server test data
- `packages/client/tests/fixtures/` for client test data
- Within test files as inline objects for simple cases

**Pattern for graph fixtures:**
```typescript
const mockGraphNode = {
  id: 'src/app.ts',
  type: 'file' as const,
  zone: 'api' as const,
  riskLevel: 'none' as const,
  label: 'app.ts',
};

const mockEdge = {
  id: 'src/app.ts->src/utils.ts',
  sourceId: 'src/app.ts',
  targetId: 'src/utils.ts',
  type: 'dependency' as const,
};
```

**Pattern for parse result fixtures:**
```typescript
const createMockParseResult = (filePath: string, deps: string[]) => ({
  filePath,
  dependencies: deps,
  errors: [],
  exports: [],
});
```

## Coverage

**Requirements:** Not enforced

- No coverage thresholds set
- Coverage reporting not configured
- If added: Use `vitest --coverage` with c8 or v8

**Critical paths to test (if coverage goals added):**
- Graph delta computation: `onParseResult()`, `flushPendingBatches()`
- Cycle detection and severity calculation
- Zone classification logic
- Risk detection (boundary violations, fan-out)
- WebSocket message validation and state application
- Error recovery (reconnect logic, snapshot recovery)

## Test Types

**Unit Tests (candidates):**
- Pure functions: `toSentence()`, `relativeTime()`, `clamp()`
- Type validation with Zod schemas: `ServerMessageSchema.safeParse()`
- Utility classes: `ParserPool` initialization, `ViewportController` zoom math
- State mutations: `graphStore.applyDelta()`, `inferenceStore.applyInference()`

**Integration Tests (candidates):**
- Graph delta + inference pipeline end-to-end
- WebSocket client message handling + store updates
- File watcher + parser + graph + inference flow
- REST snapshot recovery after disconnection

**E2E Tests:**
- Not currently used
- Candidate: Playwright or Cypress for UI interactions (canvas clicks, panel interactions)
- Server startup, WebSocket connection, data synchronization

## Common Testing Patterns (When Tests Are Written)

**Async Testing:**
```typescript
it('should reconnect after timeout', async () => {
  // Arrange
  const client = new WsClient();
  vi.useFakeTimers();

  // Act
  client.scheduleReconnect();
  await vi.runAllTimersAsync();

  // Assert
  expect(client['ws']).toBeDefined();

  vi.useRealTimers();
});
```

**Error Testing:**
```typescript
it('should handle malformed JSON gracefully', () => {
  // Arrange
  const client = new WsClient();
  const errorSpy = vi.spyOn(console, 'error');

  // Act
  client['handleMessage']({
    data: 'not valid json',
  } as MessageEvent);

  // Assert
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('[WS] Failed to parse JSON'),
  );
});
```

**State Mutation Testing:**
```typescript
it('should apply delta to graph store immutably', () => {
  // Arrange
  const initialNodes = graphStore.getState().nodes;

  // Act
  graphStore.getState().applyDelta({
    version: 1,
    addedNodes: [mockGraphNode],
    removedNodeIds: [],
    // ... other fields
  });

  // Assert
  const newNodes = graphStore.getState().nodes;
  expect(newNodes).not.toBe(initialNodes); // New reference
  expect(newNodes.get('src/app.ts')).toEqual(mockGraphNode);
});
```

**Event Listener Testing:**
```typescript
it('should emit delta event with correct payload', () => {
  // Arrange
  const graph = new DependencyGraph();
  const listener = vi.fn();
  graph.on('delta', listener);

  // Act
  graph.onParseResult({
    results: [
      { filePath: 'src/app.ts', dependencies: ['src/utils.ts'] },
    ],
  });

  // Assert
  expect(listener).toHaveBeenCalled();
  const delta = listener.mock.calls[0][0];
  expect(delta).toHaveProperty('version');
  expect(delta.addedNodes).toContain('src/app.ts');
});
```

## Running Tests (Future)

```bash
# When test framework is added:
pnpm test                 # Run all tests
pnpm test --watch        # Watch mode
pnpm test --coverage     # With coverage report
pnpm test packages/server  # Test single package
pnpm test graph          # Run tests matching pattern
```

## Test Maintenance

**Practices to follow:**
- Keep tests close to code (co-locate or organized by domain)
- Update tests with production code changes
- Use descriptive test names: `should compute correct zone for file path` not `test zone`
- Group related tests with `describe()` blocks
- Use `beforeEach()` for common setup, `afterEach()` for cleanup

---

*Testing analysis: 2026-03-16*
