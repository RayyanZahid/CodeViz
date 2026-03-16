import { create } from 'zustand';
import type { ArchitecturalEvent, RiskSignal } from '@archlens/shared/types';
import type { InferenceMessage } from '@archlens/shared/types';
import { graphStore } from './graphStore.js';
import { toSentence } from '../utils/eventSentence.js';

// ---------------------------------------------------------------------------
// ActivityItem — a single entry in the activity feed
// ---------------------------------------------------------------------------

export interface ActivityItem {
  /** `${timestamp}-${event.nodeId}` */
  id: string;
  event: ArchitecturalEvent;
  /** Pre-computed natural-language sentence via toSentence() */
  sentence: string;
  timestamp: number;
  /** #22c55e green = creation, #f97316 orange = risk, #3b82f6 blue = dependency change */
  iconColor: string;
}

// ---------------------------------------------------------------------------
// RiskItem — a risk signal with review state
// ---------------------------------------------------------------------------

export interface RiskItem {
  /** Fingerprint: `${signal.type}:${sortedAffectedNodeIds.join(',')}` */
  id: string;
  signal: RiskSignal;
  firstSeen: number;
  reviewed: boolean;
}

// ---------------------------------------------------------------------------
// InferenceStore interface
// ---------------------------------------------------------------------------

export interface InferenceStore {
  /** Newest-first activity feed, capped at 50 items */
  activityFeed: ActivityItem[];
  /** Risk signals keyed by fingerprint */
  risks: Map<string, RiskItem>;
  /** nodeId → timestamp of last activity (for 30-second decay tracking) */
  activeNodeIds: Map<string, number>;

  /** Main entry point called by wsClient on each inference message */
  applyInference: (msg: InferenceMessage) => void;
  /** Mark a risk as reviewed by its fingerprint ID */
  markRiskReviewed: (riskId: string) => void;
  /** Remove activeNodeIds entries older than 30 seconds. Call from setInterval. */
  pruneExpiredActive: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Computes a stable fingerprint for a risk signal */
function riskFingerprint(signal: RiskSignal): string {
  if (signal.affectedNodeIds && signal.affectedNodeIds.length > 0) {
    return `${signal.type}:${[...signal.affectedNodeIds].sort().join(',')}`;
  }
  return `${signal.type}:${signal.nodeId}`;
}

/** Maps an event type to an icon color */
function iconColorForEvent(type: string): string {
  switch (type) {
    case 'component_created':
      return '#22c55e'; // green

    case 'dependency_added':
    case 'dependency_removed':
      return '#3b82f6'; // blue

    case 'component_split':
    case 'component_merged':
      return '#3b82f6'; // blue

    default:
      return '#94a3b8'; // gray
  }
}

// ---------------------------------------------------------------------------
// Store implementation — double-paren pattern for TypeScript middleware compat
// (mirrors graphStore.ts pattern exactly)
// ---------------------------------------------------------------------------

export const useInferenceStore = create<InferenceStore>()((set, get) => ({
  activityFeed: [],
  risks: new Map<string, RiskItem>(),
  activeNodeIds: new Map<string, number>(),

  applyInference: (msg: InferenceMessage) => {
    const now = Date.now();
    const nodes = graphStore.getState().nodes;

    // nodeNameFn — resolves node ID to display name using current graphStore state
    const nodeNameFn = (id: string): string => nodes.get(id)?.name ?? id;

    // ------------------------------------------------------------------
    // 1. Process architectural events → new ActivityItems
    // ------------------------------------------------------------------

    const newItems: ActivityItem[] = [];

    for (const event of msg.architecturalEvents) {
      const sentence = toSentence(event, nodeNameFn);
      const iconColor = iconColorForEvent(event.type);

      newItems.push({
        id: `${event.timestamp}-${event.nodeId}`,
        event,
        sentence,
        timestamp: event.timestamp,
        iconColor,
      });
    }

    // ------------------------------------------------------------------
    // 2. Merge with existing feed (prepend new items, cap at 50)
    //
    // Post-hoc batching: if the last existing feed item refers to the same
    // nodeId as a new item and occurred < 2 seconds ago, replace with a
    // summary sentence "N events for ${name}".
    // ------------------------------------------------------------------

    let updatedFeed = [...get().activityFeed];

    for (const newItem of newItems) {
      if (updatedFeed.length > 0) {
        const last = updatedFeed[0]; // newest first
        const sameNode = last.event.nodeId === newItem.event.nodeId;
        const withinWindow = now - last.timestamp < 2000;

        if (sameNode && withinWindow) {
          // Count how many items for this node are already summarized
          const summaryMatch = last.sentence.match(/^(\d+) events for /);
          const currentCount = summaryMatch ? parseInt(summaryMatch[1], 10) : 1;
          const totalCount = currentCount + 1;
          const name = nodeNameFn(newItem.event.nodeId);

          updatedFeed[0] = {
            ...last,
            sentence: `${totalCount} events for ${name}`,
            timestamp: now,
          };
          continue;
        }
      }

      updatedFeed.unshift(newItem);
    }

    // Cap to 50 items (auto-prune oldest)
    updatedFeed = updatedFeed.slice(0, 50);

    // ------------------------------------------------------------------
    // 3. Process risks — fingerprint-based deduplication
    // ------------------------------------------------------------------

    const newRisks = new Map<string, RiskItem>(get().risks);

    // Build set of current fingerprints from incoming message
    const incomingFingerprints = new Set<string>();

    for (const signal of msg.risks) {
      const fp = riskFingerprint(signal);
      incomingFingerprints.add(fp);

      const existing = newRisks.get(fp);
      if (existing) {
        // Preserve reviewed state if previously reviewed
        newRisks.set(fp, {
          ...existing,
          signal,
        });
      } else {
        newRisks.set(fp, {
          id: fp,
          signal,
          firstSeen: now,
          reviewed: false,
        });
      }
    }

    // Remove resolved risks (fingerprints not in current inference result)
    for (const [fp] of newRisks) {
      if (!incomingFingerprints.has(fp)) {
        newRisks.delete(fp);
      }
    }

    // ------------------------------------------------------------------
    // 4. Update activeNodeIds — architectural event nodes + zone update nodes
    // ------------------------------------------------------------------

    const newActiveNodeIds = new Map<string, number>(get().activeNodeIds);

    for (const event of msg.architecturalEvents) {
      newActiveNodeIds.set(event.nodeId, now);
      if (event.targetNodeId) {
        newActiveNodeIds.set(event.targetNodeId, now);
      }
    }

    for (const zoneUpdate of msg.zoneUpdates) {
      newActiveNodeIds.set(zoneUpdate.nodeId, now);
    }

    // ------------------------------------------------------------------
    // 4b. Apply zone updates to graphStore nodes so the canvas layout
    //     engine can place nodes into the correct zone columns.
    //     Without this, all nodes stay zone=null and pile into 'external'.
    // ------------------------------------------------------------------
    if (msg.zoneUpdates.length > 0) {
      const graphState = graphStore.getState();
      const updatedNodes = new Map(graphState.nodes);
      let changed = false;
      for (const zu of msg.zoneUpdates) {
        const existing = updatedNodes.get(zu.nodeId);
        if (existing && existing.zone !== zu.zone) {
          updatedNodes.set(zu.nodeId, { ...existing, zone: zu.zone });
          changed = true;
        }
      }
      if (changed) {
        graphStore.setState({ nodes: updatedNodes });
      }
    }

    // ------------------------------------------------------------------
    // 5. Commit all updates
    // ------------------------------------------------------------------

    set({
      activityFeed: updatedFeed,
      risks: newRisks,
      activeNodeIds: newActiveNodeIds,
    });
  },

  markRiskReviewed: (riskId: string) => {
    const newRisks = new Map<string, RiskItem>(get().risks);
    const existing = newRisks.get(riskId);
    if (existing) {
      newRisks.set(riskId, { ...existing, reviewed: true });
    }
    set({ risks: newRisks });
  },

  pruneExpiredActive: () => {
    const DECAY_MS = 30_000;
    const now = Date.now();
    const current = get().activeNodeIds;

    const newActiveNodeIds = new Map<string, number>();
    for (const [nodeId, timestamp] of current) {
      if (now - timestamp < DECAY_MS) {
        newActiveNodeIds.set(nodeId, timestamp);
      }
    }

    set({ activeNodeIds: newActiveNodeIds });
  },
}));

// ---------------------------------------------------------------------------
// Vanilla reference for wsClient (same pattern as graphStore.ts)
// ---------------------------------------------------------------------------

export const inferenceStore = useInferenceStore;
