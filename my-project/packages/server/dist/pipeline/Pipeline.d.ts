import type { ParseBatchResult } from '@archlens/shared/types';
export interface PipelineOptions {
    debounceMs?: number;
    minThreads?: number;
    maxThreads?: number;
}
/**
 * Pipeline orchestrates the full data flow:
 *   FileWatcher -> file read -> ParserPool -> ParseBatchResult callback
 *
 * It accepts file change batches from the watcher, reads file contents,
 * creates ParseTasks, dispatches to the worker pool, and emits typed
 * ParseBatchResults to downstream consumers.
 *
 * File removals produce explicit FileRemoved entries and evict the
 * incremental parse tree cache in the worker pool.
 */
export declare class Pipeline {
    private readonly watchRoot;
    private readonly onResult;
    private readonly watcher;
    private readonly parserPool;
    private sequenceCounter;
    constructor(watchRoot: string, onResult: (result: ParseBatchResult) => void, options?: PipelineOptions);
    /**
     * Start watching the watchRoot directory.
     */
    start(): Promise<void>;
    /**
     * Stop watching and shut down the parser pool.
     */
    stop(): Promise<void>;
    /**
     * Returns true if the watcher is currently active.
     */
    isRunning(): boolean;
    private handleBatch;
}
//# sourceMappingURL=Pipeline.d.ts.map