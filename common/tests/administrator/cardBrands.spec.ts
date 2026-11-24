import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { PORTAL_PROFILE } from '../../../portals.config';
import { portalDate, type AdministratorPage } from '../../pages/AdministratorPage';
import { requireUatChanges, humanAction } from '../../utils/uatChanges';

// Administrator > Card Brand Settings / Card Brand Details / Edit Card Brand Details.
// Written from the APH baseline sheet (TC-APH-BP-ADM-015, 017, 027, 028) and the portal (23 Nov 2026).
// Only on portals with the screen (features.cardBrandSettings). Read-only unless ADM_ALLOW_UAT_CHANGES=true
// (TC-ADM-015 changes MyDebit's CVM limit by RM 1 and sets it back). Edit forms: Submit + Back, never Confirm.
// Run only this file:  npx playwright test common/tests/administrator/cardBrands.spec.ts

const MODULE = 'Administrator';
const COLUMNS = ['Card Brand', PORTAL_PROFILE.administrator.cardBrandLimitColumn, 'Status', 'Updated Date', 'Quicklink'];
const BRAND = 'MyDebit';      // sheet test data (restore 250.00 afterwards)

async function openEdit(admin: AdministratorPage): Promise<void> {
  await admin.openQuicklink('Card Brand Settings');
  const row = admin.rows.filter({ has: admin.page.locator('td:first-child', { hasText: new RegExp(`^\\s*${BRAND}\\s*$`) }) }).first();
  await admin.quicklinkGo(row, 'View Details');
  await expect(admin.main).toContainText(`Card Brand: ${BRAND}`);
  await admin.clickButton('Edit Card Brand Details');
  await expect(admin.title).toHaveText('Edit Card Brand Details');
}

if (PORTAL_PROFILE.features.cardBrandSettings) {
  test.describe('Administrator > Card Brand Settings @administrator', () => {

    test.beforeEach(async ({ loginPage, consolePage }) => {
      await loginAs({ loginPage, consolePage });
    });

    test(
      'Edit contactless CVM limit of a card brand',
      testCase({ id: 'TC-ADM-015', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        requireUatChanges(`changes ${BRAND}'s contactless CVM limit by RM 1, then sets it back`);
        await openEdit(admin);
        const ringgit = await admin.input('cvmLimit').inputValue();
        const sen = await admin.input('cvmLimitCent').inputValue();
        const original = `${ringgit}.${sen}`;
        await test.step(`Change ${original} -> +RM 1 -> Confirm`, async () => {
          await admin.clear(['cvmLimit']);
          await admin.fill({ cvmLimit: String(Number(ringgit) + 1) });
          await admin.submit();
          await admin.confirm();
          await openEdit(admin);
          expect(await admin.input('cvmLimit').inputValue()).toBe(String(Number(ringgit) + 1));
        });
        await test.step(`Restore ${original}`, async () => {
          await admin.clear(['cvmLimit']);
          await admin.fill({ cvmLimit: ringgit });
          await admin.submit();
          await admin.confirm();
          await openEdit(admin);
          expect(`${await admin.input('cvmLimit').inputValue()}.${await admin.input('cvmLimitCent').inputValue()}`).toBe(original);
          await admin.captureScreen(`${BRAND} CVM limit restored`);
        });
      }
    );

    test(
      'Changed card brand CVM limit applies to contactless sales',
      testCase({ id: 'TC-ADM-017', module: MODULE, priority: 'Low', manual: [{
        title: 'Changed card brand CVM limit applies to contactless sales', reason: 'Needs real contactless sales on a device.',
        handling: 'After changing a CVM limit, do a contactless sale just below and just above it, then restore the limit.' }] }),
      async () => {
        humanAction('contactless sales on a device (sheet: HAR)');
      }
    );

    test(
      'All Card Brand Settings: search and filter field validation',
      testCase({ id: 'TC-ADM-027', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        await admin.openQuicklink('Card Brand Settings');
        await expect(admin.title).toHaveText('All Card Brand Settings');
        await test.step('Dates picker-only, default last 10 years; no search box', async () => {
          for (const n of ['from', 'to']) expect(await admin.input(n, admin.filterForm).getAttribute('readonly'), `${n} read-only`).not.toBeNull();
          await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ years: -10 }));
          await expect(admin.input('to', admin.filterForm)).toHaveValue(portalDate());
          await expect(admin.searchBox).toHaveCount(0);
        });
        await test.step('Columns; card brands incl. MyDebit, VISA, MASTERCARD, AMEX, CUP', async () => {
          await admin.expectColumns(COLUMNS);
          const brands = (await admin.rows.locator('td:first-child').allInnerTexts()).map((t) => t.trim());
          for (const b of ['MyDebit', 'VISA', 'MASTERCARD', 'AMEX', 'CUP']) expect.soft(brands, `card brand ${b}`).toContain(b);
          await admin.captureScreen('All Card Brand Settings');
        });
      }
    );

    test(
      'Edit Card Brand Details: field validation (mandatory, format and length)',
      testCase({ id: 'TC-ADM-028', module: MODULE, priority: 'Medium' }),
      async ({ administratorPage: admin }) => {
        await openEdit(admin);
        expect(await admin.steps.allInnerTexts()).toEqual(['Details', 'Review & Confirm', 'Complete']);
        await test.step('Blank: error shown, nothing saved', async () => {
          await admin.clear(['cvmLimit', 'cvmLimitCent']);
          await admin.submit();
          expect.soft(await admin.reviewShown(), 'blank CVM limit must not reach Review').toBe(false);
          await expect.soft(admin.error('cvmLimitError'), 'CVM limit error').toBeVisible();
          await admin.backFromReview();
        });
        await test.step('RM "abc" / sen "5" rejected; RM max 9, sen max 2', async () => {
          await admin.clear(['cvmLimit', 'cvmLimitCent']);
          await admin.fill({ cvmLimit: 'abc', cvmLimitCent: '5' });
          await admin.submit();
          await expect(admin.error('cvmLimitError')).toHaveText('Please enter valid Amount');
          await admin.clear(['cvmLimit', 'cvmLimitCent']);
          await admin.fill({ cvmLimit: '1234567890', cvmLimitCent: '123' });
          expect((await admin.input('cvmLimit').inputValue()).length).toBe(9);
          expect((await admin.input('cvmLimitCent').inputValue()).length).toBe(2);
        });
        await test.step('Valid value -> Review, then Back (not saved)', async () => {
          await admin.clear(['cvmLimit', 'cvmLimitCent']);
          await admin.fill({ cvmLimit: '250', cvmLimitCent: '00' });
          await admin.submit();
          expect(await admin.reviewShown()).toBe(true);
          await admin.captureScreen('Edit Card Brand - Review (not confirmed)');
          await admin.backFromReview();
        });
      }
    );
  });
}
