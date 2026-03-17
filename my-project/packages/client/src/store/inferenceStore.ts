import { create } from 'zustand';
import type { ArchitecturalEvent, RiskSignal } from '@archlens/shared/types';
import type { InferenceMessage, GraphDeltaMessage } from '@archlens/shared/types';
import { graphStore } from './graphStore.js';
import { toSentence, deltaToSentence, riskToSentence } from '../utils/eventSentence.js';

// ---------------------------------------------------------------------------
// ActivityItem — a single entry in the activity feed
// ---------------------------------------------------------------------------

export interface ActivityItem {
  /** `${timestamp}-${nodeId}` */
  id: string;
  /** The architectural event that generated this item — optional for delta/risk entries */
  event?: ArchitecturalEvent;
  /** nodeId for batching deduplication — set from event.nodeId, delta nodeId, or risk nodeId */
  nodeId: string;
  /** Pre-computed natural-language sentence via toSentence() / deltaToSentence() / riskToSentence() */
  sentence: string;
  timestamp: number;
  /** #22c55e green = creation, #f97316 orange = risk, #3b82f6 blue = dependency change, #94a3b8 gray = file modification */
  iconColor: string;
  /** True for separator items inserted into the activity feed on replay exit */
  isReplaySeparator?: boolean;
  /** Total event count that occurred during replay — shown in separator text */
  replayEventCount?: number;
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
  /** Called by wsClient on each graph_delta message for feed sentence generation */
  applyGraphDelta: (msg: GraphDeltaMessage) => void;
  /** Mark a risk as reviewed by its fingerprint ID */
  markRiskReviewed: (riskId: string) => void;
  /** Remove activeNodeIds entries older than 30 seconds. Call from setInterval. */
  pruneExpiredActive: () => void;
  /** Reset all inference state on watch-root switch — called by WsClient on watch_root_changed. */
  resetState: () => void;
  /** Insert a replay separator item into the activity feed with the total buffered event count. */
  insertReplaySeparator: (totalCount: number) => void;
}

// ---------------------------------------------------------------------------
// localStorage helpers for reviewed risk persistence
// ---------------------------------------------------------------------------

const REVIEWED_RISKS_KEY = 'archlens-reviewed-risks';

/** Read reviewed fingerprints from localStorage. Returns empty Set on failure. */
function loadReviewedRisks(): Set<string> {
  try {
    const raw = localStorage.getItem(REVIEWED_RISKS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set<string>(parsed as string[]);
  } catch {
    return new Set();
  }
}

/** Persist all fingerprints marked reviewed=true to localStorage. */
function saveReviewedRisks(risks: Map<string, RiskItem>): void {
  const reviewed: string[] = [];
  for (const [fp, item] of risks) {
    if (item.reviewed) reviewed.push(fp);
  }
  localStorage.setItem(REVIEWED_RISKS_KEY, JSON.stringify(reviewed));
}

// Module-level set — initialized once from localStorage on store creation.
// Avoids reading localStorage on every applyInference call.
let persistedReviewedIds: Set<string> = loadReviewedRisks();

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
// Internal batch helper — prepends a new item to the feed, applying 2s
// same-nodeId batching. Mutates feedArray in place and returns it.
// ---------------------------------------------------------------------------

function batchPrependItem(
  feedArray: ActivityItem[],
  newItem: ActivityItem,
  now: number,
  nodeNameFn: (id: string) => string,
): ActivityItem[] {
  if (feedArray.length > 0) {
    const last = feedArray[0]; // newest first
    const sameNode = last.nodeId === newItem.nodeId;
    const withinWindow = now - last.timestamp < 2000;

    if (sameNode && withinWindow) {
      // Count how many items for this node are already summarized
      const summaryMatch = last.sentence.match(/^(\d+) events for /);
      const currentCount = summaryMatch ? parseInt(summaryMatch[1], 10) : 1;
      const totalCount = currentCount + 1;
      const name = nodeNameFn(newItem.nodeId);

      feedArray[0] = {
        ...last,
        sentence: `${totalCount} events for ${name}`,
        timestamp: now,
      };
      return feedArray;
    }
  }

  feedArray.unshift(newItem);
  return feedArray;
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
        nodeId: event.nodeId,
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
      batchPrependItem(updatedFeed, newItem, now, nodeNameFn);
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
        // Resurface logic: if risk was reviewed, check if signal has changed.
        // Changed = different nodeId or different sorted affectedNodeIds.
        if (existing.reviewed) {
          const existingAffected = existing.signal.affectedNodeIds
            ? [...existing.signal.affectedNodeIds].sort().join(',')
            : '';
          const incomingAffected = signal.affectedNodeIds
            ? [...signal.affectedNodeIds].sort().join(',')
            : '';
          const nodeChanged = existing.signal.nodeId !== signal.nodeId;
          const affectedChanged = existingAffected !== incomingAffected;

          if (nodeChanged || affectedChanged) {
            // Risk has changed — resurface as active
            newRisks.set(fp, {
              ...existing,
              signal,
              reviewed: false,
            });
            // Remove from persisted set and save
            persistedReviewedIds.delete(fp);
            // Will call saveReviewedRisks after all risks are processed
          } else {
            // Same signal data — keep reviewed state
            newRisks.set(fp, {
              ...existing,
              signal,
            });
          }
        } else {
          // Not reviewed — update signal, preserve other state
          newRisks.set(fp, {
            ...existing,
            signal,
          });
        }
      } else {
        // New risk — check if previously reviewed (hydrate from localStorage)
        const wasReviewed = persistedReviewedIds.has(fp);
        newRisks.set(fp, {
          id: fp,
          signal,
          firstSeen: now,
          reviewed: wasReviewed,
        });
      }
    }

    // Remove resolved risks (fingerprints not in current inference result)
    for (const [fp] of newRisks) {
      if (!incomingFingerprints.has(fp)) {
        newRisks.delete(fp);
      }
    }

    // Persist any resurface changes (reviewed→false) that occurred above
    saveReviewedRisks(newRisks);

    // ------------------------------------------------------------------
    // 3b. Create feed entries for NEWLY detected risks (orange dot)
    //     Only first detection — fingerprint dedup prevents duplicates.
    // ------------------------------------------------------------------

    const existingRisks = get().risks;

    for (const signal of msg.risks) {
      const fp = riskFingerprint(signal);

      // Only add a feed entry if this fingerprint was NOT already in the store
      // (i.e., genuinely new detection — not an update to an existing risk)
      if (!existingRisks.has(fp)) {
        const sentence = riskToSentence(signal, nodeNameFn);
        const riskItem: ActivityItem = {
          id: `risk-${now}-${fp}`,
          nodeId: signal.nodeId,
          sentence,
          iconColor: '#f97316', // orange
          timestamp: now,
        };
        // Risk entries don't batch with architectural events — prepend directly
        updatedFeed.unshift(riskItem);
      }
    }

    // Re-cap after risk items added
    updatedFeed = updatedFeed.slice(0, 50);

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

  applyGraphDelta: (msg: GraphDeltaMessage) => {
    const now = Date.now();
    const nodes = graphStore.getState().nodes;

    // nodeNameFn — resolves node ID to display name using current graphStore state
    const nodeNameFn = (id: string): string => nodes.get(id)?.name ?? id;

    // Convert delta arrays to sentence items
    const sentenceItems = deltaToSentence(
      msg.addedNodes,
      msg.removedNodeIds,
      msg.updatedNodes,
      msg.addedEdges,
      msg.removedEdgeIds,
      nodeNameFn,
    );

    if (sentenceItems.length === 0) return;

    let updatedFeed = [...get().activityFeed];
    const newActiveNodeIds = new Map<string, number>(get().activeNodeIds);

    for (const item of sentenceItems) {
      const activityItem: ActivityItem = {
        id: `delta-${now}-${item.nodeId}`,
        nodeId: item.nodeId,
        sentence: item.sentence,
        iconColor: item.iconColor,
        timestamp: now,
      };

      // Apply 2s batching: same nodeId within window → summarize
      batchPrependItem(updatedFeed, activityItem, now, nodeNameFn);

      // Update activeNodeIds so glow animations fire
      newActiveNodeIds.set(item.nodeId, now);
    }

    // Cap at 50 items
    updatedFeed = updatedFeed.slice(0, 50);

    set({ activityFeed: updatedFeed, activeNodeIds: newActiveNodeIds });
  },

  markRiskReviewed: (riskId: string) => {
    const newRisks = new Map<string, RiskItem>(get().risks);
    const existing = newRisks.get(riskId);
    if (existing) {
      newRisks.set(riskId, { ...existing, reviewed: true });
    }
    set({ risks: newRisks });
    // Persist reviewed state to localStorage
    saveReviewedRisks(newRisks);
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

  resetState: () => {
    set({
      activityFeed: [],
      risks: new Map<string, RiskItem>(),
      activeNodeIds: new Map<string, number>(),
    });
  },

  insertReplaySeparator: (totalCount: number) => {
    const now = Date.now();
    const separator: ActivityItem = {
      id: `replay-sep-${now}`,
      nodeId: '',
      sentence: `${totalCount} event${totalCount !== 1 ? 's' : ''} during replay`,
      iconColor: '#eab308', // amber — matches replay banner theme
      timestamp: now,
      isReplaySeparator: true,
      replayEventCount: totalCount,
    };
    const updatedFeed = [separator, ...get().activityFeed].slice(0, 50);
    set({ activityFeed: updatedFeed });
  },
}));

// ---------------------------------------------------------------------------
// Vanilla reference for wsClient (same pattern as graphStore.ts)
// ---------------------------------------------------------------------------

export const inferenceStore = useInferenceStore;
