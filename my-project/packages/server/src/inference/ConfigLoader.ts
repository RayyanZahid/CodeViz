import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import micromatch from 'micromatch';
import type { ZoneName } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// ArchLensConfig — structure of the .archlens.json file
// ---------------------------------------------------------------------------

interface ArchLensConfig {
  /**
   * Zone override map.
   * Keys are file paths (project-relative, forward slashes) or glob patterns.
   * Values are valid ZoneName values.
   */
  zoneOverrides?: Record<string, ZoneName>;
}

// ---------------------------------------------------------------------------
// ConfigLoader
// ---------------------------------------------------------------------------

/**
 * Loads and watches the `.archlens.json` configuration file from the project's
 * watch root directory. Provides zone overrides that take precedence over all
 * automatic classification signals (path-based and topology-based).
 *
 * - If `.archlens.json` does not exist, ConfigLoader operates with an empty
 *   config (no overrides) — this is the normal state for new projects.
 * - Override keys support exact path matches and glob patterns via micromatch.
 * - Live reloading: chokidar watches the config file for add/change/unlink
 *   events and reloads automatically.
 */
export class ConfigLoader {
  /** Absolute path to the watched .archlens.json file. */
  private readonly configPath: string;

  /** Current loaded configuration. */
  private config: ArchLensConfig = {};

  /** Chokidar watcher for live config reloading. */
  private watcher: ReturnType<typeof chokidar.watch>;

  constructor(watchRoot: string) {
    this.configPath = path.join(watchRoot, '.archlens.json');

    // Load config synchronously on construction so the first classify() call
    // has overrides available without awaiting any async initialization.
    this.loadConfig();

    // Set up live reloading via chokidar. Watch the single config file path.
    // persistent: false — chokidar should not keep the process alive solely
    // because of this watcher (the pipeline's file watcher owns process lifecycle).
    this.watcher = chokidar.watch(this.configPath, {
      persistent: false,
      ignoreInitial: true,
    });

    this.watcher.on('add', () => this.loadConfig());
    this.watcher.on('change', () => this.loadConfig());
    this.watcher.on('unlink', () => {
      // Config file deleted — reset to empty config (no overrides).
      this.config = {};
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the zone override for the given nodeId, or null if no override
   * matches.
   *
   * Priority:
   * 1. Exact path match (fast O(1) lookup).
   * 2. Glob pattern match via micromatch (first match wins).
   * 3. Returns null if no match.
   */
  getOverride(nodeId: string): ZoneName | null {
    const overrides = this.config.zoneOverrides;
    if (!overrides) return null;

    // 1. Exact match — most common case, fast path.
    if (Object.prototype.hasOwnProperty.call(overrides, nodeId)) {
      return overrides[nodeId] ?? null;
    }

    // 2. Glob match — iterate entries in insertion order; first match wins.
    for (const [pattern, zone] of Object.entries(overrides)) {
      if (micromatch.isMatch(nodeId, pattern)) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Stops the chokidar watcher for graceful shutdown.
   * Must be called when the server or pipeline shuts down to avoid resource leaks.
   */
  destroy(): void {
    void this.watcher.close();
  }

  // ---------------------------------------------------------------------------
  // Private — config loading
  // ---------------------------------------------------------------------------

  /**
   * Reads and parses the .archlens.json file synchronously.
   * Tolerates missing file and invalid JSON — both result in empty config.
   */
  private loadConfig(): void {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as ArchLensConfig;
      this.config = parsed ?? {};
    } catch {
      // File not found (ENOENT) or invalid JSON — normal state, use empty config.
      this.config = {};
    }
  }
}
