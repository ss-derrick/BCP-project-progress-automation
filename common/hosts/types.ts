// A host = a "Service Provider" on the System Portal's Add a Company form.
// One profile per host, written once and used by creation/ (valid data),
// utils/ (validation) and tests (loop over the hosts of the current portal).
//
// Note: VISA / MasterCard are CARD SCHEMES offered by a host, not hosts.

// Payment Type checkbox name prefixes on the form (checkbox = prefix + 'Checkbox' + row)
export type PaymentTypeKey =
  | 'retail' | 'qr' | 'member' | 'ipp' | 'fasspayWallet'
  | 'myDebit' | 'tpa' | 'cashOut' | 'preAuth' | 'amex'
  | 'duitNowQRStatic' | 'superks' | 'ndpsQr';      // Fassbayar only (scan 18 Nov 2026)

export interface HostProfile {
  code: string;                 // value in the Service Provider dropdown, e.g. 'ACS'
  name: string;                 // as the dropdown shows it, e.g. 'Aeon Credit'
  midPattern: RegExp;           // what the form accepts as MID
  midSuffix: string;            // what the company list adds after the MID, e.g. '-ACS'
  cardSchemes: string[];        // card schemes the tests pick for this host (names as the picker shows them)
  onlyTheseSchemes?: boolean;   // true = the picker offers ONLY these (e.g. Global Payment); else it lists every scheme
  paymentTypes: PaymentTypeKey[];   // payment types the form enables for this host
  autoTicked?: PaymentTypeKey[];    // payment types the form ticks by itself
  exclusivePaymentTypes?: boolean;  // true = only ONE of paymentTypes can be ticked at a time
  confirmed: boolean;           // false = rules not checked on a portal yet
}
