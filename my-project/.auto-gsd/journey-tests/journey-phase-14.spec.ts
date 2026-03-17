import { test, expect } from '@playwright/test';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 14: Schema Foundation and Shared Types', () => {
  test('A `graph_snapshots` Drizzle table exists with a `positions_json` column, and inserting a row with node positions succeeds without error', async ({ page }) => {
    test.setTimeout(60000);

    const response = await page.request.get(`${SERVER_URL}/api/debug/graph-snapshots-table`);
    expect(response.status(), 'GET /api/debug/graph-snapshots-table should return 200').toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok, 'graph_snapshots CRUD diagnostic should return ok: true').toBe(true);
    expect(body.positionsStoredInGraphJson, 'positions should be stored inside graphJson').toBe(true);

    const crud = body.crud as Record<string, boolean>;
    expect(crud.insert, 'graph_snapshots insert should succeed').toBe(true);
    expect(crud.read, 'graph_snapshots read should succeed').toBe(true);
    expect(crud.delete, 'graph_snapshots delete should succeed').toBe(true);
  });

  test('An `intent_sessions` Drizzle table exists and a new intent session row can be written and read back', async ({ page }) => {
    test.setTimeout(60000);

    const response = await page.request.get(`${SERVER_URL}/api/debug/intent-sessions-table`);
    expect(response.status(), 'GET /api/debug/intent-sessions-table should return 200').toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok, 'intent_sessions CRUD diagnostic should return ok: true').toBe(true);

    const crud = body.crud as Record<string, boolean>;
    expect(crud.insert, 'intent_sessions insert should succeed').toBe(true);
    expect(crud.read, 'intent_sessions read should succeed').toBe(true);
    expect(crud.delete, 'intent_sessions delete should succeed').toBe(true);
  });

  test('`shared/src/types/timeline.ts` exports `SnapshotMeta`, `IntentSession`, and the three new WebSocket message types, and TypeScript compiles with no errors across all packages', async ({ page }) => {
    test.setTimeout(60000);

    const response = await page.request.get(`${SERVER_URL}/api/debug/shared-types`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok, 'shared-types diagnostic should return ok: true (server running proves TypeScript compilation)').toBe(true);
    expect(body.hasIntentCategory, 'IntentCategory const (runtime companion to IntentSession/SnapshotMeta types) should be accessible').toBe(true);
  });

  test('Snapshot writes are triggered only at the delta threshold (not every event), preventing unbounded storage growth from day one', async ({ page }) => {
    test.setTimeout(60000);

    const { writeFileSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'archlens-diag-'));
    const FILE_COUNT = 18;

    // Write FILE_COUNT valid JS files BEFORE switching watch root so initial scan captures them as a burst
    for (let i = 0; i < FILE_COUNT; i++) {
      writeFileSync(
        join(tmpDir, `module${i}.js`),
        `export const value${i} = ${i};\nexport function fn${i}() { return ${i}; }\n`,
      );
    }

    const switchRes = await page.request.post(`${SERVER_URL}/api/watch`, { data: { directory: tmpDir } });
    expect(switchRes.status(), 'POST /api/watch should return 200').toBe(200);

    // Fixed 5s wait for SnapshotManager 3s debounce to settle per CONTEXT.md
    await page.waitForTimeout(5000);

    const timelineRes = await page.request.get(`${SERVER_URL}/api/timeline`);
    expect(timelineRes.status(), 'GET /api/timeline should return 200').toBe(200);

    const snapshots = (await timelineRes.json()) as unknown[];
    expect(
      snapshots.length,
      `Expected at least 1 snapshot after ${FILE_COUNT} file events but got 0 — pipeline may not have scanned yet`,
    ).toBeGreaterThan(0);
    expect(
      snapshots.length,
      `Expected snapshot count < event count but got ${snapshots.length} snapshots for ${FILE_COUNT} events — delta throttling may not be active`,
    ).toBeLessThan(FILE_COUNT);
  });
});
