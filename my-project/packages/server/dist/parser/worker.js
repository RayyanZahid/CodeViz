/**
 * Piscina worker for tree-sitter parsing.
 *
 * This file is compiled to dist/parser/worker.js and loaded by piscina in
 * worker threads. Grammars and parsers are initialized once per worker thread
 * at module load time and reused across tasks (Pattern 5 from RESEARCH.md).
 *
 * IMPORTANT: This file uses CommonJS-style imports via require() calls at
 * module level so that the compiled JS can load the native grammar bindings
 * correctly. All outputs are plain JavaScript objects — no Parser.Tree objects
 * leave this module (PARSE-05).
 */
import Parser from 'tree-sitter';
import { extractTypeScript } from './extractors/typescript.js';
import { extractJavaScript } from './extractors/javascript.js';
import { extractPython } from './extractors/python.js';
import { performance } from 'node:perf_hooks';
// ---------------------------------------------------------------------------
// Grammar imports — use require() for CommonJS native addon compatibility
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { typescript, tsx } = require('tree-sitter-typescript');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JavaScript = require('tree-sitter-javascript');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Python = require('tree-sitter-python');
// ---------------------------------------------------------------------------
// Grammar cache — one Parser instance per language, per worker thread
// Initialized once at module load time (Pitfall 5 avoidance).
// ---------------------------------------------------------------------------
const tsParser = new Parser();
tsParser.setLanguage(typescript);
const tsxParser = new Parser();
tsxParser.setLanguage(tsx);
const jsParser = new Parser();
jsParser.setLanguage(JavaScript);
const jsxParser = new Parser();
jsxParser.setLanguage(JavaScript); // JSX uses the same JavaScript grammar
const pyParser = new Parser();
pyParser.setLanguage(Python);
const parsers = {
    ts: tsParser,
    tsx: tsxParser,
    js: jsParser,
    jsx: jsxParser,
    py: pyParser,
};
// ---------------------------------------------------------------------------
// Tree cache for incremental parsing (PARSE-06)
// Lives in the worker — parse trees cannot cross thread boundaries via
// structured clone (Pitfall 2 / confirmed in STATE.md).
// ---------------------------------------------------------------------------
const treeCache = new Map();
// ---------------------------------------------------------------------------
// Default export — the piscina task handler
// ---------------------------------------------------------------------------
export default function parseFileTask(task) {
    const { filePath, source, language, sequenceId } = task;
    const parser = parsers[language];
    if (!parser) {
        throw new Error(`Unsupported language: ${language}`);
    }
    const start = performance.now();
    // Incremental parse: reuse previous tree if available (PARSE-06).
    // Pass old tree as second arg — tree-sitter internally diffs and reuses
    // unchanged subtrees even without explicit tree.edit() (per RESEARCH.md
    // open question #3 recommendation).
    const oldTree = treeCache.get(filePath);
    const tree = oldTree ? parser.parse(source, oldTree) : parser.parse(source);
    // Update cache for next incremental parse
    treeCache.set(filePath, tree);
    const parseTimeMs = performance.now() - start;
    const hasErrors = tree.rootNode.hasError;
    // Extract plain objects — the Tree stays in the cache, not in the result
    let imports, exports_, calls;
    if (language === 'ts' || language === 'tsx') {
        ({ imports, exports: exports_, calls } = extractTypeScript(tree.rootNode, filePath));
    }
    else if (language === 'py') {
        ({ imports, exports: exports_, calls } = extractPython(tree.rootNode, filePath));
    }
    else {
        ({ imports, exports: exports_, calls } = extractJavaScript(tree.rootNode, filePath));
    }
    // PARSE-05: tree is held only in treeCache for incremental reuse.
    // No Tree object escapes this function — the result contains only plain objects.
    return {
        filePath,
        language,
        imports,
        exports: exports_,
        calls,
        sequenceId,
        parseTimeMs,
        hasErrors,
    };
}
// ---------------------------------------------------------------------------
// Named export for cache eviction (piscina named task: pool.run(path, { name: 'evictFile' }))
// ---------------------------------------------------------------------------
export function evictFile(filePath) {
    treeCache.delete(filePath);
}
