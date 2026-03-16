import { type FileWatchBatch } from '@archlens/shared/types';
export interface FileWatcherOptions {
    debounceMs?: number;
    customIgnores?: string[];
}
export declare class FileWatcher {
    private watchRoot;
    private onBatch;
    private debounceMs;
    private customIgnores;
    private watcher;
    private pending;
    private debounceTimer;
    private sequenceCounter;
    private watching;
    constructor(watchRoot: string, onBatch: (batch: FileWatchBatch) => void, options?: FileWatcherOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    isWatching(): boolean;
    private enqueue;
    private flush;
}
//# sourceMappingURL=FileWatcher.d.ts.map