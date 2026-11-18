import type { HostProfile } from './types';

// Fassbayar only. Rules = Fassbayar's form in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-fassbayar.json).
// NDPS MIDs are 6 to 15 digits (the form's regex_mid_ndps). TODO(confirm): card scheme to use.
export const Ndps: HostProfile = {
  code: 'NDPS', name: 'NDPS',
  midPattern: /^\d{6,15}$/, midSuffix: '-NDPS',
  cardSchemes: [],
  paymentTypes: ['retail', 'ndpsQr'],
  confirmed: true
};
