import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { PORTAL_PROFILE } from '../../../portals.config';
import type { AdministratorPage } from '../../pages/AdministratorPage';
import { requireUatChanges } from '../../utils/uatChanges';

// Administrator > Host Settings / Edit Host Setting Details (Host Downtime Check Period, minutes).
// Written from the APH baseline sheet (TC-APH-BP-ADM-016, 029) and the portal (23 Nov 2026).
// Only on portals with the screen (features.hostSettings). Read-only unless ADM_ALLOW_UAT_CHANGES=true
// (TC-ADM-016 sets the period to 5 and back). Edit form: Submit + Back, never Confirm.
// Run only this file:  npx playwright test common/tests/administrator/hostSettings.spec.ts

const MODULE = 'Administrator';

async function openEdit(admin: AdministratorPage): Promise<void> {
  await admin.openQuicklink('Host Settings');
  await expect(admin.main).toContainText('Host Downtime Check Period (minutes)');
  await admin.clickButton('Edit Host Setting Details');
  await expect(admin.title).toHaveText('Edit Host Setting Details');
}

if (PORTAL_PROFILE.features.hostSettings) {
  test.describe('Administrator > Host Settings @administrator', () => {

    test.beforeEach(async ({ loginPage, consolePage }) => {
      await loginAs({ loginPage, consolePage });
    });

    test(
      'Edit Host Downtime Check Period',
      testCase({ id: 'TC-ADM-016', module: MODULE, priority: 'Low' }),
      async ({ administratorPage: admin }) => {
        requireUatChanges('sets Host Downtime Check Period to 5, then back');
        await openEdit(admin);
        const original = await admin.input('downtimePeriodCheck').inputValue();
        for (const value of ['5', original]) {
          await test.step(`Set ${value} -> Confirm`, async () => {
            await admin.clear(['downtimePeriodCheck']);
            await admin.fill({ downtimePeriodCheck: value });
            await admin.submit();
            await admin.confirm();
            await openEdit(admin);
            expect(await admin.input('downtimePeriodCheck').inputValue()).toBe(value);
          });
        }
        await admin.captureScreen('Host Downtime Check Period restored');
      }
    );

    test(
      'Edit Host Setting Details: field validation (mandatory, format and length)',
      testCase({ id: 'TC-ADM-029', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        await openEdit(admin);
        expect(await admin.steps.allInnerTexts()).toEqual(['Details', 'Review & Confirm', 'Complete']);
        await test.step('Blank: error shown, nothing saved', async () => {
          await admin.clear(['downtimePeriodCheck']);
          await admin.submit();
          expect.soft(await admin.reviewShown(), 'blank period must not reach Review').toBe(false);
          await expect.soft(admin.error('downtimePeriodCheckError'), 'period error').toBeVisible();
          await admin.backFromReview();
        });
        await test.step('Letters rejected; max 4 digits', async () => {
          await admin.clear(['downtimePeriodCheck']);
          await admin.fill({ downtimePeriodCheck: 'ab' });
          await admin.submit();
          await expect(admin.error('downtimePeriodCheckError')).toHaveText('Please enter valid Amount');
          await admin.clear(['downtimePeriodCheck']);
          await admin.fill({ downtimePeriodCheck: '123456' });
          expect((await admin.input('downtimePeriodCheck').inputValue()).length).toBe(4);
        });
        await test.step('Valid value -> Review, then Back (not saved)', async () => {
          await admin.clear(['downtimePeriodCheck']);
          await admin.fill({ downtimePeriodCheck: '0' });
          await admin.submit();
          expect(await admin.reviewShown()).toBe(true);
          await admin.captureScreen('Edit Host Setting - Review (not confirmed)');
          await admin.backFromReview();
        });
      }
    );
  });
}
