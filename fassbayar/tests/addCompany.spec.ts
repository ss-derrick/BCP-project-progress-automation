import { test, expect } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { createCompanyData } from '../testdata/companyData';
import { testCase } from '../../common/utils/testCase';
import { addCompany } from '../../common/flows/addCompanyFlow';

test.describe('All Companies - Add a Company', () => {

  test(
    'Add a new company with random unique details and verify it is enabled',
    testCase({ id: 'TC-FASSBAYAR-001', module: 'Company Management', priority: 'High' }),
    async ({ loginPage, homePage, addCompanyPage, companyDetailsPage }) => {

      // Fresh random + unique values for every input on each run,
      // incl. a new random 15-digit MID. Other host: createCompanyData({ hosts: ['GP'] })
      const data = createCompanyData();
      console.log('Generated company data:', JSON.stringify(data, null, 2));

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Add a Company', () =>
        homePage.openAddCompany());

      // Fill -> Submit -> Review -> Confirm -> Complete (shared with every portal)
      const created = await addCompany(addCompanyPage, data);
      if (!created) throw new Error('Company was not created');

      await test.step('View Company Details - verify all values', async () => {
        await addCompanyPage.openCompanyDetails();
        await companyDetailsPage.verifyDetails(data, created.userId);
      });

      await test.step('Verify company is enabled (Active)', () =>
        companyDetailsPage.verifyEnabled());

      await companyDetailsPage.holdForViewing('Company Details');
    }
  );
});
