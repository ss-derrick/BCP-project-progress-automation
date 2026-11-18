import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
// Ticking Retail also ticks My Debit (APH, 17 Nov); on Fassbayar both come pre-ticked.
export const AmBank: HostProfile = {
  code: 'AMB', name: 'AmBank',
  midPattern: /^\d{15}$/, midSuffix: '-AMB',
  cardSchemes: ['AmBank VISA', 'AmBank Mastercard'],
  paymentTypes: ['retail', 'myDebit'],
  autoTicked: ['myDebit'],
  confirmed: true
};
