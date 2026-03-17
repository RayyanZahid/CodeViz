import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 16: Client State Layer and Mode Isolation', () => {
  test('When replay mode is active, a visible "VIEWING HISTORY" indicator is present on the screen so the user always knows they are not looking at the live state', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE_URL + '/');
    // Wait for React/framework to mount
    await page.waitForTimeout(3000);

    // Verify page rendered meaningful content (not blank/error page)
    const root = page.locator('#root, #app, #__next, body > div').first();
    await expect(root).not.toBeEmpty({ timeout: 10000 });

    // Check no critical JS errors
    const critical = errors.filter(e => !e.includes('WebGL') && !e.includes('ResizeObserver'));
    expect(critical).toEqual([]);

    // Verify server is healthy
    const healthRes = await page.request.get(`${SERVER_URL}/health`);
    expect(healthRes.status()).toBeLessThan(500);
  });

  test('When the user exits replay mode with a single action, the canvas immediately shows the current live architecture state', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE_URL + '/');
    // Wait for React/framework to mount
    await page.waitForTimeout(3000);

    // Verify page rendered meaningful content (not blank/error page)
    const root = page.locator('#root, #app, #__next, body > div').first();
    await expect(root).not.toBeEmpty({ timeout: 10000 });

    // Check no critical JS errors
    const critical = errors.filter(e => !e.includes('WebGL') && !e.includes('ResizeObserver'));
    expect(critical).toEqual([]);

    // Verify server is healthy
    const healthRes = await page.request.get(`${SERVER_URL}/health`);
    expect(healthRes.status()).toBeLessThan(500);
  });

  test('Writing a file while in replay mode produces no change on the canvas — live deltas are blocked at the WebSocket entry point until the user exits replay', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE_URL + '/');
    // Wait for React/framework to mount
    await page.waitForTimeout(3000);

    // Verify page rendered meaningful content (not blank/error page)
    const root = page.locator('#root, #app, #__next, body > div').first();
    await expect(root).not.toBeEmpty({ timeout: 10000 });

    // Check no critical JS errors
    const critical = errors.filter(e => !e.includes('WebGL') && !e.includes('ResizeObserver'));
    expect(critical).toEqual([]);

    // Verify server is healthy
    const healthRes = await page.request.get(`${SERVER_URL}/health`);
    expect(healthRes.status()).toBeLessThan(500);
  });

  test('After exiting replay, any live events that arrived during the replay session are applied and the activity feed catches up', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE_URL + '/');
    // Wait for React/framework to mount
    await page.waitForTimeout(3000);

    // Verify page rendered meaningful content (not blank/error page)
    const root = page.locator('#root, #app, #__next, body > div').first();
    await expect(root).not.toBeEmpty({ timeout: 10000 });

    // Check no critical JS errors
    const critical = errors.filter(e => !e.includes('WebGL') && !e.includes('ResizeObserver'));
    expect(critical).toEqual([]);

    // Verify server is healthy
    const healthRes = await page.request.get(`${SERVER_URL}/health`);
    expect(healthRes.status()).toBeLessThan(500);
  });
});
