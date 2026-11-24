import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { Credentials, PORTAL_PROFILE } from '../../../portals.config';
import { portalDate } from '../../pages/AdministratorPage';

// Administrator > System Error Log / System Error Details / Audit Trail (User Activities). SHARED.
// Written from the APH baseline sheet (TC-APH-BP-ADM-010, 011, 012, 019, 024, 025) and the portal
// (explore/scan/administrator.scan.ts, 23 Nov 2026). Read-only (searches, details, file downloads).
// Run only this file:  npx playwright test common/tests/administrator/logs.spec.ts

const MODULE = 'Administrator';
const ERROR_TYPES = ['Select One', 'Security', 'Client', 'Application', 'Database', 'Infrastructure', 'Data Sync'];
const AUDIT_COLUMNS = ['Date/Time', 'User ID(Role)', 'Action', 'Status', 'Description'];
// OPT_AUDIT_ACTION (Option Lists): 117 options incl. "Select One"; first ones as on screen
const AUDIT_ACTIONS_START = ['Select One', 'Login to System', 'Logout from System', 'View Homepage', 'View Company list',
  'View company details', 'Updated a company', 'Updated company status'];

test.describe('Administrator > Logs @administrator', () => {

  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  test(
    'System Error Log filter by type and view details',
    testCase({ id: 'TC-ADM-010', module: MODULE, priority: 'Medium', suite: ['smoke'] }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('System Error Log');
      await expect(admin.title).toHaveText('System Error Log');
      for (const type of ERROR_TYPES.slice(1)) {
        await test.step(`Type = ${type}: every row is ${type}`, async () => {
          await admin.filter({ type });
          const types = (await admin.rows.locator('td:first-child').allInnerTexts()).map((t) => t.trim());
          console.log(`error log ${type}: ${types.length} rows on page 1`);
          for (const t of types) expect(t).toBe(type);
        });
      }
      // View Details opens the error in a pop-up (fancybox iframe)
      await test.step('View Details (pop-up): date/time and description', async () => {
        await admin.filter({ type: 'Select One' });
        const frame = await admin.openPopup('View Details');
        const text = await admin.popupText(frame);
        expect(text).toContain('System Error Details');
        expect(text).toMatch(/\d{2} \w{3} \d{4}|\d{4}-\d{2}-\d{2}/);
        await admin.captureScreen('System Error Details pop-up');
        await test.step('Save to File downloads the error', async () => {
          const download = admin.page.waitForEvent('download', { timeout: 30_000 });
          await frame.locator('a').filter({ hasText: /Save to File/ }).first().click();
          const file = await download;
          expect(file.suggestedFilename().length).toBeGreaterThan(0);
          console.log(`error saved as ${file.suggestedFilename()}`);
        });
        await admin.closePopup();
      });
    }
  );

  test(
    'Error details do not expose passwords or PINs',
    testCase({ id: 'TC-ADM-011', module: MODULE, priority: 'Medium', gaps: [{
      description: 'The test checks the newest error details for clear-text passwords / PINs; it does not first cause an error on a password form.',
      impact: 'A leak that only happens for one specific error would not be caught.' }] }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('System Error Log');
      const ids = (await admin.rows.locator('a').filter({ hasText: 'View Details' }).evaluateAll((as) =>
        as.map((a) => (a as HTMLAnchorElement).href))).slice(0, 5);
      const secret = /(password|passwd|pwd|pin)\s*[=:]\s*(?!\*|null|\s|,|$)[^\s,&"']{3,}/i;
      for (const href of ids) {
        await test.step(`No clear-text password / PIN in ${href.replace(/^.*\?/, '')}`, async () => {
          await admin.page.goto(href);
          const text = await admin.page.locator('body').innerText();
          expect(text.match(secret)?.[0] ?? '', 'clear-text password / PIN').toBe('');
        });
      }
      await admin.captureScreen('Newest error details checked');
    }
  );

  test(
    'Audit Trail search, columns and export',
    testCase({ id: 'TC-ADM-012', module: MODULE, priority: 'High', suite: ['smoke'], gaps: [{
      description: 'The export is downloaded but the test does not check that the export itself is written to the Audit Trail.',
      impact: 'A missing audit entry for exports would not be caught.' }] }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('Audit Trail');
      await expect(admin.title).toHaveText('User Activities');
      await test.step('Columns', async () => {
        await admin.expectColumns(AUDIT_COLUMNS);
      });
      await test.step(`Search by User ID ${Credentials.username}`, async () => {
        await admin.search(Credentials.username);
        const users = (await admin.rows.locator('td:nth-child(2)').allInnerTexts()).map((t) => t.trim());
        expect(users.length, 'own activity listed').toBeGreaterThan(0);
        for (const u of users) expect(u.toLowerCase()).toContain(Credentials.username.toLowerCase());
      });
      await test.step('Filter Action = Login to System (last 3 months)', async () => {
        await admin.openQuicklink('Audit Trail');
        await admin.filter({ action: 'Login to System' });
        const actions = (await admin.rows.locator('td:nth-child(3)').allInnerTexts()).map((t) => t.trim());
        expect(actions.length).toBeGreaterThan(0);
        for (const a of actions) expect(a).toBe('Login to System');
        await admin.captureScreen('Audit Trail - Login to System');
      });
      await test.step('Export to CSV downloads', async () => {
        const download = admin.page.waitForEvent('download', { timeout: 60_000 });
        await admin.button('Export to CSV').click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/\.(csv|xls|xlsx)$/i);
      });
    }
  );

  test(
    'Audit Trail date range limit',
    testCase({ id: 'TC-ADM-019', module: MODULE, priority: 'Low' }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('Audit Trail');
      await test.step('Default range: last 3 months', async () => {
        await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ months: -3 }));
        await expect(admin.input('to', admin.filterForm)).toHaveValue(portalDate());
      });
      // Expected behaviour per portal (portals.config.ts administrator.auditRangeLimited):
      //   APH: no range limit by design (QA Lead, 24 Nov 2026) -> a 1-year search simply lists the records
      //   Fassbayar: the same (QA Lead, 24 Nov 2026). true = a range beyond the limit must be refused with a message
      const limited = PORTAL_PROFILE.administrator.auditRangeLimited;
      await test.step(limited
        ? 'Search a range beyond the limit (1 year): rejected with a range message'
        : 'Search a 1-year range: allowed, records listed, no error (no range limit: QA Lead 24 Nov 2026)', async () => {
        await admin.setDate('from', portalDate({ years: -1 }));
        let dialog = '';
        admin.page.once('dialog', async (d) => { dialog = d.message(); await d.dismiss(); });
        await admin.filterForm.locator('a.button').filter({ hasText: /^\s*Search\s*$/ }).first().click();
        await admin.page.waitForLoadState('load');
        const message = dialog || (await admin.main.getByText(/range|exceed|maximum|months|days/i).first().innerText().catch(() => ''));
        const records = await admin.totalCount();
        console.log(`1-year range -> ${message || 'no message'}; ${records} records`);
        await admin.captureScreen('Audit Trail - 1 year range');
        if (limited) {
          expect(message, 'a range beyond the limit must be rejected with a message').not.toBe('');
        } else {
          await expect(admin.errorPage, 'no error page').toHaveCount(0);
          expect(message, 'no range message (no limit by design)').toBe('');
          expect(records, 'records of the whole year listed').toBeGreaterThan(0);
          await expect(admin.input('from', admin.filterForm), 'the 1-year start date is kept').toHaveValue(portalDate({ years: -1 }));
          test.info().annotations.push({ type: 'finding', description: `No Audit Trail date limit, as expected (QA Lead 24 Nov): 1 year = ${records} records` });
        }
      });
    }
  );

  test(
    'System Error Log: search and filter field validation',
    testCase({ id: 'TC-ADM-024', module: MODULE, priority: 'Medium' }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('System Error Log');
      await test.step('Type dropdown: default Select One, options', async () => {
        expect(await admin.selected('type')).toBe('Select One');
        expect(await admin.options('type')).toEqual(ERROR_TYPES);
      });
      await test.step('Each type searches without an error page', async () => {
        for (const type of ERROR_TYPES) {
          await admin.filter({ type });
          await expect(admin.errorPage).toHaveCount(0);
        }
        await admin.captureScreen('System Error Log - filter');
      });
    }
  );

  test(
    'Audit Trail (User Activities): search and filter field validation',
    testCase({ id: 'TC-ADM-025', module: MODULE, priority: 'Medium' }),
    async ({ administratorPage: admin }) => {
      await admin.openQuicklink('Audit Trail');
      await test.step('Search placeholder "User ID"; dates picker-only, default last 3 months', async () => {
        await expect(admin.searchBox).toHaveValue('User ID');
        for (const n of ['from', 'to']) expect(await admin.input(n, admin.filterForm).getAttribute('readonly'), `${n} read-only`).not.toBeNull();
        await expect(admin.input('from', admin.filterForm)).toHaveValue(portalDate({ months: -3 }));
      });
      await test.step('Action dropdown: OPT_AUDIT_ACTION (117 incl. Select One)', async () => {
        const actions = await admin.options('action');
        expect(actions.slice(0, AUDIT_ACTIONS_START.length)).toEqual(AUDIT_ACTIONS_START);
        const count = PORTAL_PROFILE.administrator.auditActionCount;
        if (count) expect.soft(actions.length, `number of actions (sheet: ${count})`).toBe(count);
      });
      await test.step('Special characters \' " < > % searched as plain text', async () => {
        await admin.search(`'"<>%`);
        await expect(admin.errorPage).toHaveCount(0);
        expect(await admin.rows.count(), 'no extra rows').toBe(0);
        await admin.captureScreen('Audit Trail - special characters');
      });
    }
  );
});
