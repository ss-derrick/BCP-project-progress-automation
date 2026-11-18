// Named values for existing records and the portal's magic values.

// Bulk Company Upload (Create) template
export const BulkUploadTemplate = {
  fileName: 'sampleBulkCompanyMobileUserUpload.csv',
  // Columns that must be in the header row (the template has many more)
  requiredColumns: [
    'Business Name', 'Business Short Name', 'BRN', 'SST', 'TIN',
    'Address 1', 'Address 2', 'Post code', 'City', 'State', 'Business Contact No',
    'Authoriser Name', 'Authoriser Contact', 'Authoriser Email',
    'Service Provider', 'Card Scheme', 'TPA MID', 'TPA TID', 'TPA DBA', 'TPA Payment Type'
  ]
} as const;

// Bulk Company Upload (Edit) template - semicolon separated
export const BulkEditTemplate = {
  fileName: 'sampleBulkCompanyEditUpload.csv',
  separator: ';',
  header: ['CompanyID', 'Business Name', 'Reference1', 'Reference2', 'Reference3', 'Reference4', 'Reference5'],
  // The sample row points to a company that does not exist on this server
  sampleRowError: /CompanyID '\d+' does not exist/
} as const;

// Company whose special fields (Reference 1-5) the bulk edit test updates.
// CompanyID = the "itemid" in /company/viewDetails?itemid=...
// Default: a company created by this automation (safe to change).
// Override for one run:  $env:EDIT_COMPANY_ID='2089'
export const BulkEditTargetCompanyId = process.env.EDIT_COMPANY_ID ?? '2089';

// Company that gets the new logo in "Upload Company Logo" (company id = itemid).
// The upload list only offers companies WITHOUT a logo, so by default the
// test picks the newest automation-created company still in that list.
// Pick a specific one for a run:  $env:LOGO_COMPANY_ID='2103'
export const LogoTargetCompanyId: string | undefined = process.env.LOGO_COMPANY_ID;

// Company whose logo "Remove Company Logo" removes. The list only offers
// companies that HAVE a logo; by default the test takes the FIRST
// automation-created company in it (never a real merchant).
// Pick a specific one for a run:  $env:REMOVE_LOGO_COMPANY_ID='2113'
export const RemoveLogoCompanyId: string | undefined = process.env.REMOVE_LOGO_COMPANY_ID;

// An existing company used by the search tests.
// Override the MID for one run:  $env:SEARCH_MID='800010000000079'
// (businessName / authoriser checks are skipped when the MID is overridden)
const searchMidOverride = process.env.SEARCH_MID;

export const ExistingCompany = {
  mid: searchMidOverride ?? '000452839489382',
  businessName: searchMidOverride ? undefined : 'Test APH Sync FB',
  authoriser: searchMidOverride ? undefined : 'Nur Hazirah',
  status: searchMidOverride ? undefined : 'ACTIVE'
} as const;
