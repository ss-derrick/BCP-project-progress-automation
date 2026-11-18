import { defineConfig, devices } from '@playwright/test';
import {
  ENV_NAME, PORTAL, BASE_URL, IGNORE_HTTPS_ERRORS, DEMO_MODE, Demo, HEADLESS_USER_AGENT,
  MOBILE_DEVICE, MOBILE_MODE, PROJECT_NAME, SYSTEM_LABEL, REPORT_TIMEZONE, REPORT_TIMEZONE_SHORT, Timeouts
} from './common/config/testConfig';

// ONE config for every portal. ENV_NAME (in .env, or per run) picks the
// environment; portals.config.ts says which portal that is. A run takes:
//   common/tests/**     scenarios that run on EVERY portal
//   <portal>/tests/**   scenarios only for this portal (aph/ or fassbayar/)
//
//   npm run test:aph   /   npm run test:fassbayar   /   npm run test:all
//   $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test        (same thing)
//   Fast:  $env:DEMO='false'     Phone screen:  $env:MOBILE='true'

const phone = MOBILE_MODE ? devices[MOBILE_DEVICE] : undefined;
if (MOBILE_MODE && !phone) {
  throw new Error(`Unknown MOBILE_DEVICE "${MOBILE_DEVICE}". Examples: 'Pixel 7', 'Galaxy S9+', 'iPhone 14'`);
}

// Reports per environment, so APH and FassBayar never overwrite each other
const reportRoot = `reports/${ENV_NAME}`;

export default defineConfig({
  testDir: '.',
  testMatch: ['common/tests/**/*.spec.ts', `${PORTAL}/tests/**/*.spec.ts`],
  outputDir: `test-results/${ENV_NAME}`,

  timeout: Timeouts.test,
  expect: { timeout: Timeouts.expect },

  // ONE session per user on the portals: a second login logs the first one
  // out. All tests share one account -> run serially.
  workers: 1,
  fullyParallel: false,

  retries: process.env.CI ? 1 : 0,

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
    browserName: 'chromium',
    // Edge locally; bundled Chromium on CI (Edge isn't installed there)
    channel: process.env.CI ? undefined : 'msedge',
    headless: !DEMO_MODE,
    actionTimeout: Timeouts.action,
    navigationTimeout: Timeouts.pageLoad,

    userAgent: phone ? phone.userAgent : DEMO_MODE ? undefined : HEADLESS_USER_AGENT,
    ...(phone && {
      viewport: phone.viewport,
      deviceScaleFactor: phone.deviceScaleFactor,
      isMobile: phone.isMobile,
      hasTouch: phone.hasTouch
    }),

    launchOptions: { slowMo: Demo.slowMo },

    // Screenshot at the end of every test = evidence in the execution report
    screenshot: { mode: 'on', fullPage: true },

    // Traces are OFF: a trace records every typed value, incl. the password.
    // One debugging run:  $env:TRACE='on'   (never share that report)
    trace: process.env.TRACE === 'on' ? 'retain-on-failure' : 'off'
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `${reportRoot}/playwright-report` }],

    // Test Execution Report -> reports/<ENV>/execution-report/test_execution_report.html
    // + BCP_Test_Summary.html (all environments) in this folder
    ['./common/reporters/executionReport.ts', {
      outputDir: process.env.REPORT_DIR
        ?? `${reportRoot}/${MOBILE_MODE ? 'execution-report-mobile' : 'execution-report'}`,
      notesDir: `report-notes/${ENV_NAME}`,
      projectName: PROJECT_NAME,
      systemLabel: MOBILE_MODE ? `${SYSTEM_LABEL} - Mobile web: ${MOBILE_DEVICE}` : SYSTEM_LABEL,
      runContext: 'after the last Playwright run',
      timezone: REPORT_TIMEZONE,
      timezoneShort: REPORT_TIMEZONE_SHORT
    }]
  ]
});
