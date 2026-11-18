// Exploration only (not part of the test suite): scripts that open pages and
// dump their elements so new locators can be written. Runs the scripts of
// the portal ENV_NAME points at (explore/aph or explore/fassbayar):
//   npx playwright test --config explore/explore.config.ts explore/aph/addCompanyDryRun.explore.ts
//   $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test --config explore/explore.config.ts explore/fassbayar/addCompanyDryRun.spec.ts
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, ENV_NAME, PORTAL, HEADLESS_USER_AGENT, IGNORE_HTTPS_ERRORS } from '../common/config/testConfig';

const mobile = process.env.MOBILE === 'true';

export default defineConfig({
  testDir: `./${PORTAL}`,
  testMatch: ['**/*.explore.ts', '**/*.spec.ts'],
  timeout: 300_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: `../test-results/explore/${ENV_NAME}`,
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'msedge',
    headless: true,
    ...(mobile ? { ...devices['Pixel 7'] } : { userAgent: HEADLESS_USER_AGENT, viewport: { width: 1400, height: 900 } })
  }
});
