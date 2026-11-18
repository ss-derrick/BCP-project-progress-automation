import { test, expect } from '../fixtures/portal';
import { testCase } from '../utils/testCase';
import { loginAs } from '../flows/loginFlow';
import { hostsFor, ENV_NAME } from '../../portals.config';
import { expectedPaymentTypeState } from '../utils/hostValidation';
import { createCompanyForHost } from '../creation/hostCompanyData';
import { existingMidFor } from '../testdata/existingMids';

// SHARED validation of "Add a Company" > MID Settings, on every portal.
// Read-only: the form is never submitted, nothing is created.

const HOST_CODE = 'GP';   // Global Payment

test.describe('Add a Company - MID Settings validation (shared)', () => {

  test(
    'Global Payment: only Retail or IPP can be selected, one at a time',
    testCase({ id: 'TC-COMP-002', module: 'Add a Company', priority: 'High' }),
    async ({ loginPage, consolePage, homePage, addCompanyFormPage: form }) => {

      const host = hostsFor().find((h) => h.code === HOST_CODE);
      test.skip(!host, `${HOST_CODE} is not a host of ${ENV_NAME} (portals.config.ts)`);

      await loginAs({ loginPage, consolePage });
      await test.step('Open All Companies > Add a Company', async () => {
        await homePage.openAllCompanies();
        await form.open();
      });

      // Compare what the page shows with what the rule says, for every box on the row
      const check = async (ticked: string[], label: string) => {
        const shown = await form.readPaymentTypes();
        // the host's own types must be on screen, or there is nothing to compare
        expect(Object.keys(shown), `${label}: payment-type boxes on screen`).toEqual(
          expect.arrayContaining(host!.paymentTypes));
        const actual = Object.fromEntries(Object.entries(shown).map(([t, s]) => [t, s.enabled ? 'enabled' : 'disabled']));
        console.log(`${ENV_NAME} | ${label}: enabled = ${Object.entries(actual).filter(([, v]) => v === 'enabled').map(([t]) => t).join(', ') || '(none)'} | ${Object.keys(actual).length} boxes`);
        expect(actual, `${label}: selectable payment types`).toEqual(
          expectedPaymentTypeState(host!, Object.keys(shown), ticked));
        await form.captureScreen(label);
      };

      await test.step(`Choose ${host!.name}: only ${host!.paymentTypes.join(' and ')} selectable`, async () => {
        await form.chooseHost(host!);
        await check([], `${host!.name} chosen`);
      });

      for (const pick of host!.paymentTypes) {
        await test.step(`Tick ${pick}: the other ${host!.name} type is no longer selectable`, async () => {
          await form.setPaymentType(pick, true);
          await check([pick], `${pick} ticked`);
        });
        await test.step(`Untick ${pick}: both selectable again`, async () => {
          await form.setPaymentType(pick, false);
          await check([], `${pick} unticked`);
        });
      }
      // Submit / Confirm never clicked
    }
  );

  test(
    'A MID that already exists is rejected at Submit',
    testCase({ id: 'TC-COMP-003', module: 'Add a Company', priority: 'High' }),
    async ({ loginPage, consolePage, homePage, addCompanyFormPage: form }) => {

      // Existing MID = data of ONE environment (common/testdata/existingMids.ts)
      const existing = existingMidFor(ENV_NAME);
      test.skip(!existing, `No existing MID recorded for ${ENV_NAME} in common/testdata/existingMids.ts`);
      const host = hostsFor().find((h) => h.code === existing!.hostCode);
      test.skip(!host, `${existing!.hostCode} is not a host of ${ENV_NAME}`);

      // A valid new company in every field, except its MID is already taken
      const data = { ...createCompanyForHost(host!), mid: existing!.mid };

      await loginAs({ loginPage, consolePage });
      await test.step('Open All Companies > Add a Company', async () => {
        await homePage.openAllCompanies();
        await form.open();
      });

      await test.step(`Fill the company with the existing MID ${data.mid} (${host!.name})`, async () => {
        await form.fillCompany(data);
      });

      await test.step('Submit: refused with "Duplicated. Not Available", review does not open', async () => {
        await form.submitExpectingRejection();
        await expect(form.duplicateMessage).toBeVisible();
        expect(await form.visibleErrors(), 'no other field errors').toEqual([]);
        await form.captureScreen('Duplicate MID refused');
      });
      // Confirm is never reachable here: nothing is created
    }
  );
});
