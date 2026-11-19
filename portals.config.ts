// ==========================================================================
// THE config for System Portal automation (APH + Fassbayar, one codebase)
// ==========================================================================
// .env holds only what is personal or secret (ENV_NAME + each environment's
// URL, user, password). This file holds everything the team shares:
//   1. environments  -> which portal each environment is
//   2. portals       -> name, hosts and features of each portal
//   3. run settings  -> DEMO / MOBILE modes, timeouts, report labels
//
// Pick the environment for a run:
//   in .env:          ENV_NAME=UAT-APH
//   or per run:       $env:ENV_NAME='UAT-Fassbayar'; npx playwright test
// ==========================================================================
import * as path from 'node:path';
import type { HostProfile } from './common/hosts/types';
import {
  AeonCredit, HongLeongBank, AmBank, GlobalPayment, FasspayQrHost, Tpa, Uob, Maybank, Cimb,
  Ocbc, Aeon360, Ndps
} from './common/hosts';

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // No .env file - fine; values come from the terminal or the defaults
}

// ==========================================
// 1. ENVIRONMENTS
// ==========================================
// Add one line per environment. Its .env block is named after it with "-"
// turned into "_": UAT-APH -> UAT_APH_URL / _USERNAME / _PASSWORD
export type Portal = 'aph' | 'fassbayar';

export const environments: Record<string, { portal: Portal }> = {
  'UAT-APH':       { portal: 'aph' },
  'UAT-FASSBAYAR': { portal: 'fassbayar' }
};

// ==========================================
// 2. PORTALS
// ==========================================
// hosts    = the Service Providers this portal's scenarios run against
// features = screens the portal has; a scenario needing one the portal
//            lacks is skipped with the reason (requireFeature in fixtures)
// Same host, something different on one portal (label, card schemes, payment
// types): the profile stays in common/hosts, only the difference is written here.
//   onPortal(Cimb, { name: 'CIMB' })  -> Cimb profile, shown as "CIMB" on this portal
const onPortal = (host: HostProfile, diff: Partial<HostProfile>): HostProfile => ({ ...host, ...diff });

// Form rules that differ per portal (the page's own regex_* values, scan of 18 Nov 2026).
// Test data builders read these instead of hard-coding a length.
export interface FormRules {
  nameLength: [number, number];       // Authoriser Name + User ID Prefix (regex_name)
  businessNameMax: number;            // Business Name / Short Name (regex_businessName)
  contactBody: RegExp;                // Authoriser contact number body (regex_contact_body)
  hostSwingPriorityRequired: boolean; // "Host Swing Priority" field in each MID row
  midRowExtraFields: string[];        // extra fields in a MID row, e.g. 'dba'
}

// Manage Credit Settlements > View Details (batch page) - differs per portal
// (read-only scan of 18 Nov 2026)
export interface CreditSettlementRules {
  showsRefundedTotal: boolean;        // "Total Refunded Amount" in the batch summary
  batchFilters: string[];             // filter labels on Batch Details, in page order
  transactionStatuses: string[];      // Status filter options on Batch Details
}

export interface PortalProfile {
  name: string;
  hosts: HostProfile[];
  form: FormRules;
  creditSettlement: CreditSettlementRules;
  features: {
    sstTin: boolean;          // SST / TIN / bank / MCC / references / DBA fields on Add a Company
    logoUpload: boolean;      // Upload / Remove Company Logo
    bulkUpload: boolean;      // Bulk Company Upload (create / edit)
  };
}

export const portals: Record<Portal, PortalProfile> = {
  aph: {
    name: 'Aeon Payment Hub',
    // APH Service Providers = APH's dropdown (scan 18 Nov 2026)
    hosts: [AeonCredit, HongLeongBank, FasspayQrHost, AmBank, Tpa, GlobalPayment, Uob, Maybank, Cimb],
    form: {
      nameLength: [3, 20],
      businessNameMax: 25,
      contactBody: /^\d{7,8}$/,
      hostSwingPriorityRequired: true,
      midRowExtraFields: ['hostSwingPriority']
    },
    creditSettlement: {
      showsRefundedTotal: false,
      batchFilters: ['Terminal ID (TID)', 'Approval Code', 'Status', 'Amount', 'Date'],
      transactionStatuses: ['Approved', 'Reversed', 'Voided', 'Pending Signature', 'Settled', 'Refunded', 'Expired']
    },
    // TODO(confirm): logo / bulk upload not checked on APH yet
    features: { sstTin: false, logoUpload: false, bulkUpload: false }
  },
  fassbayar: {
    name: 'Fassbayar',
    // Fassbayar Service Providers = Fassbayar's dropdown (scan 18 Nov 2026):
    // APH's 9 + OCBC, AEON360, NDPS. Differences from the APH profiles:
    hosts: [
      AeonCredit,
      onPortal(HongLeongBank, { paymentTypes: ['retail', 'ipp', 'myDebit', 'preAuth'] }),
      onPortal(FasspayQrHost, { paymentTypes: ['fasspayWallet', 'duitNowQRStatic'] }),
      onPortal(AmBank, { autoTicked: ['retail', 'myDebit'] }),
      Tpa,
      onPortal(GlobalPayment, { cardSchemes: ['VISA', 'MasterCard', 'HSBC VISA', 'HSBC Mastercard'] }),
      Ocbc,
      onPortal(Maybank, { paymentTypes: ['retail', 'ipp', 'amex'] }),
      Uob,
      onPortal(Cimb, { name: 'CIMB', paymentTypes: ['retail', 'ipp'] }),
      Aeon360,
      Ndps
    ],
    form: {
      nameLength: [2, 50],
      businessNameMax: 50,
      contactBody: /^\d{0,12}$/,
      hostSwingPriorityRequired: false,
      midRowExtraFields: ['dba']
    },
    creditSettlement: {
      showsRefundedTotal: true,
      batchFilters: ['Terminal ID (TID)', 'Status', 'Date'],
      transactionStatuses: ['Approved', 'Reversed', 'Voided', 'Pending Signature', 'Settled', 'Expired']
    },
    features: { sstTin: true, logoUpload: true, bulkUpload: true }
  }
};

// ==========================================
// THIS RUN
// ==========================================
export const ENV_NAME = process.env.ENV_NAME ?? 'UAT-APH';

const envEntry = Object.entries(environments)
  .find(([name]) => name.toUpperCase() === ENV_NAME.toUpperCase())?.[1];

export const PORTAL: Portal =
  (process.env.PORTAL as Portal | undefined)
  ?? envEntry?.portal
  ?? (/FASSBAYAR/i.test(ENV_NAME) ? 'fassbayar' : 'aph');

export const PORTAL_PROFILE = portals[PORTAL];

// Hosts the scenarios of this run should cover
export const hostsFor = (portal: Portal = PORTAL): HostProfile[] => portals[portal].hosts;

const ENV_KEY = ENV_NAME.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const envValue = (name: string): string | undefined => process.env[`${ENV_KEY}_${name}`];

// Portal address. BASE_URL (if set) wins over the environment's own URL.
export const BASE_URL =
  process.env.BASE_URL ?? envValue('URL') ?? 'https://10.0.1.30:35190';

// Both portals use a self-signed HTTPS certificate on an IP address
export const IGNORE_HTTPS_ERRORS =
  (process.env.IGNORE_HTTPS_ERRORS ?? 'true') === 'true';

// Login page path (same on both portals)
export const LOGIN_PATH = '/auth/login';

// Login account of the chosen environment, from .env (<ENV>_USERNAME /
// <ENV>_PASSWORD). Never write a password in this file. APP_USERNAME /
// APP_USER / APP_PASSWORD (if set) win, e.g. for one run.
export const Credentials = {
  username: process.env.APP_USERNAME ?? process.env.APP_USER ?? envValue('USERNAME') ?? '',
  password: process.env.APP_PASSWORD ?? envValue('PASSWORD') ?? ''
} as const;

// The Fassbayar team's explore scripts read APP_USER / APP_PASSWORD /
// BASE_URL straight from the environment: fill them from this run's environment.
process.env.BASE_URL ??= BASE_URL;
process.env.APP_USER ??= Credentials.username;
process.env.APP_PASSWORD ??= Credentials.password;

// Optional: real mailbox for authoriser emails (Fassbayar builders use a
// unique "+alias" of it). Not set = random @example.com address.
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? '';

// ==========================================
// 3. RUN SETTINGS
// ==========================================
// DEMO mode = headed, slow, watchable. FAST mode = headless, no waits.
// Default: DEMO locally, FAST on CI.   Fast locally: $env:DEMO='false'
export const DEMO_MODE =
  process.env.DEMO !== undefined ? process.env.DEMO === 'true' : !process.env.CI;

// MOBILE mode = phone-sized screen.   $env:MOBILE='true' (MOBILE_DEVICE='iPhone 14')
export const MOBILE_MODE = process.env.MOBILE === 'true';
export const MOBILE_DEVICE = process.env.MOBILE_DEVICE ?? 'Pixel 7';

// Report header
export const PROJECT_NAME = process.env.PROJECT_NAME ?? 'System Portal Automation';
export const SYSTEM_LABEL =
  process.env.SYSTEM_LABEL ?? `${ENV_NAME} - ${PORTAL_PROFILE.name} (${BASE_URL})`;
export const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE ?? 'Asia/Kuala_Lumpur';
export const REPORT_TIMEZONE_SHORT = process.env.REPORT_TIMEZONE_SHORT ?? 'KL';

// Test case ID prefix of the shared login test (TC-APH-001)
export const TEST_ID_PREFIX = process.env.TEST_ID_PREFIX ?? 'TC-APH';

// Text a firewall shows when it blocks automation: a failed test showing it
// is reported as "blocked-env", not a product defect. Empty = check off.
export const BLOCKED_PAGE_TEXT = process.env.BLOCKED_PAGE_TEXT ?? 'Web Page Blocked!';

// Normal desktop user agent for headless runs (some firewalls block "HeadlessChrome")
export const HEADLESS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

export const Timeouts = {
  test: 240_000,          // one full test (Add a Company forms are long)
  expect: 10_000,         // each expect()
  pageLoad: 60_000,       // navigation / form post
  action: 15_000,         // one click / fill
  redirect: 75_000        // automatic redirects
} as const;

// Values that only apply in DEMO mode (0 = disabled)
export const Demo = {
  slowMo: DEMO_MODE ? 500 : 0,
  typingDelay: DEMO_MODE ? 50 : 0,
  stepPause: DEMO_MODE ? 1000 : 0,
  viewPage: DEMO_MODE ? 5_000 : 0
} as const;
