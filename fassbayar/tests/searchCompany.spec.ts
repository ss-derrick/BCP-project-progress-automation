import { test } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { ExistingCompany } from '../testdata/constants';
import { testCase } from '../../common/utils/testCase';

test.describe('All Companies - Search for a Company', () => {

  test(
    'Search a company by MID and open View Details',
    testCase({ id: 'TC-FASSBAYAR-002', module: 'Company Management', priority: 'High' }),
    async ({ loginPage, homePage, companyListPage, companyDetailsPage }) => {
      const { mid, businessName, authoriser, status } = ExistingCompany;

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies', async () => {
        await homePage.openAllCompanies();
        await companyListPage.verifyOpened();
      });

      await test.step(`Search for MID ${mid}`, async () => {
        await companyListPage.search(mid);
        await companyListPage.verifySearchResult(mid, { businessName, authoriser, status });
      });

      await test.step('Quicklink "View Details" > Go', () =>
        companyListPage.openQuicklink(mid, 'View Details'));

      await test.step('Verify Company Details page', () =>
        companyDetailsPage.verifyOpenedFor(mid, businessName));

      await companyDetailsPage.holdForViewing('Company Details');
    }
  );
});
