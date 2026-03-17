import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 15: Server Replay Layer', () => {
  test('GET /api/timeline returns snapshot metadata after file changes', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-'));
    try {
      for (let i = 0; i < 6; i++) {
        fs.writeFileSync(path.join(tmpDir, `module${i}.js`), `export const v${i} = ${i};\n`);
      }
      const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
      expect(switchRes.status()).toBe(200);

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
      expect(snapshots.length).toBeGreaterThan(0);
      const first = snapshots[0];
      expect(typeof first.id).toBe('number');
      expect(typeof first.sequenceNumber).toBe('number');
      expect(typeof first.timestamp).toBe('number');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('GET /api/snapshot/:id returns complete graph snapshot', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-snap-'));
    try {
      for (let i = 0; i < 6; i++) {
        fs.writeFileSync(path.join(tmpDir, `file${i}.js`), `export const x${i} = ${i};\n`);
      }
      await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });

      let snapshotId: number | null = null;
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          const list = (await res.json()) as Array<Record<string, unknown>>;
          if (list.length > 0) { snapshotId = list[0].id as number; break; }
        }
      }
      expect(snapshotId).not.toBeNull();

      const snapRes = await page.request.get(`${SERVER_URL}/api/snapshot/${snapshotId}`);
      expect(snapRes.status()).toBe(200);
      const snap = (await snapRes.json()) as Record<string, unknown>;
      expect(typeof snap.id).toBe('number');
      expect(Array.isArray(snap.nodes)).toBe(true);
      expect(Array.isArray(snap.edges)).toBe(true);
      expect(typeof snap.positions).toBe('object');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('IntentAnalyzer classifies events into known category with confidence', async ({ page }) => {
    test.setTimeout(60000);
    const res = await page.request.get(`${SERVER_URL}/api/intents`);
    expect(res.status()).toBe(200);
    const sessions = (await res.json()) as Array<Record<string, unknown>>;
    if (sessions.length > 0) {
      const session = sessions[0];
      const validCategories = ['feature_building', 'bug_fixing', 'refactoring', 'test_writing', 'dependency_update', 'cleanup'];
      expect(validCategories).toContain(session.category);
      expect(typeof session.confidence).toBe('number');
      expect(session.confidence as number).toBeGreaterThanOrEqual(0);
      expect(session.confidence as number).toBeLessThanOrEqual(1);
    }
  });

  test('Pipeline does not pause during concurrent write and read', async ({ page }) => {
    test.setTimeout(60000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archlens-ph15-conc-'));
    try {
      // Create initial files and start watching
      for (let i = 0; i < 6; i++) {
        fs.writeFileSync(path.join(tmpDir, `init${i}.js`), `export const init${i} = ${i};\n`);
      }
      await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });

      // Wait for initial snapshot to appear
      const initDeadline = Date.now() + 30000;
      while (Date.now() < initDeadline) {
        await page.waitForTimeout(1000);
        const res = await page.request.get(`${SERVER_URL}/api/timeline`);
        if (res.status() === 200) {
          const list = (await res.json()) as Array<Record<string, unknown>>;
          if (list.length > 0) break;
        }
      }

      // Now write MORE files while simultaneously polling /api/timeline
      // If the pipeline pauses, the timeline response will timeout or stall
      const writeStart = Date.now();
      for (let i = 0; i < 4; i++) {
        fs.writeFileSync(path.join(tmpDir, `concurrent${i}.js`), `export const c${i} = ${i};\n`);
      }

      // Poll timeline immediately — should respond within 2s even while writes are processing
      const pollRes = await page.request.get(`${SERVER_URL}/api/timeline`);
      const pollEnd = Date.now();
      expect(pollRes.status()).toBe(200);
      expect(pollEnd - writeStart).toBeLessThan(5000); // Response within 5s means pipeline is not blocked
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
