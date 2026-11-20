// Companies that already exist on the portals, used by the search scenarios.
// Tests only search and view them: nothing is created, edited or suspended.
// If one is removed from UAT, pick another from the All Companies list.

export interface KnownCompany {
  mid: string;            // search with the plain MID (searching with the suffix finds nothing)
  midShown: string;       // first MID as the list shows it, with the host suffix
  businessName: string;
  authoriser: string;
  status: string;
}

// Sync company: synced to BOTH portals, same data on APH and Fassbayar.
// Seen 17 Nov 2026 on UAT-APH and UAT-Fassbayar:
//   000452839489382-ACS, 800389283402930-FP, 000452839489381-ACS
//   (Test APH Sync FB) | Nur Hazirah | ACTIVE
export const syncCompany: KnownCompany = {
  mid: '000452839489382',
  midShown: '000452839489382-ACS',
  businessName: 'Test APH Sync FB',
  authoriser: 'Nur Hazirah',
  status: 'ACTIVE'
};
