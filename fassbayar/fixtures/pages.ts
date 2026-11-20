import { test as base, expect } from '../../common/fixtures/base';

// Fassbayar-only page fixtures: screens that exist only on Fassbayar.
// (Shared pages - loginPage, consolePage, homePage, ... - come from common.)
// Fassbayar tests: import { test, expect } from '../fixtures/pages'
import { BillPaymentReportPage } from '../pages/BillPaymentReportPage';
import { BillPaymentDetailsPage } from '../pages/BillPaymentDetailsPage';

type FassbayarPages = {
  billPaymentReportPage: BillPaymentReportPage;     // Manage Transactions > Bill Payment Report
  billPaymentDetailsPage: BillPaymentDetailsPage;
};

export const test = base.extend<FassbayarPages>({
  billPaymentReportPage: async ({ page }, use) => { await use(new BillPaymentReportPage(page)); },
  billPaymentDetailsPage: async ({ page }, use) => { await use(new BillPaymentDetailsPage(page)); }
});

export { expect };
