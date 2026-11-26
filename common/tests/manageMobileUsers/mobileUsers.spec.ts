import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { PORTAL_PROFILE } from '../../../portals.config';
import { portalDate } from '../../pages/AdministratorPage';
import { MobileUsersPage, MU_COLUMNS, MU_COMPANY_VIEW_COLUMNS, MU_STATUSES, MU_STEPS, RUN_OUT } from '../../pages/MobileUsersPage';
import { humanAction, requireUatChanges, TEST_EMAIL, UAT_CHANGES_ALLOWED } from '../../utils/uatChanges';
import { digits } from '../../utils/random';

// Manage Mobile Users (both portals). Written from the baseline sheets
//   APH  TC-APH-BP-MU-001..029 (rows 119-146; no MU-009)   Fassbayar  TC-FB-BP-MU-001..029 (rows 134-159; no 011, 020, 022)
//   -> TC-MU-001..029 (same numbers), each workbook's Test Data sheet (TD-06 reference company READ ONLY, TD-07 working
//   company, TD-18 mailbox, TD-19 devices), Field Registry (FR-MU-S01..), Validation Rules (regex_muid, regex_muName,
//   regex_contact_*, regex_email, regex_counterNo), Option Lists (OPT_REASON_USER_SUSPEND, OPT_REASON_REINSTATE),
//   Open Questions (OQ-APH-05/10/23, OQ-FB-05/21/22) and the portal (explore/scan/mobileUsers.scan.ts, 26 Nov 2026).
// Read-only cases use TD-06 mobile users: forms are opened and Submitted to Review & Confirm at most, never Confirmed;
// Suspend / Reinstate forms are checked with the page's own validation, never submitted.
// Data-changing cases (ADM_ALLOW_UAT_CHANGES=true) only use the automation's OWN mobile users (ID qamu + 6 digits),
// registered on the TD-07 working company (each registration uses one of its Available TIDs).
// Run only this file:  npx playwright test common/tests/manageMobileUsers/mobileUsers.spec.ts

const MODULE = 'Manage Mobile Users';
const MU = PORTAL_PROFILE.mobileUsers;
const IS_APH = MU.failover;                     // APH has the AEON BCP failover tables
const OTHER = IS_APH ? 'Fassbayar' : 'APH';
const PREFIX = 'qamu';
const DETAIL_FLAGS = ['canVoidCheckbox', 'canSettleCheckbox', 'canTopupCheckbox', 'canRefundCheckbox', 'canCardBrandCheckbox', 'canMembershipScanCheckbox',
  'enableFasstapCheckBox', 'enableLighthouseCheckBox', 'enableK9CheckBox', 'canSSOLoginCheckbox', 'allowUnattendedCheckbox', 'enableCouponAcceptanceCheckbox'];
const sp = (t: string) => t.replace(/\s+/g, ' ').trim();
// Hint shown in a box: the portal writes it as the box's value (cleared on focus), else a placeholder
const hint = async (box: import('@playwright/test').Locator) => (await box.getAttribute('placeholder')) || (await box.inputValue());

// A case that is only in the other portal's sheet: not run here, left out of this portal's report
const inSheet = (n: string) => test.skip(!MU.sheetCases.includes(n), `Applicable for ${OTHER} only: MU-${n} is not a case of the ${PORTAL_PROFILE.name} baseline sheet`);

// "Resigned" is not a valid reason (QA Lead OQ-APH-23, 22 Nov): left out of the comparison, noted in the report
const withoutResigned = (options: string[]): string[] => {
  if (options.includes('Resigned')) test.info().annotations.push({ type: 'finding', description: '"Resigned" offered as a suspend reason; not tested (QA Lead OQ-APH-23: removed)' });
  return options.filter((o) => o !== 'Resigned');
};

// ---------- test data ----------

// A mobile user of the TD-06 reference company (read only): the first Active one
let refCache = '';
async function refUser(mu: MobileUsersPage): Promise<string> {
  if (refCache) return refCache;
  const users = await mu.usersOf(MU.refCompany.mid, 'Active');
  expect(users.length, `TD-06 ${MU.refCompany.name} (${MU.refCompany.mid}) has an Active mobile user`).toBeGreaterThan(0);
  refCache = users[0]['Mobile User ID'];
  return refCache;
}

// The automation's own Active test mobile users on TD-07
async function qaUsers(mu: MobileUsersPage): Promise<string[]> {
  return (await mu.usersOf(MU.workCompany.mid, 'Active')).map((r) => r['Mobile User ID']).filter((id) => id.startsWith(PREFIX));
}

// Register a new test mobile user on TD-07 (Submit -> Confirm). Blocked when TD-07 has no Available TID.
async function registerQaUser(mu: MobileUsersPage, why: string, flags: Record<string, boolean> = {}): Promise<{ muid: string; tid: string }> {
  await mu.openRegister(MU.workCompany.name);
  if (RUN_OUT.test(await mu.main.innerText())) {
    humanAction(`test data: the working company ${MU.workCompany.name} (Test Data TD-07) has no Available TID ` +
      '("has ran out of Terminal ID"), so no test mobile user can be registered. Register TIDs on it, or name a company with Available TIDs in the Test Data sheet');
  }
  const muid = `${PREFIX}${digits(6)}`;
  let tid = '';
  await test.step(`Register test mobile user ${muid} on ${MU.workCompany.name} (${why})`, async () => {
    await mu.fillUser({ mobileUserId: muid, name: 'QA Mobile User', prefix: '016', body: '12345678', email: TEST_EMAIL || `${muid}@example.com` });
    await mu.setFlags({ ...(MU.fasstap ? { enableLighthouseCheckBox: true } : {}), ...flags });   // Fassbayar needs a reader
    tid = await mu.pickFirstMidTid();
    expect(await mu.submitForm(`Register ${muid}`), 'no field errors').toEqual({});
    expect(await mu.reviewShown(), 'Review & Confirm shown').toBe(true);
    await mu.confirm();
    await mu.captureStep(`After Confirm: ${muid} registered`);
  });
  return { muid, tid };
}

// An Active test mobile user (registered when there is none)
async function qaUser(mu: MobileUsersPage, why: string): Promise<string> {
  const own = await qaUsers(mu);
  return own[0] ?? (await registerQaUser(mu, why)).muid;
}

// Company used for the registration-form cases (read only): TD-07 when it has a free TID, else the first that has one
async function formCompany(mu: MobileUsersPage): Promise<string> {
  const c = await mu.findCompany('free TID', [MU.workCompany.name]);
  if (!c) humanAction('test data: no company with an Available TID found for the registration form (Test Data TD-07 / TD-10)');
  if (c!.company.indexOf(MU.workCompany.mid) < 0) {
    test.info().annotations.push({ type: 'finding', description: `TD-07 ${MU.workCompany.name} has no Available TID: the form was checked on ${c!.company} (opened only, never saved)` });
  }
  return c!.href;
}
async function openForm(mu: MobileUsersPage, href: string): Promise<void> {
  await mu.page.goto(`/mobileUser/${href}`);
  await mu.page.waitForLoadState('load');
  await mu.captureStep('Add a Mobile User: registration form');
}

test.describe('Manage Mobile Users @mobile-users', () => {
  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  // ---------- 4.1 List & search ----------

  test(
    'Mobile User Summary shows search, filters, columns, Quicklink and export',
    testCase({ id: 'TC-MU-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ mobileUsersPage: mu }) => {
      await test.step('Manage Mobile Users > Mobile User Summary: "All Mobile Users", Quicklinks panel', async () => {
        await mu.openSummary();
        await expect(mu.title).toHaveText('All Mobile Users');
        expect.soft((await mu.quicklinks.allInnerTexts()).map(sp), 'Quicklinks panel').toEqual(MU.quicklinks);
      });
      await test.step('Search box "Mobile User ID / Terminal ID (TID)", MID, Status, Date (last 10 years)', async () => {
        expect(await hint(mu.searchBox), 'search box hint').toBe('Mobile User ID / Terminal ID (TID)');
        await expect(mu.input('mid', mu.filterForm), 'Merchant ID (MID)').toBeVisible();
        await mu.captureOptions('status', 'Status filter (Mobile User Summary)', MU_STATUSES);
        expect(await mu.options('status', mu.filterForm), 'Status options').toEqual(MU_STATUSES);
        await expect(mu.input('from', mu.filterForm)).toHaveValue(portalDate({ years: -10 }));
        await expect(mu.input('to', mu.filterForm)).toHaveValue(portalDate());
      });
      await test.step('Columns, Quicklink of an Active user, Export to CSV', async () => {
        await mu.expectColumns(MU_COLUMNS);
        await mu.filter({ status: 'Active' });
        expect(await mu.quicklinkOptions(mu.rows.first()), 'Active user Quicklink').toEqual(['View Details', 'View Transactions', 'Suspend Mobile User Access']);
        await expect(mu.button('Export to CSV')).toBeVisible();
        await mu.captureScreen('Mobile User Summary');
      });
    }
  );

  test(
    'Search by Mobile User ID, TID, MID, status and date',
    testCase({ id: 'TC-MU-002', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      // Test Data: Fassbayar TD-06 (read only); APH TD-07 mobile user when the automation has one, else TD-06
      const own = IS_APH ? await qaUsers(mu) : [];
      const muid = own[0] ?? (await refUser(mu));
      const row = await mu.rowCells(await mu.findUser(muid));
      const tid = row['TID'].split(',')[0].trim();
      const mid = row['MID(Business Name)'].split('-')[0].trim();
      // the search result page shows "Activation / Suspended Date" in that column; the list shows the Created Date
      const listed = (await mu.usersOf(mid)).find((r) => r['Mobile User ID'] === muid) ?? row;
      const created = listed['Created Date'];
      if (row['Created Date'] !== created) test.info().annotations.push({ type: 'finding', description: `Search result shows "${row['Created Date']}" in the Created Date column; the list shows ${created} (activation / suspended date on the search page)` });
      await test.step(`Mobile User ID ${muid} in the search box: only that user`, async () => {
        await mu.openSummary();
        await mu.search(muid);
        await mu.captureStep(`Search Mobile User ID ${muid}`);
        const ids = (await mu.allRowCells()).map((c) => c[1]);
        expect(ids.length, 'rows found').toBeGreaterThan(0);
        expect(ids.every((i) => i.toLowerCase() === muid.toLowerCase()), `rows: ${ids.join(', ')}`).toBe(true);
      });
      await test.step(`TID ${tid}: only users with that TID`, async () => {
        await mu.openSummary();
        await mu.search(tid);
        await mu.captureStep(`Search TID ${tid}`);
        const tids = (await mu.allRowCells()).map((c) => c[2]);
        expect(tids.length, 'rows found').toBeGreaterThan(0);
        expect.soft(tids.every((t) => t.split(/,\s*/).includes(tid)), `TID cells: ${tids.join(' | ')}`).toBe(true);
      });
      await test.step(`MID ${mid}: only that MID; columns populated`, async () => {
        const rows = await mu.usersOf(mid);
        await mu.captureStep(`MID filter ${mid}`);
        expect(rows.length, 'rows found').toBeGreaterThan(0);
        expect.soft(rows.every((r) => r['MID(Business Name)'].includes(mid)), 'every row has the MID').toBe(true);
        expect.soft(rows.every((r) => r['Mobile User ID'] && r['TID'] && r['Status'] && r['Created Date']), 'columns populated').toBe(true);
      });
      await test.step('Status = Suspended: only Suspended users', async () => {
        await mu.openSummary();
        await mu.filter({ status: 'Suspended' });
        const statuses = await mu.rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[3]?.textContent ?? '').trim()));
        await mu.captureStep(`Status Suspended: ${await mu.totalCount()} records`);
        expect.soft(statuses.every((s) => s === 'Suspended'), `statuses: ${[...new Set(statuses)].join(', ')}`).toBe(true);
      });
      await test.step(`Date range ${created} - ${created}: only users created that day`, async () => {
        await mu.openSummary();
        await mu.setDate('from', created);
        await mu.setDate('to', created);
        await mu.filter({});
        const dates = await mu.rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[4]?.textContent ?? '').trim()));
        await mu.captureStep(`Date range ${created}`);
        expect(dates.length, 'rows found').toBeGreaterThan(0);
        expect.soft(dates.every((d) => d === created), `created dates: ${[...new Set(dates)].join(', ')}`).toBe(true);
      });
    }
  );

  test(
    "Company view lists only that company's mobile users",
    testCase({ id: 'TC-MU-003', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const { name, mid } = MU.refCompany;
      await test.step(`All Companies > ${name} (TD-06) > View Mobile Users`, async () => {
        await mu.page.goto('/company');
        await mu.search(mid);
        await mu.quicklinkGo(mu.rows.first(), 'View Mobile Users');
        await expect(mu.main, 'company MID in the header').toContainText('MID:');
        await expect.soft(mu.main.getByText('All Mobile Users', { exact: true }).first()).toBeVisible();
        await expect(mu.button('Add a Mobile User'), 'Add a Mobile User shortcut').toBeVisible();
        await expect.soft(mu.button('View Company Details')).toBeVisible();
        await mu.expectColumns(MU_COMPANY_VIEW_COLUMNS);
      });
      const ids = (await mu.rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelector('td')?.textContent ?? '').trim()))).filter(Boolean);
      await mu.captureStep(`Company view: ${ids.length} users on page 1`);
      expect(ids.length, 'users listed').toBeGreaterThan(0);
      await test.step(`Each listed user (first 8) belongs to ${name} (Mobile User Summary business name)`, async () => {
        const wrong: string[] = [];
        for (const id of ids.slice(0, 8)) {
          const cells = await mu.rowCells(await mu.findUser(id));
          if (!cells['MID(Business Name)'].toLowerCase().includes(name.toLowerCase())) wrong.push(`${id}: ${cells['MID(Business Name)']}`);
        }
        expect(wrong, `users of another company`).toEqual([]);
      });
    }
  );

  test(
    'Export to CSV matches the filtered list',
    testCase({ id: 'TC-MU-023', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const { mid } = MU.refCompany;
      await mu.openSummary();
      await mu.filter({ mid });
      const rows = await mu.allRowCells();
      await mu.captureStep(`MID filter ${mid}: ${rows.length} rows`);
      await mu.openSummary();
      await mu.filter({ mid });
      const csv = await mu.exportCsv();
      await test.info().attach('Export to CSV', { body: csv, contentType: 'text/plain' });
      const missing = rows.map((c) => c[1]).filter((id) => !csv.includes(id));
      expect.soft(missing, 'screen Mobile User IDs missing from the CSV').toEqual([]);
      expect.soft(csv.split(/\r?\n/).filter((l) => l.trim()).length - 1, 'CSV data rows = screen rows').toBe(rows.length);
    }
  );

  test(
    'All Mobile Users (Mobile User Summary): search and filter field validation',
    testCase({ id: 'TC-MU-025', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      await mu.openSummary();
      await test.step('Placeholder, Status options, dates picker-only with the 10-year default', async () => {
        expect(await hint(mu.searchBox), 'search box hint').toBe('Mobile User ID / Terminal ID (TID)');
        expect(await mu.options('status', mu.filterForm)).toEqual(MU_STATUSES);
        for (const n of ['from', 'to']) expect.soft(await mu.input(n, mu.filterForm).getAttribute('readonly'), `${n} read-only (picker only)`).not.toBeNull();
        await expect(mu.input('from', mu.filterForm)).toHaveValue(portalDate({ years: -10 }));
        await expect(mu.input('to', mu.filterForm)).toHaveValue(portalDate());
      });
      await test.step('Special characters \' " < > % in the search box: plain text, no error page, no rows', async () => {
        await mu.search(`'"<>%`);
        await mu.captureStep('Search with special characters');
        await mu.expectNoErrorPage();
        expect(await mu.rows.count(), 'no rows').toBe(0);
      });
      await test.step('Special characters in the MID filter: no error page, no rows', async () => {
        await mu.openSummary();
        await mu.filter({ mid: `'"<>%` });
        await mu.captureStep('MID filter with special characters');
        await mu.expectNoErrorPage();
        expect(await mu.rows.count(), 'no rows').toBe(0);
      });
      await test.step('Long search (51 characters): no error page', async () => {
        await mu.openSummary();
        await mu.search('M'.repeat(51));
        await mu.expectNoErrorPage();
      });
      await test.step(`Company view (TD-06 ${MU.refCompany.name}): Status options, dates picker-only`, async () => {
        await mu.page.goto('/company');
        await mu.search(MU.refCompany.name);
        await mu.quicklinkGo(mu.rows.first(), 'View Mobile Users');
        await mu.expectNoErrorPage();
        expect.soft(await mu.options('status', mu.filterForm), 'company view Status options').toEqual(MU_STATUSES);
        for (const n of ['from', 'to']) expect.soft(await mu.input(n, mu.filterForm).getAttribute('readonly'), `company view ${n} read-only`).not.toBeNull();
      });
    }
  );

  // ---------- 4.2 Register ----------

  test(
    'Add a Mobile User: search company and open the registration form',
    testCase({ id: 'TC-MU-004', module: MODULE, priority: 'High' }),
    async ({ mobileUsersPage: mu }) => {
      const href = await formCompany(mu);
      await test.step('Company search: steps, "You are currently viewing", Total Records, the company', async () => {
        await mu.openQuicklink('Add a Mobile User');
        await expect(mu.title).toHaveText('Add a Mobile User');
        expect.soft((await mu.steps.allInnerTexts()).map(sp), 'steps').toEqual(MU_STEPS);
        await mu.search(MU.workCompany.name);
        await expect.soft(mu.main).toContainText('You are currently viewing');
        await expect.soft(mu.main).toContainText(/Total Records:?\s*\d+/);
        await expect.soft(mu.main, 'company listed').toContainText(MU.workCompany.mid);
        await mu.captureStep('Company search result');
      });
      await openForm(mu, href);
      await test.step('Form: steps, maxlengths, placeholders, defaults (credit settlement ticked, others unticked)', async () => {
        expect.soft((await mu.steps.allInnerTexts()).map(sp), 'steps').toEqual(MU_STEPS);
        const maxlengths: Record<string, string> = { mobileUserId: '20', name: '20', contact_prefix: '3', contact_body: '8', email: '50', ...(MU.counterNo ? { counterNo: '10' } : {}) };
        for (const [id, max] of Object.entries(maxlengths)) expect.soft(await mu.main.locator(`#${id}`).getAttribute('maxlength'), `${id} maxlength`).toBe(max);
        expect.soft(await hint(mu.main.locator('#contact_prefix')), 'contact prefix hint').toBe('01X');
        expect.soft(await hint(mu.main.locator('#contact_body')), 'contact number hint').toBe('1234567');
        // Field Registry defaults: credit settlement ticked; Fassbayar FR-MU-S05-015 SSO ticked too ("follows company SSO")
        const ticked = ['canSettleCheckbox', ...(MU.fasstap ? ['canSSOLoginCheckbox'] : [])];
        const flags = await mu.flags(DETAIL_FLAGS);
        expect.soft(flags['canSettleCheckbox'], 'Able to perform credit settlement ticked by default').toBe(true);
        expect.soft(Object.entries(flags).filter(([k, v]) => !ticked.includes(k) && v).map(([k]) => k), 'other flags unticked by default').toEqual([]);
      });
      if (IS_APH) {
        await test.step('Hints (APH sheet)', async () => {
          await expect.soft(mu.main).toContainText('Between 3-20 Alphanumeric characters');
          await expect.soft(mu.main).toContainText('Between 5-20 Alphabets, spaces, dots(.) and/or dashes(-)');
        });
      }
      await test.step('MID table' + (MU.failover ? ' and Secondary Terminal (Failover-Capable) table' : ''), async () => {
        await expect(mu.main.getByText('Terminal ID (TID)').first()).toBeVisible();
        expect(await mu.midRows.count(), 'MID rows').toBeGreaterThan(0);
        if (MU.failover) await expect.soft(mu.main.getByText('Secondary Terminal (Failover-Capable)').first()).toBeVisible();
        await mu.captureScreen('Add a Mobile User form');
      });
    }
  );

  test(
    'Register a mobile user with one TID per MID',
    testCase({ id: 'TC-MU-005', module: MODULE, priority: 'High', manual: [{
      title: 'Registration email of the new mobile user (NTF-07)', reason: 'The email arrives in the TD-18 mailbox, which automation cannot read.',
      handling: 'Check the email of the registered test user: subject, body and values as NTF-07 (no activation code).' }] }),
    async ({ mobileUsersPage: mu }) => {
      requireUatChanges('registers a new test mobile user on the TD-07 working company (uses one Available TID)');
      const { muid, tid } = await registerQaUser(mu, 'MU-005');
      await test.step(`${muid}: Active and listed on Mobile User Summary with TID ${tid}`, async () => {
        const cells = await mu.rowCells(await mu.findUser(muid));
        expect(cells['Status']).toBe('Active');
        expect.soft(cells['TID'], 'assigned TID').toContain(tid);
      });
      await test.step(`Status History: "Registration"`, async () => {
        await mu.openDetails(muid);
        const history = await mu.statusHistory();
        expect.soft(history.rows.some((r) => Object.values(r).some((v) => /Registration/.test(v))), 'Status History has Registration').toBe(true);
      });
      await test.step(`TID ${tid} changed from Available to Active (Terminal Summary)`, async () => {
        await mu.page.goto('/terminal');
        await mu.page.waitForLoadState('load');
        if (/\/issue\//.test(mu.page.url())) { test.info().annotations.push({ type: 'finding', description: 'Terminal Summary opens the portal error page: TID status not checked' }); return; }
        await mu.search(tid);
        await mu.captureStep(`Terminal Summary: TID ${tid}`);
        expect.soft(await mu.rows.first().innerText().catch(() => ''), `TID ${tid} row`).toContain('Active');
      });
    }
  );

  test(
    'Register with multiple MIDs',
    testCase({ id: 'TC-MU-006', module: MODULE, priority: 'Medium' }),
    async () => {
      humanAction('test data: a company with several MIDs and Available TIDs per host (Host Matrix HM-* data sets) is not named in the Test Data sheet; ' +
        'the TD-07 working company has one MID. Register a user ticking every MID and check one TID per MID (AMB Retail + MyDebit together, GP Retail and IPP share a TID)');
    }
  );

  test(
    'Registration validation messages',
    testCase({ id: 'TC-MU-007', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const href = await formCompany(mu);
      const base = { mobileUserId: `qav${digits(6)}`, name: 'QA Validation', prefix: '016', body: '12345678', email: 'qa.mu.validation@example.com' };
      // one run: a valid form with one change; Submit; read the errors; back from Review if it got there (never Confirm)
      const run = async (label: string, change: Parameters<MobileUsersPage['fillUser']>[0], opts: { mid?: 'none' | 'noTid' | 'tid' } = {}) => {
        await openForm(mu, href);
        await mu.fillUser({ ...base, ...change });
        if (MU.fasstap) await mu.setFlags({ enableLighthouseCheckBox: true });   // Fassbayar needs a reader
        if (opts.mid !== 'none') {
          await mu.midRows.first().check({ force: true });
          if (opts.mid !== 'noTid') await mu.pickFirstMidTid();
        }
        const errors = await mu.submitForm(label);
        if (await mu.reviewShown()) await mu.backFromReview();
        test.info().annotations.push({ type: 'info', description: `${label}: ${Object.values(errors).join('; ') || 'accepted (Review & Confirm)'}` });
        return errors;
      };
      const SELECT_MSGS = /^(Please select a TID for every MID selected|Please select one TID)$/;
      await test.step('No MID ticked: a TID / MID message, nothing saved', async () => {
        const e = await run('No MID ticked', {}, { mid: 'none' });
        expect.soft(e.tidError ?? '', 'no MID ticked: "Please select a TID for every MID selected" or "Please select one TID" (sheet)').toMatch(SELECT_MSGS);
      });
      await test.step('MID ticked without a TID: "Please select a TID for every MID selected"', async () => {
        const e = await run('MID ticked, no TID', {}, { mid: 'noTid' });
        expect.soft(e.tidError ?? '', 'MID ticked without a TID: "Please select a TID for every MID selected" or "Please select one TID" (sheet)').toMatch(SELECT_MSGS);
      });
      await test.step('Existing Mobile User ID: "Mobile User ID already exists"', async () => {
        const existing = await refUser(mu);
        const e = await run(`Existing Mobile User ID ${existing}`, { mobileUserId: existing });
        expect.soft(Object.values(e).join(' '), 'existing Mobile User ID').toContain('Mobile User ID already exists');
      });
      await test.step('Mobile User ID: 2 chars and with "-" rejected; 3 and 20 accepted; 21 cut to 20', async () => {
        expect.soft((await run('Mobile User ID 2 chars', { mobileUserId: `q${digits(1)}` })).mobileUserIdError, 'ID 2 chars').toBe('Please enter valid Mobile User ID');
        expect.soft((await run('Mobile User ID with "-"', { mobileUserId: `qa-${digits(4)}` })).mobileUserIdError, 'ID with "-"').toBe('Please enter valid Mobile User ID');
        expect.soft((await run('Mobile User ID 3 chars', { mobileUserId: `q${digits(2)}` })).mobileUserIdError, 'ID 3 chars accepted (QA Lead: 3-20)').toBeUndefined();
        expect.soft((await run('Mobile User ID 20 chars', { mobileUserId: `qa${digits(18)}` })).mobileUserIdError, 'ID 20 chars accepted').toBeUndefined();
        await openForm(mu, href);
        await mu.fillUser({ mobileUserId: `qa${digits(19)}` });
        expect.soft((await mu.valueOf('mobileUserId')).length, 'ID 21st character not taken').toBe(20);
      });
      await test.step('Name: 21 chars cut to 20; with digits rejected', async () => {
        await openForm(mu, href);
        await mu.fillUser({ name: 'Abcdefghijklmnopqrstu' });
        expect.soft((await mu.valueOf('name')).length, 'Name 21st character not taken').toBe(20);
        expect.soft((await run('Name with digits', { name: 'Ab1de Abc' })).nameError, 'Name with digits').toBe('Please enter valid Name');
      });
      await test.step('Contact No. 7 digits rejected (8 digits: QA Lead); invalid email rejected', async () => {
        expect.soft((await run('Contact 7 digits', { body: digits(7) })).contactError, 'contact 7 digits rejected').toBe('Please enter valid Contact');
        expect.soft((await run('Email "x@"', { email: 'x@' })).emailError, 'invalid email').toBe('Please enter valid Email');
      });
      if (MU.counterNo) {
        await test.step('Counter No 11 characters: cut to 10 (Fassbayar)', async () => {
          await openForm(mu, href);
          await mu.fillUser({ counterNo: 'C'.repeat(11) });
          expect.soft((await mu.valueOf('counterNo')).length, 'Counter No 11th character not taken').toBe(10);
        });
        await test.step('IPP MID without a plan: "Please select one IPP Plan" (Fassbayar)', async () => {
          await openForm(mu, href);
          if (!(await mu.main.getByText(/IPP/).count())) { test.info().annotations.push({ type: 'finding', description: 'The form company has no IPP MID: "Please select one IPP Plan" not checked' }); return; }
          const e = await run('IPP MID without plan', {});
          expect.soft(Object.values(e).join(' '), 'IPP plan message').toContain('Please select one IPP Plan');
        });
      }
    }
  );

  test(
    'Company without an Available TID shows the run-out message',
    testCase({ id: 'TC-MU-008', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const c = await mu.findCompany('no free TID', [MU.workCompany.name]);
      if (!c) humanAction('test data: no company without an Available TID found (Test Data: a new company from the CMP add case)');
      await test.step(`Add a Mobile User > ${c!.company}: no form, run-out message, Register New Terminal`, async () => {
        await openForm(mu, c!.href);
        const text = sp(await mu.main.innerText());
        const mid = (text.match(RUN_OUT) ?? ['', ''])[1];
        expect(text, 'run-out message').toMatch(RUN_OUT);
        expect.soft(c!.company, 'MID in the message is the company\'s').toContain(mid);
        await expect.soft(mu.main).toContainText('Please register more Terminals to continue');
        await expect(mu.button('Register New Terminal'), 'Register New Terminal button').toBeVisible();
        await expect(mu.main.locator('#mobileUserId'), 'no registration form').toHaveCount(0);
      });
    }
  );

  test(
    'Enable Fasstap requires contactless on the company',
    testCase({ id: 'TC-MU-009', module: MODULE, priority: 'Low' }),
    async () => {
      inSheet('009');
      humanAction('test data: a company with contactless disabled and an Available TID is not named in the Test Data sheet. ' +
        'Register a user with Enable Fasstap ticked: "Contactless payments not enabled for this merchant" (or Fasstap not selectable)');
    }
  );

  test(
    'Mobile user flags are saved',
    testCase({ id: 'TC-MU-010', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      requireUatChanges('registers a test mobile user with a mix of flags on the TD-07 working company (uses one Available TID)');
      const mix = { canVoidCheckbox: true, canSettleCheckbox: false, canRefundCheckbox: true, enableLighthouseCheckBox: true, allowUnattendedCheckbox: true,
        ...(MU.fasstap ? { enableCouponAcceptanceCheckbox: true } : {}) };
      const { muid } = await registerQaUser(mu, 'MU-010', mix);
      await test.step(`${muid}: every flag as registered (read on Edit Mobile User Details, not saved)`, async () => {
        await mu.openDetails(muid);
        await mu.clickButton('Edit Mobile User Details');
        const now = await mu.flags(Object.keys(mix));
        await mu.captureStep(`Flags of ${muid}`);
        expect(now, 'flags after registration').toEqual(mix);
        await mu.clickButton('Cancel');
      });
    }
  );

  test(
    'Secondary Terminal (Failover-Capable) table is shown (AEON BCP)',
    testCase({ id: 'TC-MU-011', module: MODULE, priority: 'Low' }),
    async ({ mobileUsersPage: mu }) => {
      inSheet('011');
      await openForm(mu, await formCompany(mu));
      const section = mu.main.getByText('Secondary Terminal (Failover-Capable)').first();
      await expect(section).toBeVisible();
      await expect.soft(mu.main.getByText('Secondary TID').first(), 'Secondary TID column').toBeVisible();
      expect(await mu.main.locator('select[id^="selectSecondaryTID_"]').count(), 'a Secondary TID selector per MID row').toBe(await mu.midRows.count());
      await mu.captureScreen('Secondary Terminal (Failover-Capable)');
    }
  );

  test(
    'Add a Mobile User – company search: field validation (mandatory, format and length)',
    testCase({ id: 'TC-MU-026', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      await mu.openQuicklink('Add a Mobile User');
      await test.step('Search box labelled "MID / Name of Business / Authoriser"', async () => {
        await expect(mu.searchBox).toBeVisible();
        await mu.search(MU.refCompany.mid);
        await expect.soft(mu.main, 'search label').toContainText('MID / Name of Business / Authoriser');
      });
      await test.step('Blank search: no error page', async () => {
        await mu.openQuicklink('Add a Mobile User');
        await mu.search('');
        await mu.expectNoErrorPage();
      });
      await test.step('Special characters \' " < > %: plain text, no error page, no rows', async () => {
        await mu.search(`'"<>%`);
        await mu.captureStep('Company search with special characters');
        await mu.expectNoErrorPage();
        expect(await mu.rows.count(), 'no rows').toBe(0);
      });
      await test.step('Long search (51 characters): no error page', async () => {
        await mu.search('C'.repeat(51));
        await mu.expectNoErrorPage();
      });
    }
  );

  test(
    'Add a Mobile User – registration form: mandatory fields',
    testCase({ id: 'TC-MU-027', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const href = await formCompany(mu);
      await openForm(mu, href);
      const blank = await test.step('Submit with every field blank: each mandatory field shows its error', async () => {
        const e = await mu.submitForm('Blank form');
        for (const id of ['mobileUserIdError', 'nameError', 'emailError']) expect.soft(e[id], `${id} shown`).toBeTruthy();
        expect(await mu.reviewShown(), 'form not submitted').toBe(false);
        return e;
      });
      test.info().annotations.push({ type: 'info', description: `blank form errors: ${Object.entries(blank).map(([k, v]) => `${k}=${v}`).join('; ')}` });
      await test.step('Fill the mandatory fields one at a time: each error clears', async () => {
        const steps: [string, Parameters<MobileUsersPage['fillUser']>[0]][] = [
          ['mobileUserIdError', { mobileUserId: `qav${digits(6)}` }], ['nameError', { name: 'QA Validation' }],
          ['contactError', { prefix: '016', body: '12345678' }], ['emailError', { email: 'qa.mu.validation@example.com' }]];
        for (const [error, value] of steps) {
          await mu.fillUser(value);
          const e = await mu.submitForm(`Filled ${Object.keys(value).join(', ')}`);
          expect.soft(e[error], `${error} cleared after filling`).toBeUndefined();
        }
        await mu.pickFirstMidTid();
        let left = await mu.submitForm('All mandatory fields and a TID');
        if (left.readerError) {
          test.info().annotations.push({ type: 'finding', description: `Also mandatory on this portal (not in the sheet's Field IDs): a reader - "${left.readerError}"` });
          await mu.setFlags({ enableLighthouseCheckBox: true });
          left = await mu.submitForm('A reader ticked');
        }
        expect(left, 'no errors left').toEqual({});
        if (await mu.reviewShown()) await mu.backFromReview();       // never Confirm
      });
    }
  );

  // ---------- 4.3 Details & update ----------

  test(
    'Mobile User Details shows every label and flag',
    testCase({ id: 'TC-MU-012', module: MODULE, priority: 'High' }),
    async ({ mobileUsersPage: mu }) => {
      const own = IS_APH ? await qaUsers(mu) : [];
      const muid = own[0] ?? (await refUser(mu));
      await mu.openDetails(muid);
      const text = sp(await mu.main.innerText());
      const labels = ['You are currently viewing', 'Mobile User Details', 'Company Details', 'Business Name', 'Terminal ID (TID)', 'Mobile User ID', 'Name',
        'Contact No.', 'Email Address', 'Authorisation', 'Reader Acceptance', 'Single Sign On (SSO)', 'Allow Unattended Usage', 'MID', 'Payment Type',
        ...(MU.failover ? ['Fassbayar Sync Status', 'Last Sync Date', 'Last Sync Status', 'Secondary Terminal (Failover-Capable)', 'Secondary TID'] : []),
        ...(MU.counterNo ? ['Counter No', 'Enable Coupon Acceptance'] : [])];
      await test.step('Sections and labels (Field Registry)', async () => {
        expect.soft(labels.filter((l) => !text.includes(l)), 'labels missing').toEqual([]);
        await expect.soft(mu.main, 'MID / TID table columns').toContainText(/Merchant ID \(MID\)\s*Payment Type\s*Terminal ID \(TID\)/);
      });
      await test.step('Buttons', async () => {
        const buttons = ['View Company Details', 'Edit Mobile User Details', 'Status History', 'View Transactions', 'Reset User PIN', 'Suspend Mobile User Access',
          ...(MU.failover ? ['View Sync History'] : [])];
        for (const b of buttons) await expect.soft(mu.button(new RegExp(`^\\s*${b}\\s*(>>)?\\s*$`)), `button "${b}"`).toBeVisible();
        if (MU.failover) {
          // sheet / OQ-APH-05: "Retrigger FassBayar Sync"
          const retrigger = mu.main.locator('#retriggerFassbayarSyncBtn, a, button').filter({ hasText: /Retrigger Fass ?bayar Sync/i }).first();
          await expect.soft(retrigger, 'Retrigger FassBayar Sync button').toBeVisible();
          const shown = sp(await retrigger.innerText().catch(() => ''));
          if (shown && shown !== 'Retrigger FassBayar Sync') test.info().annotations.push({ type: 'finding', description: `Button reads "${shown}"; the sheet (OQ-APH-05) says "Retrigger FassBayar Sync"` });
        }
      });
      if (MU.fasstap) {
        await test.step('Flags shown (Field Registry ids)', async () => {
          for (const id of ['canVoidResult', 'canSettleResult', 'enableFasstapResult', 'enableLighthouseResult', 'enableK9Result', 'enableCouponResult'])
            await expect.soft(mu.main.locator(`#${id}`), `flag ${id}`).toHaveCount(1);
        });
      }
      await mu.captureScreen(`Mobile User Details ${muid}`);
    }
  );

  test(
    'Edit mobile user details and permissions',
    testCase({ id: 'TC-MU-013', module: MODULE, priority: 'High', gaps: [{
      description: 'The audit entry of the edit is not checked (the Audit Trail action name for a mobile user edit is not in the sheet).',
      impact: 'A missing audit entry for mobile user edits would not be caught.' }] }),
    async ({ mobileUsersPage: mu }) => {
      requireUatChanges('edits a test mobile user of the TD-07 working company (registered when there is none)');
      const muid = await qaUser(mu, 'MU-013');
      const v = { name: `QA Edited ${String.fromCharCode(65 + Number(digits(1)) % 26)}`, prefix: '017', body: digits(8), email: `qa.edit.${digits(4)}@example.com` };
      await mu.openDetails(muid);
      await mu.clickButton('Edit Mobile User Details');
      await test.step('Mobile User ID is read-only on the edit form', async () => {
        await expect(mu.main.locator('#mobileUserId'), 'no Mobile User ID input').toHaveCount(0);
        await expect(mu.main).toContainText(muid);
      });
      const before = await mu.flags(['canVoidCheckbox', 'canRefundCheckbox']);
      const after = { canVoidCheckbox: !before.canVoidCheckbox, canRefundCheckbox: !before.canRefundCheckbox };
      await test.step(`Change Name, Contact No., Email and two permission flags; Submit; Confirm`, async () => {
        await mu.fillUser(v);
        await mu.setFlags(after);
        expect(await mu.submitForm(`Edit ${muid}`), 'no field errors').toEqual({});
        expect(await mu.reviewShown()).toBe(true);
        await mu.confirm();
        await mu.captureStep(`After Confirm: ${muid} edited`);
      });
      await test.step('Details show the new values and flags', async () => {
        await mu.openDetails(muid);
        const text = sp(await mu.main.innerText());
        expect.soft(text, 'new name').toContain(v.name);
        expect.soft(text, 'new contact').toContain(v.body.slice(-4));
        expect.soft(text, 'new email').toContain(v.email);
        await mu.clickButton('Edit Mobile User Details');
        expect(await mu.flags(Object.keys(after)), 'flags saved').toEqual(after);
        await mu.clickButton('Cancel');
      });
    }
  );

  test(
    'Edit validation: name max 20, contact 8 digits, email',
    testCase({ id: 'TC-MU-014', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      // the form is only Submitted to Review & Confirm and left with Back / Cancel: nothing is saved
      const muid = await refUser(mu);
      const openEdit = async () => { await mu.openDetails(muid); await mu.clickButton('Edit Mobile User Details'); };
      const run = async (label: string, change: Parameters<MobileUsersPage['fillUser']>[0]) => {
        await openEdit();
        await mu.fillUser(change);
        const e = await mu.submitForm(label);
        if (await mu.reviewShown()) await mu.backFromReview();
        test.info().annotations.push({ type: 'info', description: `${label}: ${Object.values(e).join('; ') || 'accepted (Review & Confirm)'}` });
        return e;
      };
      await test.step('Name 20 accepted; 21 cut to 20', async () => {
        expect.soft((await run('Name 20 chars', { name: 'Abcdefghij Klmnopqrs' })).nameError, 'Name 20 accepted').toBeUndefined();
        await openEdit();
        await mu.fillUser({ name: 'Abcdefghij Klmnopqrst' });
        expect.soft((await mu.valueOf('name')).length, 'Name 21st character not taken').toBe(20);
      });
      await test.step('Contact No. 8 accepted; 9 cut to 8; 7 rejected (QA Lead: 8 digits)', async () => {
        expect.soft((await run('Contact 8 digits', { body: digits(8) })).contactError, 'contact 8 accepted').toBeUndefined();
        await openEdit();
        await mu.fillUser({ body: digits(9) });
        expect.soft((await mu.valueOf('contact_body')).length, 'contact 9th digit not taken').toBe(8);
        expect.soft((await run('Contact 7 digits', { body: digits(7) })).contactError, 'contact 7 digits rejected').toBe('Please enter valid Contact');
      });
      await test.step('Invalid email rejected', async () => {
        expect.soft((await run('Email "x@"', { email: 'x@' })).emailError, 'invalid email').toBe('Please enter valid Email');
      });
      if (MU.counterNo) {
        await test.step('Counter No 10 accepted; 11 cut to 10 (Fassbayar)', async () => {
          expect.soft((await run('Counter No 10 chars', { counterNo: 'C'.repeat(10) })).counterNoError, 'Counter No 10 accepted').toBeUndefined();
          await openEdit();
          await mu.fillUser({ counterNo: 'C'.repeat(11) });
          expect.soft((await mu.valueOf('counterNo')).length, 'Counter No 11th character not taken').toBe(10);
        });
      }
      await mu.clickButton('Cancel');
    }
  );

  test(
    'Edit Mobile User Details: mandatory fields',
    testCase({ id: 'TC-MU-028', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      const muid = await refUser(mu);
      await mu.openDetails(muid);
      await mu.clickButton('Edit Mobile User Details');
      const original = { name: await mu.valueOf('name'), email: await mu.valueOf('email') };
      await test.step('Clear Name and Email, Submit: both errors shown, not submitted', async () => {
        await mu.fillUser({ name: '', email: '' });
        const e = await mu.submitForm('Name and Email cleared');
        expect.soft(e.nameError, 'Name error').toBe('Please enter valid Name');
        expect.soft(e.emailError, 'Email error').toBe('Please enter valid Email');
        expect(await mu.reviewShown(), 'not submitted').toBe(false);
      });
      await test.step('Fill them one at a time: each error clears', async () => {
        await mu.fillUser({ name: original.name });
        expect.soft((await mu.submitForm('Name filled again')).nameError, 'Name error cleared').toBeUndefined();
        await mu.fillUser({ email: original.email });
        expect.soft(await mu.submitForm('Email filled again'), 'no errors left').toEqual({});
        if (await mu.reviewShown()) await mu.backFromReview();     // never Confirm
      });
      await mu.clickButton('Cancel');
    }
  );

  // ---------- 4.4 Status & PIN ----------

  test(
    'Suspend Mobile User Access form shows the expected fields',
    testCase({ id: 'TC-MU-015', module: MODULE, priority: 'High' }),
    async ({ mobileUsersPage: mu }) => {
      // forms are only opened (never submitted)
      const muid = await refUser(mu);
      await test.step(`Suspend Mobile User Access form of ${muid}`, async () => {
        await mu.quicklinkGo(await mu.findUser(muid), 'Suspend Mobile User Access');
        await expect(mu.main).toContainText('You are currently viewing');
        await expect(mu.button('View Company Details')).toBeVisible();
        await expect(mu.title).toHaveText('Suspend Mobile User Access');
        expect((await mu.steps.allInnerTexts()).map(sp)).toEqual(['Details', 'Complete']);
        await expect(mu.main).toContainText(/Mobile User ID\s*:/);
        await expect.soft(mu.main, 'Mobile User ID shown').toContainText(muid);
        await expect.soft(mu.main, 'Effective Date = today').toContainText(portalDate());
        await mu.captureOptions('reason', 'Reason (Suspend Mobile User Access)', ['Others']);
        expect(withoutResigned(await mu.options('reason')), 'Reason options (OPT_REASON_USER_SUSPEND)').toEqual(['Others']);
        const def = await mu.selected('reason');
        if (def !== 'Others') test.info().annotations.push({ type: 'finding', description: `Default reason is "${def}"; the Field Registry default is "Others"` });
        await expect(mu.main).toContainText(/Max characters:\s*250/);
        expect(await mu.remaining(), 'counter').toBe('250');
        expect(await mu.input('description').getAttribute('maxlength')).toBe('250');
        await expect(mu.button('Submit')).toBeVisible();
      });
      await test.step('Reinstate form (a Suspended user): Reason = Reinstate only', async () => {
        await mu.openSummary();
        await mu.filter({ status: 'Suspended' });
        test.skip(!(await mu.rows.count()), 'No Suspended mobile user on the portal to open the Reinstate form');
        await mu.quicklinkGo(mu.rows.first(), 'Reinstate Mobile User Access');
        expect(await mu.options('reason')).toEqual(['Reinstate']);
        expect((await mu.steps.allInnerTexts()).map(sp)).toEqual(['Details', 'Complete']);
        expect(await mu.remaining()).toBe('250');
      });
    }
  );

  test(
    'Suspend Mobile User Access with reason and remarks, then reinstate',
    testCase({ id: 'TC-MU-016', module: MODULE, priority: 'High' }),
    async ({ mobileUsersPage: mu }) => {
      requireUatChanges('suspends and reinstates a test mobile user of the TD-07 working company (registered when there is none)');
      const muid = await qaUser(mu, 'MU-016');
      const submitStatus = async (action: 'Suspend' | 'Reinstate', reason: string, remarks: string) => {
        await mu.quicklinkGo(await mu.findUser(muid), `${action} Mobile User Access`);
        if (action === 'Suspend') await mu.input('reason').selectOption({ label: reason });
        await mu.fillCounted('description', remarks);
        await mu.captureStep(`${action} ${muid}: ${reason}, "${remarks}", before Submit`);
        await mu.button('Submit').click();
        await mu.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await mu.captureStep(`After ${action} Submit`);
      };
      await test.step('Suspend: Reason Others, remarks "QA baseline suspend"', async () => {
        await submitStatus('Suspend', 'Others', 'QA baseline suspend');
      });
      await test.step('Suspended in the list and details; Suspended Date today; Reinstate offered; Status History', async () => {
        const row = await mu.findUser(muid);
        expect((await mu.rowCells(row))['Status']).toBe('Suspended');
        expect(await mu.quicklinkOptions(row)).toContain('Reinstate Mobile User Access');
        await mu.quicklinkGo(row, 'View Details');
        await expect.soft(mu.main, 'Suspended Date: today').toContainText(portalDate());
        await expect(mu.button('Reinstate Mobile User Access')).toBeVisible();
        const rows = (await mu.statusHistory()).rows;
        expect.soft(rows.some((r) => Object.values(r).join(' ').includes('Others') && Object.values(r).join(' ').includes('QA baseline suspend')), 'history: Others / QA baseline suspend').toBe(true);
      });
      await test.step('Reinstate: "Suspended" badge on the form; remarks "QA baseline reinstate"; Active again', async () => {
        await mu.quicklinkGo(await mu.findUser(muid), 'Reinstate Mobile User Access');
        await expect.soft(mu.main, '"Suspended" shown on the Reinstate form').toContainText('Suspended');
        await mu.fillCounted('description', 'QA baseline reinstate');
        await mu.button('Submit').click();
        await mu.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        expect(await mu.statusOf(muid)).toBe('Active');
        await mu.openDetails(muid);
        await expect(mu.button('Suspend Mobile User Access')).toBeVisible();
        const rows = (await mu.statusHistory()).rows;
        expect.soft(rows.some((r) => Object.values(r).join(' ').includes('Reinstate')), 'history: Reinstate').toBe(true);
      });
    }
  );

  test(
    'Suspend Mobile User Access: remarks limit and counter',
    testCase({ id: 'TC-MU-017', module: MODULE, priority: 'Low' }),
    async ({ mobileUsersPage: mu }) => {
      // the form is never submitted: empty remarks are checked with the page's own validation
      const muid = await refUser(mu);
      await mu.quicklinkGo(await mu.findUser(muid), 'Suspend Mobile User Access');
      await test.step('10 characters: "Max characters: 240 remaining"', async () => {
        await mu.fillCounted('description', 'abcdefghij');
        expect(await mu.remaining()).toBe('240');
        await mu.captureStep('Remarks 10 characters: counter');
      });
      await test.step('251 characters: input stops at 250, counter 0', async () => {
        await mu.fillCounted('description', 'x'.repeat(251));
        expect((await mu.input('description').inputValue()).length).toBe(250);
        expect(await mu.remaining()).toBe('0');
      });
      await test.step('Empty remarks: rejected (the page\'s own check, not submitted)', async () => {
        await mu.fillCounted('description', '');
        const ok = await mu.validateWithoutSubmit();
        await mu.captureStep('Empty remarks: page validation');
        expect.soft(ok, 'empty remarks must not pass the form check').toBe(false);
        await expect.soft(mu.error('descriptionError'), 'remarks error shown').toBeVisible();
      });
    }
  );

  test(
    'Reinstate is blocked when the user has no active TID',
    testCase({ id: 'TC-MU-018', module: MODULE, priority: 'Medium' }),
    async () => {
      humanAction('test data: a mobile user suspended because its only TID was deleted (Terminal delete) is needed; ' +
        'try Reinstate: it must be rejected and the user stays Suspended');
    }
  );

  test(
    'Reinstate Mobile User Access form: field validation (mandatory, format and length)',
    testCase({ id: 'TC-MU-029', module: MODULE, priority: 'Medium' }),
    async ({ mobileUsersPage: mu }) => {
      // an already Suspended user's form; never submitted (blank remarks checked with the page's own validation)
      await mu.openSummary();
      await mu.filter({ status: 'Suspended' });
      test.skip(!(await mu.rows.count()), 'No Suspended mobile user on the portal to open the Reinstate form');
      await mu.quicklinkGo(mu.rows.first(), 'Reinstate Mobile User Access');
      await test.step('Reason: Reinstate only (default); counter 250; maxlength 250', async () => {
        expect(await mu.options('reason')).toEqual(['Reinstate']);
        expect(await mu.selected('reason')).toBe('Reinstate');
        expect(await mu.remaining()).toBe('250');
        expect(await mu.input('description').getAttribute('maxlength')).toBe('250');
      });
      await test.step('Blank remarks: rejected by the form check', async () => {
        await mu.fillCounted('description', '');
        const ok = await mu.validateWithoutSubmit();
        await mu.captureStep('Reinstate: blank remarks, page validation');
        expect.soft(ok, 'blank remarks must not pass').toBe(false);
        await expect.soft(mu.error('descriptionError'), 'remarks error shown').toBeVisible();
      });
      await test.step('250 accepted, 251 cut to 250', async () => {
        await mu.fillCounted('description', 'y'.repeat(251));
        expect((await mu.input('description').inputValue()).length).toBe(250);
        expect(await mu.remaining()).toBe('0');
      });
    }
  );

  test(
    'Reset User PIN asks for confirmation and sends a new activation',
    testCase({ id: 'TC-MU-019', module: MODULE, priority: 'Medium', manual: [{
      title: 'Reset User PIN: email and new PIN on the device', reason: 'Needs the TD-18 mailbox and a TD-19 device (sheet: HAR).',
      handling: 'Continue the pop-up, check the email (NTF-08) and set a new PIN on the device; earlier sessions must be invalidated.' }] }),
    async ({ mobileUsersPage: mu }) => {
      // the pop-up is checked and cancelled; the rest needs the mailbox and a device
      const muid = await refUser(mu);
      await mu.openDetails(muid);
      const email = (sp(await mu.main.innerText()).match(/Email Address\s+(\S+@\S+)/) ?? ['', ''])[1];
      const frame = await mu.openPopup('Reset User PIN');
      const text = await mu.popupText(frame);
      await mu.closePopup();
      expect.soft(text, 'pop-up text (FR-MU-S11-004)').toContain(`Are you sure you want to reset User PIN? If you continue, an activation email will be sent to ${email}`);
      humanAction('mailbox and device: Continue the Reset User PIN pop-up, check the email (NTF-08) and set a new PIN on the TD-19 device (sheet: HAR)');
    }
  );

  test(
    'Revoke SSO Token asks for confirmation and forces a new SSO login',
    testCase({ id: 'TC-MU-020', module: MODULE, priority: 'Low', manual: [{
      title: 'Revoke SSO Token on an SSO mobile user', reason: 'Needs a TD-19 device logged in by SSO (sheet: HAR).',
      handling: 'Revoke SSO Token > Confirm; the device must log in again.' }] }),
    async () => {
      inSheet('020');
      humanAction('device: an SSO mobile user logged in on a TD-19 device; Revoke SSO Token > Confirm, the device must log in again (sheet: HAR)');
    }
  );

  test(
    'Suspended mobile user cannot log in on the app',
    testCase({ id: 'TC-MU-021', module: MODULE, priority: 'Medium', manual: [{
      title: 'Suspended mobile user logs in on the app', reason: 'Needs the mobile app on a TD-19 device (sheet: HAR).',
      handling: 'Suspend the TD-07 test user, log in with it on the app: refused while suspended.' }] }),
    async () => {
      humanAction('device: log in on the app with a suspended mobile user (TD-07 + TD-19 device): login refused (sheet: HAR)');
    }
  );

  test(
    'Reinstated mobile user can log in and pay',
    testCase({ id: 'TC-MU-024', module: MODULE, priority: 'Medium', manual: [{
      title: 'Reinstated mobile user logs in and pays', reason: 'Needs the mobile app, a TD-19 device and a test card (sheet: HAR).',
      handling: 'After reinstating, log in on the app and do a card sale: both succeed.' }] }),
    async () => {
      humanAction('device and test card: log in on the app with the reinstated user and do a card sale (sheet: HAR)');
    }
  );

  // ---------- 4.5 History ----------

  test(
    'Status History and Fassbayar Sync History pop-ups (Sync History APH only)',
    testCase({ id: 'TC-MU-022', module: MODULE, priority: 'Low' }),
    async ({ mobileUsersPage: mu }) => {
      inSheet('022');
      const muid = await refUser(mu);
      await mu.openDetails(muid);
      await test.step('Status History >>: columns, entries newest first', async () => {
        const h = await mu.statusHistory();
        expect(h.columns.map((c) => c.replace(/\s+/g, '')), 'columns').toEqual(['Date / Time', 'User ID(Role)', 'Status', 'Reason', 'Description'].map((c) => c.replace(/\s+/g, '')));
        const times = h.rows.map((r) => Date.parse((r[h.columns[0]] ?? '').replace(' / ', ' ')));
        if (times.length > 1) expect.soft(times.every((t, i) => i === 0 || t <= times[i - 1]), `newest first: ${h.rows.map((r) => r[h.columns[0]]).join(' | ')}`).toBe(true);
      });
      await test.step('View Sync History >>: columns', async () => {
        const frame = await mu.openPopup('View Sync History');
        const text = await mu.popupText(frame);
        await mu.closePopup();
        for (const c of ['Date / Time', 'Action', 'Direction', 'Status', 'Triggered By', 'Reason', 'Request ID']) expect.soft(text, `column ${c}`).toContain(c);
      });
    }
  );
});
