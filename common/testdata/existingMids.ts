// MIDs that already exist on an environment, for "duplicate MID" checks.
// Per environment: a MID is real data on ONE environment only.
// An environment with no entry -> the duplicate-MID scenario is skipped there.

export interface ExistingMid {
  mid: string;
  hostCode: string;      // the host it was registered with
  note: string;          // where it came from
}

export const existingMids: Record<string, ExistingMid> = {
  'UAT-APH': {
    mid: '261118112937535',
    hostCode: 'GP',
    note: 'Global Payment company created by TC-COMP-001 on 18 Nov 2026, 11:29'
  },
  'UAT-FASSBAYAR': {
    mid: '261118140251604',
    hostCode: 'GP',
    note: 'Global Payment company created by TC-COMP-001 on 18 Nov 2026, 14:02'
  }
};

export const existingMidFor = (env: string): ExistingMid | undefined =>
  Object.entries(existingMids).find(([name]) => name.toUpperCase() === env.toUpperCase())?.[1];
