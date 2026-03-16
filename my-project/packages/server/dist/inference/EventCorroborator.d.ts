import type { GraphDelta } from '@archlens/shared/types';
import type { ZoneUpdate, ArchitecturalEvent } from '@archlens/shared/types';
/**
 * EventCorroborator accumulates corroboration signals across multiple
 * GraphDeltas and fires ArchitecturalEvents only when the signal count
 * reaches THRESHOLD (2).
 *
 * A single file edit produces one delta — it alone cannot trigger an event.
 * The counter must reach 2 across two separate deltas with the same signal,
 * preventing noisy single-file-edit events from flooding the system.
 *
 * Key design decisions (locked):
 * - THRESHOLD = 2: binary pass/fail, no confidence scores exposed.
 * - Events fire immediately when threshold is met (no time-window batching).
 * - Counter is deleted (not zeroed) on fire — re-accumulation starts fresh.
 * - MAX_STALE_VERSIONS = 10: evict entries older than 10 delta versions
 *   to prevent unbounded memory growth (RESEARCH.md Pitfall 2).
 */
export declare class EventCorroborator {
    /** Minimum number of signals required before an event fires. */
    readonly THRESHOLD = 2;
    /** Evict counter entries that are older than this many delta versions. */
    private readonly MAX_STALE_VERSIONS;
    /**
     * Signal counters keyed by canonical "candidate event" string.
     * Format examples:
     *   component_created:src/foo.ts
     *   dependency_added:src/a.ts:src/b.ts
     *   dependency_removed:src/a.ts->src/b.ts
     *   component_merged:src/new.ts
     *   component_split:src/old.ts
     */
    private counters;
    /**
     * Processes a GraphDelta and optional zone updates to accumulate signals
     * and fire ArchitecturalEvents when the corroboration threshold is reached.
     *
     * @param delta      - The computed graph delta for this update cycle.
     * @param zoneUpdates - Zone assignment updates produced by the ZoneClassifier
     *                      in the same inference cycle — used to attach zone labels
     *                      to component_created events.
     * @returns          Array of ArchitecturalEvents that fired this cycle
     *                   (may be empty if no counters crossed the threshold).
     */
    processDelta(delta: GraphDelta, zoneUpdates: ZoneUpdate[]): ArchitecturalEvent[];
    /**
     * Increments the counter for the given key.
     *
     * Returns true if the counter reached THRESHOLD (the event fires).
     * When firing, the counter entry is deleted so re-accumulation starts fresh.
     * Otherwise, the updated count is stored.
     */
    private incrementCounter;
}
//# sourceMappingURL=EventCorroborator.d.ts.map