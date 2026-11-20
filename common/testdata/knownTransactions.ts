// Transactions that already exist on each environment, used by the
// Manage Transactions > Transaction Summary scenarios (search + view only).
// Unlike the sync company, a transaction lives on ONE portal: one per environment.
// An environment with no entry -> its transaction scenarios are skipped there.

export interface KnownTransaction {
  trxId: string;
  status: string;        // as the portal shows it
  note: string;          // where it came from
}

export const knownTransactions: Record<string, KnownTransaction> = {
  'UAT-APH': {
    trxId: '10029595181126001164',
    // Was 'Approved' on 18 Nov; settled since (QA team, 19 Nov 2026).
    // A transaction's status moves on when its batch settles: update it here.
    status: 'Settled',
    note: 'Given by the QA team, 18 Nov 2026; status Settled from 19 Nov 2026'
  },
  'UAT-FASSBAYAR': {
    trxId: '18052434181126000560',
    // Was 'Approved' on 18 Nov; its batch was credit-settled (QA team, 19 Nov 2026).
    status: 'Settled',
    note: 'Given by the QA team, 18 Nov 2026; status Settled from 19 Nov 2026'
  }
};

export const knownTransactionFor = (env: string): KnownTransaction | undefined =>
  Object.entries(knownTransactions).find(([name]) => name.toUpperCase() === env.toUpperCase())?.[1];
