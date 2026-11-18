import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
// The form's own rule: Maybank AMEX MIDs are 10 digits, all other MIDs 15.
export const Maybank: HostProfile = {
  code: 'MBB', name: 'Maybank',
  midPattern: /^\d{15}$/, midSuffix: '-MBB',
  cardSchemes: ['MBB VISA', 'MBB Mastercard', 'MBB AMEX'],
  paymentTypes: ['retail', 'amex'],
  confirmed: true
};

// Maybank AMEX MID rule (regex_mid_mbb_amex on the form)
export const MAYBANK_AMEX_MID = /^\d{10}$/;
