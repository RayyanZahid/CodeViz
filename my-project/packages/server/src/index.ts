import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { healthPlugin } from './plugins/health.js';
import { websocketPlugin, broadcast, translateInferenceToComponentIds } from './plugins/websocket.js';
import { snapshotPlugin } from './plugins/snapshot.js';
import { watchRootPlugin } from './plugins/watchRoot.js';
import { db } from './db/connection.js';
import { graphNodes, graphEdges } from './db/schema.js';
import { DependencyGraph } from './graph/DependencyGraph.js';
import { ComponentAggregator } from './graph/ComponentAggregator.js';
import { Pipeline } from './pipeline/Pipeline.js';
import { InferenceEngine } from './inference/InferenceEngine.js';
import { SnapshotManager } from './snapshot/SnapshotManager.js';
import { IntentAnalyzer } from './snapshot/IntentAnalyzer.js';
import { timelinePlugin } from './plugins/timeline.js';
import type { InferenceMessage, InferenceResult } from '@archlens/shared/types';

// Reference db to trigger connection initialization and WAL mode setup
void db;

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

fastify.register(healthPlugin);

// Initialize dependency graph and load prior state from SQLite
const graph = new DependencyGraph();
graph.loadFromDatabase();

// Watch root — mutable so POST /api/watch can switch it at runtime
let currentWatchRoot = process.env.ARCHLENS_WATCH_ROOT ?? process.cwd();

// Initialize component aggregator for directory-level grouping (stable reference)
const aggregator = new ComponentAggregator(graph);

// Initialize inference engine — subscribes to graph delta events
let inferenceEngine = new InferenceEngine(graph, currentWatchRoot);
inferenceEngine.loadPersistedZones();

// Initialize snapshot manager — subscribes to graph delta events for threshold-based snapshots
let snapshotManager = new SnapshotManager(graph, randomUUID(), currentWatchRoot);
console.log(`[ArchLens] Snapshot manager initialized (session: ${snapshotManager.getSessionId().slice(0, 8)}...)`);

// Initialize intent analyzer — subscribes to graph delta events for intent classification
let intentAnalyzer = new IntentAnalyzer(graph, snapshotManager.getSessionId(), currentWatchRoot);
console.log(`[ArchLens] Intent analyzer initialized`);

// ---------------------------------------------------------------------------
// Inference broadcast helper — wired on startup and re-wired on watch switch
// ---------------------------------------------------------------------------

/**
 * Subscribes to an InferenceEngine's 'inference' event and broadcasts the
 * translated result to all connected WebSocket clients.
 *
 * Extracted as a named function so it can be re-registered when the
 * inferenceEngine is replaced during a watch-root switch.
 */
function wireInferenceBroadcast(engine: InferenceEngine): void {
  engine.on('inference', (result: InferenceResult) => {
    const fileToComp = aggregator.getFileToComponentMap();
    const translated = translateInferenceToComponentIds(result, fileToComp);

    if (!translated) {
      return;
    }

    const message: InferenceMessage = {
      type: 'inference',
      version: translated.graphVersion,
      zoneUpdates: translated.zoneUpdates,
      architecturalEvents: translated.architecturalEvents,
      risks: translated.risks,
    };

    broadcast(message);
  });
}

wireInferenceBroadcast(inferenceEngine);

// Log delta events for visibility
graph.on('delta', (delta) => {
  console.log(
    `[Graph] Delta v${delta.version}: +${delta.addedNodes.length} nodes, -${delta.removedNodeIds.length} nodes, ~${delta.modifiedNodes.length} modified, +${delta.addedEdges.length} edges, -${delta.removedEdgeIds.length} edges`,
  );
  if (delta.cyclesAdded.length > 0) {
    console.log(`[Graph] Cycles detected: ${delta.cyclesAdded.length} new`);
  }
});

// Log inference results for visibility
inferenceEngine.on('inference', (result) => {
  const parts: string[] = [];
  if (result.zoneUpdates.length > 0) parts.push(`${result.zoneUpdates.length} zone updates`);
  if (result.architecturalEvents.length > 0) parts.push(`${result.architecturalEvents.length} arch events`);
  if (result.risks.length > 0) parts.push(`${result.risks.length} risks`);
  console.log(`[Inference] v${result.graphVersion}: ${parts.join(', ')}`);
});

// Register WebSocket streaming plugin (must come after graph + aggregator init)
fastify.register(websocketPlugin, { graph, aggregator });

// Register snapshot REST endpoint for reconnect recovery
fastify.register(snapshotPlugin, { graph, aggregator });

// Register timeline REST endpoints for replay data
fastify.register(timelinePlugin, {
  getSessionId: () => snapshotManager.getSessionId(),
});

// Start pipeline — watches for file changes, parses, feeds into graph
let pipeline = new Pipeline(
  currentWatchRoot,
  (batch) => graph.onParseResult(batch),
);

// ---------------------------------------------------------------------------
// Watch root switch — full reset sequence for runtime directory switching
// ---------------------------------------------------------------------------

/**
 * Stops the current pipeline, destroys the current inference engine, resets
 * all in-memory and SQLite graph state, and starts fresh on the new directory.
 *
 * Called by POST /api/watch after validating the new directory path.
 */
async function switchWatchRoot(newDir: string): Promise<void> {
  // 1. Stop current pipeline (stops chokidar watcher)
  await pipeline.stop();

  // 2. Destroy current inference engine (removes graph delta listener + stops ConfigLoader)
  inferenceEngine.destroy();

  // 2b. Destroy current snapshot manager (clears timer, removes graph delta listener)
  snapshotManager.destroy();

  // 2c. Destroy current intent analyzer (closes active session, removes graph delta listener)
  intentAnalyzer.destroy();

  // 3. Clear in-memory graph state
  graph.reset();

  // 4. Purge SQLite graph tables — edges first due to FK constraint
  db.delete(graphEdges).run();
  db.delete(graphNodes).run();

  // 5. Clear aggregator snapshot/map caches
  aggregator.resetCache();

  // 6. Broadcast watch_root_changed to all connected WebSocket clients
  broadcast({ type: 'watch_root_changed', directory: newDir });

  // 7. Update current watch root
  currentWatchRoot = newDir;

  // 8. Create new InferenceEngine for the new directory
  inferenceEngine = new InferenceEngine(graph, newDir);
  inferenceEngine.loadPersistedZones();

  // 9. Wire inference broadcast on the new engine
  wireInferenceBroadcast(inferenceEngine);

  // 8b. Create new SnapshotManager for the new directory
  snapshotManager = new SnapshotManager(graph, randomUUID(), newDir);
  console.log(`[ArchLens] Snapshot manager initialized (session: ${snapshotManager.getSessionId().slice(0, 8)}...)`);

  // 8c. Create new IntentAnalyzer for the new session
  intentAnalyzer = new IntentAnalyzer(graph, snapshotManager.getSessionId(), newDir);
  console.log(`[ArchLens] Intent analyzer initialized`);

  // 10. Create and start new Pipeline on the new directory
  pipeline = new Pipeline(newDir, (batch) => graph.onParseResult(batch));
  await pipeline.start();

  // 10b. Capture initial snapshot after new scan completes
  setTimeout(() => {
    snapshotManager.captureInitialSnapshot();
  }, 2000);

  console.log(`[ArchLens] Switched to watching ${newDir}`);
}

// Register watch root REST endpoints
fastify.register(watchRootPlugin, {
  getWatchRoot: () => currentWatchRoot,
  setWatchRoot: switchWatchRoot,
});

// Graceful cleanup on server close — must be registered before listen()
fastify.addHook('onClose', async () => {
  intentAnalyzer.destroy();
  snapshotManager.destroy();
  inferenceEngine.destroy();
  await pipeline.stop();
});

const start = async () => {
  try {
    await pipeline.start();
    console.log(`[ArchLens] Watching ${currentWatchRoot} for changes`);

    // Capture initial snapshot after first scan populates the graph.
    // 2-second delay lets scan deltas flush through DependencyGraph's 50ms consolidation window.
    setTimeout(() => {
      snapshotManager.captureInitialSnapshot();
    }, 2000);

    await fastify.listen({ port: 3100, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
