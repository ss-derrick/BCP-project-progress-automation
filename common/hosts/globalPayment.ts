import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
// The ONLY host whose Card Scheme picker is filtered: APH offers just these two.
// Fassbayar also offers HSBC VISA / HSBC Mastercard (portals.config.ts).
export const GlobalPayment: HostProfile = {
  code: 'GP', name: 'Global Payment',
  midPattern: /^\d{15}$/, midSuffix: '-GP',
  cardSchemes: ['VISA', 'MasterCard'],
  onlyTheseSchemes: true,
  paymentTypes: ['retail', 'ipp'],
  // Retail OR IPP: ticking one disables the other (rule given 18 Nov 2026)
  exclusivePaymentTypes: true,
  confirmed: true
};
