import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
export const Uob: HostProfile = {
  code: 'UOB', name: 'UOB',
  midPattern: /^\d{15}$/, midSuffix: '-UOB',
  cardSchemes: ['UOB VISA', 'UOB Mastercard'],
  paymentTypes: ['retail'],
  confirmed: true
};
