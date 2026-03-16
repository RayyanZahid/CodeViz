import { watch } from 'chokidar';
import path from 'node:path';
import { FileEventType } from '@archlens/shared/types';
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
export class FileWatcher {
    watchRoot;
    onBatch;
    debounceMs;
    customIgnores;
    watcher = null;
    pending = new Map();
    debounceTimer = null;
    sequenceCounter = 0;
    watching = false;
    constructor(watchRoot, onBatch, options = {}) {
        this.watchRoot = watchRoot;
        this.onBatch = onBatch;
        this.debounceMs = options.debounceMs ?? 200;
        this.customIgnores = options.customIgnores ?? [];
    }
    start() {
        return new Promise((resolve, reject) => {
            const ignoreFn = (filePath) => {
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
            this.watcher.on('add', (absolutePath) => {
                this.enqueue(absolutePath, FileEventType.ADDED);
            });
            this.watcher.on('change', (absolutePath) => {
                this.enqueue(absolutePath, FileEventType.MODIFIED);
            });
            this.watcher.on('unlink', (absolutePath) => {
                this.enqueue(absolutePath, FileEventType.REMOVED);
            });
            this.watcher.on('error', (err) => {
                console.error('[FileWatcher] error:', err);
            });
            this.watcher.on('ready', () => {
                this.watching = true;
                resolve();
            });
            // Reject if chokidar emits an error before ready
            this.watcher.once('error', (err) => {
                if (!this.watching) {
                    reject(err);
                }
            });
        });
    }
    async stop() {
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
    isWatching() {
        return this.watching;
    }
    enqueue(absolutePath, type) {
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
    flush() {
        this.debounceTimer = null;
        if (this.pending.size === 0) {
            return;
        }
        const events = Array.from(this.pending.values());
        const sequenceStart = this.sequenceCounter;
        this.sequenceCounter += events.length;
        this.pending.clear();
        const batch = {
            events,
            sequenceStart,
            flushedAt: Date.now(),
        };
        this.onBatch(batch);
    }
}
//# sourceMappingURL=FileWatcher.js.map