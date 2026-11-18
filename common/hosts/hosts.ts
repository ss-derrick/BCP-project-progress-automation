import type { PaymentType, QrWallet } from './paymentTypes';
import type { PortalKey } from '../config/portals';

// ============================================================
// HOSTS = the "Service Provider" dropdown in MID Settings.
// To test another host, pick it here (or add it) - nothing else changes:
//   createCompanyData(PORTAL, { hosts: ['CIMB'] })
//
// Read from both UAT portals on 18 Nov 2026 (common/explore/addCompanyProbe.ts):
//   code         = <option value> of the dropdown
//   name         = text shown in the dropdown (APH shows "Cimb", FassBayar "CIMB";
//                  checks ignore case)
//   portals      = portals whose dropdown offers it
//   cardSchemes  = default Card Scheme(s) for a company with ONE MID
//                  ([] = the host has no Card Scheme field, e.g. AEON360)
//   schemeOnReview = false: the review page does not show the scheme
//   schemeChoices= schemes the host accepts, in order of preference. A
//                  company with SEVERAL MIDs gets one scheme per MID, never
//                  the same scheme twice ("Duplicate card scheme in form")
//   paymentTypes = default Payment Type(s) a test ticks (must be ENABLED for
//                  this host - the page enables them per host)
//   qrWallets    = QR wallet(s) to tick when Fasspay Wallet / QR is ticked
//                  (the page needs at least one)
//   enabled      = every main Payment Type the host enables, per portal
// ============================================================

export interface Host {
  code: string;
  name: string;
  portals: readonly PortalKey[];
  cardSchemes: readonly string[];
  schemeChoices: readonly string[];
  schemeOnReview?: boolean;
  paymentTypes: readonly PaymentType[];
  qrWallets?: readonly QrWallet[];
  enabled: Partial<Record<PortalKey, readonly PaymentType[]>>;
}

const BOTH = ['aph', 'fassbayar'] as const;

export const Hosts = {
  ACS: {
    code: 'ACS', name: 'Aeon Credit', portals: BOTH,
    cardSchemes: ['Aeon VISA'], schemeChoices: ['Aeon VISA', 'Aeon Mastercard'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail', 'QR', 'Member Info/Top up', 'IPP'], fassbayar: ['Retail', 'QR', 'Member Info/Top up', 'IPP'] }
  },
  HLB: {
    code: 'HLB', name: 'Hong Leong Bank', portals: BOTH,
    cardSchemes: ['HLB VISA'], schemeChoices: ['HLB VISA', 'HLB MASTERCARD'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail', 'MyDebit', 'PreAuth'], fassbayar: ['Retail', 'IPP', 'MyDebit', 'PreAuth'] }
  },
  FP: {
    code: 'FP', name: 'Fasspay QR Host', portals: BOTH,
    // QR host: a Card Scheme must be chosen (FassBayar will not keep Fasspay
    // Wallet ticked without one), but the review page does not show it
    cardSchemes: ['VISA'], schemeChoices: ['VISA', 'MasterCard', 'UPI', 'JCB'], schemeOnReview: false,
    paymentTypes: ['Fasspay Wallet'], qrWallets: ['Fasspay QR'],
    enabled: { aph: ['Fasspay Wallet'], fassbayar: ['Fasspay Wallet', 'DuitNow Static QR'] }
  },
  AMB: {
    code: 'AMB', name: 'AmBank', portals: BOTH,
    // Retail and MyDebit are linked for AmBank: unticking one unticks /
    // re-ticks the other ("Invalid payment type" otherwise)
    cardSchemes: ['AmBank VISA'], schemeChoices: ['AmBank VISA', 'AmBank Mastercard'], paymentTypes: ['Retail', 'MyDebit'],
    enabled: { aph: ['Retail', 'MyDebit'], fassbayar: ['Retail', 'MyDebit'] }
  },
  TPA: {
    code: 'TPA', name: 'TPA', portals: BOTH,
    cardSchemes: ['VISA', 'MasterCard'], schemeChoices: ['VISA', 'MasterCard', 'UPI', 'JCB'], paymentTypes: ['TPA', 'PreAuth'],
    enabled: { aph: ['TPA', 'CashOut', 'PreAuth'], fassbayar: ['TPA', 'CashOut', 'PreAuth'] }
  },
  GP: {
    code: 'GP', name: 'Global Payment', portals: BOTH,
    // GP offers only VISA / MasterCard (FassBayar also HSBC VISA / Mastercard)
    cardSchemes: ['VISA', 'MasterCard'], schemeChoices: ['VISA', 'MasterCard'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail', 'IPP'], fassbayar: ['Retail', 'IPP'] }
  },
  UOB: {
    code: 'UOB', name: 'UOB', portals: BOTH,
    cardSchemes: ['UOB VISA'], schemeChoices: ['UOB VISA', 'UOB Mastercard'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail'], fassbayar: ['Retail'] }
  },
  MBB: {
    code: 'MBB', name: 'Maybank', portals: BOTH,
    cardSchemes: ['MBB VISA'], schemeChoices: ['MBB VISA', 'MBB Mastercard'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail', 'AMEX'], fassbayar: ['Retail', 'IPP', 'AMEX'] }
  },
  CIMB: {
    code: 'CIMB', name: 'CIMB', portals: BOTH,
    cardSchemes: ['CIMB VISA'], schemeChoices: ['CIMB VISA', 'CIMB Mastercard'], paymentTypes: ['Retail'],
    enabled: { aph: ['Retail'], fassbayar: ['Retail', 'IPP'] }
  },
  OCBC: {
    code: 'OCBC', name: 'OCBC', portals: ['fassbayar'],
    cardSchemes: ['OCBC VISA'], schemeChoices: ['OCBC VISA', 'OCBC Mastercard'], paymentTypes: ['Retail'],
    enabled: { fassbayar: ['Retail'] }
  },
  AEON360: {
    code: 'AEON360', name: 'AEON360', portals: ['fassbayar'],
    // No Card Scheme field for AEON360
    cardSchemes: [], schemeChoices: [], paymentTypes: ['Superks'],
    enabled: { fassbayar: ['Superks'] }
  },
  NDPS: {
    code: 'NDPS', name: 'NDPS', portals: ['fassbayar'],
    cardSchemes: ['VISA'], schemeChoices: ['VISA', 'MasterCard', 'UPI', 'JCB'], paymentTypes: ['Retail'],
    enabled: { fassbayar: ['Retail', 'NDPS Wallet'] }
  }
} as const satisfies Record<string, Host>;

export type HostCode = keyof typeof Hosts;

// Card schemes for the MIDs of one company, one list per host (same order).
// One MID: the host's default cardSchemes. Several MIDs: one scheme each,
// never used twice; hosts with fewest choices pick first.
export function allocateCardSchemes(hosts: readonly HostCode[]): string[][] {
  if (hosts.length === 1) return [[...Hosts[hosts[0]].cardSchemes]];

  const used = new Set<string>();
  const result: string[][] = hosts.map(() => []);
  const order = hosts.map((h, i) => i)
    .sort((a, b) => Hosts[hosts[a]].schemeChoices.length - Hosts[hosts[b]].schemeChoices.length);

  for (const i of order) {
    const host = Hosts[hosts[i]];
    if (host.schemeChoices.length === 0) continue;         // no Card Scheme field
    const free = host.schemeChoices.find((s) => !used.has(s));
    if (!free) {
      throw new Error(`No unused card scheme left for host ${host.code} in this company ` +
        `(a scheme can be used by one MID only). Put ${host.code} in another company, ` +
        'or add choices to schemeChoices in common/hosts/hosts.ts');
    }
    used.add(free);
    result[i] = [free];
  }
  return result;
}

export const hostsFor = (portal: PortalKey): HostCode[] =>
  (Object.keys(Hosts) as HostCode[]).filter((c) => (Hosts[c].portals as readonly string[]).includes(portal));
