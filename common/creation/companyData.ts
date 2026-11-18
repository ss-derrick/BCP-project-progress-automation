import { digits, letters, pick, randInt, uniqueDigits, uniqueTag } from '../utils/random';
import { Portals, type PortalProfile, type SettingKey } from '../config/portals';
import { Hosts, allocateCardSchemes, type HostCode } from '../hosts/hosts';
import type { PaymentType, QrWallet } from '../hosts/paymentTypes';

// ============================================================
// Data for "All Companies > Add a Company" (and the Business + Authoriser
// part of "Add a Parent Company") on EVERY portal.
//
//   createCompanyData(Portals.aph)                          1 MID, default host
//   createCompanyData(Portals.fassbayar, { hosts: ['GP'] }) 1 MID on Global Payment
//   createCompanyData(Portals.aph, { hosts: ['ACS', 'HLB', 'AMB'] })   3 MIDs
//
// Every call returns NEW random values; every MID is a NEW random, unique
// 15-digit number. Sections a portal does not have are left out (see
// common/config/portals.ts), so the shared page skips them.
// ============================================================

// ---------- shapes ----------

// Business Details + Authoriser Details (same fields on Add a Company and
// Add a Parent Company, on every portal)
export interface BusinessAndAuthoriser {
  businessName: string;
  businessShortName: string;          // max 25
  brn: string;                        // Business Registration Number
  sst?: string;                       // FassBayar only
  tin?: string;                       // FassBayar only
  address1: string;
  address2?: string;
  postcode: string;                   // 5 digits
  city: string;                       // max 15
  state: string;                      // option text, e.g. 'Kuala Lumpur'
  businessContact: string;

  salutation: 'Mr.' | 'Ms.' | 'Mrs';
  fullName: string;                   // 3-20 chars
  mobilePrefix: string;               // e.g. 017
  mobileBody: string;                 // e.g. 3218948
  email: string;
  userIdPrefix: string;               // authoriser User ID = prefix + 001
}

// One block of MID Settings ("Add another MID" adds the next one)
export interface MidSetting {
  mid: string;                        // 15 digits, unique
  host: HostCode;                     // Service Provider, see hosts.ts
  dba?: string;                       // FassBayar only
  cardSchemes: string[];              // labels in the Card Scheme list
  paymentTypes: PaymentType[];        // ticked; every other enabled box is unticked
  qrWallets?: QrWallet[];             // with Fasspay Wallet / QR: wallets to tick
  preAuthType?: 'CP' | 'CNP';         // only when PreAuth is ticked
  hostSwingPriority?: number;         // only when the page shows the box (APH, some hosts)
}

export interface BankDetails {
  name: string;                       // option text of Business Bank Name
  accountNo: string;
  holderName: string;
}

export interface TransactionLimits {
  perTransaction: string;             // RM
  perDay: string;
  perMonth: string;
}

export type CompanySettings = Partial<{
  contactless: boolean;
  mccsOptIn: boolean;
  billPayment: boolean;
  bypassVoid: boolean;
  bypassSettlement: boolean;
  unattendedScheduleTime: string;     // 'HH:00'
  applicationIdentifier: string;
  qrScanType: 'Merchant Scan' | 'Customer Scan';
}>;

// A section left out (undefined) is not touched on the form
export interface CompanyData extends BusinessAndAuthoriser {
  bank?: BankDetails;                 // FassBayar only
  mcc?: string;                       // FassBayar only - option value, e.g. '2741'
  limits?: TransactionLimits;
  references?: string[];              // FassBayar only - Special Fields Reference 1..5
  mids: MidSetting[];
  settings?: CompanySettings;
}

// ---------- value pools ----------

// State -> a city in it and its postcode range
const LOCATIONS = [
  { state: 'Kuala Lumpur', city: 'Kuala Lumpur', postcode: [50000, 60000] },
  { state: 'Selangor', city: 'Shah Alam', postcode: [40000, 40990] },
  { state: 'Selangor', city: 'Petaling Jaya', postcode: [46000, 47999] },
  { state: 'Putrajaya', city: 'Putrajaya', postcode: [62000, 62999] },
  { state: 'Labuan', city: 'Labuan', postcode: [87000, 87999] },
  { state: 'Johor', city: 'Johor Bahru', postcode: [80000, 81999] },
  { state: 'Kedah', city: 'Alor Setar', postcode: [5000, 6999] },
  { state: 'Kelantan', city: 'Kota Bharu', postcode: [15000, 16999] },
  { state: 'Malacca', city: 'Melaka', postcode: [75000, 75999] },
  { state: 'Negeri Sembilan', city: 'Seremban', postcode: [70000, 71999] },
  { state: 'Pahang', city: 'Kuantan', postcode: [25000, 26999] },
  { state: 'Perak', city: 'Ipoh', postcode: [30000, 31999] },
  { state: 'Perlis', city: 'Kangar', postcode: [1000, 2999] },
  { state: 'Penang', city: 'George Town', postcode: [10000, 10999] },
  { state: 'Sabah', city: 'Kota Kinabalu', postcode: [88000, 88999] },
  { state: 'Sarawak', city: 'Kuching', postcode: [93000, 93999] },
  { state: 'Terengganu', city: 'Kuala Terengganu', postcode: [20000, 21999] }
] as const;

// Exact option texts of the Business Bank Name list
const BANKS = [
  'Affin Bank Berhad', 'Agro Bank', 'Alliance Bank Malaysia Berhad',
  'Bank Islam Malaysia Berhad', 'Bank Muamalat Malaysia Berhad',
  'Bank Simpanan Nasional Berhad', 'CIMB Bank Berhad', 'Citibank Berhad',
  'HSBC Bank Malaysia Berhad', 'Hong Leong Bank Berhad', 'Malayan Banking Berhad',
  'OCBC Bank (Malaysia) Berhad', 'Public Bank Berhad', 'RHB Bank Berhad',
  'Standard Chartered Bank Malaysia Berhad', 'United Overseas Bank (Malaysia) Bhd.',
  'MBSB Bank Berhad'
] as const;

// Option values of the MCC list (first entries; all valid on the form)
const MCCS = [
  '0742', '0763', '0780', '1520', '1711', '1731', '1740', '1750',
  '1761', '1771', '1799', '2741', '2791', '2842'
] as const;

const FOODS = ['Chicken Rice', 'Nasi Lemak', 'Roti Canai', 'Char Kuey Teow', 'Laksa',
  'Satay', 'Mee Goreng', 'Teh Tarik', 'Cendol', 'Rendang', 'Dim Sum', 'Banana Leaf'];
const BIZ_TYPES = ['Corner', 'House', 'Kitchen', 'Express', 'Station', 'Cafe', 'Bistro', 'Stall'];
const FIRST_NAMES = ['Aiman', 'Farah', 'Wei Jie', 'Mei Ling', 'Arjun', 'Priya', 'Hafiz',
  'Nurul', 'Kumar', 'Siti', 'Jason', 'Michelle', 'Daniel', 'Aisyah'];
const LAST_NAMES = ['Abdullah', 'Tan', 'Lim', 'Rahman', 'Wong', 'Raj', 'Ismail', 'Lee',
  'Chong', 'Hassan', 'Ng', 'Pillai'];
const STREETS = ['Jalan Kiamat', 'Jalan Ampang', 'Jalan Tun Razak', 'Jalan Bukit Bintang',
  'Jalan Sultan Ismail', 'Jalan Raja Chulan', 'Jalan Imbi', 'Jalan Pudu'];
const AREAS = ['Taman Menyala', 'Taman Desa', 'Taman Melawati', 'Taman Tun Dr Ismail',
  'Taman Connaught', 'Taman Sri Gombak', 'Taman Bukit Indah', 'Taman Midah'];
// Malaysian mobile prefixes with a 7-digit body
const MOBILE_PREFIXES = ['012', '013', '014', '016', '017', '018', '019'];

// ---------- helpers ----------

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// True for business names made here, e.g. "Cendol Corner 2P9GZK" - used to
// pick automation-created companies (never real merchants) when a test
// needs an existing company.
const AUTOMATION_NAME = new RegExp(
  `^(${FOODS.map(escapeRegex).join('|')}) (${BIZ_TYPES.map(escapeRegex).join('|')}) [A-Z0-9]{6}$`
);
export const isAutomationCompanyName = (name: string): boolean => AUTOMATION_NAME.test(name.trim());

const randomName = (): string => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

// notifyEmail 'me@company.com' -> 'me+<tag>@company.com' (one mailbox, unique
// address per run), or unchanged on a portal that rejects "+" (APH).
// Empty -> 'qa.<tag>@example.com'.
function uniqueEmail(tag: string, notifyEmail: string, plusAlias: boolean): string {
  if (notifyEmail.includes('@') && !plusAlias) return notifyEmail;
  if (notifyEmail.includes('@')) {
    const [local, domain] = notifyEmail.split('@');
    return `${local}+${tag}@${domain}`;
  }
  return `qa.${tag}@example.com`;
}

// `count` random 15-digit MIDs: unique per run (time-based) and different
// from each other
export function uniqueMids(count: number): string[] {
  const mids = new Set<string>();
  while (mids.size < count) mids.add(uniqueDigits(15));
  return [...mids];
}

// City length limit. Add a Company: input maxlength=15. Add a Parent Company:
// input maxlength=50, BUT its validation rejects longer names
// ("Kuala Terengganu" -> "Please enter valid City"), so 15 for both.
export const CityMaxLength = { company: 15, parentCompany: 15 } as const;

// ---------- generators ----------

export interface BusinessOptions {
  tag?: string;                       // the run's unique tag (default: new)
  cityMaxLength?: number;
  notifyEmail?: string;               // see uniqueEmail()
}

// Random + unique Business and Authoriser details for a portal
export function createBusinessAndAuthoriser(
  portal: PortalProfile,
  { tag = uniqueTag(), cityMaxLength = CityMaxLength.company, notifyEmail = '' }: BusinessOptions = {}
): BusinessAndAuthoriser {
  const TAG = tag.toUpperCase();
  const location = pick(LOCATIONS.filter((l) => l.city.length <= cityMaxLength));

  // "Food BizType TAG" that fits the portal's Business Name check
  const names = FOODS.flatMap((f) => BIZ_TYPES.map((b) => `${f} ${b} ${TAG}`))
    .filter((n) => n.length <= portal.businessNameMaxLength);

  return {
    businessName: pick(names),
    businessShortName: `${pick(BIZ_TYPES)} ${TAG}`,       // < 25 chars
    brn: digits(12),
    ...(portal.sstTin ? { sst: digits(8), tin: digits(10) } : {}),
    address1: `No. ${randInt(1, 999)}, ${pick(STREETS)}`,
    address2: pick(AREAS),
    postcode: String(randInt(location.postcode[0], location.postcode[1])).padStart(5, '0'),
    city: location.city,
    state: location.state,
    businessContact: `03${digits(8, { leadingZero: true })}`,

    salutation: pick(['Mr.', 'Ms.', 'Mrs'] as const),
    fullName: randomName(),
    mobilePrefix: pick(MOBILE_PREFIXES),
    mobileBody: digits(7),
    email: uniqueEmail(tag, notifyEmail, portal.emailPlusAlias),
    // 8 random letters: 3 letters collided with existing APH users ("Duplicated. Not Available")
    userIdPrefix: letters(8)
  };
}

// One MID block for a host, with the host's default card scheme(s) and
// payment type(s) from hosts.ts
export function createMid(
  portal: PortalProfile, host: HostCode, mid: string, row = 0, tag = uniqueTag(),
  cardSchemes: string[] = [...Hosts[host].cardSchemes]
): MidSetting {
  const h = Hosts[host];
  if (!(h.portals as readonly string[]).includes(portal.key)) {
    throw new Error(`Host ${host} (${h.name}) is not offered on ${portal.name} - see common/hosts/hosts.ts`);
  }
  return {
    mid,
    host,
    ...(portal.dba ? { dba: `${pick(FOODS)} ${tag.toUpperCase()}` } : {}),
    cardSchemes,
    paymentTypes: [...h.paymentTypes],
    ...('qrWallets' in h ? { qrWallets: [...h.qrWallets] } : {}),
    ...((h.paymentTypes as readonly string[]).includes('PreAuth') ? { preAuthType: 'CNP' as const } : {}),
    hostSwingPriority: row + 1
  };
}

export interface CompanyOptions extends Omit<BusinessOptions, 'tag'> {
  // One MID per host, in this order (default: one MID on TPA)
  hosts?: HostCode[];
  // Change any generated value afterwards
  overrides?: Partial<CompanyData>;
}

export function createCompanyData(portal: PortalProfile, opts: CompanyOptions = {}): CompanyData {
  const tag = uniqueTag();
  const hosts = opts.hosts ?? ['TPA'];
  const mids = uniqueMids(hosts.length);
  const schemes = allocateCardSchemes(hosts);

  const perTransaction = randInt(1_000, 50_000);
  const perDay = perTransaction * randInt(2, 10);
  const perMonth = perDay * randInt(10, 30);

  const data: CompanyData = {
    ...createBusinessAndAuthoriser(portal, { ...opts, tag }),

    ...(portal.bankDetails ? {
      bank: { name: pick(BANKS), accountNo: digits(randInt(12, 16)), holderName: randomName() }
    } : {}),
    ...(portal.mcc ? { mcc: pick(MCCS) } : {}),
    limits: {
      perTransaction: String(perTransaction),
      perDay: String(perDay),
      perMonth: String(perMonth)
    },
    ...(portal.specialFields ? {
      references: [1, 2, 3, 4, 5].map((n) => `REF${n}-${tag.toUpperCase()}`)
    } : {}),

    mids: hosts.map((h, i) => createMid(portal, h, mids[i], i, tag, schemes[i])),

    settings: defaultSettings(portal)
  };

  return { ...data, ...opts.overrides };
}

// Settings: the agreed example values, only for settings this portal has.
// APH: none set (the form defaults are kept).
function defaultSettings(portal: PortalProfile): CompanySettings | undefined {
  if (portal.key === 'aph') return undefined;
  const all: Required<CompanySettings> = {
    contactless: true,
    mccsOptIn: true,
    billPayment: true,
    bypassVoid: true,
    bypassSettlement: true,
    unattendedScheduleTime: '05:00',
    applicationIdentifier: 'Fasspay Bayar',
    qrScanType: 'Merchant Scan'
  };
  return Object.fromEntries(
    (Object.keys(all) as SettingKey[]).filter((k) => portal.settings.includes(k)).map((k) => [k, all[k]])
  ) as CompanySettings;
}

export { Portals };
