// Read-only scans that compare a screen across portals. Not part of the suite.
//   $env:ENV_NAME='UAT-APH'; npx playwright test --config explore/scan/scan.config.ts
import { defineConfig } from '@playwright/test';
import { BASE_URL, HEADLESS_USER_AGENT, IGNORE_HTTPS_ERRORS } from '../../portals.config';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.scan.ts',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  outputDir: '../../test-results/scan-run',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    userAgent: HEADLESS_USER_AGENT,
    viewport: { width: 1400, height: 900 }
  }
});
