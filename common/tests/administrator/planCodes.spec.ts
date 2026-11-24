import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { portalDate, type AdministratorPage } from '../../pages/AdministratorPage';
import { requireUatChanges, stopBeforeSaving } from '../../utils/uatChanges';
import { PORTAL_PROFILE } from '../../../portals.config';

// Administrator > IPP Plan code & Term Summary / Add IPP Plan code & Term / Plan Code Details. SHARED
// (Fassbayar's form also has a Service Provider field: filled / checked only where it exists).
// Written from the APH baseline sheet (TC-APH-BP-ADM-013, 014, 026) and the portal (23 Nov 2026).
// Read-only unless ADM_ALLOW_UAT_CHANGES=true (TC-ADM-013 adds, edits and deletes a TEST plan code).
// Run only this file:  npx playwright test common/tests/administrator/planCodes.spec.ts

const MODULE = 'Administrator';
const COLUMNS = ['Plan Code', 'Term', 'Status', 'Created Date/Deleted Date', 'Quicklink'];

// Plan codes on the list (any status): code -> its cells after the code ("Term | Status | ...";
// Fassbayar has Service Provider first). A deleted code can be added again, so one code can have
// several rows (newest first): they are joined with " || ".
async function listedPlanCodes(admin: AdministratorPage): Promise<Map<string, string>> {
  await admin.openQuicklink('IPP Plan code & Term Summary');
  const rows = await admin.allRowCells();          // every page (Fassbayar: 50+ plan codes, 15 a page)
  const map = new Map<string, string>();
  for (const c of rows) map.set(c[0], map.has(c[0]) ? `${map.get(c[0])} || ${c.slice(1).join(' | ')}` : c.slice(1).join(' | '));
  return map;
}

// provider: Service Provider to choose where the form has one (default: the first one)
async function fillPlanCode(admin: AdministratorPage, v: { planCode: string; tenure: string; transactionLimit: string; desc: string }, provider = '') {
  const select = admin.input('serviceProvider');
  if (await select.count()) {
    // option text = name ("Hong Leong Bank"), option value = host code shown on the list ("HLB"): match either
    const options = await select.locator('option').evaluateAll((os) => os.map((o) => ({ value: (o as HTMLOptionElement).value, text: (o.textContent ?? '').trim() })).filter((o) => o.value));
    const want = provider.toUpperCase();
    const pick = options.find((o) => provider && (o.value.toUpperCase() === want || o.text.toUpperCase() === want)) ?? options[0];
    if (pick) await select.selectOption(pick.value);
  }
  await admin.clear(['planCode', 'tenure', 'transactionLimit', 'desc']);
  await admin.fill(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')));
}

// The Active row of a plan code (Fassbayar: of that Service Provider; older Deleted rows may be listed too)
async function openActivePlanCode(admin: AdministratorPage, code: string, provider: string): Promise<void> {
  await admin.openQuicklink('IPP Plan code & Term Summary');
  await admin.search(code);
  const active = admin.rows.filter({ hasText: 'Active' });
  // the search result has no Service Provider column (the full list has): filter on it only if shown
  const ofProvider = provider ? active.filter({ has: admin.page.locator('td', { hasText: new RegExp(`^\\s*${provider}\\s*$`) }) }) : active;
  await admin.quicklinkGo(((await ofProvider.count()) ? ofProvider : active).first(), 'View Details');
}

// Delete Plan Code is a form (Reason Incorrect create / Others + remarks); Submit deletes at once
async function deletePlanCode(admin: AdministratorPage, code: string, provider: string, remarks: string): Promise<void> {
  await openActivePlanCode(admin, code, provider);
  await admin.clickButton('Delete Plan Code');
  await expect(admin.title).toHaveText('Delete Plan Code');
  await admin.fill({ reason: 'Incorrect create' });
  await admin.fillCounted('description', remarks);
  await stopBeforeSaving(admin, `Delete Plan Code ${code} Submit`);
  await admin.button('Submit').click();
  await admin.page.waitForLoadState('load');
  await expect(admin.main).toContainText('Your request is successful');
}

// Is the code Active (for that provider, where the list has a Service Provider column)?
const activeFor = (cells: string | undefined, provider: string): boolean =>
  (cells ?? '').split(' || ').some((r) => /\| Active \|/.test(` ${r} |`) && (!provider || r.startsWith(`${provider} |`)));

test.describe('Administrator > IPP Plan codes @administrator', () => {

  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  test(
    'Add, edit and delete a test IPP plan code (existing plan codes untouched)',
    testCase({ id: 'TC-ADM-013', module: MODULE, priority: 'Medium' }),
    async ({ administratorPage: admin }) => {
      requireUatChanges('adds, edits and deletes a test IPP plan code');
      // Test Data sheet: the test plan code (APH TD-11 / Fassbayar TD-05: 789), used only by this case.
      // A deleted code can be added again. Left Active by a run that stopped half-way -> deleted first.
      const code = PORTAL_PROFILE.administrator.testPlanCode;
      const provider = PORTAL_PROFILE.administrator.testPlanProvider;
      if (activeFor((await listedPlanCodes(admin)).get(code), provider)) {
        await test.step(`Test plan code ${code} was left Active by an earlier run: delete it first`, async () => {
          await deletePlanCode(admin, code, provider, 'QA automation: clean-up before test');
        });
      }
      const before = await listedPlanCodes(admin);
      await test.step(`Add plan code ${code}${provider ? ` (${provider})` : ''}: Term 36, Min 2,500.00, "QA baseline test"`, async () => {
        await admin.openQuicklink('Add IPP Plan code & Term');
        await fillPlanCode(admin, { planCode: code, tenure: '36', transactionLimit: '2,500.00', desc: 'QA baseline test' }, provider);
        await admin.submit();
        await admin.confirm();
        expect(activeFor((await listedPlanCodes(admin)).get(code), provider), `${code} Active`).toBe(true);
      });
      await test.step(`Edit plan code ${code}: Term 24`, async () => {
        await openActivePlanCode(admin, code, provider);
        await admin.clickButton('Edit Plan Code Details');
        await admin.clear(['tenure']);
        await admin.fill({ tenure: '24' });
        await admin.submit();
        await admin.confirm();
        expect((await listedPlanCodes(admin)).get(code), 'Term 24, Active').toContain('24 | Active');
      });
      await test.step(`Delete plan code ${code} (Reason Incorrect create); other plan codes unchanged`, async () => {
        await deletePlanCode(admin, code, provider, 'QA baseline test - delete');
        const after = await listedPlanCodes(admin);
        expect(activeFor(after.get(code), provider), `${code} no longer Active`).toBe(false);
        for (const [c, v] of before) if (c !== code) expect(after.get(c), `plan code ${c} unchanged`).toBe(v);
        await admin.captureScreen(`Plan code ${code} deleted`);
      });
    }
  );

  test(
    'IPP plan code validation',
    testCase({ id: 'TC-ADM-014', module: MODULE, priority: 'Low' }),
    async ({ administratorPage: admin }) => {
      const [existing, existingCells] = [...(await listedPlanCodes(admin)).entries()].find(([, v]) => /Active/.test(v)) ?? ['', ''];
      // Fassbayar: a plan code belongs to a Service Provider (2nd column), so the duplicate uses the same one (ignored where the form has no provider)
      const existingProvider = existingCells.split(' | ')[0];
      const tryCode = async (v: Parameters<typeof fillPlanCode>[1], provider = '') => {
        await admin.openQuicklink('Add IPP Plan code & Term');
        await fillPlanCode(admin, v, provider);
        await admin.submit();
        const errors: Record<string, string | undefined> = await admin.visibleErrors();
        const review = await admin.reviewShown();
        await admin.backFromReview();         // never confirmed
        return { ...errors, review } as Record<string, string | boolean | undefined>;
      };
      await test.step('Plan code 2 digits / letters rejected', async () => {
        expect((await tryCode({ planCode: '12', tenure: '6', transactionLimit: '500.00', desc: 'QA' })).planCodeError).toBe('Please enter valid Plan Code');
        expect((await tryCode({ planCode: 'abc', tenure: '6', transactionLimit: '500.00', desc: 'QA' })).planCodeError).toBe('Please enter valid Plan Code');
      });
      await test.step(`Existing plan code ${existing} refused (list row: ${existingCells})`, async () => {
        test.skip(!existing, 'No active plan code to duplicate');
        const r = await tryCode({ planCode: existing, tenure: '6', transactionLimit: '500.00', desc: 'QA' }, existingProvider);
        expect(r.review, 'existing plan code must not reach Review').toBe(false);
        expect.soft(r.planCodeError, 'Duplicate plan code message (sheet wording)').toBe('Duplicate plan code in form');
      });
      await test.step('Term: letters rejected, 3 digits cut to 2', async () => {
        expect((await tryCode({ planCode: '091', tenure: 'a', transactionLimit: '500.00', desc: 'QA' })).tenureError).toBe('Please enter valid Tenure');
        await admin.openQuicklink('Add IPP Plan code & Term');
        await admin.fill({ tenure: '100' });
        expect((await admin.input('tenure').inputValue()).length).toBe(2);
      });
      await test.step('Amount "x" / "1,000.555" / "1.234" rejected', async () => {
        for (const amount of ['x', '1,000.555', '1.234']) {
          expect((await tryCode({ planCode: '091', tenure: '6', transactionLimit: amount, desc: 'QA' })).transactionLimitError, amount).toBe('Please enter valid Transaction Limit');
        }
      });
      await test.step('Blank description: "Please enter a short description"; 251 cut to 250', async () => {
        const r = await tryCode({ planCode: '091', tenure: '6', transactionLimit: '500.00', desc: '' });
        expect.soft(r.review, 'blank description must not reach Review').toBe(false);
        expect.soft(r.descError, 'description error').toBe('Please enter a short description');
        await admin.openQuicklink('Add IPP Plan code & Term');
        await admin.input('desc').fill('d'.repeat(251));
        expect((await admin.input('desc').inputValue()).length).toBe(250);
        await admin.captureScreen('Add IPP Plan code - validation');
      });
      await test.step('Service Provider required (only where the form has it)', async () => {
        await admin.openQuicklink('Add IPP Plan code & Term');
        // No Service Provider field (APH): nothing to check - noted, and the test's other results stand
        // (test.skip() here would turn the whole test into "skipped" and hide them)
        if (!(await admin.input('serviceProvider').count())) {
          test.info().annotations.push({ type: 'info', description: 'No Service Provider field on this portal\'s plan code form: "Service Provider required" not applicable' });
          await admin.captureStep('Add a Plan Code: no Service Provider field on this portal');
          return;
        }
        // Fassbayar: no blank / "Select One" choice - a provider is always pre-selected, so it cannot be left empty
        const providers = await admin.options('serviceProvider');
        await admin.captureOptions('serviceProvider', 'Service Provider (Add a Plan Code)');
        if (!providers.some((o) => o === '' || /select/i.test(o))) {
          test.info().annotations.push({ type: 'finding', description: `Service Provider has no blank choice (always pre-selected: ${providers[0]}), so "required" cannot be tested` });
          return;
        }
        await admin.fill({ planCode: '091', tenure: '6', transactionLimit: '500.00', desc: 'QA' });
        await admin.submit();
        await expect(admin.main).toContainText('Please select a service provider');
        await admin.backFromReview();
      });
    }
  );

  test(
    'Edit Plan Code Details: field validation (mandatory, format and length)',
    testCase({ id: 'TC-ADM-030', module: MODULE, priority: 'Medium' }),
    async ({ administratorPage: admin }) => {
      // An ACTIVE plan code's edit form; Submitted and left with Back, never confirmed
      await admin.openQuicklink('IPP Plan code & Term Summary');
      await admin.filter({ status: 'Active' });
      const row = admin.rows.first();
      test.skip(!(await row.count()), 'No active plan code to open the edit form on');
      await admin.quicklinkGo(row, 'View Details');
      await admin.clickButton('Edit Plan Code Details');
      await expect(admin.title).toHaveText('Edit Plan Code Details');
      expect(await admin.steps.allInnerTexts()).toEqual(['Plan Code Details', 'Review & Confirm', 'Complete']);
      await test.step('Every field blank: errors, nothing saved', async () => {
        await admin.clear(['planCode', 'tenure', 'transactionLimit', 'desc']);
        await admin.submit();
        expect.soft(await admin.reviewShown(), 'blank fields must not reach Review').toBe(false);
        await expect.soft(admin.error('planCodeError'), 'Plan Code error').toBeVisible();
        await expect.soft(admin.error('transactionLimitError'), 'Min Transaction Amount error').toBeVisible();
        await admin.backFromReview();
      });
      await test.step('Invalid values rejected; Plan Code max 3, Term max 2, Description max 250', async () => {
        await admin.clear(['planCode', 'tenure', 'transactionLimit']);
        await admin.fill({ planCode: '12', tenure: 'a', transactionLimit: '1.234' });
        await admin.submit();
        await expect(admin.error('planCodeError')).toHaveText('Please enter valid Plan Code');
        await expect(admin.error('tenureError')).toHaveText('Please enter valid Tenure');
        await expect(admin.error('transactionLimitError')).toHaveText('Please enter valid Transaction Limit');
        await admin.clear(['planCode', 'tenure']);
        await admin.fill({ planCode: '12345', tenure: '123' });
        expect((await admin.input('planCode').inputValue()).length).toBe(3);
        expect((await admin.input('tenure').inputValue()).length).toBe(2);
        await admin.fillCounted('desc', 'd'.repeat(251));
        expect((await admin.input('desc').inputValue()).length).toBe(250);
        expect(await admin.remaining()).toBe('0');
      });
      await test.step('Valid values -> Review, then Back (not saved)', async () => {
        await admin.clear(['planCode', 'tenure', 'transactionLimit', 'desc']);
        await admin.fill({ planCode: '091', tenure: '6', transactionLimit: '500.00', desc: 'QA edit check' });
        await admin.submit();
        const review = await admin.reviewShown();
        const errors = await admin.visibleErrors();
        await admin.captureScreen('Edit Plan Code - after valid Submit (not confirmed)');
        await admin.backFromReview();
        expect(review || errors.planCodeError === 'Duplicated. Not Available', `valid values reach Review (errors: ${JSON.stringify(errors)})`).toBe(true);
      });
    }
  );

  test(
    'All Plan Code (IPP Plan code & Term Summary): search and filter field validation',
    testCase({ id: 'TC-ADM-026', module: MODULE, priority: 'Medium' }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('IPP Plan code & Term Summary');
      await expect(admin.title).toHaveText('All Plan Code');
      await test.step('Search placeholder "xxx"; Status options; dates picker-only, default last 10 years', async () => {
        await expect(admin.searchBox).toHaveValue('xxx');
        expect(await admin.options('status')).toEqual(['Select One', 'Active', 'Deleted']);
        for (const n of ['from', 'to']) expect(await admin.input(n, admin.filterForm).getAttribute('readonly'), `${n} read-only`).not.toBeNull();
        await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ years: -10 }));
        await expect(admin.input('to', admin.filterForm)).toHaveValue(portalDate());
      });
      await test.step('Columns', async () => {
        const squash = (a: string[]) => a.map((c) => c.replace(/\s+/g, ''));
        expect(squash((await admin.columns()).filter((c) => !/Service\s*Provider/.test(c)))).toEqual(squash(COLUMNS));
      });
      await test.step('Status filter Active / Deleted lists only that status', async () => {
        for (const status of ['Active', 'Deleted']) {
          await admin.filter({ status });
          const statuses = (await admin.rows.locator('td').filter({ hasText: /^(Active|Deleted)$/ }).allInnerTexts()).map((t) => t.trim());
          for (const s of statuses) expect(s).toBe(status);
        }
      });
      await test.step('Special characters \' " < > % searched as plain text', async () => {
        await admin.search(`'"<>%`);
        await expect(admin.errorPage).toHaveCount(0);
        expect(await admin.rows.count(), 'no extra rows').toBe(0);
        await admin.captureScreen('Plan codes - special characters');
      });
    }
  );
});
