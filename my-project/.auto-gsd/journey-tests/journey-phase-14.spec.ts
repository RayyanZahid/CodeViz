import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 14: Schema Foundation and Shared Types', () => {
  test('graph_snapshots table exists with graphJson positions, CRUD succeeds', async ({ page }) => {
    const response = await page.request.get(`${SERVER_URL}/api/debug/graph-snapshots-table`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.crud.insert).toBe(true);
    expect(body.crud.read).toBe(true);
    expect(body.crud.delete).toBe(true);
    expect(body.positionsStoredInGraphJson).toBe(true);
  });

  test('intent_sessions table exists, row can be written and read back', async ({ page }) => {
    const response = await page.request.get(`${SERVER_URL}/api/debug/intent-sessions-table`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.crud.insert).toBe(true);
    expect(body.crud.read).toBe(true);
    expect(body.crud.delete).toBe(true);
  });

  test('shared types compile — server running proves TypeScript compilation across all packages', async ({ page }) => {
    const response = await page.request.get(`${SERVER_URL}/api/debug/shared-types`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test('snapshot writes triggered only at delta threshold, not every event', async ({ page }) => {
    test.setTimeout(60000);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-diag-'));

    try {
      // Write 7 valid JS files to the temp dir to trigger graph delta events
      const FILE_COUNT = 7;
      for (let i = 0; i < FILE_COUNT; i++) {
        fs.writeFileSync(
          path.join(tmpDir, `module${i}.js`),
          `export const value${i} = ${i};\nexport function fn${i}() { return ${i}; }\n`,
        );
      }

      // Switch the watcher to the temp directory
      const switchResponse = await page.request.post(`${SERVER_URL}/api/watch`, {
        data: { directory: tmpDir },
      });
      expect(switchResponse.status()).toBe(200);

      // Poll /api/timeline until at least 1 snapshot appears (up to 30s)
      // SnapshotManager debounces 3s after last delta; pipeline scan ~1-2s
      let snapshots: unknown[] = [];
      const maxWaitMs = 30000;
      const pollIntervalMs = 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await page.waitForTimeout(pollIntervalMs);
        const timelineRes = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (timelineRes.status() === 200) {
          snapshots = await timelineRes.json();
          if (snapshots.length > 0) break;
        }
      }

      // Assert threshold behavior: fewer snapshots than file writes
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots.length).toBeLessThan(FILE_COUNT);
    } finally {
      // Clean up temp dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
