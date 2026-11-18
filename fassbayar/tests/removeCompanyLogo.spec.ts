import { test } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { RemoveLogoCompanyId } from '../testdata/constants';
import { isAutomationCompanyName } from '../testdata/companyData';
import { testCase } from '../../common/utils/testCase';

test.describe('All Companies - Remove Company Logo', () => {

  test(
    'Remove the logo of one company',
    testCase({ id: 'TC-FASSBAYAR-012', module: 'Company Management', priority: 'Medium' }),
    async ({ loginPage, homePage, removeCompanyLogoPage }) => {

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Remove Company Logo', async () => {
        await homePage.openAllCompanies();
        await removeCompanyLogoPage.open();
      });

      // The list only offers companies that have a logo -> take the first
      // automation-created one (never a real merchant)
      const companyId = RemoveLogoCompanyId ??
        await removeCompanyLogoPage.firstCompany(isAutomationCompanyName, 'automation-created company');

      const companyName = await test.step(`Details: move company ${companyId} to the right list`, () =>
        removeCompanyLogoPage.moveCompany(companyId));

      await test.step('Click Submit', () =>
        removeCompanyLogoPage.submit());

      await test.step('Review & Confirm', async () => {
        await removeCompanyLogoPage.verifyReview([companyName]);
        await removeCompanyLogoPage.confirm();
      });

      await test.step('Complete: request successful, 1 company updated', () =>
        removeCompanyLogoPage.verifyComplete(1));

      await test.step('Company no longer listed as having a logo', () =>
        removeCompanyLogoPage.verifyNotListed(companyId));

      test.info().annotations.push({
        type: 'note',
        description: `Logo removed from "${companyName}" (company ${companyId})`
      });

      await removeCompanyLogoPage.holdForViewing('Remove Company Logo');
    }
  );
});
