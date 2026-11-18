// Test data for "Parent Company Summary".
// Existing parent company on UAT-APH, seen 17 Nov 2026 (read-only tests).

export const masterParentCompany = {
  searchKeyword: 'test_kw_master',
  businessName: 'Test_kw_Master',
  businessShortName: 'test_kw_master',
  authoriser: 'test_kw_master',
  authoriserUserId: 'test_kw_master001',
  status: 'ACTIVE',
  merchantType: 'Master Merchant',
  // Child company linked to it
  child: {
    businessName: 'Test_kw_child1',
    mid: '202610011010002-ACS'
  }
} as const;
