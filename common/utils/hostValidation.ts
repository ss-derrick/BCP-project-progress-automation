import type { HostProfile } from '../hosts';
import { MAYBANK_AMEX_MID } from '../hosts';

// Host-specific rules, written once and used by every portal.

// Does the form accept this MID for this host?
export function isValidMid(host: HostProfile, mid: string, cardSchemes: string[] = []): boolean {
  // Maybank AMEX uses a 10-digit MID (the form's regex_mid_mbb_amex)
  if (host.code === 'MBB' && cardSchemes.some((s) => /AMEX/i.test(s))) {
    return MAYBANK_AMEX_MID.test(mid);
  }
  return host.midPattern.test(mid);
}

// How the company list shows a MID of this host, e.g. 202610011060002-ACS
export const shownMid = (host: HostProfile, mid: string): string => `${mid}${host.midSuffix}`;

// What the search box needs: the MID WITHOUT the host suffix
// (searching '202610011060002-ACS' finds nothing, '202610011060002' finds it)
export const searchableMid = (shown: string): string => shown.replace(/-[A-Z]+$/, '');

// Payment types the review / details page should show for this host, given
// what the test ticked (the form adds some by itself, e.g. AmBank + My Debit)
export const expectedPaymentTypes = (host: HostProfile, ticked: string[]): string[] =>
  [...new Set([...ticked, ...(host.autoTicked ?? [])])];

// Which payment-type boxes SHOULD be selectable for this host, given what is
// ticked now. Every box on the row is listed (onRow = the row's checkbox names):
//   - a type the host does not offer   -> disabled
//   - exclusive host + one type ticked -> the host's other types disabled
//   - otherwise                        -> enabled
export function expectedPaymentTypeState(
  host: HostProfile,
  onRow: string[],
  ticked: string[] = []
): Record<string, 'enabled' | 'disabled'> {
  const offered = new Set<string>(host.paymentTypes);
  const lockedByChoice = host.exclusivePaymentTypes && ticked.some((t) => offered.has(t));
  const out: Record<string, 'enabled' | 'disabled'> = {};
  for (const type of onRow) {
    if (!offered.has(type)) out[type] = 'disabled';
    else if (lockedByChoice && !ticked.includes(type)) out[type] = 'disabled';
    else out[type] = 'enabled';
  }
  return out;
}
