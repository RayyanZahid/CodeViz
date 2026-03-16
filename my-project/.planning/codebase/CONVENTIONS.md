# Coding Conventions

**Analysis Date:** 2026-03-16

## Naming Patterns

**Files:**
- PascalCase for class/component files: `DependencyGraph.ts`, `ArchCanvas.tsx`, `ViewportController.ts`
- camelCase for utility/helper files: `eventSentence.ts`, `viewport.ts`, `wsClient.ts`
- lowercase with hyphens for schema/config files: `serverMessages.ts`

**Functions:**
- camelCase for all functions: `handleZoomIn()`, `relativeTime()`, `toSentence()`, `clamp()`
- Handler functions prefixed with `handle`: `handleSelectNode()`, `handleViewportChange()`, `handleZoomIn()`
- Callback helpers prefixed with `on`: `onViewportChange`, `onSelectNode`, `onClose`
- Pure utility functions with descriptive names: `toSentence()`, `relativeTime()`, `clearSelection()`, `highlightNode()`

**Variables:**
- camelCase for all variable names: `selectedNodeId`, `containerRef`, `nodePositionsRef`, `dimensions`
- Numeric constants in UPPER_SNAKE_CASE: `HIGH_SEVERITY_THRESHOLD = 10`, `CONSOLIDATE_MS = 50`, `ZOOM_FACTOR = 1.1`
- Map/Set variable names clearly indicate collection type: `pendingBatches: ParseBatchResult[]`, `activeCycles: Set<string>`, `shapes: Map<string, Konva.Group>`
- Ref variable names suffix with `Ref`: `containerRef`, `stageRef`, `graphLayerRef`, `viewportControllerRef`, `canvasRef`, `handleSelectNodeRef`
- Boolean flags use `is*` or verb prefixes: `isComponentNode()`, `minimapVisible`, `listening={false}`

**Types & Interfaces:**
- PascalCase for all type names: `GraphNode`, `GraphDelta`, `ArchCanvasProps`, `NavButtonProps`, `ChangeSummary`
- Event interfaces suffix with `Events`: `DependencyGraphEvents`, `InferenceEngineEvents`
- Mutable internal types prefix with `Mutable`: `MutableDelta`
- Simulation types prefix with `Sim`: `SimNode`, `SimLink`
- Props interfaces suffix with `Props`: `ArchCanvasProps`, `NavButtonProps`

## Code Style

**Formatting:**
- No external formatter configured (no .prettierrc, .eslintrc, or biome.json)
- File: 2-space indentation (observed in all TypeScript files)
- Line length: No strict limit observed; pragmatic wrapping at 80 chars for comments and readability
- Trailing commas in objects/arrays for cleaner diffs

**Linting:**
- TypeScript strict mode enabled (`"strict": true` in tsconfig.base.json)
- No eslint/prettier/biome config — rely on TypeScript compiler for type safety
- ESM module system enforced (`"type": "module"` in package.json)

## Import Organization

**Order:**
1. Node.js built-ins: `import path from 'node:path'`, `import os from 'node:os'`
2. Third-party packages: `import Fastify from 'fastify'`, `import { create } from 'zustand'`, `import Konva from 'konva'`
3. Type imports from third-party: `import type { SimulationLinkDatum } from 'd3-force'`
4. Project imports (absolute with `@archlens/` workspace paths): `import { DependencyGraph } from './graph/DependencyGraph.js'`
5. Relative imports: `import { graphStore } from '../store/graphStore.js'`
6. Type imports from project: `import type { GraphNode, GraphEdge } from '@archlens/shared/types'`

**Path Aliases:**
- Workspace imports: `@archlens/server`, `@archlens/client`, `@archlens/shared`
- No path aliases configured; use explicit relative paths for same-package imports
- All imports include `.js` extension (ESM convention for Node.js)

## Error Handling

**Patterns:**
- Try-catch blocks for I/O and network operations: `try { new WebSocket(...) } catch (err) { ... }`
- Error validation with Zod schemas: `ServerMessageSchema.safeParse(raw)` — check `!parsed.success` before using
- Graceful degradation on recoverable errors: Log warning, continue execution or trigger fallback (e.g., WsClient snapshot recovery)
- Process exit on fatal errors: `process.exit(1)` in server startup failures
- Error recovery with timeouts: `triggerGapRecovery()`, `scheduleReconnect()`
- No custom error classes — use standard Error with descriptive messages

**Error messages:**
- Prefix with context tag in brackets: `[WS] Failed to parse JSON message`, `[Graph] Delta v${version}`, `[Inference] v${version}`
- Include relevant values for debugging: version numbers, counts, error details

## Logging

**Framework:** Native console methods + Pino for server

**Patterns:**
- Client: `console.log()`, `console.error()`, `console.warn()` with context tags: `console.log('[WS] Connected')`
- Server: `fastify.log.error(err)` for errors, `console.log()` for info
- Structured format: `[Component] Message: details`
- Log on significant state changes: connection state, reconnects, data sync events
- Log on errors and recovery attempts
- No debug logging for every operation — only milestone events

**Example patterns:**
```typescript
console.log('[WS] Connected');
console.error('[WS] Failed to parse JSON message:', event.data);
console.warn(`[WS] Version gap detected: expected ${expected}, got ${actual}`);
console.log(`[Graph] Delta v${delta.version}: +${delta.addedNodes.length} nodes`);
```

## Comments

**When to Comment:**
- Complex algorithms: zoom-to-pointer implementation, cycle detection, force simulation
- Non-obvious design decisions: Why nodes are copied before d3-force mutation, why batch consolidation window exists
- Public API contracts: JSDoc on exported functions and classes
- Markup sections with dashes: `// ---------------------------------------------------------------------------`

**JSDoc/TSDoc:**
- Used on exported functions and class methods
- Format: Multi-line with description + @param + @return
- Focus on "what" and "why", not "how"
- Example from `toSentence()`:
```typescript
/**
 * Converts an ArchitecturalEvent into a terse technical natural-language sentence.
 *
 * @param event      The architectural event to describe
 * @param nodeNameFn Resolves a node ID to its display name (e.g. from graphStore)
 */
```

**Block comments:**
- Use ASCII dashes to demarcate sections: `// ---------------------------------------------------------------------------`
- Section comments appear above code sections for visual organization
- Example: `// -------------------------------------------------------------------------\n// ResizeObserver — track canvas container dimensions (excludes sidebar)\n// -------------------------------------------------------------------------`

## Function Design

**Size:**
- Keep functions under 100 lines where practical
- Larger functions (100-300 lines) are orchestrators managing multiple subsystems (e.g., `ArchCanvas` effect hook)
- Decompose via helper functions: `clearSelection()`, `highlightNode()`, `highlightDependency()` extracted from event handler

**Parameters:**
- Use destructured parameters for objects: `function NavButton({ onClick, title, active, children }: NavButtonProps)`
- Prefer named parameters (via interfaces) over positional for 3+ parameters
- React components always use interface props

**Return Values:**
- Explicit return types on exported functions and methods
- Implicit types on internal helpers when obvious
- Void for side-effect functions: `destroy()`, `pruneExpiredActive()`, `start()`
- Nullable returns use `| null`: `getState()` returns state, null checks happen at callsite

## Module Design

**Exports:**
- Named exports for classes and functions: `export class DependencyGraph`, `export function toSentence()`
- Default exports for React components: `export function App()` (used as default in practice)
- Barrel exports in `index.ts` files for organizing public APIs: `packages/shared/src/types/index.ts` exports types

**Barrel Files:**
- Used in shared package for centralized type exports: `packages/shared/src/types/index.ts`
- Not used extensively in server/client packages — direct imports preferred

**Class Design:**
- Private fields: `private readonly pool: Piscina`, `private version: number`
- Public methods for APIs: `parseFile()`, `parseBatch()`, `destroy()`
- Constructor for initialization with dependency injection
- EventEmitter inheritance for async notification: `extends EventEmitter<DependencyGraphEvents>`

## Special Patterns

**React Hooks:**
- `useCallback()` for stable callback references passed to child components
- `useRef()` for imperative handles, DOM refs, and mutable values that don't trigger re-renders
- `useState()` for local component state
- Zustand stores accessed via `store.getState()` in non-React code (vanilla access)
- Hook dependencies carefully managed — ESLint disable comments only when intentional

**Zustand Stores:**
- Double-paren middleware pattern: `create<GraphStore>()((set, get) => ({...}))`
- Immutable updates using Map copies: `new Map<string, GraphNode>(current.nodes)`
- Actions in store for state mutations: `applyDelta()`, `setConnectionStatus()`
- Vanilla access: `graphStore.getState()` for non-React code

**Type Safety:**
- All functions have explicit parameter types (enforced by strict mode)
- Return types on public functions and exports
- `as` casts only when necessary: `shape.findOne<Konva.Rect>('Rect')`, `msg as unknown as InitialStateMessage`
- Nullable checks before dereferencing: `if (!pointer) return`, `if (shape) { ... }`

## Repository Structure Conventions

**Package structure:**
- `packages/server/src/` - Backend, no testing framework
- `packages/client/src/` - Frontend React/Konva
- `packages/shared/src/types/` - Shared type definitions
- Config files at package root: `tsconfig.json`, `package.json`, `vite.config.ts`

**Directory organization patterns:**
- By domain: `db/`, `graph/`, `inference/`, `parser/`, `pipeline/`, `watcher/`, `plugins/`
- By feature: `canvas/`, `layout/`, `minimap/`, `panels/`, `store/`, `utils/`, `ws/`
- Type files: `types/`, `schemas/`
- Tests: Co-located with source (when tests exist) or separate `tests/` folder

---

*Convention analysis: 2026-03-16*
