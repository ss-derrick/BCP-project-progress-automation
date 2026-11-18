import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
export const Tpa: HostProfile = {
  code: 'TPA', name: 'TPA',
  midPattern: /^\d{15}$/, midSuffix: '-TPA',
  cardSchemes: ['TPA MyDebit'],
  paymentTypes: ['tpa', 'cashOut', 'preAuth'],
  confirmed: true
};
