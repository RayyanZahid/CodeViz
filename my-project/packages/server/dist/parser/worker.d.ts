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
import type { ParseTask, ParseResult } from '@archlens/shared/types';
export default function parseFileTask(task: ParseTask): ParseResult;
export declare function evictFile(filePath: string): void;
//# sourceMappingURL=worker.d.ts.map