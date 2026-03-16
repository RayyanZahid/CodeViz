import type { GraphDelta, GraphDeltaEdge } from '@archlens/shared/types';
import type { ZoneName, RiskSignal } from '@archlens/shared/types';
/**
 * ZONE_LAYER_ORDER defines the strict layering contract for architectural
 * boundary checks. Only these four zones participate in layer-ordering rules.
 *
 * Allowed import directions (adjacent or same layer only):
 *   frontend (0) -> api (1) -> services (2) -> data-stores (3)
 *
 * Infrastructure and external zones are intentionally excluded:
 * - Infrastructure nodes serve all layers (loggers, config, etc.) — no ordering applies.
 * - External nodes (__ext__/ prefix) are third-party — no boundary rules apply.
 */
export declare const ZONE_LAYER_ORDER: Partial<Record<ZoneName, number>>;
/**
 * FAN_OUT_THRESHOLD is the maximum number of outgoing internal dependencies
 * (edges to non-__ext__/ nodes) a node may have before triggering a warning.
 *
 * External stub nodes are explicitly excluded from this count: they inflate
 * out-degree for server entry points and would cause false positives
 * (RESEARCH.md Pitfall 6).
 */
export declare const FAN_OUT_THRESHOLD = 8;
/**
 * RiskDetector identifies three categories of architectural risk from a
 * GraphDelta and the current graph topology:
 *
 * 1. Circular dependency  — wraps Phase 3 cycle detection (critical severity).
 * 2. Boundary violation   — layer-skip imports between layered zones (warning).
 * 3. Excessive fan-out    — internal out-degree > FAN_OUT_THRESHOLD (warning).
 *
 * RiskDetector is stateless: it is a pure function of the incoming delta and
 * current topology. No state is maintained across calls, keeping it simple
 * and easily testable.
 */
export declare class RiskDetector {
    /**
     * Detects all risk signals for the given GraphDelta.
     *
     * @param delta       - The incremental graph delta to analyse.
     * @param getZone     - Callback returning the ZoneName for any node ID.
     *                      Should return ZoneName.UNKNOWN for unclassified nodes.
     * @param getOutEdges - Callback returning all outgoing GraphDeltaEdge objects
     *                      for a node ID. Needed for fan-out counting.
     * @returns           Array of RiskSignal objects (may be empty).
     */
    detectRisks(delta: GraphDelta, getZone: (nodeId: string) => ZoneName, getOutEdges: (nodeId: string) => GraphDeltaEdge[]): RiskSignal[];
    /**
     * Wraps Phase 3 cyclesAdded to emit a critical RiskSignal per new cycle.
     *
     * Severity is always 'critical' (locked decision) — circular dependencies
     * are categorically the most dangerous structural risk.
     */
    private detectCycleRisks;
    /**
     * Checks all newly added edges for layer-skip imports.
     *
     * Only nodes in ZONE_LAYER_ORDER participate in boundary checks.
     * Nodes in infrastructure, external, or unknown zones are skipped.
     * External stub nodes (__ext__/ prefix) are also skipped.
     *
     * Allowed: same zone (diff === 0) or adjacent layer forward (diff === 1).
     * Violations:
     *   - diff > 1: forward layer skip (e.g., frontend -> data-stores)
     *   - diff < 0: backward import (e.g., services -> frontend)
     */
    private detectBoundaryViolations;
    /**
     * Checks nodes that may have gained new outgoing edges for excessive fan-out.
     *
     * Candidate nodes: addedNodes + modifiedNodes + source nodes of addedEdges.
     * Only internal edges (target does NOT start with __ext__/) are counted.
     * Threshold is FAN_OUT_THRESHOLD (8) — more than 8 internal deps is a warning.
     */
    private detectFanOutRisks;
}
//# sourceMappingURL=RiskDetector.d.ts.map