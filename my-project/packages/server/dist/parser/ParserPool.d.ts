import type { ParseTask, ParseResult } from '@archlens/shared/types';
export interface ParserPoolOptions {
    minThreads?: number;
    maxThreads?: number;
    idleTimeout?: number;
}
/**
 * Managed worker thread pool for tree-sitter parsing (PARSE-04).
 *
 * Wraps piscina to provide typed parseFile/parseBatch/evictFile methods.
 * Workers load the compiled dist/parser/worker.js and maintain their own
 * grammar cache and tree cache for incremental parsing.
 *
 * IMPORTANT: Run `pnpm build:workers` before instantiating this class in
 * development. In production, the worker file must be compiled to dist/.
 */
export declare class ParserPool {
    private readonly pool;
    constructor(options?: ParserPoolOptions);
    /**
     * Parse a single file in a worker thread.
     */
    parseFile(task: ParseTask): Promise<ParseResult>;
    /**
     * Parse multiple files concurrently within the pool.
     * All tasks are dispatched simultaneously and resolved as a batch.
     */
    parseBatch(tasks: ParseTask[]): Promise<ParseResult[]>;
    /**
     * Evict the incremental parse tree cache for a given file path.
     * Should be called when a file is deleted so the worker frees its cached tree.
     */
    evictFile(filePath: string): Promise<void>;
    /**
     * Gracefully shut down the worker pool, waiting for in-flight tasks.
     */
    destroy(): Promise<void>;
    /**
     * Current pool utilization snapshot.
     */
    get stats(): {
        completed: number;
        queued: number;
    };
}
//# sourceMappingURL=ParserPool.d.ts.map