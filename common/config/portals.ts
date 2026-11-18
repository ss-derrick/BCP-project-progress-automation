// Types and field ids behind the portal profiles. The profiles themselves
// (which portal has which section) are in the root portals.config.ts.

export type PortalKey = 'aph' | 'fassbayar';

export interface PortalProfile {
  key: PortalKey;
  name: string;

  // Business Details: SST and TIN boxes
  sstTin: boolean;
  // Business Bank Name / Account No / Holder Name
  bankDetails: boolean;
  // Merchant Category Code
  mcc: boolean;
  // Special Fields: Reference 1..5
  specialFields: boolean;
  // MID Settings: DBA box per MID
  dba: boolean;
  // Settings section checkboxes / lists that exist on this portal
  settings: readonly SettingKey[];
  // Add a Parent Company: settings checkboxes that exist on this portal
  parentSettings: readonly ParentSettingKey[];

  // Longest Business Name the form's check accepts (the box may allow more)
  businessNameMaxLength: number;
  // Server accepts a "+alias" in the authoriser email (me+tag@company.com)?
  // APH rejects it on Confirm: "FAILED [...]:: Invalid format"
  emailPlusAlias: boolean;
}

// Settings section: key -> element id (same id on every portal that has it)
export const SettingField = {
  contactless: '#enableContaclessSupport',
  mccsOptIn: '#optInMccsCheckbox',
  billPayment: '#enableBillPayment',
  bypassVoid: '#byPassVoid',
  bypassSettlement: '#byPassSettlement',
  unattendedScheduleTime: '#setUnattendedScheduleTime',
  applicationIdentifier: '#setApplicationIdentifier',
  qrScanType: '#setTypesOfPresentedQR'
} as const;
export type SettingKey = keyof typeof SettingField;

// Add a Parent Company settings: key -> element id
export const ParentSettingField = {
  apiAuthentication: '#apiAuthenticationSettingCheckbox',   // "Enable API Authentication Setting"
  sso: '#canSSOLoginCheckbox'                               // "Enable login via Single Sign On (SSO)"
} as const;
export type ParentSettingKey = keyof typeof ParentSettingField;

export { PORTALS as Portals } from '../../portals.config';
