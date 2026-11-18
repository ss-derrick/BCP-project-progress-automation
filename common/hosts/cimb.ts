import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
// Label: "Cimb" on APH, "CIMB" on Fassbayar (portals.config.ts)
export const Cimb: HostProfile = {
  code: 'CIMB', name: 'Cimb',
  midPattern: /^\d{15}$/, midSuffix: '-CIMB',
  cardSchemes: ['CIMB VISA', 'CIMB Mastercard'],
  paymentTypes: ['retail'],
  confirmed: true
};
