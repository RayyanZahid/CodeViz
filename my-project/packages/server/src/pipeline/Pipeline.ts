import fs from 'node:fs/promises';
import path from 'node:path';
import { FileWatcher } from '../watcher/FileWatcher.js';
import { ParserPool } from '../parser/ParserPool.js';
import type {
  FileWatchBatch,
  ParseTask,
  ParseBatchResult,
  FileRemoved,
  SupportedLanguage,
} from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
  '.py': 'py',
};

function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = path.extname(filePath);
  return (EXTENSION_TO_LANGUAGE[ext] as SupportedLanguage | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Pipeline options
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  debounceMs?: number;
  minThreads?: number;
  maxThreads?: number;
}

// ---------------------------------------------------------------------------
// Pipeline class
// ---------------------------------------------------------------------------

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
export class Pipeline {
  private readonly watchRoot: string;
  private readonly onResult: (result: ParseBatchResult) => void;
  private readonly watcher: FileWatcher;
  private readonly parserPool: ParserPool;
  private sequenceCounter: number = 0;

  constructor(
    watchRoot: string,
    onResult: (result: ParseBatchResult) => void,
    options: PipelineOptions = {},
  ) {
    this.watchRoot = watchRoot;
    this.onResult = onResult;

    this.watcher = new FileWatcher(
      watchRoot,
      (batch) => {
        this.handleBatch(batch).catch((err: unknown) => {
          console.error('[Pipeline] Unhandled error in handleBatch:', err);
        });
      },
      { debounceMs: options.debounceMs },
    );

    this.parserPool = new ParserPool({
      minThreads: options.minThreads,
      maxThreads: options.maxThreads,
    });
  }

  /**
   * Start watching the watchRoot directory.
   */
  async start(): Promise<void> {
    await this.watcher.start();
    console.log(`[Pipeline] started, watching ${this.watchRoot}`);
  }

  /**
   * Stop watching and shut down the parser pool.
   */
  async stop(): Promise<void> {
    await this.watcher.stop();
    await this.parserPool.destroy();
    console.log('[Pipeline] stopped');
  }

  /**
   * Returns true if the watcher is currently active.
   */
  isRunning(): boolean {
    return this.watcher.isWatching();
  }

  // ---------------------------------------------------------------------------
  // Internal batch handler
  // ---------------------------------------------------------------------------

  private async handleBatch(batch: FileWatchBatch): Promise<void> {
    try {
      const removals: FileRemoved[] = [];
      const tasks: ParseTask[] = [];

      for (const event of batch.events) {
        if (event.type === 'removed') {
          // Evict tree cache for the removed file and build a FileRemoved result
          await this.parserPool.evictFile(event.relativePath);
          removals.push({
            filePath: event.relativePath,
            sequenceId: this.sequenceCounter++,
            type: 'removed',
          });
        } else {
          // 'added' or 'modified' — read the file and create a ParseTask
          const language = detectLanguage(event.relativePath);
          if (!language) {
            // No supported language detected — skip
            continue;
          }

          let source: string;
          try {
            source = await fs.readFile(
              path.join(this.watchRoot, event.relativePath),
              'utf-8',
            );
          } catch (readErr: unknown) {
            const nodeErr = readErr as NodeJS.ErrnoException;
            if (nodeErr.code === 'ENOENT') {
              // File was deleted between the event and the read — treat as removal
              await this.parserPool.evictFile(event.relativePath);
              removals.push({
                filePath: event.relativePath,
                sequenceId: this.sequenceCounter++,
                type: 'removed',
              });
            } else {
              // Encoding error, binary file, or other I/O problem — skip with warning
              console.warn(
                `[Pipeline] Skipping ${event.relativePath}: ${String(readErr)}`,
              );
            }
            continue;
          }

          tasks.push({
            filePath: event.relativePath,
            source,
            language,
            sequenceId: this.sequenceCounter++,
          });
        }
      }

      // Dispatch all parse tasks to the worker pool concurrently
      const parseResults = tasks.length > 0 ? await this.parserPool.parseBatch(tasks) : [];

      // Combine removal results and parse results into a single ParseBatchResult
      const batchResult: ParseBatchResult = {
        results: [...removals, ...parseResults],
        batchSequenceStart: batch.sequenceStart,
        processedAt: Date.now(),
      };

      this.onResult(batchResult);
    } catch (err: unknown) {
      console.error('[Pipeline] Error processing batch:', err);
    }
  }
}
