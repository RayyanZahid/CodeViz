import Fastify from 'fastify';
import { healthPlugin } from './plugins/health.js';
import { websocketPlugin } from './plugins/websocket.js';
import { snapshotPlugin } from './plugins/snapshot.js';
import { db } from './db/connection.js';
import { DependencyGraph } from './graph/DependencyGraph.js';
import { Pipeline } from './pipeline/Pipeline.js';
import { InferenceEngine } from './inference/InferenceEngine.js';

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

// Watch root — used by both InferenceEngine and Pipeline
const watchRoot = process.env.ARCHLENS_WATCH_ROOT ?? process.cwd();

// Initialize inference engine — subscribes to graph delta events
const inferenceEngine = new InferenceEngine(graph, watchRoot);
inferenceEngine.loadPersistedZones();

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

// Register WebSocket streaming plugin (must come after graph + inferenceEngine init)
fastify.register(websocketPlugin, { graph, inferenceEngine });

// Register snapshot REST endpoint for reconnect recovery
fastify.register(snapshotPlugin, { graph });

// Start pipeline — watches for file changes, parses, feeds into graph
const pipeline = new Pipeline(
  watchRoot,
  (batch) => graph.onParseResult(batch),
);

// Graceful cleanup on server close — must be registered before listen()
fastify.addHook('onClose', async () => {
  inferenceEngine.destroy();
  await pipeline.stop();
});

const start = async () => {
  try {
    await pipeline.start();
    console.log(`[ArchLens] Watching ${watchRoot} for changes`);

    await fastify.listen({ port: 3100, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
