import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    headless: true,
  },
  reporter: [['json', { outputFile: 'results.json' }]],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: true,
    cwd: projectRoot,
    env: {
      NODE_ENV: 'development',
    },
  },
});
