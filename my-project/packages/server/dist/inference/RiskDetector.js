// ---------------------------------------------------------------------------
// Layer ordering for boundary violation detection
// ---------------------------------------------------------------------------
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
export const ZONE_LAYER_ORDER = {
    frontend: 0,
    api: 1,
    services: 2,
    'data-stores': 3,
};
/**
 * FAN_OUT_THRESHOLD is the maximum number of outgoing internal dependencies
 * (edges to non-__ext__/ nodes) a node may have before triggering a warning.
 *
 * External stub nodes are explicitly excluded from this count: they inflate
 * out-degree for server entry points and would cause false positives
 * (RESEARCH.md Pitfall 6).
 */
export const FAN_OUT_THRESHOLD = 8;
// ---------------------------------------------------------------------------
// RiskDetector
// ---------------------------------------------------------------------------
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
export class RiskDetector {
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
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
    detectRisks(delta, getZone, getOutEdges) {
        const risks = [];
        // 1. Circular dependency risks — wraps Phase 3 cycle detection output.
        this.detectCycleRisks(delta, getZone, risks);
        // 2. Boundary violation risks — newly added edges that skip layers.
        this.detectBoundaryViolations(delta, getZone, risks);
        // 3. Excessive fan-out risks — nodes whose out-degree may have changed.
        this.detectFanOutRisks(delta, getOutEdges, risks);
        return risks;
    }
    // ---------------------------------------------------------------------------
    // Private — risk detectors
    // ---------------------------------------------------------------------------
    /**
     * Wraps Phase 3 cyclesAdded to emit a critical RiskSignal per new cycle.
     *
     * Severity is always 'critical' (locked decision) — circular dependencies
     * are categorically the most dangerous structural risk.
     */
    detectCycleRisks(delta, getZone, risks) {
        for (const cycle of delta.cyclesAdded) {
            const zoneLabels = cycle.path.map((nodeId) => getZone(nodeId));
            const pathWithZones = cycle.path
                .map((nodeId, i) => `${nodeId} (${zoneLabels[i]})`)
                .join(' -> ');
            risks.push({
                type: 'circular_dependency',
                severity: 'critical',
                nodeId: cycle.path[0],
                affectedNodeIds: cycle.path,
                details: `Circular dependency detected: ${pathWithZones}`,
            });
        }
    }
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
    detectBoundaryViolations(delta, getZone, risks) {
        for (const edge of delta.addedEdges) {
            // Skip external stub nodes — not subject to layering rules.
            if (edge.v.startsWith('__ext__/') || edge.w.startsWith('__ext__/')) {
                continue;
            }
            const sourceZone = getZone(edge.v);
            const targetZone = getZone(edge.w);
            const sourceLayer = ZONE_LAYER_ORDER[sourceZone];
            const targetLayer = ZONE_LAYER_ORDER[targetZone];
            // If either endpoint has no layer assignment (infrastructure, external,
            // unknown), skip — no boundary rule applies.
            if (sourceLayer === undefined || targetLayer === undefined) {
                continue;
            }
            const diff = targetLayer - sourceLayer;
            // diff === 0 (same zone) or diff === 1 (adjacent forward) are allowed.
            if (diff === 0 || diff === 1) {
                continue;
            }
            // Determine violation direction for the details message.
            let violationDescription;
            if (diff > 1) {
                violationDescription =
                    `Forward layer skip: ${sourceZone} -> ${targetZone} ` +
                        `(${edge.v} imports ${edge.w}, skipping ${diff - 1} layer(s))`;
            }
            else {
                // diff < 0: backward import
                violationDescription =
                    `Backward import: ${sourceZone} -> ${targetZone} ` +
                        `(${edge.v} imports ${edge.w}, violating layer ordering)`;
            }
            risks.push({
                type: 'boundary_violation',
                severity: 'warning',
                nodeId: edge.v,
                affectedNodeIds: [edge.v, edge.w],
                details: violationDescription,
            });
        }
    }
    /**
     * Checks nodes that may have gained new outgoing edges for excessive fan-out.
     *
     * Candidate nodes: addedNodes + modifiedNodes + source nodes of addedEdges.
     * Only internal edges (target does NOT start with __ext__/) are counted.
     * Threshold is FAN_OUT_THRESHOLD (8) — more than 8 internal deps is a warning.
     */
    detectFanOutRisks(delta, getOutEdges, risks) {
        // Collect unique candidate node IDs.
        const candidates = new Set();
        for (const nodeId of delta.addedNodes) {
            candidates.add(nodeId);
        }
        for (const nodeId of delta.modifiedNodes) {
            candidates.add(nodeId);
        }
        for (const edge of delta.addedEdges) {
            candidates.add(edge.v);
        }
        for (const nodeId of candidates) {
            const allOutEdges = getOutEdges(nodeId);
            // Count only internal edges — exclude __ext__/ targets.
            const internalOutDegree = allOutEdges.filter((e) => !e.w.startsWith('__ext__/')).length;
            if (internalOutDegree > FAN_OUT_THRESHOLD) {
                risks.push({
                    type: 'excessive_fan_out',
                    severity: 'warning',
                    nodeId,
                    details: `Excessive fan-out: ${nodeId} has ${internalOutDegree} internal ` +
                        `outgoing dependencies (threshold: ${FAN_OUT_THRESHOLD})`,
                });
            }
        }
    }
}
//# sourceMappingURL=RiskDetector.js.map