import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { ENV_NAME } from '../../../portals.config';
import { knownTransactionFor } from '../../testdata/knownTransactions';

// Manage Transactions > Transaction Summary - SHARED: runs on APH and Fassbayar.
// Read-only: searches and views an existing transaction. Never voids it.
// Test data: the NEWEST transaction of today (the list opens on today), so it is not archived yet
// (APH shows archived transaction details only 22:00 - 06:00). None today -> the known transaction of
// the environment (common/testdata/knownTransactions.ts); archived -> Human action (time window).
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

      // Test data: today's newest transaction, else the environment's known one
      const known = knownTransactionFor(ENV_NAME);
      let trxId = await transactionSummaryPage.newestTransactionId();
      if (trxId) {
        test.info().annotations.push({ type: 'test data', description: `Newest transaction of today: ${trxId}` });
      } else {
        test.skip(!known, `No transaction today and no known transaction for ${ENV_NAME} (common/testdata/knownTransactions.ts)`);
        trxId = known!.trxId;
      }
      let status = '';

      // Content: search the Transaction ID
      await test.step(`Search Transaction ID ${trxId}`, async () => {
        await transactionSummaryPage.search(trxId);
      });

      // Validation: exactly this transaction comes back
      await test.step('Verify exactly this transaction is returned', async () => {
        expect(await transactionSummaryPage.getTotalRecords(), 'Total Records').toBe(1);

        const row = transactionSummaryPage.row(trxId);
        await expect(row).toHaveCount(1);

        const shown = await transactionSummaryPage.readRow(row);
        expect(shown['Transaction ID'], 'Transaction ID').toBe(trxId);
        status = shown['Status'];
        expect(status, 'Status shown').not.toBe('');
        if (trxId === known?.trxId) expect(status, 'Status').toBe(known.status);

        await transactionSummaryPage.captureScreen(`Search result - ${trxId} (${status})`);
      });

      // Content: View Details
      await test.step('Open View Details', async () => {
        const opened = await transactionSummaryPage.openDetails(transactionSummaryPage.row(trxId));
        if (opened === 'archive') {
          await transactionSummaryPage.captureScreen('Archive hours message');
          test.skip(true, `Human action required: transaction ${trxId} is archived; its details can only be viewed 22:00 - 06:00`);
        }
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
