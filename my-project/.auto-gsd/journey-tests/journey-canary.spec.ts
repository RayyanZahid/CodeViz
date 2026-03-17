import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('No spec files contain auto-gsd placeholder overwrite patterns', async () => {
  const specFiles = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.spec.ts') && f !== 'journey-canary.spec.ts');

  const violations: string[] = [];

  for (const filename of specFiles) {
    const content = fs.readFileSync(path.join(__dirname, filename), 'utf-8');

    // Pattern 1: bodyText.length check — hallmark of auto-gsd placeholder stubs
    if (content.includes('bodyText.length')) {
      violations.push(`${filename}: contains bodyText.length placeholder check`);
    }

    // Pattern 2: page.goto without page.request API calls
    // Exception: journey-build-and-start.spec.ts legitimately uses BASE_URL browser navigation
    if (filename !== 'journey-build-and-start.spec.ts') {
      const hasPageGoto = content.includes('page.goto(');
      const hasApiCall = content.includes('page.request.');
      const hasServerUrl = content.includes('SERVER_URL');
      if (hasPageGoto && !hasApiCall && !hasServerUrl) {
        violations.push(`${filename}: page.goto without page.request API calls (likely placeholder stub)`);
      }
    }
  }

  expect(
    violations,
    `Auto-gsd placeholder patterns detected — spec files may have been overwritten:\n${violations.join('\n')}`
  ).toHaveLength(0);
});
