import type { HostProfile } from './types';

// Rules = what the APH form showed in the read-only scan of 18 Nov 2026
// (explore/scan/results/add-company-uat-aph.json). Fassbayar differences are
// set per portal in portals.config.ts.
// A QR host: its only payment type is Fasspay Wallet (no Retail).
export const FasspayQrHost: HostProfile = {
  code: 'FP', name: 'Fasspay QR Host',
  midPattern: /^\d{15}$/, midSuffix: '-FP',
  cardSchemes: [],
  paymentTypes: ['fasspayWallet'],
  confirmed: true
};
