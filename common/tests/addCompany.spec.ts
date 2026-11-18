import { test } from '../fixtures/portal';
import { testCase } from '../utils/testCase';
import { loginAs } from '../flows/loginFlow';
import { hostsFor, ENV_NAME } from '../../portals.config';
import { createCompanyForHost } from '../creation/hostCompanyData';

// SHARED: runs on every portal (APH + Fassbayar) from this one file.
// The portal (ENV_NAME) decides the host profile, the form rules and the
// page version (common/fixtures/portal.ts).
// !! Confirm CREATES a real company. Run with $env:DEMO='false'.
// Dry run without Confirm: explore/scan/addCompanyGp.scan.ts

const HOST_CODE = 'GP';   // Global Payment = the sample host

test.describe('Add a Company (shared)', () => {

  test(
    'Add a company with Global Payment as Service Provider',
    testCase({ id: 'TC-COMP-001', module: 'Add a Company', priority: 'High' }),
    async ({ loginPage, consolePage, homePage, addCompanyFormPage }) => {

      const host = hostsFor().find((h) => h.code === HOST_CODE);
      test.skip(!host, `${HOST_CODE} is not a host of ${ENV_NAME} (portals.config.ts)`);
      const data = createCompanyForHost(host!);

      await loginAs({ loginPage, consolePage });

      await test.step('Open All Companies > Add a Company', async () => {
        await homePage.openAllCompanies();
        await addCompanyFormPage.open();
      });

      await test.step(`Fill company with ${host!.name} (MID ${data.mid})`, async () => {
        await addCompanyFormPage.fillCompany(data);
      });

      await test.step('Submit -> Review & Confirm', async () => {
        await addCompanyFormPage.submit();
        await addCompanyFormPage.verifyReview(data);
      });

      await test.step('Confirm (creates the company)', async () => {
        await addCompanyFormPage.confirm();
      });

      await test.step(`Company list shows ${data.mid}${host!.midSuffix}`, async () => {
        await addCompanyFormPage.verifyListed(data);
      });
    }
  );
});
