import type { HostProfile } from '../hosts';
import type { PaymentTypeKey } from '../hosts/types';
import type { BusinessDetails, AuthoriserDetails, CompanyExtras } from './types';
import { PORTAL_PROFILE, type PortalProfile } from '../../portals.config';
import { pick, randInt, letters } from '../utils/random';
import * as R from './randomCompanyData';

// Authoriser email: random @example.com per company by default (no real
// mailbox). Set AUTHORISER_EMAIL in .env to send every company's authoriser
// mail to one real address instead.
export const AUTHORISER_EMAIL = process.env.AUTHORISER_EMAIL ?? '';

// Builds a NEW company for one host that is valid on the given portal.
// RANDOM on every call: business, authoriser, location, bank, MCC, references
// (pools in randomCompanyData.ts). UNIQUE: business name, short name, user ID
// prefix and MID carry a timestamp, so runs never collide and a company can be
// traced to its run. Lengths come from the portal's form rules
// (portals.config.ts); MID rule, card schemes and payment types from the host.
// Transaction limits are not touched (the form's defaults stay).

export interface NewHostCompany {
  host: HostProfile;
  business: BusinessDetails;
  authoriser: AuthoriserDetails;
  extras: CompanyExtras;         // fields only some portals have (Fassbayar fills them)
  mid: string;
  cardSchemes: string[];
  paymentTypes: PaymentTypeKey[];
  // portal-only MID-row values (the portal page uses the one it has)
  hostSwingPriority: number;     // APH
  dba: string;                   // Fassbayar (max 25)
}

// yyMMddHHmmss, e.g. 261118103045
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function createCompanyForHost(host: HostProfile, portal: PortalProfile = PORTAL_PROFILE): NewHostCompany {
  const s = stamp();
  const form = portal.form;
  const fit = (text: string, max: number) => text.slice(0, max);

  // MID: 12-digit stamp + 3 random digits = 15 (checked against the host's rule)
  const mid = `${s}${String(randInt(0, 999)).padStart(3, '0')}`;
  if (!host.midPattern.test(mid)) {
    throw new Error(`Generated MID ${mid} does not match ${host.name}'s rule ${host.midPattern}`);
  }

  const { name, trade } = R.businessName(s, form.businessNameMax);   // e.g. "Sinar Jaya Trading 261118103045"
  const loc = pick(R.LOCATIONS);
  const person = R.authoriserPerson();
  const contactBody = R.mobileBody();
  if (!form.contactBody.test(contactBody)) {
    throw new Error(`Generated contact number ${contactBody} does not match ${portal.name}'s rule ${form.contactBody}`);
  }

  return {
    host,
    business: {
      businessName: name,
      businessShortName: fit(`${trade.replace(/\s+/g, '')}${s}`, 25),   // trade name cut, stamp kept
      registrationNo: R.registrationNo(),
      address1: R.address1(),
      address2: R.address2(),
      postcode: loc.postcode,
      city: loc.city,
      state: loc.state,
      businessContact: R.landline(loc)
    },
    authoriser: {
      salutation: person.salutation,
      fullName: fit(person.fullName, form.nameLength[1]),
      contactPrefix: R.mobilePrefix(),
      contactBody,
      email: AUTHORISER_EMAIL || R.emailFor(person.fullName),
      userIdPrefix: `${letters(3)}${s}`                 // e.g. "kqz261118103045", unique
    },
    extras: {
      sst: R.sstNo(),
      tin: R.tinNo(),
      bankName: pick(R.BANKS),
      bankAccountNo: R.bankAccountNo(),
      bankAccountHolder: fit(name, 50),
      mcc: pick(R.MCC_CODES),
      references: [1, 2, 3, 4, 5].map(R.referenceValue)
    },
    mid,
    cardSchemes: host.cardSchemes.slice(0, 1),           // the host's first scheme, e.g. VISA
    paymentTypes: host.paymentTypes.slice(0, 1),         // the host's first payment type, e.g. retail
    hostSwingPriority: 1,
    dba: fit(`${trade} ${s}`, 25)
  };
}
