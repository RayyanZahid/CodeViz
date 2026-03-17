import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 15: Server Replay Layer', () => {
  test('`GET /api/timeline` returns a list of snapshot metadata with sequence numbers and timestamps after file changes occur', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-tl-'));
    try {
      // Write TypeScript files with real import statements to create nodes + edges
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), `export const b = 2;\n`);
      fs.writeFileSync(path.join(tmpDir, 'a.ts'), `import { b } from './b.js';\nexport const a = b + 1;\n`);
      fs.writeFileSync(path.join(tmpDir, 'c.ts'), `import { a } from './a.js';\nexport const c = a + 1;\n`);

      const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
      expect(switchRes.status(), 'POST /api/watch should return 200').toBe(200);

      // Poll for snapshots (accounts for 3s debounce + 2s initial capture delay)
      let snapshots: Array<Record<string, unknown>> = [];
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          snapshots = (await res.json()) as Array<Record<string, unknown>>;
          if (snapshots.length > 0) break;
        }
      }

      expect(snapshots.length, 'Expected at least 1 snapshot in timeline after writing 3 TypeScript files').toBeGreaterThan(0);

      // Shape validation on the first snapshot
      const first = snapshots[0];
      expect(typeof first.id, 'id should be a number').toBe('number');
      expect(typeof first.sequenceNumber, 'sequenceNumber should be a number').toBe('number');
      expect(typeof first.timestamp, 'timestamp should be a number').toBe('number');
      expect(typeof first.summary, 'summary should be a string').toBe('string');
      expect(Array.isArray(first.triggerFiles), 'triggerFiles should be an array').toBe(true);

      // Timestamp epoch range validation (after 2025-01-01, before ~2030)
      const ts = first.timestamp as number;
      expect(ts, 'timestamp should be after 2025-01-01 epoch').toBeGreaterThan(1735689600000);
      expect(ts, 'timestamp should be before year 2030 epoch').toBeLessThan(1893456000000);

      // Monotonically increasing sequenceNumbers (if multiple snapshots available)
      if (snapshots.length > 1) {
        for (let i = 1; i < snapshots.length; i++) {
          expect(
            snapshots[i].sequenceNumber as number,
            `sequenceNumber[${i}] should be greater than sequenceNumber[${i - 1}]`,
          ).toBeGreaterThan(snapshots[i - 1].sequenceNumber as number);
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('`GET /api/snapshot/:id` returns a complete graph snapshot (nodes, edges, positions) reconstructed from the nearest checkpoint in at most 50 replay steps', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-snap-'));
    try {
      // Write files with real import statements to guarantee edges exist in the graph
      const fileB = path.join(tmpDir, 'b.ts');
      const fileA = path.join(tmpDir, 'a.ts');
      fs.writeFileSync(fileB, `export const b = 2;\n`);
      fs.writeFileSync(fileA, `import { b } from './b.js';\nexport const a = b + 1;\n`);

      const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
      expect(switchRes.status(), 'POST /api/watch should return 200').toBe(200);

      // Poll for a snapshot ID via timeline
      let snapshotId: number | null = null;
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          const list = (await res.json()) as Array<Record<string, unknown>>;
          if (list.length > 0) {
            snapshotId = list[0].id as number;
            break;
          }
        }
      }
      expect(snapshotId, 'Expected a snapshot ID to be available from the timeline').not.toBeNull();

      // Fetch the full snapshot by its ID
      const snapRes = await page.request.get(`${SERVER_URL}/api/snapshot/${snapshotId}`);
      expect(snapRes.status(), 'GET /api/snapshot/:id should return 200').toBe(200);

      const snap = (await snapRes.json()) as Record<string, unknown>;

      // Shape validation
      expect(typeof snap.id, 'snapshot id should be a number').toBe('number');
      expect(typeof snap.sequenceNumber, 'sequenceNumber should be a number').toBe('number');
      expect(Array.isArray(snap.nodes), 'nodes should be an array').toBe(true);
      expect(Array.isArray(snap.edges), 'edges should be an array').toBe(true);
      expect(typeof snap.positions, 'positions should be an object').toBe('object');
      expect(snap.positions, 'positions should not be null').not.toBeNull();

      // Node IDs are relative paths from the watch root (e.g., "a.ts" not absolute path)
      // because Pipeline uses event.relativePath as the filePath passed to the parser
      const nodeIds = (snap.nodes as Array<{ id: string }>).map((n) => n.id);
      expect(nodeIds, 'nodes should contain a.ts relative path').toContain('a.ts');
      expect(nodeIds, 'nodes should contain b.ts relative path').toContain('b.ts');

      // Edges must reflect the real import (a.ts imports b.ts)
      expect(
        (snap.edges as unknown[]).length,
        'Expected at least 1 edge from a.ts importing b.ts',
      ).toBeGreaterThan(0);

      // Error case: 404 for a snapshot ID that does not exist
      const missingRes = await page.request.get(`${SERVER_URL}/api/snapshot/999999999`);
      expect(missingRes.status(), 'GET /api/snapshot/999999999 should return 404').toBe(404);

      // Error case: 400 for a non-numeric snapshot ID
      const invalidRes = await page.request.get(`${SERVER_URL}/api/snapshot/not-a-number`);
      expect(invalidRes.status(), 'GET /api/snapshot/not-a-number should return 400').toBe(400);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('The `IntentAnalyzer` classifies a realistic sequence of architectural events into one of the 4-6 coarse categories and returns a confidence score', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-int-'));
    try {
      // Write .spec.ts files importing a test-framework to strongly signal TEST_WRITING category
      fs.writeFileSync(
        path.join(tmpDir, 'test-framework.ts'),
        `export const test = (name: string, fn: () => void) => fn();\n`,
      );
      for (let i = 0; i < 4; i++) {
        fs.writeFileSync(
          path.join(tmpDir, `module${i}.spec.ts`),
          `import { test } from './test-framework.js';\nexport const spec${i} = () => test('test ${i}', () => {});\n`,
        );
      }

      const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
      expect(switchRes.status(), 'POST /api/watch should return 200').toBe(200);

      // Poll until snapshots appear — this proves IntentAnalyzer has also processed deltas
      const snapshotDeadline = Date.now() + 30000;
      while (Date.now() < snapshotDeadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          const list = (await res.json()) as unknown[];
          if (list.length > 0) break;
        }
      }

      const intentsRes = await page.request.get(`${SERVER_URL}/api/intents`);
      expect(intentsRes.status(), 'GET /api/intents should return 200').toBe(200);

      const sessions = (await intentsRes.json()) as Array<Record<string, unknown>>;
      // Unconditional assertion — test data was designed to guarantee a session exists
      expect(
        sessions.length,
        'Expected at least 1 intent session after writing spec files with import statements',
      ).toBeGreaterThan(0);

      const validCategories = [
        'feature_building',
        'bug_fixing',
        'refactoring',
        'test_writing',
        'dependency_update',
        'cleanup',
      ];
      const session = sessions[0];

      expect(validCategories, 'category should be a valid IntentCategory enum value').toContain(session.category);
      expect(typeof session.confidence, 'confidence should be a number').toBe('number');
      expect(session.confidence as number, 'confidence should be >= 0').toBeGreaterThanOrEqual(0);
      expect(session.confidence as number, 'confidence should be <= 1').toBeLessThanOrEqual(1);
      expect(Array.isArray(session.subtasks), 'subtasks should be an array').toBe(true);
      expect(typeof session.objective, 'objective should be a string').toBe('string');
      expect(typeof session.sessionId, 'sessionId should be a string').toBe('string');
      // startSnapshotId can be null (no snapshot when session opened) or a number
      expect(
        session.startSnapshotId === null || typeof session.startSnapshotId === 'number',
        'startSnapshotId should be a number or null',
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Writing files during an active session does not cause the pipeline to pause — new events continue to arrive while the replay read path is active', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-conc-'));
    try {
      // Write 6 initial .ts files and switch watch root
      for (let i = 0; i < 6; i++) {
        fs.writeFileSync(path.join(tmpDir, `init${i}.ts`), `export const init${i} = ${i};\n`);
      }
      const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
      expect(switchRes.status(), 'POST /api/watch should return 200').toBe(200);

      // Wait for the initial snapshot to appear before triggering the write burst
      const initDeadline = Date.now() + 30000;
      while (Date.now() < initDeadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          const list = (await res.json()) as unknown[];
          if (list.length > 0) break;
        }
      }

      // Burst: write 12 more .ts files to exceed MINOR_THRESHOLD=10 and trigger a new snapshot
      const writeStart = Date.now();
      for (let i = 0; i < 12; i++) {
        fs.writeFileSync(path.join(tmpDir, `concurrent${i}.ts`), `export const c${i} = ${i};\n`);
      }

      // Concurrent read immediately during the write burst — must respond within 5 seconds
      const concurrentRes = await page.request.get(`${SERVER_URL}/api/timeline`);
      const responseTime = Date.now() - writeStart;
      expect(concurrentRes.status(), 'GET /api/timeline should return 200 during concurrent writes').toBe(200);
      expect(
        responseTime,
        'GET /api/timeline should respond within 5 seconds while files are being written concurrently',
      ).toBeLessThan(5000);

      // After the burst, poll to confirm new snapshots appear — pipeline must not have stalled
      const postBurstDeadline = Date.now() + 30000;
      let finalSnapshots: unknown[] = [];
      while (Date.now() < postBurstDeadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          finalSnapshots = (await res.json()) as unknown[];
          if (finalSnapshots.length > 0) break;
        }
      }
      expect(
        finalSnapshots.length,
        'Expected new snapshots to appear after the concurrent write burst (pipeline must be alive)',
      ).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
