import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface WatchRootPluginOptions {
  /** Returns the current watched directory path. */
  getWatchRoot: () => string;
  /** Performs the full reset sequence and starts watching the new directory. */
  setWatchRoot: (dir: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// watchRoot plugin — GET /api/watch and POST /api/watch
// ---------------------------------------------------------------------------

/**
 * Fastify plugin that exposes REST endpoints for reading and switching the
 * watched project directory at runtime.
 *
 * GET  /api/watch — returns the current watched directory.
 * POST /api/watch — validates the new directory and triggers the full reset
 *   sequence (graph clear, SQLite purge, aggregator reset, new pipeline start).
 */
export const watchRootPlugin: FastifyPluginAsync<WatchRootPluginOptions> = async (
  fastify,
  { getWatchRoot, setWatchRoot },
) => {
  // GET /api/watch — return current watched directory
  fastify.get('/api/watch', async (_req, reply) => {
    return reply.send({ directory: getWatchRoot() });
  });

  // POST /api/watch — switch to a new watched directory
  fastify.post('/api/watch', async (req, reply) => {
    const body = req.body as { directory?: unknown };

    // Validate that directory is a non-empty string
    if (!body?.directory || typeof body.directory !== 'string' || body.directory.trim() === '') {
      return reply.status(400).send({ error: 'directory is required' });
    }

    const rawDir = body.directory.trim();

    // Check that the path exists and is readable
    try {
      await fs.access(rawDir, fs.constants.R_OK);
    } catch {
      return reply.status(400).send({
        error: `Directory does not exist or is not readable: ${rawDir}`,
      });
    }

    // Check that the path is actually a directory (not a file)
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(rawDir);
    } catch {
      return reply.status(400).send({
        error: `Directory does not exist or is not readable: ${rawDir}`,
      });
    }

    if (!stat.isDirectory()) {
      return reply.status(400).send({ error: `Path is not a directory: ${rawDir}` });
    }

    // Resolve to absolute path
    const resolvedPath = path.resolve(rawDir);

    // Trigger the full reset sequence
    await setWatchRoot(resolvedPath);

    return reply.send({ directory: resolvedPath });
  });
};
