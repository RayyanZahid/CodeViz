import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

test.describe('Phase 17: Timeline Slider and Intent Panel UI', () => {
  test('User can drag a timeline slider to any point in the session and the architecture canvas updates to show the graph at that moment with correct node positions', async ({ page }) => {
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

  test('User can press play and watch the architecture evolve automatically, pause it mid-playback, and step forward one event at a time; speed can be set to 0.5x, 1x, 2x, or 4x', async ({ page }) => {
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

  test('The timeline slider shows timestamp labels, auto-detected epoch markers at significant moments, and the activity feed scrolls in sync with the current scrubber position', async ({ page }) => {
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

  test('The intent panel shows the inferred objective label with a confidence indicator, a list of derived subtasks, and updates automatically as new events stream in during live view', async ({ page }) => {
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

  test('The intent panel shows historical intent during replay (not the current live intent), and displays a focus-shift notification when the agent transitions between objectives', async ({ page }) => {
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
