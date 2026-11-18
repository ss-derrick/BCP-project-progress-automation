import type { HostProfile } from './types';

// Fassbayar only. Rules = Fassbayar's form in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-fassbayar.json).
// Its only payment type is "superks" (no Retail). TODO(confirm): card scheme to use.
export const Aeon360: HostProfile = {
  code: 'AEON360', name: 'AEON360',
  midPattern: /^\d{15}$/, midSuffix: '-AEON360',
  cardSchemes: [],
  paymentTypes: ['superks'],
  confirmed: true
};
