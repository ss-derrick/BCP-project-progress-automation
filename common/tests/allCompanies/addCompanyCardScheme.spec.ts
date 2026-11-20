import { test, expect } from '../../fixtures/portal';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { hostsFor, portals, ENV_NAME, PORTAL_PROFILE } from '../../../portals.config';
import { createCompanyForHost } from '../../creation/hostCompanyData';

// SHARED: Global Payment card schemes on Add a Company, on every portal.
// (Written by Derrick, merged 19 Nov 2026; IDs renumbered from his TC-COMP-004 /
//  TC-COMP-005-xx because TC-COMP-004 is Company Summary here.)
// The schemes come from the portal's GP profile, so no portal check here:
//   APH:       VISA, MasterCard                                   (common/hosts/globalPayment.ts)
//   Fassbayar: VISA, MasterCard, HSBC VISA, HSBC Mastercard       (portals.config.ts)
// A scheme added / removed on a portal = one line in those lists.
// One test per scheme, created ONLY on a portal that offers that scheme:
// on APH the HSBC tests don't exist (not run, not counted, not in the report).
// IDs stay the same on every portal: numbered over the schemes of ALL
// portals, so HSBC VISA is always TC-COMP-006-03.
// Read-only: Submit opens the review, Confirm is NEVER clicked, nothing is created.

const HOST_CODE = 'GP';   // Global Payment
const host = hostsFor().find((h) => h.code === HOST_CODE);

// GP schemes of every portal, APH's first: VISA, MasterCard, HSBC VISA, HSBC Mastercard
const allSchemes = [...new Set(Object.values(portals).flatMap(
  (p) => p.hosts.find((h) => h.code === HOST_CODE)?.cardSchemes ?? []))];

test.describe('Add a Company - Global Payment card schemes (shared)', () => {

  test(
    'Global Payment offers exactly this portal\'s card schemes',
    testCase({ id: 'TC-COMP-005', module: 'Add a Company', priority: 'High' }),
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

  // One test per scheme THIS portal offers (ID numbered over all portals' schemes)
  for (const [i, scheme] of allSchemes.entries()) {
    if (!host?.cardSchemes.includes(scheme)) continue;   // not on this portal: no test at all
    test(
      `Global Payment with card scheme ${scheme}: accepted at Submit and shown on Review`,
      testCase({
        id: `TC-COMP-006-${String(i + 1).padStart(2, '0')}`, module: 'Add a Company', priority: 'Medium',
        gaps: [{
          description: 'Card scheme tests stop at Review & Confirm (Confirm is never clicked, same on both portals), so a company is created end-to-end with the first scheme only (TC-COMP-001).',
          impact: 'A defect that only shows when saving a company with another card scheme would not be caught.'
        }, {
          description: 'One card scheme per test: selecting several schemes in one MID row is not tested.',
          impact: 'A defect with multiple card schemes would not be caught.'
        }]
      }),
      async ({ loginPage, consolePage, homePage, addCompanyFormPage: form }) => {

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
