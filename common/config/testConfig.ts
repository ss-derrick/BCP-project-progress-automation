import * as path from 'node:path';
import type { RunMode } from './runMode';
import { ENVIRONMENTS, PORTALS } from '../../portals.config';

// ============================================================
// Run settings for ONE run. Which environment: ENV_NAME
// (in .env, or per run:  $env:ENV_NAME='UAT-FASSBAYAR'; npx playwright test).
// Environments and portal profiles: portals.config.ts (root).
//
// Secrets live in the root .env (git-ignored; template .env.example),
// loaded here. Values already set in the terminal win over .env.
// Every value can be overridden with an environment variable.
// ============================================================

try {
  process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
} catch {
  // No .env file - values come from the terminal or the defaults
}

// ---------- environment / portal ----------

// Case-insensitive: 'UAT-Fassbayar' = 'UAT-FASSBAYAR'
const requested = process.env.ENV_NAME ?? 'UAT-APH';
export const ENV_NAME =
  Object.keys(ENVIRONMENTS).find((k) => k.toLowerCase() === requested.toLowerCase()) ?? requested;

const environment = ENVIRONMENTS[ENV_NAME];
if (!environment) {
  throw new Error(`Unknown ENV_NAME "${requested}". Known: ${Object.keys(ENVIRONMENTS).join(', ')} ` +
    '(add new ones in portals.config.ts)');
}

// Which portal this run tests, and what its screens have
export const PORTAL = environment.portal;
export const PORTAL_PROFILE = PORTALS[PORTAL];

// .env block of this environment: UAT-APH -> UAT_APH_URL / _USERNAME / _PASSWORD
const ENV_KEY = ENV_NAME.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const envValue = (name: string): string | undefined => process.env[`${ENV_KEY}_${name}`];

// Portal address. BASE_URL (if set) wins over the environment's own URL.
export const BASE_URL = process.env.BASE_URL ?? envValue('URL') ?? environment.url;

// UAT portals use a self-signed certificate on an IP address
export const IGNORE_HTTPS_ERRORS = (process.env.IGNORE_HTTPS_ERRORS ?? 'true') === 'true';

// Login account of this environment, from .env (<ENV>_USERNAME / <ENV>_PASSWORD).
// APP_USERNAME / APP_PASSWORD (if set) win, e.g. for one run.
export const Credentials = {
  get username(): string { return requireLogin('USERNAME', process.env.APP_USERNAME ?? envValue('USERNAME')); },
  get password(): string { return requireLogin('PASSWORD', process.env.APP_PASSWORD ?? envValue('PASSWORD')); }
};

function requireLogin(part: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `HUMAN ACTION REQUIRED: no login for ${ENV_NAME}. Fill in ${ENV_KEY}_${part} ` +
      'in the .env file in the BCP folder (see .env.example).'
    );
  }
  return value;
}

// Optional: real mailbox for authoriser emails. Each run uses a unique
// "+alias" of it (name+a1b2c3@company.com). Empty = qa.<tag>@example.com.
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? process.env.AUTHORISER_EMAIL ?? '';

// ---------- report ----------

export const PROJECT_NAME = process.env.PROJECT_NAME ?? environment.projectName;
export const SYSTEM_LABEL = process.env.SYSTEM_LABEL ?? `${ENV_NAME} (${BASE_URL})`;
// TC-APH -> TC-APH-001
export const TEST_ID_PREFIX = process.env.TEST_ID_PREFIX ?? environment.testIdPrefix;
export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE ?? 'Asia/Kuala_Lumpur';
export const REPORT_TIMEZONE_SHORT = process.env.REPORT_TIMEZONE_SHORT ?? 'KL';

// Login page path (relative to BASE_URL)
export const LOGIN_PATH = '/auth/login';

// Text a firewall shows when it blocks automation: a failed test showing it
// is reported as "blocked-env", not as a product defect. Empty = off.
export const BLOCKED_PAGE_TEXT = process.env.BLOCKED_PAGE_TEXT ?? 'Web Page Blocked!';

// Normal desktop user agent for headless runs (some firewalls block "HeadlessChrome")
export const HEADLESS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

// ---------- run modes ----------

// DEMO = headed, slow, watchable. FAST = no artificial waits.
// Default: DEMO locally, FAST on CI.   Fast locally: $env:DEMO='false'
export const DEMO_MODE =
  process.env.DEMO !== undefined ? process.env.DEMO === 'true' : !process.env.CI;

// MOBILE = same tests on a phone-sized screen.  $env:MOBILE='true'
export const MOBILE_MODE = process.env.MOBILE === 'true';
export const MOBILE_DEVICE = process.env.MOBILE_DEVICE ?? 'Pixel 7';

export const Timeouts = {
  test: 240_000,          // one full test
  expect: 10_000,         // each expect() assertion
  pageLoad: 60_000,       // navigation / form post
  action: 30_000,         // one click / fill
  redirect: 75_000        // automatic redirects
} as const;

// Values that only apply in DEMO mode (0 = disabled)
export const Demo = {
  slowMo: DEMO_MODE ? 500 : 0,
  typingDelay: DEMO_MODE ? 50 : 0,
  stepPause: DEMO_MODE ? 1000 : 0,
  viewPage: DEMO_MODE ? 5_000 : 0
} as const;

// Watch-mode speeds used by every page object (common/pages/BasePage.ts)
export const RUN_MODE: RunMode = {
  demoMode: DEMO_MODE,
  typingDelay: Demo.typingDelay,
  stepPause: Demo.stepPause,
  viewPage: Demo.viewPage
};
