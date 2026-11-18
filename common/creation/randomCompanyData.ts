import { pick, randInt, digits, letters } from '../utils/random';
import type { AuthoriserDetails } from './types';

// Pools of REALISTIC, FORM-VALID values for "Add a Company" test data.
// Every value here passes the form's own rules on both portals (regex_* from
// the scans of 18 Nov 2026, explore/scan/results/). hostCompanyData.ts picks
// from these on every run, so each company gets different data.

// ---------- location: postcode, city and state always match ----------
// city: regex_city = letters / digits / spaces, 2-15 chars
// state: exactly as the "Region / State" dropdown shows it
export interface Location {
  city: string;
  postcode: string;
  state: string;
  areaCode: string;      // landline prefix, for the business contact number
}

export const LOCATIONS: Location[] = [
  { city: 'Kuala Lumpur', postcode: '50450', state: 'Kuala Lumpur', areaCode: '03' },
  { city: 'Putrajaya', postcode: '62000', state: 'Putrajaya', areaCode: '03' },
  { city: 'Shah Alam', postcode: '40000', state: 'Selangor', areaCode: '03' },
  { city: 'Petaling Jaya', postcode: '46000', state: 'Selangor', areaCode: '03' },
  { city: 'Johor Bahru', postcode: '80000', state: 'Johor', areaCode: '07' },
  { city: 'George Town', postcode: '10200', state: 'Penang', areaCode: '04' },
  { city: 'Ipoh', postcode: '30000', state: 'Perak', areaCode: '05' },
  { city: 'Melaka', postcode: '75000', state: 'Malacca', areaCode: '06' },
  { city: 'Seremban', postcode: '70000', state: 'Negeri Sembilan', areaCode: '06' },
  { city: 'Kuantan', postcode: '25000', state: 'Pahang', areaCode: '09' },
  { city: 'Kota Bharu', postcode: '15000', state: 'Kelantan', areaCode: '09' },
  { city: 'Alor Setar', postcode: '05000', state: 'Kedah', areaCode: '04' },
  { city: 'Kangar', postcode: '01000', state: 'Perlis', areaCode: '04' },
  { city: 'Kota Kinabalu', postcode: '88000', state: 'Sabah', areaCode: '088' },
  { city: 'Kuching', postcode: '93000', state: 'Sarawak', areaCode: '082' },
  { city: 'Labuan', postcode: '87000', state: 'Labuan', areaCode: '087' }
];

// Landline for a location: area code + digits = 10 or 11 digits, e.g. 0378123456
export const landline = (loc: Location): string =>
  loc.areaCode + digits(loc.areaCode.length === 2 ? 8 : 6);

// ---------- business ----------
// Trading names: max 12 chars, so "<name> <12-digit stamp>" fits APH's 25
const TRADE_NAMES = [
  'Kedai Maju', 'Sinar Jaya', 'Mega Mart', 'Bistro Kita', 'Pasar Segar', 'Kopi Corner',
  'Restoran Ali', 'Mewah Emas', 'Bunga Raya', 'Cahaya Baru', 'Gemilang', 'Seri Murni',
  'Urban Cafe', 'Fresh Daily', 'Golden Wok', 'Teh Tarik Co', 'Kasih Mart', 'Delima Store'
];
const COMPANY_SUFFIXES = ['Sdn Bhd', 'Enterprise', 'Trading', 'Resources', 'Holdings'];

// "<trading name> [<suffix>] <stamp>", cut to the portal's max WITHOUT losing the stamp
// (the stamp keeps the name unique and tells when it was created)
export function businessName(stamp: string, max: number): { name: string; trade: string } {
  const trade = pick(TRADE_NAMES);
  const withSuffix = `${trade} ${pick(COMPANY_SUFFIXES)} ${stamp}`;
  return { trade, name: withSuffix.length <= max ? withSuffix : `${trade} ${stamp}` };
}

// SSM-style registration number: year + entity type + 6 digits, e.g. 201901123456
export const registrationNo = (): string =>
  `${randInt(1990, 2025)}${pick(['01', '03'])}${digits(6, { leadingZero: true })}`;

// SST registration number, e.g. W10-1808-31001234
export const sstNo = (): string =>
  `${pick(['W10', 'B16', 'J31', 'P11', 'A12'])}-${randInt(18, 25)}${String(randInt(1, 12)).padStart(2, '0')}-` +
  digits(8);

// Company TIN: "C" + 10 digits, e.g. C2584563201
export const tinNo = (): string => `C${digits(10)}`;

// regex_address = letters / digits / space _ - , . & @ ' /, max 50
const STREETS = ['Bukit Bintang', 'Ampang', 'Tun Razak', 'Merdeka', 'Sultan Ismail', 'Raja Laut',
  'Damai', 'Mawar', 'Cempaka', 'Kenanga', 'Perdana', 'Bestari', 'Indah', 'Setia'];
const AREAS = ['Taman Melati', 'Taman Desa', 'Taman Bukit Indah', 'Taman Sri Muda', 'Taman Universiti',
  'Bandar Baru', 'Taman Tun Dr Ismail', 'Taman Seri Gombak', 'Taman Sentosa', 'Taman Permata'];

export const address1 = (): string => `No. ${randInt(1, 199)}, Jalan ${pick(STREETS)} ${randInt(1, 20)}`;
export const address2 = (): string => pick(AREAS);

// ---------- authoriser ----------
// Names max 20 chars (APH regex_name 3-20; Fassbayar 2-50)
const MALE_NAMES = ['Ahmad Faizal', 'Tan Wei Ming', 'Muthu Kumar', 'Lim Chee Keong', 'Hafiz Rahman',
  'Wong Kah Hoe', 'Arif Hakimi', 'Rajesh Nair', 'Daniel Lee', 'Azman Ismail'];
const FEMALE_NAMES = ['Siti Aminah', 'Tan Mei Ling', 'Priya Devi', 'Nurul Huda', 'Chong Siew Yin',
  'Aisyah Zainal', 'Kavitha Rao', 'Lee Hui Min', 'Farah Nadia', 'Ng Pei Shan'];

export function authoriserPerson(): { salutation: AuthoriserDetails['salutation']; fullName: string } {
  return Math.random() < 0.5
    ? { salutation: 'Mr.', fullName: pick(MALE_NAMES) }
    : { salutation: pick(['Ms.', 'Mrs'] as const), fullName: pick(FEMALE_NAMES) };
}

// Mobile: prefix 01X (regex_contact_prefix_mobile = 3 digits) + 7 digits
// (APH regex_contact_body 7-8 digits, Fassbayar 0-12)
export const mobilePrefix = (): string => pick(['010', '011', '012', '013', '014', '016', '017', '018', '019']);
export const mobileBody = (): string => digits(7);

// Email from the person's name, unique tag, @example.com (no real mailbox).
// regex_email: domain + TLD lowercase, local part letters / digits / . _ + -
export const emailFor = (fullName: string): string =>
  `${fullName.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}.${letters(4)}@example.com`;

// ---------- bank / MCC / references (Fassbayar only) ----------
// Exactly as the Business Bank Name dropdown shows them (Fassbayar, 31 banks)
export const BANKS = [
  'Affin Bank Berhad', 'Agro Bank', 'Alliance Bank Malaysia Berhad',
  'Al-Rajhi Banking and Investment Corporation (Malaysia) Berhad', 'Arab-Malaysian Bank Berhad',
  'BNP Paribas Malaysia Berhad', 'Bank Islam Malaysia Berhad', 'Bank Kerjasama Rakyat Berhad',
  'Bank Muamalat Malaysia Berhad', 'Bank of America Malaysia Berhad', 'Bank Simpanan Nasional Berhad',
  'CIMB Bank Berhad', 'Citibank Berhad', 'Deutsche Bank (Malaysia) Berhad', 'HSBC Bank Malaysia Berhad',
  'Hong Leong Bank Berhad', 'Industrial and Commercial Bank of China (Malaysia) Berhad',
  'J.P. Morgan Chase Bank Berhad', 'Kuwait Finance House', 'Malayan Banking Berhad',
  'Mizuho Bank (Malaysia) Berhad', 'OCBC Bank (Malaysia) Berhad', 'Public Bank Berhad', 'RHB Bank Berhad',
  'Standard Chartered Bank Malaysia Berhad', 'Sumitomo Mitsui Banking Corporation Malaysia Berhad',
  'United Overseas Bank (Malaysia) Bhd.', 'MBSB Bank Berhad', 'Bank of China (M) Berhad', 'MUFG Bank',
  'China Construction Bank (M) Berhad'
];

// Common retail MCCs (values in the MCC dropdown, 875 codes on Fassbayar)
export const MCC_CODES = ['4121', '5311', '5411', '5691', '5732', '5812', '5814', '5912', '5999', '8099'];

// regex_accNo = 0-30 digits
export const bankAccountNo = (): string => digits(12);

// regex_specialField = letters / digits / space . , : ; ? ! - _ / ( ) & @ # % + * ' $, max 100
export const referenceValue = (n: number): string =>
  `REF${n}-${letters(3).toUpperCase()}${digits(5)}`;
