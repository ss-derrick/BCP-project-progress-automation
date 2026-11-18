import { test } from '../fixtures/pages';
import { loginAsAdmin } from '../flows/loginFlow';
import { LogoTargetCompanyId } from '../testdata/constants';
import { createLogo } from '../testdata/logoData';
import { isAutomationCompanyName } from '../testdata/companyData';
import { testCase } from '../../common/utils/testCase';

test.describe('All Companies - Upload Company Logo', () => {

  test(
    'Upload a company logo for one company',
    testCase({ id: 'TC-FASSBAYAR-011', module: 'Company Management', priority: 'Medium' }),
    async ({ browser, loginPage, homePage, uploadCompanyLogoPage }) => {

      // New random 400x180 PNG every run (or your own file via LOGO_FILE)
      const logo = await createLogo(browser);
      await test.info().attach(logo.fileName, { path: logo.path, contentType: 'image/png' });
      console.log('Logo to upload:', logo.fileName, logo.label);

      await loginAsAdmin(loginPage);

      await test.step('Open All Companies > Upload Company Logo', async () => {
        await homePage.openAllCompanies();
        await uploadCompanyLogoPage.open();
      });

      await test.step('Logo: choose the image and click Next', async () => {
        await uploadCompanyLogoPage.chooseLogo(logo.path, logo.fileName);
        await uploadCompanyLogoPage.nextFromLogo();
      });

      // The list only offers companies with no logo yet -> by default take the
      // newest automation-created one (never a real merchant)
      const companyId = LogoTargetCompanyId ??
        await uploadCompanyLogoPage.newestCompany(isAutomationCompanyName, 'automation-created company');

      const companyName = await test.step(`Company: move company ${companyId} to the right list`, () =>
        uploadCompanyLogoPage.moveCompany(companyId));

      await test.step('Click Next', () =>
        uploadCompanyLogoPage.nextFromCompany());

      await test.step('Review & Confirm', async () => {
        await uploadCompanyLogoPage.verifyReview([companyName]);
        await uploadCompanyLogoPage.confirm();
      });

      await test.step('Complete: request successful, 1 company updated', () =>
        uploadCompanyLogoPage.verifyComplete(1));

      test.info().annotations.push({
        type: 'note',
        description: `Logo ${logo.fileName} uploaded for "${companyName}" (company ${companyId})`
      });

      await uploadCompanyLogoPage.holdForViewing('Upload Company Logo - Complete');
    }
  );
});
