import { test } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { createParentCompanyData } from '../testdata/parentCompanyData';
import { testCase } from '../../common/utils/testCase';
import { addParentCompany } from '../../common/flows/addParentCompanyFlow';

test.describe('All Companies - Add a Parent Company', () => {

  test(
    'Add a new parent company with random unique details',
    testCase({ id: 'TC-FASSBAYAR-008', module: 'Company Management', priority: 'High' }),
    async ({ loginPage, homePage, addParentCompanyPage, parentCompanyDetailsPage }) => {

      // Fresh random + unique values for every input on each run
      const data = createParentCompanyData();
      console.log('Generated parent company data:', JSON.stringify(data, null, 2));

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Add a Parent Company', async () => {
        await homePage.openAllCompanies();
        await addParentCompanyPage.open();
      });

      // Fill -> Submit -> Review -> Confirm -> Complete (shared with every portal)
      const created = await addParentCompany(addParentCompanyPage, data);
      if (!created) throw new Error('Parent company was not created');

      await test.step('View Company Details - verify all values', async () => {
        await addParentCompanyPage.openCompanyDetails();
        await parentCompanyDetailsPage.verifyParentDetails(data, created.userId);
      });

      await parentCompanyDetailsPage.holdForViewing('Parent Company Details');
    }
  );
});
