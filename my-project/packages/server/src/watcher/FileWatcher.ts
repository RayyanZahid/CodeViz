import { watch, type FSWatcher } from 'chokidar';
import path from 'node:path';
import { FileEventType, type WatchEvent, type FileWatchBatch } from '@archlens/shared/types';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
]);

const PARSEABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);

const IGNORED_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.env',
  '.gitignore',
]);

export interface FileWatcherOptions {
  debounceMs?: number;
  customIgnores?: string[];
}

export class FileWatcher {
  private watchRoot: string;
  private onBatch: (batch: FileWatchBatch) => void;
  private debounceMs: number;
  private customIgnores: string[];

  private watcher: FSWatcher | null = null;
  private pending: Map<string, WatchEvent> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private sequenceCounter: number = 0;
  private watching: boolean = false;

  constructor(
    watchRoot: string,
    onBatch: (batch: FileWatchBatch) => void,
    options: FileWatcherOptions = {},
  ) {
    this.watchRoot = watchRoot;
    this.onBatch = onBatch;
    this.debounceMs = options.debounceMs ?? 200;
    this.customIgnores = options.customIgnores ?? [];
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ignoreFn = (filePath: string): boolean => {
        const parts = filePath.replace(/\\/g, '/').split('/');

        // Check every path segment against IGNORED_DIRS
        for (const part of parts) {
          if (IGNORED_DIRS.has(part)) {
            return true;
          }
        }

        const basename = path.basename(filePath);

        // Check against config files list
        if (IGNORED_FILES.has(basename)) {
          return true;
        }

        // Only allow parseable extensions (directories pass through — chokidar passes dirs too)
        const ext = path.extname(filePath);
        if (ext !== '' && !PARSEABLE_EXTENSIONS.has(ext)) {
          return true;
        }

        // Check user-provided custom ignore patterns (simple substring match)
        for (const pattern of this.customIgnores) {
          if (filePath.includes(pattern)) {
            return true;
          }
        }

        return false;
      };

      this.watcher = watch(this.watchRoot, {
        followSymlinks: false,
        ignoreInitial: false,
        ignored: ignoreFn,
        persistent: true,
      });

      this.watcher.on('add', (absolutePath: string) => {
        this.enqueue(absolutePath, FileEventType.ADDED);
      });

      this.watcher.on('change', (absolutePath: string) => {
        this.enqueue(absolutePath, FileEventType.MODIFIED);
      });

      this.watcher.on('unlink', (absolutePath: string) => {
        this.enqueue(absolutePath, FileEventType.REMOVED);
      });

      this.watcher.on('error', (err: unknown) => {
        console.error('[FileWatcher] error:', err);
      });

      this.watcher.on('ready', () => {
        this.watching = true;
        resolve();
      });

      // Reject if chokidar emits an error before ready
      this.watcher.once('error', (err: unknown) => {
        if (!this.watching) {
          reject(err);
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.watching = false;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher !== null) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.pending.clear();
  }

  isWatching(): boolean {
    return this.watching;
  }

  private enqueue(absolutePath: string, type: FileEventType): void {
    const relativePath = path
      .relative(this.watchRoot, absolutePath)
      .replace(/\\/g, '/');

    // Last event type for same path wins (coalescing)
    this.pending.set(relativePath, { relativePath, absolutePath, type });

    // Reset debounce timer on every new event
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  private flush(): void {
    this.debounceTimer = null;

    if (this.pending.size === 0) {
      return;
    }

    const events = Array.from(this.pending.values());
    const sequenceStart = this.sequenceCounter;
    this.sequenceCounter += events.length;
    this.pending.clear();

    const batch: FileWatchBatch = {
      events,
      sequenceStart,
      flushedAt: Date.now(),
    };

    this.onBatch(batch);
  }
}
