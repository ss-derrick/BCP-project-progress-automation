import type { HostProfile } from './types';

// Fassbayar only. Rules = Fassbayar's form in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-fassbayar.json).
export const Ocbc: HostProfile = {
  code: 'OCBC', name: 'OCBC',
  midPattern: /^\d{15}$/, midSuffix: '-OCBC',
  cardSchemes: ['OCBC VISA', 'OCBC Mastercard', 'OCBC MyDebit'],
  paymentTypes: ['retail'],
  confirmed: true
};
