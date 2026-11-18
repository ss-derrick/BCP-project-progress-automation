import { test, expect } from '../fixtures/portal';
import { testCase } from '../utils/testCase';
import { loginAs } from '../flows/loginFlow';
import { hostsFor, portals, ENV_NAME, PORTAL_PROFILE } from '../../portals.config';
import { createCompanyForHost } from '../creation/hostCompanyData';

// SHARED: Global Payment card schemes on Add a Company, on every portal.
// The schemes come from the portal's GP profile, so no portal check here:
//   APH:       VISA, MasterCard                                   (common/hosts/globalPayment.ts)
//   Fassbayar: VISA, MasterCard, HSBC VISA, HSBC Mastercard       (portals.config.ts)
// A scheme added / removed on a portal = one line in those lists.
// Every portal lists the SAME test cases: one per GP scheme of ANY portal.
// A scheme this portal doesn't offer is skipped with the reason
// (e.g. HSBC VISA on APH), so both reports show the same IDs.
// Read-only: Submit opens the review, Confirm is NEVER clicked, nothing is created.

const HOST_CODE = 'GP';   // Global Payment
const host = hostsFor().find((h) => h.code === HOST_CODE);

// GP schemes of every portal, APH's first: VISA, MasterCard, HSBC VISA, HSBC Mastercard
const allSchemes = [...new Set(Object.values(portals).flatMap(
  (p) => p.hosts.find((h) => h.code === HOST_CODE)?.cardSchemes ?? []))];

// Portals whose GP offers this scheme, e.g. "Fassbayar"
const portalsOffering = (scheme: string): string => Object.values(portals)
  .filter((p) => p.hosts.find((h) => h.code === HOST_CODE)?.cardSchemes.includes(scheme))
  .map((p) => p.name).join(', ');

test.describe('Add a Company - Global Payment card schemes (shared)', () => {

  test(
    'Global Payment offers exactly this portal\'s card schemes',
    testCase({ id: 'TC-COMP-004', module: 'Add a Company', priority: 'High' }),
    async ({ loginPage, consolePage, homePage, addCompanyFormPage: form }) => {

      test.skip(!host, `${HOST_CODE} is not a host of ${ENV_NAME} (portals.config.ts)`);

      await loginAs({ loginPage, consolePage });
      await test.step('Open All Companies > Add a Company', async () => {
        await homePage.openAllCompanies();
        await form.open();
      });

      await test.step(`Choose ${host!.name}: card schemes = ${host!.cardSchemes.join(', ')}`, async () => {
        await form.chooseHost(host!);
        const offered = await form.cardSchemeOptions();
        console.log(`${ENV_NAME} | ${host!.name} card schemes offered: ${offered.join(', ')}`);
        expect(offered, `${host!.name} card schemes on ${PORTAL_PROFILE.name}`).toEqual(host!.cardSchemes);
        await form.captureCardSchemeList(`${host!.name} card scheme list`);
      });
      // Submit / Confirm never clicked
    }
  );

  // One test per scheme of ANY portal; run only where this portal offers it
  for (const [i, scheme] of allSchemes.entries()) {
    test(
      `Global Payment with card scheme ${scheme}: accepted at Submit and shown on Review`,
      testCase({ id: `TC-COMP-005-${String(i + 1).padStart(2, '0')}`, module: 'Add a Company', priority: 'Medium' }),
      async ({ loginPage, consolePage, homePage, addCompanyFormPage: form }) => {

        test.skip(!host, `${HOST_CODE} is not a host of ${ENV_NAME} (portals.config.ts)`);
        // "Applicable for <portal> only: ..." = not applicable here; the summary
        // report lists it apart and does not count it as not passed
        test.skip(!host!.cardSchemes.includes(scheme),
          `Applicable for ${portalsOffering(scheme)} only: ${scheme} is not offered under ` +
          `${host!.name} on ${PORTAL_PROFILE.name} (${ENV_NAME})`);

        // A valid new company in every field, with this one card scheme
        const data = { ...createCompanyForHost(host!), cardSchemes: [scheme] };

        await loginAs({ loginPage, consolePage });
        await test.step('Open All Companies > Add a Company', async () => {
          await homePage.openAllCompanies();
          await form.open();
        });

        await test.step(`Fill company with ${host!.name}, card scheme ${scheme} (MID ${data.mid})`, async () => {
          await form.fillCompany(data);
        });

        await test.step(`Submit -> Review shows Card Scheme : ${scheme}`, async () => {
          await form.submit();
          await form.verifyReview(data);
          await form.verifyReviewCardSchemes([scheme]);
        });
        // Confirm never clicked: nothing is created
      }
    );
  }
});
