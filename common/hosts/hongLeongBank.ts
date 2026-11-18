import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
export const HongLeongBank: HostProfile = {
  code: 'HLB', name: 'Hong Leong Bank',
  midPattern: /^\d{15}$/, midSuffix: '-HLB',
  cardSchemes: ['HLB VISA', 'HLB MASTERCARD', 'HLB MyDebit'],
  paymentTypes: ['retail', 'myDebit', 'preAuth'],
  confirmed: true
};
