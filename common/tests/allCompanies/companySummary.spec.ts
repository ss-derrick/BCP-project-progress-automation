import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { syncCompany } from '../../testdata/knownCompanies';

// All Companies > Company Summary - SHARED: runs on APH and Fassbayar.
// Read-only: searches existing companies, creates nothing.
// Run only this submodule:  npx playwright test --grep @company-summary

const MODULE = 'All Companies';

test.describe('All Companies > Company Summary', { tag: '@company-summary' }, () => {

  test.beforeEach(async ({ loginPage, consolePage, homePage, companySummaryPage }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open All Companies > Company Summary', async () => {
      await homePage.openAllCompanies();
      await companySummaryPage.verifyOpened();
    });
  });

  test(
    'Search the sync company by MID',
    testCase({ id: 'TC-COMP-004', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ companySummaryPage }) => {

      // Content: search with the plain MID (no -ACS suffix)
      await test.step(`Search MID ${syncCompany.mid}`, async () => {
        await companySummaryPage.search(syncCompany.mid);
      });

      // Validation: exactly this company comes back, with its data
      await test.step('Verify the sync company data is returned', async () => {
        expect(await companySummaryPage.getTotalRecords(), 'Total Records').toBe(1);

        const row = companySummaryPage.row(syncCompany.mid);
        await expect(row).toHaveCount(1);

        const shown = await companySummaryPage.readRow(row);
        expect(shown.mids, 'MIDs').toContain(syncCompany.midShown);
        expect(shown.businessName, 'Business Name').toBe(syncCompany.businessName);
        expect(shown.authoriser, 'Authoriser').toBe(syncCompany.authoriser);
        expect(shown.status.toUpperCase(), 'Status').toBe(syncCompany.status);

        await companySummaryPage.captureScreen(`Search result - ${syncCompany.mid}`);
      });
    }
  );
});
