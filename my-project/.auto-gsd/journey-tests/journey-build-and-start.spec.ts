import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Build and Start', () => {
  test('App builds without errors', async ({}) => {
    const { execSync } = await import('child_process');
    const result = execSync('pnpm build', {
      encoding: 'utf-8',
      timeout: 120000,
      cwd: projectRoot,
    });
    expect(result).toBeDefined();
  });

  test('Build outputs exist in dist folders', async ({}) => {
    const { existsSync, readdirSync } = await import('fs');
    const serverDist = path.join(projectRoot, 'packages/server/dist');
    const clientDist = path.join(projectRoot, 'packages/client/dist');
    expect(existsSync(serverDist)).toBe(true);
    expect(existsSync(clientDist)).toBe(true);
    const serverJsFiles = readdirSync(serverDist).filter((f: string) => f.endsWith('.js'));
    expect(serverJsFiles.length).toBeGreaterThan(0);
  });

  test('Dev server starts and responds', async ({ page }) => {
    const response = await page.goto(BASE_URL + '/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('No JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});
