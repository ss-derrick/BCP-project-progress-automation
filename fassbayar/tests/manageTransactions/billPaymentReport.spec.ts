import { test, expect } from '../../fixtures/pages';
import { testCase } from '../../../common/utils/testCase';
import { loginAs } from '../../../common/flows/loginFlow';
import { ENV_NAME } from '../../../portals.config';
import { knownBillPaymentFor } from '../../../common/testdata/knownBillPayments';

// FASSBAYAR ONLY - Manage Transactions > Bill Payment Report.
// APH has no Bill Payment Report, so this spec is in fassbayar/tests and only
// runs when ENV_NAME is a Fassbayar environment.
// Read-only: search + view details.
// Run only this submodule:  $env:ENV_NAME='UAT-Fassbayar'; npx playwright test --grep @bill-payment-report

const MODULE = 'Manage Transactions';

test.describe('Manage Transactions > Bill Payment Report', { tag: ['@fassbayar', '@bill-payment-report'] }, () => {

  test.beforeEach(async ({ loginPage, consolePage, billPaymentReportPage }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open Manage Transactions > Bill Payment Report', async () => {
      await billPaymentReportPage.open();
    });
  });

  test(
    'Search a bill payment by Business Name and date range, and view its details',
    testCase({ id: 'TC-BILL-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ billPaymentReportPage, billPaymentDetailsPage }) => {

      const bill = knownBillPaymentFor(ENV_NAME);
      test.skip(!bill, `No known bill payment for ${ENV_NAME} (common/testdata/knownBillPayments.ts)`);
      const { businessName, mid, from, to, status, dateTime, batchNo } = bill!;

      // Content: Business Name + Date from / to, Search
      await test.step(`Search Business Name ${businessName}, Date ${from} to ${to}`, async () => {
        await billPaymentReportPage.search({ businessName, from, to });
      });

      // Validation: the bill payment is returned with its data
      await test.step('Verify the bill payment is returned', async () => {
        expect(await billPaymentReportPage.getTotalRecords(), 'Total Records').toBeGreaterThanOrEqual(1);

        const row = billPaymentReportPage.row(`${businessName}(${mid})`).filter({ hasText: dateTime });
        await expect(row).toHaveCount(1);

        const shown = await billPaymentReportPage.readRow(row);
        expect(shown.businessName, 'Business Name').toBe(businessName);
        expect(shown.mid, 'MID').toBe(mid);
        expect(shown.status, 'Status').toBe(status);
        expect(shown.dateTime, 'Date/Time').toContain(dateTime);

        await billPaymentReportPage.captureScreen(`Search result - ${businessName}`);
      });

      // Content: View Details
      await test.step('Open View Details', async () => {
        await billPaymentReportPage.openDetails(
          billPaymentReportPage.row(`${businessName}(${mid})`).filter({ hasText: dateTime })
        );
      });

      // Validation: the details page is this batch
      await test.step(`Verify Bill Payment Details for Batch No. ${batchNo}`, async () => {
        await billPaymentDetailsPage.verifyOpenedFor(batchNo);
        await billPaymentDetailsPage.verifySettlementMessage(status);
        await billPaymentDetailsPage.captureScreen(`Bill Payment Details - Batch ${batchNo}`);
      });
    }
  );
});
