import { defineConfig, devices } from '@playwright/test';
import * as fs from 'node:fs';
import {
  BASE_URL,
  DEMO_MODE,
  ENV_NAME,
  Demo,
  HEADLESS_USER_AGENT,
  MOBILE_DEVICE,
  MOBILE_MODE,
  PROJECT_NAME,
  REPORT_TIMEZONE,
  REPORT_TIMEZONE_SHORT,
  IGNORE_HTTPS_ERRORS,
  SYSTEM_LABEL,
  Timeouts,
  PORTAL
} from './portals.config';

// Run modes (see portals.config.ts):
//   Local default = DEMO (headed, slow, watchable)
//   CI default    = FAST (headless, no artificial waits)
//   Fast locally:  $env:DEMO='false'; npx playwright test
//   Phone screen:  $env:MOBILE='true'; npx playwright test

// Phone settings (screen size, touch, mobile user agent) - MOBILE mode only
const phone = MOBILE_MODE ? devices[MOBILE_DEVICE] : undefined;

// Per-environment folders, e.g. UAT-APH -> uat-aph, UAT-Fassbayar -> uat-fassbayar
const envFolder = ENV_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Report notes (gaps / human action cards) per environment if that folder
// exists, e.g. report-notes/uat-fassbayar/; otherwise report-notes/
const notesDir = fs.existsSync(`report-notes/${envFolder}`)
  ? `report-notes/${envFolder}`
  : 'report-notes';

if (MOBILE_MODE && !phone) {
  throw new Error(
    `Unknown MOBILE_DEVICE "${MOBILE_DEVICE}". Examples: 'Pixel 7', ` +
    `'Galaxy S9+', 'iPhone 14'`
  );
}

export default defineConfig({
  // Which tests run: the shared ones + the current portal's own.
  //   ENV_NAME=UAT-APH        -> common/tests + aph/tests
  //   ENV_NAME=UAT-Fassbayar  -> common/tests + fassbayar/tests
  testDir: '.',
  testMatch: ['common/tests/**/*.spec.ts', `${PORTAL}/tests/**/*.spec.ts`],
  testIgnore: ['explore/**', 'node_modules/**'],

  timeout: Timeouts.test,

  expect: {
    timeout: Timeouts.expect
  },

  // The portal allows ONE session per user: a second login (another worker)
  // logs the first one out. All tests share one account -> run serially.
  workers: 1,
  fullyParallel: false,

  // Retry once on CI to absorb environment flakiness
  retries: process.env.CI ? 1 : 0,

  use: {
    baseURL: BASE_URL,

    // Both portals use a self-signed certificate (see config/testConfig.ts)
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,

    browserName: 'chromium',

    // Edge locally; bundled Chromium on CI (Edge isn't installed there)
    channel: process.env.CI ? undefined : 'msedge',

    headless: !DEMO_MODE,

    actionTimeout: Timeouts.action,
    navigationTimeout: Timeouts.pageLoad,

    // Headless: send a normal desktop user agent (some firewalls block
    // "HeadlessChrome"). MOBILE mode: use the phone's own user agent.
    userAgent: phone
      ? phone.userAgent
      : DEMO_MODE ? undefined : HEADLESS_USER_AGENT,

    // MOBILE mode only: phone screen size, touch screen, mobile layout
    ...(phone && {
      viewport: phone.viewport,
      deviceScaleFactor: phone.deviceScaleFactor,
      isMobile: phone.isMobile,
      hasTouch: phone.hasTouch
    }),

    launchOptions: {
      slowMo: Demo.slowMo
    },

    // Screenshot at the end of every test = evidence in the execution report
    screenshot: { mode: 'on', fullPage: true },

    // Traces are OFF by default: a trace records every typed value,
    // including the login password, so a shared report would leak it.
    // Turn on for one debugging run:  $env:TRACE='on'; npx playwright test ...
    // (never share a report made with TRACE on)
    trace: process.env.TRACE === 'on' ? 'retain-on-failure' : 'off'
  },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],

    // Test Execution Report, one folder per environment so a run on one
    // portal never overwrites the other:
    //   execution-report-uat-aph/   execution-report-uat-fassbayar/
    //   (mobile: execution-report-mobile-uat-aph/ ...)
    // REPORT_DIR overrides the folder:  $env:REPORT_DIR='execution-report-sit'
    ['./common/reporters/executionReport.ts', {
      outputDir: process.env.REPORT_DIR
        ?? (MOBILE_MODE ? `execution-report-mobile-${envFolder}` : `execution-report-${envFolder}`),
      notesDir,
      projectName: PROJECT_NAME,
      systemLabel: MOBILE_MODE
        ? `${SYSTEM_LABEL} - Mobile web: ${MOBILE_DEVICE}`
        : SYSTEM_LABEL,
      runContext: 'after the last Playwright run',
      timezone: REPORT_TIMEZONE,
      timezoneShort: REPORT_TIMEZONE_SHORT
    }],

    // Test Summary -> test_summary.html: one card per environment, built
    // from every execution-report-<env>/ folder. Must stay AFTER the
    // Test Execution Report above (it reads what that one writes).
    ['./common/reporters/summaryReport.ts', {
      title: `${PROJECT_NAME}: Summary`,
      timezone: REPORT_TIMEZONE,
      timezoneShort: REPORT_TIMEZONE_SHORT
    }]
  ]
});
