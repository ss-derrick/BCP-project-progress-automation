import type { PaymentTypeKey } from '../hosts';

// Data shapes for "Add a Company", used by creation/hostCompanyData.ts.

// Payment Type checkbox name prefixes (checkbox name = prefix + 'Checkbox' + row)
export const PaymentType = {
  RETAIL: 'retail',
  QR: 'qr',
  MEMBER_INFO_TOP_UP: 'member',
  IPP: 'ipp',
  FASSPAY_WALLET: 'fasspayWallet',
  MY_DEBIT: 'myDebit',
  TPA: 'tpa',
  CASH_OUT: 'cashOut',
  PRE_AUTH: 'preAuth',
  AMEX: 'amex'
} as const satisfies Record<string, PaymentTypeKey>;

export interface BusinessDetails {
  businessName: string;          // 1-25 chars (form rule)
  businessShortName: string;     // 1-25 chars
  registrationNo: string;        // BRN, max 30
  address1: string;
  address2?: string;
  postcode: string;              // 5 digits
  city: string;                  // 2-15 chars
  state: string;                 // e.g. 'Kuala Lumpur'
  businessContact: string;       // max 20
}

export interface AuthoriserDetails {
  salutation: 'Mr.' | 'Ms.' | 'Mrs';
  fullName: string;              // 3-20 chars
  contactPrefix: string;         // e.g. '012'
  contactBody: string;           // e.g. '3456789'
  email: string;
  userIdPrefix?: string;         // "User ID Prefix", 3-20 chars
}

// Company fields only some portals have (Fassbayar: portals.config features.sstTin).
// Always generated; only a portal page that has the fields fills them.
export interface CompanyExtras {
  sst: string;                   // Sales and Services Tax (SST), max 50
  tin: string;                   // Tax Identification Number (TIN), max 50
  bankName: string;              // Business Bank Name, as the dropdown shows it
  bankAccountNo: string;         // 0-30 digits
  bankAccountHolder: string;     // max 50
  mcc: string;                   // Merchant Category Code value, e.g. '5411'
  references: string[];          // Reference 1-5, max 100 each
}
