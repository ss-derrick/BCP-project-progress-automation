import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
export const AeonCredit: HostProfile = {
  code: 'ACS', name: 'Aeon Credit',
  midPattern: /^\d{15}$/, midSuffix: '-ACS',
  cardSchemes: ['Aeon VISA', 'Aeon Mastercard'],
  paymentTypes: ['retail', 'qr', 'member', 'ipp'],
  confirmed: true
};
