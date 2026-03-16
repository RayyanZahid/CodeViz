import { ServerMessageSchema } from '../schemas/serverMessages.js';
import { graphStore } from '../store/graphStore.js';
import { inferenceStore } from '../store/inferenceStore.js';
import type { GraphDeltaMessage, InitialStateMessage, InferenceMessage } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_MS = 500;
const MAX_MS = 30_000;
const BATCH_WINDOW_MS = 500;

// ---------------------------------------------------------------------------
// WsClient — hand-rolled WebSocket manager with exponential backoff reconnect,
// 500ms batch window for delta application, and version gap detection.
//
// IMPORTANT: Initialize as a module-level singleton in main.ts, NOT inside
// a React component (avoids double-connection from StrictMode double-invoke).
// ---------------------------------------------------------------------------

export class WsClient {
  private ws: WebSocket | null = null;
  private attempt: number = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDeltas: GraphDeltaMessage[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tracks version of the last queued/applied delta (NOT store version).
   * Used for gap detection with buffered deltas — see RESEARCH.md Pitfall 3. */
  private lastQueuedVersion: number = 0;
  /** Store version before disconnect — used to compute change summary on reconnect. */
  private previousVersion: number = 0;

  constructor() {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return; // Already connecting or connected
    }

    graphStore.getState().setConnectionStatus('connecting');

    try {
      this.ws = new WebSocket('/ws');
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      // Reset backoff counter on successful connection
      this.attempt = 0;

      // Clear any pending retry timer
      if (this.retryTimer !== null) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      graphStore.getState().setConnectionStatus('connected');

      // Reset lastQueuedVersion to current store version so gap detection
      // starts from the correct baseline after reconnect
      this.lastQueuedVersion = graphStore.getState().version;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      graphStore.getState().setConnectionStatus('disconnected');

      // Save current version before reconnect — used for change summary calculation
      this.previousVersion = graphStore.getState().version;

      // Cancel any pending batch timer and clear queued deltas
      if (this.batchTimer !== null) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      this.pendingDeltas = [];

      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      // Logging here would duplicate with onclose, so we no-op
    };
  }

  /** Clean up all timers and close the WebSocket. */
  destroy(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingDeltas = [];
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private: reconnect with exponential backoff + jitter
  // -------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.retryTimer !== null) {
      return; // Already scheduled
    }

    const delay = Math.min(BASE_MS * Math.pow(2, this.attempt) + Math.random() * 1000, MAX_MS);
    this.attempt++;

    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.attempt})`);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  // -------------------------------------------------------------------------
  // Private: message handling
  // -------------------------------------------------------------------------

  private handleMessage(event: MessageEvent): void {
    let raw: unknown;
    try {
      raw = JSON.parse(event.data as string);
    } catch {
      console.error('[WS] Failed to parse JSON message:', event.data);
      return;
    }

    const parsed = ServerMessageSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[WS] Invalid message:', parsed.error);
      return; // Silently drop malformed/unrecognized messages
    }

    const msg = parsed.data;

    switch (msg.type) {
      case 'initial_state': {
        // Cast to shared type — Zod schema uses relaxed string types for forward compat,
        // but the runtime values are always valid NodeType/EdgeType string literals.
        graphStore.getState().applySnapshot(msg as unknown as InitialStateMessage);
        this.lastQueuedVersion = msg.version;
        // If we were scanning after a watch root change, scanning is complete on initial_state
        if (graphStore.getState().scanning) {
          graphStore.getState().setScanning(false);
        }

        // Compute change summary if we were previously connected
        if (this.previousVersion > 0 && msg.version > this.previousVersion) {
          const state = graphStore.getState();
          graphStore.getState().setChangeSummary({
            addedNodes: state.nodes.size,
            removedNodes: 0,
            addedEdges: state.edges.size,
            removedEdges: 0,
          });
        }
        break;
      }

      case 'graph_delta': {
        // Turn off scanning indicator on first delta after watch root change
        if (graphStore.getState().scanning) {
          graphStore.getState().setScanning(false);
        }

        // Version continuity check against lastQueuedVersion (not store version)
        // Per RESEARCH.md Pitfall 3: buffered deltas not yet applied to store
        if (this.lastQueuedVersion > 0 && msg.version !== this.lastQueuedVersion + 1) {
          console.warn(`[WS] Version gap detected: expected ${this.lastQueuedVersion + 1}, got ${msg.version}. Requesting snapshot.`);
          this.triggerGapRecovery();
          return;
        }

        this.lastQueuedVersion = msg.version;
        // Cast to shared type — Zod schema uses relaxed string types for forward compat
        this.queueDelta(msg as unknown as GraphDeltaMessage);
        // Route to inferenceStore immediately (not batched) for <3s feed latency (FEED-01)
        inferenceStore.getState().applyGraphDelta(msg as unknown as GraphDeltaMessage);
        break;
      }

      case 'inference': {
        inferenceStore.getState().applyInference(msg as unknown as InferenceMessage);
        break;
      }

      case 'watch_root_changed': {
        console.log('[WS] Watch root changed to:', msg.directory);
        // 1. Clear graph state — canvas will re-render empty
        graphStore.getState().resetState();
        // 2. Clear inference state — panels will show empty
        inferenceStore.getState().resetState();
        // 3. Update watchRoot in store for UI display
        graphStore.getState().setWatchRoot(msg.directory);
        // 4. Mark as scanning — UI will show loading indicators
        graphStore.getState().setScanning(true);
        // 5. Reset version tracking — fresh scan starts from version 0
        this.lastQueuedVersion = 0;
        this.previousVersion = 0;
        // 6. Clear any pending deltas from the old project
        if (this.batchTimer !== null) {
          clearTimeout(this.batchTimer);
          this.batchTimer = null;
        }
        this.pendingDeltas = [];
        break;
      }

      case 'error': {
        // Server error — Phase 7 will add the banner UI. Log for now.
        console.warn('[WS] Server error:', msg.code, msg.message);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private: 500ms batch window
  // -------------------------------------------------------------------------

  private queueDelta(msg: GraphDeltaMessage): void {
    this.pendingDeltas.push(msg);

    if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => this.flushDeltas(), BATCH_WINDOW_MS);
    }
  }

  private flushDeltas(): void {
    this.batchTimer = null;

    const deltas = this.pendingDeltas;
    this.pendingDeltas = [];

    for (const delta of deltas) {
      graphStore.getState().applyDelta(delta);
    }
  }

  // -------------------------------------------------------------------------
  // Private: version gap recovery via REST snapshot
  // -------------------------------------------------------------------------

  private triggerGapRecovery(): void {
    // Cancel any pending batch and clear buffered deltas
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingDeltas = [];

    graphStore.getState().setConnectionStatus('syncing');
    this.requestSnapshot();
  }

  private requestSnapshot(): void {
    fetch('/api/snapshot')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Snapshot fetch failed: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        const parsed = ServerMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.error('[WS] Invalid snapshot response:', parsed.error);
          graphStore.getState().setConnectionStatus('connected');
          return;
        }

        const msg = parsed.data;
        if (msg.type !== 'initial_state') {
          console.error('[WS] Snapshot response was not initial_state, got:', msg.type);
          graphStore.getState().setConnectionStatus('connected');
          return;
        }

        // Cast to shared type — Zod schema uses relaxed string types for forward compat
        graphStore.getState().applySnapshot(msg as unknown as InitialStateMessage);
        this.lastQueuedVersion = msg.version;
        graphStore.getState().setConnectionStatus('connected');
        console.log('[WS] Snapshot recovery complete, version:', msg.version);
      })
      .catch((err) => {
        console.error('[WS] Snapshot recovery failed:', err);
        graphStore.getState().setConnectionStatus('connected'); // Degrade gracefully
      });
  }
}
