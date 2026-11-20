import { test } from '../../fixtures/portal';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { hostsFor, ENV_NAME, PORTAL_PROFILE } from '../../../portals.config';
import { createCompanyForHost } from '../../creation/hostCompanyData';

// SHARED: runs on every portal (APH + Fassbayar) from this one file.
// The portal (ENV_NAME) decides the host profile, the form rules and the
// page version (common/fixtures/portal.ts).
// !! Confirm CREATES a real company. Run with $env:DEMO='false'.
// Dry run without Confirm: explore/scan/addCompanyGp.scan.ts

const HOST_CODE = 'GP';   // Global Payment = the sample host
const otherHosts = hostsFor().filter((h) => h.code !== HOST_CODE).map((h) => h.name);

test.describe('Add a Company (shared)', () => {

  test(
    'Add a company with Global Payment as Service Provider',
    testCase({
      id: 'TC-COMP-001', module: 'Add a Company', priority: 'High',
      gaps: [
        {
          description: `A company is created for Global Payment only. Not created by automation on ${PORTAL_PROFILE.name}: ${otherHosts.join(', ')}.`,
          impact: 'A defect when adding a company for another Service Provider (MID rule, card schemes, payment types, auto-ticked types) would not be caught.'
        },
        {
          description: 'One MID row only: "Add another MID" (several MIDs / hosts in one company) is not tested.',
          impact: 'A defect with multi-MID companies would not be caught.'
        },
        {
          description: 'Settings below MID Settings (Contactless, MCCS, Bill Payment, SSO, schedule time, application identifier, QR type, merchant / API settings) keep their defaults.',
          impact: 'Changing those settings at creation is not verified.'
        },
        {
          description: "After Confirm only the company list row is checked; Company Details, editing the company and the authoriser's activation e-mail are not verified.",
          impact: 'A defect in what was saved (beyond name and MID) or in the welcome e-mail would not be caught.'
        }
      ]
    }),
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
