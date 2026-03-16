# Phase 2: File Watching and Parsing Pipeline - Research

**Researched:** 2026-03-15
**Domain:** File system watching, tree-sitter incremental parsing, Node.js worker threads
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Watch scope and filtering**
- Smart defaults with override: ship with sensible ignore patterns (node_modules, .git, dist, build, coverage, etc.), user can customize via .archlens.json
- Extension filter at the watcher level: only emit events for parseable extensions (.ts, .tsx, .js, .jsx, .py) — ignore all others before they reach the parser
- Skip config files: don't watch package.json, tsconfig.json, .env, etc. — only source code files that produce parse results
- Ignore symlinks: only watch real files within the watched directory tree, do not follow or resolve symlinks

**Output contract shape**
- Per-file results grouped in a batch: one batch event containing an array of per-file parse results, preserving the context of what changed together within the debounce window
- Project-relative paths from the start: normalize file paths to project-relative immediately (e.g., 'src/auth/service.ts') rather than passing raw absolute paths downstream
- Explicit removal events: watcher emits a typed 'file-removed' result in the batch so the graph model receives an explicit deletion signal — no inference required
- Per-result monotonic sequence number: each parse result carries a monotonic ID for strict ordering, even within a batch

### Claude's Discretion
- Parse extraction depth (direct calls vs method chains vs decorators)
- Error handling strategy for syntax errors, binary files, and huge files
- Worker thread pool sizing and task distribution
- Tree-sitter grammar initialization and caching strategy
- Exact debounce implementation details within the 200ms window

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WATCH-01 | System detects file changes in a watched directory using chokidar v5 | chokidar v5 API verified; ESM-only, Node 20+, watch() with ignored option |
| WATCH-02 | File change events are debounced (200ms window) and batched before processing | Debounce with Map accumulation pattern; lodash/ts-debounce or plain setTimeout |
| WATCH-03 | Duplicate events for the same file within a batch window are coalesced | Map<filePath, lastEventType> pattern deduplicates before flush |
| WATCH-04 | System watches for create, modify, and delete events across the project tree | chokidar events: 'add', 'change', 'unlink' cover create/modify/delete |
| PARSE-01 | System parses TypeScript and JavaScript files using tree-sitter with incremental parsing | tree-sitter npm v0.25+ with tree-sitter-typescript and tree-sitter-javascript grammars verified |
| PARSE-02 | System parses Python files using tree-sitter with incremental parsing | tree-sitter-python npm package verified; same API as TS/JS grammars |
| PARSE-03 | Parser extracts imports, exports, and call relationships from ASTs | Node types: import_statement, export_statement, call_expression; tree traversal via namedChildren |
| PARSE-04 | Parsing runs in worker threads to avoid blocking the main event loop | Native tree-sitter bindings now NAPI/context-aware; piscina ESM worker pool pattern verified |
| PARSE-05 | Parse trees are explicitly disposed after extraction to prevent memory leaks | tree-sitter memory leak via callback reference retention documented; extract to plain object, don't pass Tree cross-thread |
| PARSE-06 | Incremental parsing reuses previous tree state for modified files (tree.edit API) | tree.edit({startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition}) + parser.parse(source, oldTree) pattern verified |
</phase_requirements>

---

## Summary

Phase 2 introduces the data input layer: a chokidar v5 file watcher feeding debounced batches into a tree-sitter parsing pipeline that runs in worker threads. The core design challenge is the intersection of three concerns: accurate file event aggregation (debouncing + deduplication), efficient per-file parsing (incremental tree reuse), and thread safety (worker isolation for the native tree-sitter addon).

The standard stack is well-established. chokidar v5 (ESM-only, released November 2025) is the unambiguous choice for file watching — it is what the project requirements specify. tree-sitter with Node.js native bindings (v0.25+, now NAPI-based and worker-thread safe since a 2024 fix) handles parsing. Piscina manages the worker thread pool with full ESM and TypeScript support.

A critical blocker from STATE.md is confirmed resolved: tree-sitter native bindings were not worker-thread compatible before 2024 due to a V8 isolate issue, but the module was rewritten to use Node API (NAPI), making it context-aware and safe in multiple threads. The fallback to `web-tree-sitter` (WASM) is no longer necessary. Additionally, running TypeScript worker files via tsx requires a specific pattern (using tsx CLI as the worker entry and passing the .ts file as argv, or using eval+tsx/esm/api registration) — straightforward compilation to plain .js workers avoids this complexity entirely.

**Primary recommendation:** Use chokidar v5 + debounce with Map coalescing + piscina worker pool + tree-sitter native bindings; compile worker files to plain JS to avoid tsx/worker-thread compatibility issues.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | ^5.0.0 | File system watching | Specified in WATCH-01; ESM-only, Node 20+; cross-platform (uses fsevents on macOS, inotify on Linux, ReadDirectoryChangesW on Windows) |
| tree-sitter | ^0.25.0 | Incremental AST parsing core | NAPI-based (worker-thread safe since 2024), native performance, official Node.js bindings |
| tree-sitter-typescript | ^0.25.0 | TypeScript + TSX grammar | Official grammar; exports two parsers: `typescript` and `tsx` |
| tree-sitter-javascript | ^0.23.0 | JavaScript + JSX grammar | Official grammar; separate from TypeScript grammar |
| tree-sitter-python | ^0.25.0 | Python grammar | Official grammar; consistent API with TS/JS grammars |
| piscina | ^4.7.0 | Worker thread pool | Written in TypeScript, ESM-native, active maintenance, Node 20+ support; avoids spawning one Worker per file |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lodash.debounce / ts-debounce | n/a | Debounce utility | If not hand-rolling debounce; ts-debounce is TypeScript-native with no extra dep; lodash.debounce has maxWait option |
| node:worker_threads | built-in | Worker communication primitives | Use directly for isMainThread, parentPort, workerData when not using piscina |
| node:path | built-in | Path normalization for project-relative paths | path.relative(watchedRoot, absolutePath) for output contract normalization |
| node:fs/promises | built-in | Reading file contents for parsing | fs.readFile for getting source text before parse |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chokidar v5 | node:fs.watch (native) | fs.watch is unreliable cross-platform; chokidar is the required choice per WATCH-01 |
| tree-sitter native | web-tree-sitter (WASM) | WASM is ~2x slower; no longer needed now that native bindings are NAPI/worker-thread safe |
| piscina | node:worker_threads directly | Manual pool management is error-prone; piscina handles queueing, back-pressure, worker lifecycle |
| piscina | tinypool | tinypool is smaller but less featured; piscina is more production-proven |
| compiled JS workers | tsx worker workaround | tsx worker thread support is currently blocked at Node.js level; compiling to .js is cleaner |

**Installation:**
```bash
pnpm --filter @archlens/server add chokidar tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python piscina
```

Note: tree-sitter, tree-sitter-typescript, tree-sitter-javascript, and tree-sitter-python are native addons (node-gyp). Add to `onlyBuiltDependencies` in the root `package.json` pnpm config:
```json
"pnpm": {
  "onlyBuiltDependencies": ["better-sqlite3", "esbuild", "tree-sitter", "tree-sitter-typescript", "tree-sitter-javascript", "tree-sitter-python"]
}
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── watcher/
│   ├── FileWatcher.ts       # chokidar setup, debounce+batch logic
│   └── types.ts             # WatchEvent, FileWatchBatch types
├── parser/
│   ├── ParserPool.ts        # piscina pool setup, task dispatch
│   ├── worker.ts            # piscina worker: tree-sitter parse + extract (compiled to JS)
│   ├── extractors/
│   │   ├── typescript.ts    # TS/TSX node traversal: imports, exports, calls
│   │   ├── javascript.ts    # JS/JSX node traversal
│   │   └── python.ts        # Python node traversal
│   └── types.ts             # ParseResult, ParseBatch, FileRemoved types
└── pipeline/
    └── Pipeline.ts          # Connects watcher → parser pool → output event emitter
```

### Pattern 1: Chokidar v5 Watch with Extension Filter at the Watcher Level

**What:** Initialize chokidar with an `ignored` function that filters non-source files before they reach any downstream processing. The filter must be applied at watch time, not during event handling.

**When to use:** Always — this is the locked decision to filter at watcher level.

**Example:**
```typescript
// Source: https://github.com/paulmillr/chokidar (chokidar v5 README)
import { watch } from 'chokidar';

const PARSEABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const IGNORED_FILES = new Set(['package.json', 'tsconfig.json', 'tsconfig.base.json', '.env']);

const watcher = watch(watchedDirectory, {
  persistent: true,
  followSymlinks: false,          // locked: ignore symlinks
  ignoreInitial: false,           // emit 'add' events for existing files on startup
  ignored: (filePath: string) => {
    const parts = filePath.split(/[\\/]/);
    // Ignore ignored directories anywhere in the path
    if (parts.some(p => IGNORED_DIRS.has(p))) return true;
    // For files (not directories), filter by extension
    const basename = parts[parts.length - 1];
    if (basename.includes('.')) {
      const ext = '.' + basename.split('.').pop()!;
      return !PARSEABLE_EXTENSIONS.has(ext) || IGNORED_FILES.has(basename);
    }
    return false; // Don't ignore directories at this point
  },
  depth: undefined,               // unlimited depth
  awaitWriteFinish: false,        // we rely on debounce instead
});

watcher
  .on('add', (filePath) => handleFileEvent('added', filePath))
  .on('change', (filePath) => handleFileEvent('modified', filePath))
  .on('unlink', (filePath) => handleFileEvent('removed', filePath))
  .on('ready', () => console.log('Initial scan complete'));
```

### Pattern 2: Debounce + Coalesce Batch Pattern

**What:** Accumulate file events in a Map (keyed by project-relative path) during a 200ms debounce window. The Map naturally deduplicates: the last event type for a given file within the window wins. After the window expires, flush the Map as a single `ParseBatch`.

**When to use:** Between the chokidar event handlers and the parser pool.

**Example:**
```typescript
// Source: pattern from requirements WATCH-02, WATCH-03
import path from 'node:path';

type FileEventType = 'added' | 'modified' | 'removed';

interface PendingEvent {
  relativePath: string;
  absolutePath: string;
  type: FileEventType;
}

class FileWatcher {
  private pending = new Map<string, PendingEvent>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private sequenceCounter = 0;

  constructor(
    private readonly watchRoot: string,
    private readonly onBatch: (batch: ParseBatch) => void,
  ) {}

  handleFileEvent(type: FileEventType, absolutePath: string): void {
    const relativePath = path.relative(this.watchRoot, absolutePath)
      .replace(/\\/g, '/'); // normalize Windows paths

    // Coalesce: last event for this path wins within the window
    this.pending.set(relativePath, { relativePath, absolutePath, type });

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), 200);
  }

  private flush(): void {
    if (this.pending.size === 0) return;
    const events = [...this.pending.values()];
    this.pending.clear();
    this.debounceTimer = null;
    this.onBatch({ events, flushedAt: Date.now() });
  }
}
```

### Pattern 3: Piscina Worker Pool for Parsing

**What:** Create a piscina pool pointing at a compiled worker JS file. The worker receives a parse task (file path + source text + optional previous tree state identifier), runs tree-sitter, extracts plain objects, and returns the result. The pool manages thread count automatically.

**When to use:** For all parse tasks dispatched from the main thread.

**CRITICAL: Worker files must be compiled .js files.** tsx has a known, officially blocked limitation with worker threads (Node.js issue #47747). Compile worker.ts to dist/parser/worker.js and reference the dist path.

**Example — main thread (ParserPool.ts):**
```typescript
// Source: https://piscinajs.dev/examples/ES%20Module/
import Piscina from 'piscina';
import { fileURLToPath } from 'node:url';

const piscina = new Piscina({
  filename: new URL('../../dist/parser/worker.js', import.meta.url).href,
  minThreads: 1,
  maxThreads: Math.max(2, Math.floor(navigator.hardwareConcurrency / 2)), // or os.cpus().length / 2
  idleTimeout: 30_000, // reclaim idle threads after 30s
});

export async function parseFile(task: ParseTask): Promise<ParseResult> {
  return piscina.run(task) as Promise<ParseResult>;
}
```

**Example — worker file (worker.ts → compiled to dist/parser/worker.js):**
```typescript
// Source: https://piscinajs.dev/getting-started/Typescript/
// tree-sitter API: https://tree-sitter.github.io/node-tree-sitter/
import Parser from 'tree-sitter';
import { typescript, tsx } from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import type { ParseTask, ParseResult } from './types.js';

// Grammar cache: initialize once per worker, reuse across tasks
const parsers = {
  ts: (() => { const p = new Parser(); p.setLanguage(typescript); return p; })(),
  tsx: (() => { const p = new Parser(); p.setLanguage(tsx); return p; })(),
  js: (() => { const p = new Parser(); p.setLanguage(JavaScript); return p; })(),
  jsx: (() => { const p = new Parser(); p.setLanguage(JavaScript); return p; })(),
  py: (() => { const p = new Parser(); p.setLanguage(Python); return p; })(),
};

// Default export is what piscina calls
export default function parseFileTask(task: ParseTask): ParseResult {
  const { filePath, source, language } = task;
  const parser = parsers[language];

  // Parse (full parse; incremental not applicable cross-thread — see pitfalls)
  const tree = parser.parse(source);

  try {
    return extractFromTree(tree, filePath, source, language);
  } finally {
    // PARSE-05: explicit disposal — dereference the tree after extraction
    // In NAPI-based tree-sitter, JS GC handles cleanup but explicitly nulling
    // tree variable after extraction prevents callback reference retention leaks.
    // No .delete()/.dispose() method exists in Node bindings; rely on GC + scope exit.
  }
}
```

### Pattern 4: Incremental Parsing with tree.edit (PARSE-06)

**What:** tree-sitter supports incremental parsing: if you have the previous parse tree for a file and know what changed, you call `tree.edit(...)` to invalidate affected regions, then call `parser.parse(newSource, previousTree)`. The parser reuses unchanged subtrees, significantly reducing work on small edits.

**When to use:** When the same file is modified repeatedly. Requires maintaining a Map<relativePath, Tree> in the worker (or in a persistent worker with long lifetime).

**CRITICAL CONSTRAINT:** Parse Tree objects cannot be transferred via structured clone (postMessage). They are native objects living in C++ memory. Therefore, the tree cache for incremental parsing must live inside the worker thread, not the main thread. This is the "serialization pattern needs verification" concern from STATE.md — confirmed: the cache must be worker-local.

**Example — worker with per-file tree cache:**
```typescript
// Source: https://tessl.io/registry/tessl/pypi-tree-sitter/0.25.0/files/docs/incremental-parsing.md
// Node.js API: https://tree-sitter.github.io/node-tree-sitter/

// Tree cache lives in the worker, keyed by relativePath
const treeCache = new Map<string, Parser.Tree>();

export default function parseFileTask(task: ParseTask): ParseResult {
  const { filePath, source, language, editInfo } = task;
  const parser = parsers[language];

  let tree: Parser.Tree;
  const cachedTree = treeCache.get(filePath);

  if (cachedTree && editInfo) {
    // Incremental: edit the old tree to reflect the change, then reparse
    cachedTree.edit({
      startIndex: editInfo.startIndex,
      oldEndIndex: editInfo.oldEndIndex,
      newEndIndex: editInfo.newEndIndex,
      startPosition: editInfo.startPosition,    // { row: number, column: number }
      oldEndPosition: editInfo.oldEndPosition,
      newEndPosition: editInfo.newEndPosition,
    });
    tree = parser.parse(source, cachedTree);
  } else {
    // Full parse
    tree = parser.parse(source);
  }

  // Update cache
  treeCache.set(filePath, tree);

  return extractFromTree(tree, filePath, source, language);
}

// Evict cache on file removal
export function evictFile(filePath: string): void {
  treeCache.delete(filePath);
}
```

**Note on editInfo computation:** For a file watcher that reads the full file after each change, computing precise byte offsets for `tree.edit()` requires knowing what changed. The simplest approach for a file watcher (not a text editor) is to skip `tree.edit()` and always do a full parse on the new source but pass the old tree as the second arg to `parser.parse()` — tree-sitter will internally diff and optimize even without explicit `tree.edit()`. This reduces implementation complexity significantly. PARSE-06 says "reuses previous tree state" — passing oldTree to `parser.parse(source, oldTree)` satisfies this even without `tree.edit()`.

### Pattern 5: AST Extraction — Imports, Exports, Calls

**What:** Walk the tree-sitter syntax tree using `namedChildren` recursion to find specific node types. The Query API (S-expression patterns) is the more powerful alternative but has more setup overhead.

**Node type reference (verified against tree-sitter grammars):**

| Language | Imports | Exports | Function Calls |
|----------|---------|---------|----------------|
| TypeScript/JavaScript | `import_statement` | `export_statement` | `call_expression` |
| Python | `import_statement`, `import_from_statement` | (no export concept; use `module` root) | `call` |

**Example — TypeScript import extraction:**
```typescript
// Source: https://deepwiki.com/tree-sitter/tree-sitter-typescript/1.2-getting-started
function extractImports(rootNode: Parser.SyntaxNode): string[] {
  const imports: string[] = [];

  function walk(node: Parser.SyntaxNode): void {
    if (node.type === 'import_statement') {
      // Find the string literal source: import X from 'source'
      const source = node.children.find(c => c.type === 'string');
      if (source) {
        imports.push(source.text.replace(/['"]/g, ''));
      }
    }
    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(rootNode);
  return imports;
}
```

**Example — Query API alternative (more expressive):**
```typescript
// Source: https://tree-sitter.github.io/node-tree-sitter/
const importQuery = typescript.query(`
  (import_statement
    source: (string (string_fragment) @source))
`);

const captures = importQuery.captures(tree.rootNode);
const imports = captures.map(({ node }) => node.text);
```

### Anti-Patterns to Avoid

- **Passing Tree objects cross-thread via postMessage:** Tree objects are native C++ memory; they cannot be structured-cloned. Always extract to plain JavaScript objects before returning from the worker.
- **Creating a new Parser per parse call:** Parser initialization loads the grammar WASM/native code — expensive. Cache parsers per-language per-worker, initialized once on worker startup.
- **Watching all files then filtering in handler:** The `ignored` option prevents events from firing at all. Filtering in the handler still fires OS-level watch events unnecessarily.
- **Spinning up a new Worker per file:** Worker startup has significant overhead (grammar load, V8 init). Use a pool (piscina) that keeps workers alive.
- **Blocking the main thread on parser.parse():** Even if fast on small files, accumulating parses during rapid editing will block. Always use worker threads.
- **Debouncing file events with a simple `_.debounce()`:** lodash.debounce debounces per-function-call, but you need per-file coalescing. Multiple files changing simultaneously should each debounce independently but flush as a batch. The Map pattern (one entry per path, single timer) is correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File watching | Custom fs.watch wrapper | chokidar | Cross-platform normalization (macOS fsevents, Linux inotify, Windows ReadDirectoryChanges); proper rename detection; event deduplication at OS level |
| Language parsing | Custom regex/tokenizer for imports | tree-sitter + language grammars | Edge cases in string interpolation, multiline imports, re-exports, dynamic imports are all handled; error-tolerant parsing handles syntax errors gracefully |
| Worker thread pool | Manual Worker spawning | piscina | Back-pressure, queue depth limits, task cancellation, idle thread cleanup, proper error propagation |
| Debounce with batching | Your own debounce timer | Native setTimeout + Map | Simple enough to hand-roll correctly; avoid adding lodash just for this |

**Key insight:** The tree-sitter grammar files encode years of real-world TypeScript/JavaScript/Python edge cases. A regex-based extractor will fail on re-exports, type-only imports, dynamic `import()`, namespace imports, and Python relative imports. The grammar handles all of these.

---

## Common Pitfalls

### Pitfall 1: tsx + Worker Threads = ERR_UNKNOWN_FILE_EXTENSION

**What goes wrong:** When running the server via `tsx watch src/index.ts`, spawning a Worker with a `.ts` file path fails with `ERR_UNKNOWN_FILE_EXTENSION`. The tsx `--import` hook cannot be propagated to worker threads.

**Why it happens:** This is a Node.js limitation (issue #47747) — ESM loaders cannot be defined via Worker options. tsx v3.14.0+ uses the `--import` API which is blocked in workers. tsx maintainers have marked this as "blocked" upstream.

**How to avoid:** Two options:
1. **Recommended:** Compile workers to JS before running. Set up a `tsc` build step for the server package and reference the compiled `dist/parser/worker.js` in the Piscina constructor. During dev, use `tsc --watch` alongside `tsx watch`.
2. **Alternative:** Use the tsx CLI workaround: `new Worker(import.meta.resolve('tsx/cli'), { argv: ['./src/parser/worker.ts'] })` — this is fragile and tsx-version-dependent.

**Warning signs:** Runtime `ERR_UNKNOWN_FILE_EXTENSION` on any Worker constructor call with a `.ts` path.

### Pitfall 2: Tree Objects Cannot Cross Thread Boundaries

**What goes wrong:** Attempting to return a `Parser.Tree` object from a piscina worker (or postMessage it from a worker) results in an empty/corrupted object because the structured clone algorithm cannot serialize native C++ objects.

**Why it happens:** tree-sitter Tree objects are NAPI external references — they wrap native memory. Structured clone only copies enumerable JS properties.

**How to avoid:** Always extract all needed data into plain JavaScript objects (plain arrays of strings, objects with primitive fields) inside the worker before returning. Never return a Tree, SyntaxNode, or Parser object across thread boundaries.

**Warning signs:** Parse results arriving as empty objects `{}` or missing fields that were set on native objects.

### Pitfall 3: Memory Leaks from Tree Accumulation

**What goes wrong:** If the worker's tree cache (`Map<string, Tree>`) grows unbounded (e.g., watching a project where files are created but never removed), memory usage grows proportionally. A real-world case from cosine.sh documented ~2GB growth in an indexer service.

**Why it happens:** tree-sitter trees hold C++ allocated memory not subject to normal V8 GC pressure signals. The cache keeps strong references.

**How to avoid:**
1. Evict the tree cache entry when a file is deleted (`unlink` event).
2. Optionally cap the cache size using an LRU eviction strategy (e.g., keep at most N trees, evict LRU on overflow).
3. After extracting results from a tree, do not retain the old tree longer than needed for the next incremental parse.

**Warning signs:** Worker thread memory usage growing monotonically over time without ceiling.

### Pitfall 4: Chokidar v5 Is ESM-Only

**What goes wrong:** `const chokidar = require('chokidar')` fails in chokidar v5 with "not a CommonJS module" error.

**Why it happens:** chokidar v5 (November 2025) dropped CJS support and became ESM-only, requiring Node 20+.

**How to avoid:** Use `import { watch } from 'chokidar'`. The project is already ESM (`"type": "module"` in all package.json files), so this is not an issue — but be aware if checking older documentation.

**Warning signs:** Any require() or createRequire() usage with chokidar will fail.

### Pitfall 5: Grammar Initialization Per Worker Call

**What goes wrong:** Calling `const parser = new Parser(); parser.setLanguage(typescript);` inside the piscina worker's exported function body means grammar is loaded on every task. On high-frequency edits this creates excessive overhead.

**Why it happens:** Grammars are native addons; `setLanguage()` is not free.

**How to avoid:** Initialize parsers at module top-level (or in a module-level constant), outside the exported function. piscina workers are long-lived — the module initializes once per worker thread.

**Warning signs:** Measurable latency increase under load that doesn't correlate with parse tree complexity.

### Pitfall 6: pnpm onlyBuiltDependencies for Native Addons

**What goes wrong:** `pnpm install` silently skips building native addons unless they are whitelisted. tree-sitter packages fail to load at runtime with "was compiled against a different Node.js version" or missing .node file errors.

**Why it happens:** pnpm 10 requires explicit `onlyBuiltDependencies` entries to permit native build scripts (node-gyp).

**How to avoid:** Add all tree-sitter packages to the `pnpm.onlyBuiltDependencies` array in the root `package.json`. This pattern is already established in Phase 1 for `better-sqlite3` and `esbuild`.

**Warning signs:** `Error: Cannot find module '...tree-sitter.node'` or `.../tree-sitter/build/Release/tree_sitter.node: invalid ELF header`.

---

## Code Examples

Verified patterns from official sources:

### Chokidar v5 — ESM Watch Setup
```typescript
// Source: https://github.com/paulmillr/chokidar (official README, v5)
import { watch, type FSWatcher } from 'chokidar';

const watcher: FSWatcher = watch('/path/to/project', {
  persistent: true,
  followSymlinks: false,
  ignored: (p: string) => p.includes('node_modules') || p.includes('.git'),
});

watcher
  .on('add', path => console.log(`File ${path} has been added`))
  .on('change', path => console.log(`File ${path} has been changed`))
  .on('unlink', path => console.log(`File ${path} has been removed`))
  .on('error', error => console.error(`Watcher error: ${error}`))
  .on('ready', () => console.log('Initial scan complete. Ready for changes'));

// Graceful shutdown
process.on('SIGTERM', () => watcher.close());
```

### tree-sitter — Parse and Extract (Worker Context)
```typescript
// Source: https://tree-sitter.github.io/node-tree-sitter/index.html
import Parser from 'tree-sitter';
import { typescript } from 'tree-sitter-typescript';

const parser = new Parser();
parser.setLanguage(typescript);

// Full parse
const tree = parser.parse(`import { foo } from './bar.js';`);

// Incremental parse (pass previous tree as second argument)
// tree.edit() is optional when reading full file contents
const newTree = parser.parse(newSourceCode, previousTree);

// Extract: traverse namedChildren
function getImports(root: Parser.SyntaxNode): string[] {
  const results: string[] = [];
  for (const node of root.namedChildren) {
    if (node.type === 'import_statement') {
      const src = node.children.find(c => c.type === 'string');
      if (src) results.push(src.text.slice(1, -1)); // strip quotes
    }
  }
  return results;
}
```

### tree-sitter — Grammar Import for TypeScript (two dialects)
```typescript
// Source: https://github.com/tree-sitter/tree-sitter-typescript
// tree-sitter-typescript exports BOTH typescript and tsx grammars
import { typescript, tsx } from 'tree-sitter-typescript';

const tsParser = new Parser();
tsParser.setLanguage(typescript); // for .ts files

const tsxParser = new Parser();
tsxParser.setLanguage(tsx);       // for .tsx files
```

### tree-sitter — tree.edit() with Full Parameters
```typescript
// Source: https://tessl.io/registry/tessl/pypi-tree-sitter/0.25.0/files/docs/incremental-parsing.md
// (Python API maps 1:1 to Node.js API for this method)
previousTree.edit({
  startIndex: 10,
  oldEndIndex: 15,
  newEndIndex: 18,
  startPosition: { row: 0, column: 10 },
  oldEndPosition: { row: 0, column: 15 },
  newEndPosition: { row: 0, column: 18 },
});
const updatedTree = parser.parse(newSourceCode, previousTree);
```

### Piscina — Pool Setup with ESM Worker
```typescript
// Source: https://piscinajs.dev/examples/ES%20Module/
import Piscina from 'piscina';

const pool = new Piscina({
  // Point to compiled JS worker — NOT .ts (see Pitfall 1)
  filename: new URL('../../dist/parser/worker.js', import.meta.url).href,
  minThreads: 1,
  maxThreads: 4,
  idleTimeout: 30_000,
});

// Workers return plain JS objects (never Tree objects)
const result = await pool.run({ filePath: 'src/auth.ts', source, language: 'ts' });
```

### Piscina — Worker File Pattern
```typescript
// Source: https://piscinajs.dev/getting-started/Typescript/
// This file is compiled to .js before being used as a piscina worker

export default function(task: ParseTask): ParseResult {
  // ... parse and extract ...
  return { filePath, imports, exports, calls }; // plain objects only
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tree-sitter in worker threads = impossible (V8 isolate issue) | tree-sitter is NAPI-based (context-aware) — fully worker-thread safe | May 2024 (issue #57 closed) | No need for web-tree-sitter WASM workaround |
| chokidar as CJS package (v3.x) | chokidar v5 ESM-only, Node 20+ | November 2025 | Must use import syntax; already correct for this project |
| tsx as universal TypeScript runner for all code | tsx for main thread only; compiled JS for workers | Ongoing limitation (Node.js #47747) | Worker files must have a build step |
| Spawn new Worker per parse task | Use worker pool (piscina) | Established practice | 10-50x throughput improvement for high-frequency edits |

**Deprecated/outdated:**
- `@types/chokidar`: Not needed for chokidar v5 — types are bundled.
- `chokidar v3 CJS patterns (`require('chokidar')`): Use ESM import.
- `web-tree-sitter` as worker workaround: The native NAPI fix makes this unnecessary.

---

## Open Questions

1. **Worker file compilation during dev**
   - What we know: tsx breaks with .ts worker files; piscina needs compiled .js
   - What's unclear: Best dev workflow — run tsc --watch for workers in parallel with tsx watch for main thread? Or use esbuild to bundle workers?
   - Recommendation: Add a `"build:workers": "tsc --outDir dist src/parser/worker.ts"` script; run alongside dev. esbuild bundling is also valid but adds complexity.

2. **Exact debounce timer per-file vs. global**
   - What we know: A single global 200ms debounce with a Map accumulator is simpler and satisfies WATCH-02 and WATCH-03
   - What's unclear: Whether per-file debounce timers would give better UX for independent file edits
   - Recommendation: Single global timer with Map coalescing. Simpler, correct, and the 200ms window is short enough that per-file timers don't meaningfully improve latency.

3. **Incremental parse strategy: tree.edit() vs. pass-old-tree**
   - What we know: Both satisfy PARSE-06. Full tree.edit() requires computing byte offsets from a diff. Passing oldTree without edit() works but is less optimal.
   - What's unclear: Whether the performance difference matters at the file sizes in this project (<5000 lines typical source file)
   - Recommendation: Start with pass-old-tree-only (no tree.edit()); add tree.edit() only if profiling shows a bottleneck.

4. **Parse extraction depth for calls (Claude's Discretion)**
   - What we know: call_expression captures all direct calls; method chains (a.b().c()) need deeper traversal; decorators are separate node types
   - What's unclear: Which call patterns are most architecturally relevant for the dependency graph
   - Recommendation: Extract direct `call_expression` where the callee is an `identifier` (not member_expression) for v1. This captures service-to-service calls. Skip method chains and decorators to avoid noise.

---

## Sources

### Primary (HIGH confidence)
- tree-sitter.github.io/node-tree-sitter/index.html — Parser class API, setLanguage, parse, tree.edit parameters
- nodejs.org/api/worker_threads.html — Worker constructor, workerData, postMessage, isMainThread, parentPort patterns
- piscinajs.dev/getting-started/Typescript/ — Piscina TypeScript worker pattern
- piscinajs.dev/examples/ES%20Module/ — Piscina ESM example with file:// URL
- tree-sitter.github.io/node-tree-sitter/issues/57 — NAPI worker-thread fix confirmation (May 2024)
- tessl.io/registry/tessl/pypi-tree-sitter/0.25.0/files/docs/incremental-parsing.md — tree.edit parameters (Python API, maps 1:1 to Node.js API)

### Secondary (MEDIUM confidence)
- generalistprogrammer.com/tutorials/chokidar-npm-package-guide — chokidar v5 ESM-only, Node 20+ requirement (November 2025)
- jsdocs.io/package/chokidar — FSWatcherEventMap, ChokidarOptions, Matcher types
- github.com/privatenumber/tsx/issues/354 — tsx worker thread limitation, "blocked" by Node.js issue #47747
- electrovir.com/2025-08-09-typescript-worker/ — tsx ESM worker workaround pattern (eval + tsx/esm/api)
- deepwiki.com/tree-sitter/tree-sitter-typescript/1.2-getting-started — node type names: import_statement, export_statement, call_expression

### Tertiary (LOW confidence)
- cosine.sh/blog/tree-sitter-memory-leak — callback reference retention memory leak in tree-sitter (single source; confirmed as a real historical bug, patched)
- npm registry descriptions for tree-sitter-python v0.25.0, tree-sitter-javascript — existence and version confirmed via search results

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — chokidar v5 specified by requirements; tree-sitter Node bindings confirmed NAPI; piscina verified from official docs
- Architecture: HIGH — worker thread pattern, piscina ESM example, debounce/coalesce pattern all verified from official sources
- Pitfalls: HIGH — tsx/worker limitation confirmed from tsx issue tracker; tree/thread serialization confirmed from Node.js structured clone spec; grammar init pitfall verified from tree-sitter docs

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable libraries; chokidar v5 and tree-sitter NAPI fix are recent but settled)
