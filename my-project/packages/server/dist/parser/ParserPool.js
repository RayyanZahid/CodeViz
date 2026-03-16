import { Piscina } from 'piscina';
import os from 'node:os';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
export class ParserPool {
    pool;
    constructor(options = {}) {
        // Resolve worker file path relative to this module's location.
        // ParserPool is at dist/parser/ParserPool.js at runtime, so
        // dist/parser/worker.js is in the same directory.
        const workerUrl = new URL('../../dist/parser/worker.js', import.meta.url);
        const workerPath = fileURLToPath(workerUrl);
        if (!existsSync(workerPath)) {
            throw new Error(`Worker file not found at ${workerPath}. Run 'pnpm build:workers' first.`);
        }
        this.pool = new Piscina({
            filename: workerUrl.href,
            minThreads: options.minThreads ?? 1,
            maxThreads: options.maxThreads ?? Math.max(2, Math.floor(os.availableParallelism() / 2)),
            idleTimeout: options.idleTimeout ?? 30_000,
        });
    }
    /**
     * Parse a single file in a worker thread.
     */
    async parseFile(task) {
        return this.pool.run(task);
    }
    /**
     * Parse multiple files concurrently within the pool.
     * All tasks are dispatched simultaneously and resolved as a batch.
     */
    async parseBatch(tasks) {
        return Promise.all(tasks.map((t) => this.parseFile(t)));
    }
    /**
     * Evict the incremental parse tree cache for a given file path.
     * Should be called when a file is deleted so the worker frees its cached tree.
     */
    async evictFile(filePath) {
        await this.pool.run(filePath, { name: 'evictFile' });
    }
    /**
     * Gracefully shut down the worker pool, waiting for in-flight tasks.
     */
    async destroy() {
        await this.pool.destroy();
    }
    /**
     * Current pool utilization snapshot.
     */
    get stats() {
        return {
            completed: this.pool.completed,
            queued: this.pool.queueSize,
        };
    }
}
