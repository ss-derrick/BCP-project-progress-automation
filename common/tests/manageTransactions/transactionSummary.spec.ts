import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { ENV_NAME } from '../../../portals.config';
import { knownTransactionFor } from '../../testdata/knownTransactions';

// Manage Transactions > Transaction Summary - SHARED: runs on APH and Fassbayar.
// Read-only: searches and views an existing transaction. Never voids it.
// The trxID differs per environment (common/testdata/knownTransactions.ts).
// Run only this submodule:  npx playwright test --grep @transaction-summary

const MODULE = 'Manage Transactions';

test.describe('Manage Transactions > Transaction Summary', { tag: '@transaction-summary' }, () => {

  test.beforeEach(async ({ loginPage, consolePage, transactionSummaryPage }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open Manage Transactions > Transaction Summary', async () => {
      await transactionSummaryPage.open();
    });
  });

  test(
    'Search a transaction by Transaction ID and view its details',
    testCase({ id: 'TC-TRX-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ transactionSummaryPage, transactionDetailsPage }) => {

      const trx = knownTransactionFor(ENV_NAME);
      test.skip(!trx, `No known transaction for ${ENV_NAME} (common/testdata/knownTransactions.ts)`);
      const { trxId, status } = trx!;

      // Content: search the Transaction ID
      await test.step(`Search Transaction ID ${trxId}`, async () => {
        await transactionSummaryPage.search(trxId);
      });

      // Validation: exactly this transaction comes back, Approved
      await test.step(`Verify the transaction is returned with status ${status}`, async () => {
        expect(await transactionSummaryPage.getTotalRecords(), 'Total Records').toBe(1);

        const row = transactionSummaryPage.row(trxId);
        await expect(row).toHaveCount(1);

        const shown = await transactionSummaryPage.readRow(row);
        expect(shown['Transaction ID'], 'Transaction ID').toBe(trxId);
        expect(shown['Status'], 'Status').toBe(status);

        await transactionSummaryPage.captureScreen(`Search result - ${trxId}`);
      });

      // Content: View Details
      await test.step('Open View Details', async () => {
        await transactionSummaryPage.openDetails(transactionSummaryPage.row(trxId));
      });

      // Validation: the details page is this transaction, Payment Status Approved
      await test.step('Verify the transaction details', async () => {
        await transactionDetailsPage.verifyOpenedFor(trxId);
        await transactionDetailsPage.verifyPaymentStatus(status);
        await transactionDetailsPage.captureScreen(`Transaction details - ${trxId}`);
      });
    }
  );
});
