import type { ZoneName } from '@archlens/shared/types';
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
export declare class ConfigLoader {
    /** Absolute path to the watched .archlens.json file. */
    private readonly configPath;
    /** Current loaded configuration. */
    private config;
    /** Chokidar watcher for live config reloading. */
    private watcher;
    constructor(watchRoot: string);
    /**
     * Returns the zone override for the given nodeId, or null if no override
     * matches.
     *
     * Priority:
     * 1. Exact path match (fast O(1) lookup).
     * 2. Glob pattern match via micromatch (first match wins).
     * 3. Returns null if no match.
     */
    getOverride(nodeId: string): ZoneName | null;
    /**
     * Stops the chokidar watcher for graceful shutdown.
     * Must be called when the server or pipeline shuts down to avoid resource leaks.
     */
    destroy(): void;
    /**
     * Reads and parses the .archlens.json file synchronously.
     * Tolerates missing file and invalid JSON — both result in empty config.
     */
    private loadConfig;
}
//# sourceMappingURL=ConfigLoader.d.ts.map