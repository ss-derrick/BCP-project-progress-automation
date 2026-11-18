// Test data for the "All Companies" module.
// These companies already exist on UAT-APH (seen 17 Nov 2026). The tests
// only search and view them - nothing is created, edited or suspended.
// If one is removed from UAT, pick another from the All Companies list.

export const knownCompany = {
  // The list shows the MID with a "-ACS" suffix, but search only finds
  // the plain MID (searching '202610011060002-ACS' returns No record found)
  mid: '202610011060002',
  midShown: '202610011060002-ACS',
  businessName: 'testcreate888',
  authoriser: 'testcreate888',
  status: 'ACTIVE'
} as const;

// Sync company (TC-APH-002). Seen on the All Companies list, 17 Nov 2026:
//   000452839489382-ACS, 800389283402930-FP, 000452839489381-ACS
//   (Test APH Sync FB) | Nur Hazirah | ACTIVE | 07 Oct 2026
export const syncCompany = {
  mid: '000452839489382',            // search with the plain MID (no -ACS)
  midShown: '000452839489382-ACS',   // how the list shows it
  businessName: 'Test APH Sync FB',
  authoriser: 'Nur Hazirah',
  status: 'ACTIVE'
} as const;

// Date filter start for TC-APH-003 ("from Jan 2026 to current")
export const filterFromJan2026 = new Date(2026, 0, 1);   // 01 Jan 2026

// A search keyword that must not match anything
export const noSuchCompany = 'zzzz-no-such-company-zzzz';

// Companies shown per page in the list
export const ROWS_PER_PAGE = 15;
