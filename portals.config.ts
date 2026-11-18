// ============================================================
// THE config shared by the team (in the repo). Secrets stay in .env.
//
//   ENVIRONMENTS  which portal each environment runs, its default address,
//                 report name and test ID prefix. A run picks ONE with
//                 ENV_NAME (in .env, or per run: $env:ENV_NAME='UAT-FASSBAYAR').
//   PORTALS       what each portal's screens have ("features"): the shared
//                 pages skip what a portal lacks, so tests never say
//                 if (portal === ...).
//
// Hosts (Service Providers) and which portal offers each:
//   common/hosts/hosts.ts
//
// New environment (e.g. SIT-APH) = one line in ENVIRONMENTS + its block in .env.
// New portal = one profile in PORTALS + a folder next to aph/ and fassbayar/.
// ============================================================
import type { PortalKey, PortalProfile } from './common/config/portals';

export interface Environment {
  portal: PortalKey;
  url: string;              // default; <ENV>_URL in .env wins
  projectName: string;      // Test Execution Report header
  testIdPrefix: string;     // e.g. TC-APH -> TC-APH-001
}

export const ENVIRONMENTS: Record<string, Environment> = {
  'UAT-APH': {
    portal: 'aph',
    url: 'https://10.0.1.30:35190',
    projectName: 'APH Automation',
    testIdPrefix: 'TC-APH'
  },
  'UAT-FASSBAYAR': {
    portal: 'fassbayar',
    url: 'https://10.0.1.30:36190',
    projectName: 'FassBayar Test Automation',
    testIdPrefix: 'TC-FASSBAYAR'
  }
};

// Read from both UAT portals on 18 Nov 2026 (common/explore/addCompanyProbe.ts)
export const PORTALS: Record<PortalKey, PortalProfile> = {
  aph: {
    key: 'aph',
    name: 'APH',
    sstTin: false,
    bankDetails: false,
    mcc: false,
    specialFields: false,
    dba: false,
    settings: ['contactless', 'mccsOptIn', 'unattendedScheduleTime', 'applicationIdentifier', 'qrScanType'],
    parentSettings: ['apiAuthentication'],            // no SSO box on APH
    // Box allows 50, but the page's check rejects more than 25
    businessNameMaxLength: 25,
    // Server rejects "+" in the email on Confirm (form check accepts it)
    emailPlusAlias: false
  },
  fassbayar: {
    key: 'fassbayar',
    name: 'FassBayar',
    sstTin: true,
    bankDetails: true,
    mcc: true,
    specialFields: true,
    dba: true,
    settings: ['contactless', 'mccsOptIn', 'billPayment', 'bypassVoid', 'bypassSettlement',
      'unattendedScheduleTime', 'applicationIdentifier', 'qrScanType'],
    parentSettings: ['apiAuthentication', 'sso'],
    businessNameMaxLength: 50,
    emailPlusAlias: true
  }
};
