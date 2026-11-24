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
// (read-only scan of 18 Nov 2026, by Derrick)
export interface CreditSettlementRules {
  showsRefundedTotal: boolean;        // "Total Refunded Amount" in the batch summary
  settleCreditButton: boolean;        // "Settle Credit" on a PENDING batch (never clicked by tests)
  batchFilters: string[];             // filter labels on Batch Details, in page order
  transactionStatuses: string[];      // Status filter options on Batch Details
}

// Administrator differences per portal (sheet + exploration 23 Nov 2026)
export interface AdministratorRules {
  cardBrandLimitColumn: string;      // Card Brand list column: APH "(MYR)", Fassbayar "(RM)"
  auditActionCount?: number;         // Audit Trail Action options incl. Select One (APH sheet: 117; FB sheet: "60+")
  // Audit Trail date range (ADM-019): true = a range beyond the limit must be refused with a message;
  // false = no limit by design (a long range simply lists the records). APH and Fassbayar: false (QA Lead, 24 Nov 2026).
  auditRangeLimited: boolean;
  // From each baseline workbook's Test Data sheet (QA Lead, 23 Nov 2026). '' = not given yet: the tests
  // then use the automation's own dummy users (qaautotest01 / 02). ADM_TEST_BANK_USER (.env) overrides.
  testBankUser: string;              // disposable user: edit / suspend / reinstate (ADM-004, 006)
  resetUser: string;                 // Reset Password target (ADM-009)
  loginTestUser: string;             // logged in as while suspended / reinstated (ADM-018); password: <ENV>_TEST_BANK_USER_PASSWORD
  testPlanCode: string;              // unused 3-digit IPP plan code, created / edited / deleted only by ADM-013
  testPlanProvider: string;          // its Service Provider host code where the form has one, as on the list ('' = first option)
}

// Manage Readers (explore/scan/readers.scan.ts 23 Nov 2026 + each workbook's Test Data sheet)
export interface ReaderRules {
  quicklinks: string[];              // left panel on Reader Summary
  detailsButtons: string[];          // Reader Details buttons of an Active reader (besides Suspend Reader)
  // TD-07 working company (Test Data sheet): test readers are registered on it (RDR-003 .. 016)
  workingCompany: string;            // business name
  workingMid: string;                // its MID ('' = looked up from All Companies by the name)
  // RDR-005 "company B": the test reader is moved to it. '' = not named yet -> the case asks for it
  secondMid: string;
}

// Home (/console): Quicklinks panel boxes and their links (explore/scan/home.scan.ts 24 Nov 2026 + the APH
// Field Registry FR-HOME-S01-001..024). heading = title of the page the link opens.
export interface HomeLink { text: string; href: string; heading: string }
export interface HomeRules {
  panels: { title: string; links: HomeLink[] }[];
  dailySnapshot: boolean;            // Daily Transaction Snapshot chart (Fassbayar sheet HOME-001/002); APH Home has none
  headerCases: boolean;              // header / Quicklinks / last login cases: only in the APH sheet (HOME-003..005)
}
const L = (text: string, href: string, heading: string): HomeLink => ({ text, href, heading });
const HOME_COMPANIES = [L('Company Summary', '/company', 'All Companies'), L('Add a Company', '/company/register', 'Add a Company'),
  L('Bulk Company Upload', '/company/bulkupload', 'Bulk Company Upload')];
const HOME_MOBILE = [L('Mobile User Summary', '/mobileUser', 'All Mobile Users'), L('Add a Mobile User', '/mobileUser/registerSearch', 'Add a Mobile User'),
  L('Terminal Summary', '/terminal', 'All Terminals'), L('Register New Terminal', '/terminal/register', 'Register New Terminal')];
const HOME_READERS = [L('Reader Summary', '/reader', 'All Readers'), L('Register New Readers', '/reader/register', 'Register New Readers')];
const HOME_TRANSACTIONS = [L('Transaction Summary', '/transaction', 'All Transactions'),
  L('Geofencing Bypassed Transaction Report', '/transaction/getBlankTransactionsReport', 'Geofencing Bypassed Transaction Report'),
  L('Reporting', '/transaction/billingReport', 'Reporting')];
const HOME_SETTLEMENTS = [L('Credit Settlement Summary', '/creditSettlement', 'All Credit Settlements'),
  L('Schedule Force Settlement', '/creditSettlement/searchCompany', 'Schedule Force Settlement')];
const HOME_ADMIN = [L('Manage Bank Users', '/admin', 'All Users'), L('Add a Bank User', '/admin/register', 'Add a Bank User'),
  L('System Error Log', '/admin/errorLog', 'System Error Log'), L('Audit Trail', '/admin/auditTrail', 'User Activities')];

export interface PortalProfile {
  name: string;
  hosts: HostProfile[];
  form: FormRules;
  creditSettlement: CreditSettlementRules;
  administrator: AdministratorRules;
  readers: ReaderRules;
  home: HomeRules;
  features: {
    sstTin: boolean;          // SST / TIN / bank / MCC / references / DBA fields on Add a Company
    logoUpload: boolean;      // Upload / Remove Company Logo
    bulkUpload: boolean;      // Bulk Company Upload (create / edit)
    // Administrator screens shown to the automation account (explore/scan/administrator.scan.ts, 23 Nov 2026)
    bankUsers: boolean;       // Manage Bank Users, Add a Bank User, suspend / reinstate, Reset Password
    cardBrandSettings: boolean;  // Card Brand Settings (contactless CVM limit)
    hostSettings: boolean;    // Host Settings (Host Downtime Check Period)
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
      settleCreditButton: true,
      batchFilters: ['Terminal ID (TID)', 'Approval Code', 'Status', 'Amount', 'Date'],
      transactionStatuses: ['Approved', 'Reversed', 'Voided', 'Pending Signature', 'Settled', 'Refunded', 'Expired']
    },
    // TODO(confirm): logo / bulk upload not checked on APH yet
    features: { sstTin: false, logoUpload: false, bulkUpload: false, bankUsers: true, cardBrandSettings: true, hostSettings: true },
    // APH Test Data: TD-04 disposable user test_email (ADM-004, 006, 009); TD-02 for ADM-018 = qaautotest01
    // (QA Lead 23 Nov: "can use qaautotest01"; the automation's own user); TD-11 test plan code 789
    administrator: {
      cardBrandLimitColumn: 'Contactless CVM Limit (MYR)', auditActionCount: 117, auditRangeLimited: false,   // no limit: QA Lead 24 Nov
      testBankUser: 'test_email', resetUser: 'test_email', loginTestUser: 'qaautotest01',
      testPlanCode: '789', testPlanProvider: ''
    },
    home: {
      dailySnapshot: false, headerCases: true,   // APH sheet: HOME-003..005
      panels: [
        { title: 'All Companies', links: HOME_COMPANIES },
        { title: 'Manage Mobile Users', links: HOME_MOBILE },
        { title: 'Manage Readers', links: HOME_READERS },
        { title: 'Manage Transactions', links: HOME_TRANSACTIONS },
        { title: 'Manage Credit Settlements', links: HOME_SETTLEMENTS },
        { title: 'Administrator', links: HOME_ADMIN }
      ]
    },
    readers: {
      quicklinks: ['Reader Summary', 'Register New Readers'],
      detailsButtons: ['View Company Details', 'Status History >>', 'View Sync History >>', 'Retrigger Fassbayar Sync'],
      workingCompany: 'testcreate888', workingMid: '202610011060002',   // Test Data TD-07 (ACS)
      secondMid: ''                                                      // not named in Test Data yet (RDR-005 asks)
    }
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
      // Same as APH: a pending batch offers "Settle Credit" (confirmed by QA team, 19 Nov 2026;
      // seen on batch 000009). Was false in Derrick's version.
      settleCreditButton: true,
      batchFilters: ['Terminal ID (TID)', 'Status', 'Date'],
      transactionStatuses: ['Approved', 'Reversed', 'Voided', 'Pending Signature', 'Settled', 'Expired']
    },
    // Administrator for automationfb (exploration 23 Nov 2026): bank users + card brands yes, no Host Settings (404)
    features: { sstTin: true, logoUpload: true, bulkUpload: true, bankUsers: true, cardBrandSettings: true, hostSettings: false },
    // Fassbayar Test Data: TD-01 disposable user hGtkMDzs (suspend / reinstate, ADM-018); no reset user
    // given; TD-05 test plan code 789 (Maybank)
    administrator: {
      cardBrandLimitColumn: 'Contactless CVM Limit (RM)', auditActionCount: undefined, auditRangeLimited: false,  // no limit: QA Lead 24 Nov
      testBankUser: 'hGtkMDzs', resetUser: '', loginTestUser: 'hGtkMDzs',
      testPlanCode: '789', testPlanProvider: 'MBB'   // MBB = Maybank (list shows the host code)
    },
    home: {
      dailySnapshot: true, headerCases: false,   // Fassbayar sheet: HOME-001..002 only
      panels: [
        { title: 'All Companies', links: [...HOME_COMPANIES,
          L('Parent Company Summary', '/company/parentCompanyListing', 'All Parent Companies'),
          L('Add a Parent Company', '/company/registerMasterMerchant', 'Add a Parent Company'),
          L('Upload Company Logo', '/company/uploadCompanyLogo', 'Upload Company Logo'),
          L('Remove Company Logo', '/company/removeCompanyLogo', 'Remove Company Logo')] },
        { title: 'Manage Mobile Users', links: HOME_MOBILE },
        { title: 'Manage Readers', links: [...HOME_READERS,
          L('Readers Replacement Report', '/reader/getReplacementReport', 'Readers Replacement Report'),
          L('Replace Readers', '/reader/replacement', 'Replace Readers'),
          L('Fasstap Summary', '/fasstap', 'All Fasstap')] },
        { title: 'Manage Transactions', links: [...HOME_TRANSACTIONS, L('Bill Payment Report', '/transaction/billPaymentBatchList', 'Bill Payment Report')] },
        { title: 'Manage Credit Settlements', links: HOME_SETTLEMENTS },
        { title: 'Administrator', links: HOME_ADMIN }
      ]
    },
    readers: {
      quicklinks: ['Reader Summary', 'Register New Readers', 'Readers Replacement Report', 'Replace Readers', 'Fasstap Summary'],
      detailsButtons: ['View Company Details', 'Status History >>'],
      workingCompany: 'TEST COMPANY AUTOMATION 1', workingMid: '',       // Test Data TD-07
      secondMid: ''                                                      // not named in Test Data yet (RDR-005 asks)
    }
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

// Password of the disposable test bank user (Administrator TC-ADM-018 logs in as it), per environment:
// <ENV>_TEST_BANK_USER_PASSWORD in .env. Set once by hand from the user's activation email.
export const TEST_BANK_USER_PASSWORD = envValue('TEST_BANK_USER_PASSWORD') ?? '';

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
