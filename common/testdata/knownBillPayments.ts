// Bill payment batches that already exist, for Manage Transactions >
// Bill Payment Report (a FASSBAYAR-ONLY screen: APH has no Bill Payment Report).
// Search + view only. Keyed by environment like the other known-data files.

export interface KnownBillPayment {
  businessName: string;
  mid: string;            // shown in brackets after the business name
  from: string;           // date filter, as the portal writes it: dd MMM yyyy
  to: string;
  status: string;         // Successful / Unsuccessful / Pending / Processing
  dateTime: string;       // Date/Time column, e.g. '21 Oct 2026'
  batchNo: string;        // "Batch No. : 000060" on Bill Payment Details
  note: string;
}

export const knownBillPayments: Record<string, KnownBillPayment> = {
  'UAT-FASSBAYAR': {
    businessName: 'Harris_LH',
    mid: '800030000000171',
    from: '01 Oct 2026',
    to: '01 Nov 2026',
    status: 'Successful',
    dateTime: '21 Oct 2026',
    batchNo: '000060',
    note: 'Given by the QA team; seen by the read-only scan, 18 Nov 2026 (batchId=60)'
  }
};

export const knownBillPaymentFor = (env: string): KnownBillPayment | undefined =>
  Object.entries(knownBillPayments).find(([name]) => name.toUpperCase() === env.toUpperCase())?.[1];
