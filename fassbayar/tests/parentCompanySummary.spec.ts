import { test } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { ParentCompanyRow } from '../pages/ParentCompanyListPage';
import { testCase } from '../../common/utils/testCase';

// Search terms are taken from the NEWEST parent company in the listing,
// so the tests always search for something that exists.
test.describe('All Companies - Parent Company Summary search', () => {

  let latest: ParentCompanyRow;

  test.beforeEach(async ({ loginPage, homePage, parentCompanyListPage }) => {
    await loginAsAdmin(loginPage);
    await test.step('Open All Companies > Parent Company Summary', async () => {
      await homePage.openAllCompanies();
      await parentCompanyListPage.open();
    });
    latest = await test.step('Read the latest parent company', async () => {
      const row = await parentCompanyListPage.latestRow();
      console.log('Latest parent company:', row);
      test.info().annotations.push({
        type: 'note',
        description: `Latest parent company: "${row.businessName}", authoriser "${row.authoriser}"`
      });
      return row;
    });
  });

  test(
    'Search a parent company by business name',
    testCase({ id: 'TC-FASSBAYAR-009', module: 'Company Management', priority: 'High' }),
    async ({ parentCompanyListPage }) => {
      await test.step(`Search "${latest.businessName}"`, () =>
        parentCompanyListPage.search(latest.businessName));

      await test.step('Result lists that parent company', () =>
        parentCompanyListPage.verifySearchFinds(latest.businessName, latest));
    }
  );

  test(
    'Search a parent company by authoriser',
    testCase({ id: 'TC-FASSBAYAR-010', module: 'Company Management', priority: 'High' }),
    async ({ parentCompanyListPage }) => {
      await test.step(`Search "${latest.authoriser}"`, () =>
        parentCompanyListPage.search(latest.authoriser));

      await test.step('Result lists that parent company', () =>
        parentCompanyListPage.verifySearchFinds(latest.authoriser, latest));
    }
  );
});
