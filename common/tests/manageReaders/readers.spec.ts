import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { PORTAL_PROFILE, ENV_NAME } from '../../../portals.config';
import { portalDate } from '../../pages/AdministratorPage';
import { ReadersPage, READER_COLUMNS, READER_STATUSES, SUSPEND_REASONS, HISTORY_COLUMNS, CSV_HEADER } from '../../pages/ReadersPage';
import { requireUatChanges, humanAction, stopBeforeSaving } from '../../utils/uatChanges';
import { digits } from '../../utils/random';
import { readerCsv } from '../../testdata/readerCsvFiles';

// Manage Readers (both portals, same screens). Written from the baseline sheets
//   APH  TC-APH-BP-RDR-001..016 (rows 175-190)   Fassbayar  TC-FB-BP-RDR-001..016 (rows 193-208)
// (same 16 cases in both), each workbook's Test Data sheet (TD-07 working company, TD-13 reader CSVs)
// and the portal (explore/scan/readers.scan.ts + readerUpload.scan.ts, 23 Nov 2026).
// Read-only cases: 001, 002, 006, 007, 013, 015. Data-changing cases (ADM_ALLOW_UAT_CHANGES=true) only use
// the automation's OWN test readers: serial QARDR + 10 digits, registered on the TD-07 working company.
// RDR-009 makes two of them Permanently Suspended (irreversible): always two NEW ones.
// Run only this file:  npx playwright test common/tests/manageReaders/readers.spec.ts

const MODULE = 'Manage Readers';
const RULES = PORTAL_PROFILE.readers;
const PREFIX = 'QARDR';
const newSerial = () => `${PREFIX}${digits(10)}`;

// ---------- test data ----------

// TD-07 working company: { mid, provider } from All Companies (list shows "MID-HOST")
const companyCache: Record<string, { mid: string; provider: string; name: string }> = {};
async function company(rdr: ReadersPage, key: string): Promise<{ mid: string; provider: string; name: string }> {
  if (companyCache[key]) return companyCache[key];
  await rdr.page.goto('/company');
  await rdr.search(key);
  const text = (await rdr.rows.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  const m = /^\d{6,15}$/.test(key) ? text.match(new RegExp(`(${key})-([A-Z0-9]+)`)) : text.match(/(\d{10,15})-([A-Z0-9]+)/);
  expect(m, `company "${key}" found in All Companies on ${ENV_NAME} (Test Data sheet)`).toBeTruthy();
  companyCache[key] = { mid: m![1], provider: m![2], name: text.slice(0, 80) };
  return companyCache[key];
}
const workingCompany = (rdr: ReadersPage) => company(rdr, RULES.workingMid || RULES.workingCompany);

// Register new test readers on the working company (Upload -> Submit); returns their serials
async function registerReaders(rdr: ReadersPage, count: number, why: string): Promise<string[]> {
  const { mid, provider } = await workingCompany(rdr);
  const serials = Array.from({ length: count }, newSerial);
  await test.step(`Register ${count} new test reader(s) on the working company ${mid} (${why})`, async () => {
    const sum = await rdr.upload(`register-${serials[0]}.csv`, [CSV_HEADER, ...serials.map((s) => `${s};${mid};${provider}`)].join('\r\n') + '\r\n');
    expect(sum.approved, `upload summary (${sum.text.slice(0, 160)})`).toBe(count);
    await rdr.submitUpload(why);
  });
  return serials;
}

// Active test readers of the automation on the working company (registered when there are not enough)
async function testReaders(rdr: ReadersPage, count: number, why: string): Promise<string[]> {
  const { mid } = await workingCompany(rdr);
  await rdr.openQuicklink('Reader Summary');
  await rdr.filter({ mid, status: 'Active' });
  const own = (await rdr.allRowCells()).map((c) => c[0]).filter((s) => s.startsWith(PREFIX));
  if (own.length >= count) return own.slice(0, count);
  return [...own, ...(await registerReaders(rdr, count - own.length, why))];
}

async function statusOf(rdr: ReadersPage, serial: string): Promise<string> {
  const row = await rdr.findSerial(serial);
  return (await rdr.rowCells(row.first()))['Status'] ?? '';
}

// Suspend form: reasons Deactivate - Reassignment / Terminate open a confirmation pop-up first
async function confirmPermanentPopup(rdr: ReadersPage): Promise<string> {
  const frame = rdr.page.frameLocator('#fancybox-wrap iframe, .fancybox-wrap iframe, .fancybox-inner iframe').first();
  await expect(frame.locator('body'), 'confirmation pop-up for a permanent suspension').not.toBeEmpty({ timeout: 15_000 });
  const text = (await frame.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  await rdr.captureStep(`Pop-up: permanent suspension warning`);
  await stopBeforeSaving(rdr, 'confirm the permanent suspension');
  await frame.locator('a, button, input[type=button], input[type=submit]').filter({ hasText: /^\s*(Yes|Confirm|Proceed|OK|Submit|Continue)\s*$/i }).first().click();
  await rdr.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await rdr.captureStep('After confirming the permanent suspension');
  return text;
}

test.describe('Manage Readers @readers', () => {

  test.beforeEach(async ({ loginPage, consolePage }) => {
    await loginAs({ loginPage, consolePage });
  });

  // ---------- 5.1 List & search ----------

  test(
    'Reader Summary shows search, filters, columns, Quicklink and export',
    testCase({ id: 'TC-RDR-001', module: MODULE, priority: 'High', suite: ['smoke'] }),
    async ({ readersPage: rdr }) => {
      await test.step('Open Manage Readers > Reader Summary', async () => {
        await rdr.openQuicklink('Reader Summary');
        await expect(rdr.title).toHaveText('All Readers');
        await expect.soft(rdr.page, 'browser title').toHaveTitle(/All Readers/);
        expect.soft((await rdr.quicklinks.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()), 'Quicklinks panel').toEqual(RULES.quicklinks);
      });
      await test.step('Search box "Serial Number", MID, Status, Date filters', async () => {
        await expect(rdr.searchBox).toHaveValue('Serial Number');
        await expect(rdr.input('mid', rdr.filterForm)).toBeVisible();
        await rdr.captureOptions('status', 'Status filter (Reader Summary)', READER_STATUSES);
        expect(await rdr.options('status', rdr.filterForm), 'Status options (Field Registry)').toEqual(READER_STATUSES);
        await expect(rdr.input('from', rdr.filterForm)).toHaveValue(portalDate({ years: -10 }));
        await expect(rdr.input('to', rdr.filterForm)).toHaveValue(portalDate());
      });
      await test.step('Columns, Quicklink of an Active reader, Export to CSV', async () => {
        await rdr.expectColumns(READER_COLUMNS);
        await rdr.filter({ status: 'Active' });
        expect(await rdr.quicklinkOptions(rdr.rows.first()), 'Active reader Quicklink').toEqual(['View Details', 'Suspend Reader']);
        await expect(rdr.button('Export to CSV')).toBeVisible();
        await rdr.captureScreen('Reader Summary');
      });
    }
  );

  test(
    'Search readers by serial, MID, status and date; export',
    testCase({ id: 'TC-RDR-002', module: MODULE, priority: 'High' }),
    async ({ readersPage: rdr }) => {
      await rdr.openQuicklink('Reader Summary');
      const first = await rdr.rowCells(rdr.rows.first());
      const serial = first['Reader Serial No.'];
      const mid = first['MID(Business Name)'].split('-')[0].trim();
      const created = first['Created Date'];

      await test.step(`Serial ${serial}: only that serial`, async () => {
        await rdr.findSerial(serial);
        const serials = (await rdr.allRowCells()).map((c) => c[0]);
        expect(serials.length, 'rows found').toBeGreaterThan(0);
        expect(serials.every((s) => s.toUpperCase() === serial.toUpperCase()), `every row is ${serial}: ${serials.join(', ')}`).toBe(true);
      });
      await test.step('Status: each status lists only readers in that status', async () => {
        for (const status of READER_STATUSES.slice(1)) {
          await rdr.openQuicklink('Reader Summary');
          await rdr.filter({ status });
          const shown = (await rdr.rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[1]?.textContent ?? '').trim())));
          await rdr.captureStep(`Status filter ${status}: ${await rdr.totalCount()} records`);
          expect.soft(shown.every((s) => s === status), `${status}: ${[...new Set(shown)].join(', ')}`).toBe(true);
        }
      });
      await test.step(`MID ${mid}: only that MID; Export to CSV equals the screen rows`, async () => {
        await rdr.openQuicklink('Reader Summary');
        await rdr.filter({ mid });
        const rows = await rdr.allRowCells();
        await rdr.captureStep(`MID filter ${mid}: ${rows.length} rows`);
        expect(rows.every((c) => c[3].startsWith(mid)), 'every row has the MID').toBe(true);
        await rdr.openQuicklink('Reader Summary');
        await rdr.filter({ mid });
        const csv = await rdr.exportCsv();
        await test.info().attach('Export to CSV', { body: csv, contentType: 'text/plain' });
        const missing = rows.map((c) => c[0]).filter((s) => !csv.includes(s));
        expect.soft(missing, 'screen serials missing from the CSV').toEqual([]);
        const dataLines = csv.split(/\r?\n/).filter((l) => l.trim()).length - 1;
        expect.soft(dataLines, 'CSV data rows = screen rows').toBe(rows.length);
      });
      await test.step(`Date range ${created} - ${created}: only readers created that day`, async () => {
        await rdr.openQuicklink('Reader Summary');
        await rdr.setDate('from', created);
        await rdr.setDate('to', created);
        await rdr.filter({});
        const dates = (await rdr.rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelectorAll('td')[2]?.textContent ?? '').trim())));
        await rdr.captureStep(`Date range ${created}: ${dates.length} rows on page 1`);
        expect(dates.length, 'rows found').toBeGreaterThan(0);
        expect.soft(dates.every((d) => d === created), `created dates: ${[...new Set(dates)].join(', ')}`).toBe(true);
      });
      await test.step('Bypass serial 0000000000 is never listed', async () => {
        await rdr.findSerial('0000000000');
        expect(await rdr.row('0000000000').count(), 'bypass serial listed').toBe(0);
      });
    }
  );

  // ---------- 5.2 Register ----------

  test(
    'Register readers by CSV',
    testCase({ id: 'TC-RDR-003', module: MODULE, priority: 'High' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('registers 2 new test readers on the TD-07 working company');
      await test.step('Download the template: header Reader Serial No.;MID;ServiceProvider', async () => {
        const tpl = await rdr.downloadTemplate();
        await test.info().attach('template', { body: tpl, contentType: 'text/plain' });
        expect(tpl.split(/\r\n|\r|\n/)[0].trim()).toBe(CSV_HEADER);
      });
      const { mid, provider } = await workingCompany(rdr);
      const [a, b] = [newSerial(), newSerial()];
      await test.step(`Upload 2 readers (one lower-case with spaces: " ${a.toLowerCase()} ") -> summary 2 found, 2 approved`, async () => {
        const sum = await rdr.upload('RDR_01-valid.csv', readerCsv('RDR_01-valid.csv',
          { NEW_SERIAL_1_LOWER: a.toLowerCase(), NEW_SERIAL_2: b, WORKING_MID: mid, PROVIDER: provider }));
        expect(sum.found, 'found').toBe(2);
        expect(sum.approved, 'approved').toBe(2);
        expect(sum.rejected + sum.duplicated, 'rejected + duplicated').toBe(0);
      });
      await test.step('Submit -> readers registered', async () => {
        const result = await rdr.submitUpload('2 valid readers');
        test.info().annotations.push({ type: 'info', description: `Register result: ${result.slice(0, 200)}` });
      });
      for (const s of [a, b]) {
        await test.step(`${s}: Active, on the working company ${mid}, serial upper-cased and trimmed`, async () => {
          const row = await rdr.findSerial(s);
          await expect(row, `${s} listed exactly as upper-case`).toHaveCount(1);
          const cells = await rdr.rowCells(row);
          expect(cells['Reader Serial No.']).toBe(s);
          expect(cells['Status']).toBe('Active');
          expect(cells['MID(Business Name)'].startsWith(mid), `MID ${cells['MID(Business Name)']}`).toBe(true);
          expect(cells['Activation Date'] ?? cells['Created Date'], 'activation date').toBe(portalDate());
        });
      }
    }
  );

  test(
    'Reader CSV row errors and file errors',
    testCase({ id: 'TC-RDR-004', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('uploads bad reader rows; Submits them when the upload step accepts them, to see if Submit rejects them');
      const { mid, provider } = await workingCompany(rdr);
      const [existing] = await testReaders(rdr, 1, 'existing serial for RDR-004');
      const dup = newSerial();
      // a 15-digit MID no company has (999999999999999 exists on APH: "Ma Inc")
      let unknownMid = '';
      for (let i = 0; i < 5 && !unknownMid; i++) {
        const m = `9${digits(14)}`;
        await rdr.page.goto('/company');
        await rdr.search(m);
        if (!(await rdr.rows.count())) unknownMid = m;
      }
      expect(unknownMid, 'a MID with no company').not.toBe('');
      // files: common/testdata/RDR_0x-*.csv (placeholders filled per run, see readerCsvFiles.ts)
      const base = { WORKING_MID: mid, PROVIDER: provider };
      const [newA, newB, d3] = [newSerial(), newSerial(), digits(3)];
      const bad = {
        existing: { file: 'RDR_02-existing-serial.csv' as const, values: { ...base, EXISTING_SERIAL: existing }, serial: existing, expect: 'duplicate serial' },
        unknownMid: { file: 'RDR_03-unknown-mid.csv' as const, values: { ...base, NEW_SERIAL: newA, UNKNOWN_MID: unknownMid }, serial: newA, expect: 'Invalid MID' },
        notRegistered: { file: 'RDR_04-company-not-registered.csv' as const, values: { ...base, NEW_SERIAL: newB }, serial: newB, expect: 'Company not registered (wrong Service Provider for the MID)' },
        invalidSerial: { file: 'RDR_05-invalid-serial.csv' as const, values: { ...base, DIGITS_3: d3 }, serial: `QA RDR#!${d3}`, expect: 'Invalid Serial No.' },
        duplicateInCsv: { file: 'RDR_06-duplicate-in-csv.csv' as const, values: { ...base, NEW_SERIAL: dup }, serial: dup, expect: '1 approved + 1 duplicated' }
      };
      for (const [key, c] of Object.entries(bad)) {
        await test.step(`${c.file}: rejected (${c.expect})`, async () => {
          const sum = await rdr.upload(c.file, readerCsv(c.file, c.values));
          const flagged = sum.rejected + sum.duplicated;
          test.info().annotations.push({ type: 'info', description: `${c.file}: found ${sum.found}, approved ${sum.approved}, rejected ${sum.rejected}, duplicated ${sum.duplicated}` });
          if (key === 'duplicateInCsv') {
            // the portal rejects BOTH rows of a repeated serial (Rejected 2); the sheet only asks that it is flagged
            expect.soft(flagged, `${c.file}: repeated serial flagged`).toBeGreaterThanOrEqual(1);
            expect.soft(sum.approved, `${c.file}: at most one row approved`).toBeLessThanOrEqual(1);
            if (sum.canSubmit && sum.approved) await rdr.submitUpload(c.file);   // the one good row is a new test reader
            return;
          }
          expect.soft(flagged, `${c.file}: bad row flagged at Upload (${c.expect})`).toBe(1);
          if (flagged === 0 && sum.canSubmit) {
            // the upload step accepted it: see whether Submit rejects it
            const result = await rdr.submitUpload(`${c.file} (bad row)`);
            test.info().annotations.push({ type: 'info', description: `${c.file} after Submit: ${result.slice(0, 200)}` });
            if (key !== 'existing') {
              const listed = await (await rdr.findSerial(c.serial.trim().toUpperCase())).count();
              expect.soft(listed, `${c.file}: bad reader must not be registered`).toBe(0);
            }
          }
        });
      }
      await test.step('RDR_07 a .xlsx file: "Please upload a valid CSV"', async () => {
        const sum = await rdr.upload('RDR_07-not-a-csv.xlsx', readerCsv('RDR_07-not-a-csv.xlsx'));
        expect(sum.found, 'nothing read from the file').toBeNaN();
        await expect.soft(rdr.main, 'file error message (sheet: "Please upload a valid CSV")').toContainText('Please upload a valid CSV');
      });
    }
  );

  test(
    'Existing serial uploaded for another company is reassigned',
    testCase({ id: 'TC-RDR-005', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('moves one test reader to company B');
      if (!RULES.secondMid) {
        // show what is ready: the working company's own test readers and the Register New Readers screen
        const { mid } = await workingCompany(rdr);
        await rdr.openQuicklink('Reader Summary');
        await rdr.filter({ mid });
        await rdr.captureStep(`Readers of the working company ${mid} (company A): a test reader would be moved to company B`);
        await rdr.openQuicklink('Register New Readers');
        humanAction(`name a second company ("company B") for ${ENV_NAME} in the Test Data sheet; then this case uploads a test reader's serial with company B's MID and checks it moved`);
      }
      const [serial] = await testReaders(rdr, 1, 'reader to reassign (RDR-005)');
      const b = await company(rdr, RULES.secondMid);
      let before = 0;
      await test.step(`${serial}: Status History before`, async () => {
        await rdr.openDetails(serial);
        before = (await rdr.statusHistory()).rows.length;
      });
      await test.step(`Upload ${serial} for company B ${b.mid} -> Submit`, async () => {
        const sum = await rdr.upload('RDR_08-reassign.csv', readerCsv('RDR_08-reassign.csv',
          { EXISTING_SERIAL: serial, SECOND_MID: b.mid, SECOND_PROVIDER: b.provider }));
        test.info().annotations.push({ type: 'info', description: `upload: found ${sum.found}, approved ${sum.approved}, rejected ${sum.rejected}, duplicated ${sum.duplicated}` });
        expect(sum.canSubmit, 'Submit offered').toBe(true);
        await rdr.submitUpload('reassign to company B');
      });
      await test.step(`${serial} now belongs to company B; history kept`, async () => {
        const row = await rdr.findSerial(serial);
        const mids = (await rdr.allRowCells()).map((c) => c[3]);
        expect(mids.some((m) => m.startsWith(b.mid)), `rows of ${serial}: ${mids.join(' | ')}`).toBe(true);
        await rdr.quicklinkGo(row.filter({ hasText: b.mid }).first(), 'View Details');
        const after = (await rdr.statusHistory()).rows.length;
        expect.soft(after, 'Status History kept (not fewer entries)').toBeGreaterThanOrEqual(before);
      });
    }
  );

  // ---------- 5.3 Details ----------

  test(
    'Reader Details shows labels and actions; Status History',
    testCase({ id: 'TC-RDR-006', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      await rdr.openQuicklink('Reader Summary');
      await rdr.filter({ status: 'Active' });
      const cells = await rdr.rowCells(rdr.rows.first());
      const serial = cells['Reader Serial No.'];
      await test.step(`Reader Details of ${serial}`, async () => {
        await rdr.quicklinkGo(rdr.rows.first(), 'View Details');
        await expect(rdr.main).toContainText('You are currently viewing');
        await expect(rdr.main).toContainText(`MID: ${cells['MID(Business Name)'].split('-')[0].trim()}`);
        for (const label of ['Reader Details', 'Reader Serial No.', 'Status']) await expect.soft(rdr.main, `label ${label}`).toContainText(label);
        await expect.soft(rdr.main, 'serial shown').toContainText(serial);
        for (const b of RULES.detailsButtons) await expect.soft(rdr.button(b), `button ${b}`).toBeVisible();
        await expect(rdr.button('Suspend Reader'), 'Active reader: Suspend Reader').toBeVisible();
        await expect(rdr.button('Reinstate Reader'), 'Active reader: no Reinstate Reader').toHaveCount(0);
      });
      await test.step('Status History >>: columns; first entry Registration', async () => {
        const h = await rdr.statusHistory();
        expect(h.columns, 'Status History columns').toEqual(HISTORY_COLUMNS);
        expect(h.rows.length, 'entries').toBeGreaterThan(0);
        expect.soft(h.rows[0]['Reason'], 'first entry').toBe('Registration');
      });
    }
  );

  // ---------- 5.4 Suspend / reinstate ----------

  test(
    'Suspend Reader form shows the expected fields',
    testCase({ id: 'TC-RDR-007', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      // forms are only opened (never submitted): any reader will do
      await rdr.openQuicklink('Reader Summary');
      await rdr.filter({ status: 'Active' });
      const serial = (await rdr.rowCells(rdr.rows.first()))['Reader Serial No.'];
      await test.step(`Suspend Reader form of ${serial}`, async () => {
        await rdr.quicklinkGo(rdr.rows.first(), 'Suspend Reader');
        await expect(rdr.main).toContainText('You are currently viewing');
        await expect(rdr.button('View Company Details')).toBeVisible();
        await expect(rdr.main.getByText('Suspend Reader', { exact: true }).first()).toBeVisible();
        expect((await rdr.steps.allInnerTexts()).map((t) => t.trim())).toEqual(['Details', 'Complete']);
        await expect(rdr.main).toContainText(/Serial Number\s*:/);
        await expect.soft(rdr.main, 'serial shown').toContainText(serial);
        await expect(rdr.main).toContainText(/Effective Date\s*:/);
        await expect.soft(rdr.main, 'Effective Date = today').toContainText(portalDate());
        await rdr.captureOptions('reason', 'Reason (Suspend Reader)', SUSPEND_REASONS);
        expect(await rdr.options('reason'), 'Reason options (Field Registry)').toEqual(SUSPEND_REASONS);
        expect(await rdr.selected('reason'), 'default reason').toBe('Lost');
        await expect(rdr.main).toContainText('Max characters: 250');
        expect(await rdr.remaining(), 'counter').toBe('250');
        expect(await rdr.input('description').getAttribute('maxlength')).toBe('250');
        await expect(rdr.button('Submit')).toBeVisible();
      });
      await test.step('Reinstate Reader form (a Suspended reader): Reason = Reinstate only', async () => {
        await rdr.openQuicklink('Reader Summary');
        await rdr.filter({ status: 'Suspended' });
        test.skip(!(await rdr.rows.count()), 'No Suspended reader on the portal to open the Reinstate form');
        await rdr.quicklinkGo(rdr.rows.first(), 'Reinstate Reader');
        await rdr.captureOptions('reason', 'Reason (Reinstate Reader)', ['Reinstate']);
        expect(await rdr.options('reason')).toEqual(['Reinstate']);
        expect((await rdr.steps.allInnerTexts()).map((t) => t.trim())).toEqual(['Details', 'Complete']);
        expect(await rdr.remaining()).toBe('250');
      });
    }
  );

  test(
    'Reader suspended as Lost, Not functioning or Others can be reinstated',
    testCase({ id: 'TC-RDR-008', module: MODULE, priority: 'High' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('suspends and reinstates one test reader three times');
      const [serial] = await testReaders(rdr, 1, 'RDR-008');
      for (const reason of ['Lost', 'Not functioning', 'Others']) {
        await test.step(`${reason}: Suspended (not Permanently), Reinstate offered; reinstate -> Active`, async () => {
          await rdr.setStatus('Suspend', serial, reason, `QA RDR-008 suspend ${reason}`);
          const row = await rdr.findSerial(serial);
          expect((await rdr.rowCells(row.first()))['Status']).toBe('Suspended');
          expect(await rdr.quicklinkOptions(row.first())).toEqual(['View Details', 'Reinstate Reader']);
          await rdr.setStatus('Reinstate', serial, 'Reinstate', `QA RDR-008 reinstate after ${reason}`);
          expect(await statusOf(rdr, serial)).toBe('Active');
        });
      }
      await test.step('Status History has the three suspensions and reinstatements', async () => {
        await rdr.openDetails(serial);
        const rows = (await rdr.statusHistory()).rows.slice(-6);
        expect(rows.map((r) => `${r['Status']} / ${r['Reason']}`)).toEqual([
          'Suspended / Lost', 'Active / Reinstate', 'Suspended / Not functioning', 'Active / Reinstate', 'Suspended / Others', 'Active / Reinstate']);
      });
    }
  );

  test(
    'Reader suspended as Deactivate - Reassignment or Terminate becomes Permanently Suspended',
    testCase({ id: 'TC-RDR-009', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('permanently suspends two NEW test readers (irreversible)');
      const [a, b] = await registerReaders(rdr, 2, 'two disposable readers for RDR-009');
      for (const [serial, reason] of [[a, 'Deactivate - Reassignment'], [b, 'Terminate']]) {
        await test.step(`${serial}: Suspend as ${reason} -> warning pop-up -> confirm`, async () => {
          const row = await rdr.findSerial(serial);
          await rdr.quicklinkGo(row.first(), 'Suspend Reader');
          await rdr.input('reason').selectOption({ label: reason });
          await rdr.fillCounted('description', `QA RDR-009 ${reason}`);
          await rdr.captureStep(`Suspend Reader ${serial}: ${reason}, before Submit`);
          await rdr.button('Submit').click();
          const warning = await confirmPermanentPopup(rdr);
          test.info().annotations.push({ type: 'info', description: `${reason} warning: ${warning.slice(0, 200)}` });
        });
        await test.step(`${serial}: Permanently Suspended; Quicklink View Details only; no Reinstate; history shows ${reason}`, async () => {
          const row = await rdr.findSerial(serial);
          expect((await rdr.rowCells(row.first()))['Status']).toBe('Permanently Suspended');
          expect(await rdr.quicklinkOptions(row.first())).toEqual(['View Details']);
          await rdr.quicklinkGo(row.first(), 'View Details');
          await expect(rdr.button('Reinstate Reader')).toHaveCount(0);
          await expect(rdr.button('Suspend Reader')).toHaveCount(0);
          const last = (await rdr.statusHistory()).rows.at(-1)!;
          expect(`${last['Status']} / ${last['Reason']}`).toBe(`Permanently Suspended / ${reason}`);
        });
      }
    }
  );

  test(
    'Suspend Reader: remarks limit and counter',
    testCase({ id: 'TC-RDR-010', module: MODULE, priority: 'Low' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('submits the Suspend form of a test reader with empty remarks (reinstated if it saves)');
      const [serial] = await testReaders(rdr, 1, 'RDR-010');
      const row = await rdr.findSerial(serial);
      await rdr.quicklinkGo(row.first(), 'Suspend Reader');
      await test.step('10 characters: "Max characters: 240 remaining"', async () => {
        await rdr.fillCounted('description', 'abcdefghij');
        expect(await rdr.remaining()).toBe('240');
        await rdr.captureStep('Remarks 10 characters: counter');
      });
      await test.step('251 characters: input stops at 250, counter 0', async () => {
        await rdr.fillCounted('description', 'x'.repeat(251));
        expect((await rdr.input('description').inputValue()).length).toBe(250);
        expect(await rdr.remaining()).toBe('0');
      });
      await test.step('Empty remarks: rejected with an error, reader stays Active', async () => {
        await rdr.fillCounted('description', '');
        await rdr.captureStep('Remarks empty, before Submit');
        await rdr.button('Submit').click();
        await rdr.page.waitForLoadState('networkidle').catch(() => {});
        await rdr.captureStep('After Submit with empty remarks');
        await expect.soft(rdr.error('descriptionError'), 'remarks error shown').toBeVisible();
        test.info().annotations.push({ type: 'info', description: `empty remarks message: ${await rdr.error('descriptionError').innerText().catch(() => '(none)')}` });
        const status = await statusOf(rdr, serial);
        if (status !== 'Active') await rdr.setStatus('Reinstate', serial, 'Reinstate', 'QA RDR-010 restore');
        expect(status, 'empty remarks must not suspend the reader').toBe('Active');
      });
      await test.step('Valid remarks "sss" are accepted (the page rule /([^\\\\s])/ wrongly rejects text of only "s" and "\\")', async () => {
        const r = await rdr.findSerial(serial);
        await rdr.quicklinkGo(r.first(), 'Suspend Reader');
        await rdr.fillCounted('description', 'sss');
        await rdr.captureStep('Remarks "sss", before Submit');
        await rdr.button('Submit').click();
        await rdr.page.waitForLoadState('networkidle').catch(() => {});
        await rdr.captureStep('After Submit with remarks "sss"');
        const rejected = await rdr.error('descriptionError').isVisible().catch(() => false);
        const message = rejected ? await rdr.error('descriptionError').innerText() : '';
        const status = await statusOf(rdr, serial);
        if (status !== 'Active') await rdr.setStatus('Reinstate', serial, 'Reinstate', 'QA RDR-010 restore after sss');
        expect.soft(rejected, `valid remarks "sss" rejected with "${message}"`).toBe(false);
        expect.soft(status, 'remarks "sss" suspend the reader').toBe('Suspended');
      });
    }
  );

  test(
    'Suspended reader cannot take a payment',
    testCase({ id: 'TC-RDR-011', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      // the portal side: where the tester finds a Suspended reader; the sale itself needs the device
      await rdr.openQuicklink('Reader Summary');
      await rdr.filter({ status: 'Suspended' });
      await rdr.captureStep('Suspended readers: the tester tries a sale with one of these physical readers');
      humanAction('needs a physical card reader (suspended in the portal) and a test card: attempt a sale and record the message shown');
    }
  );

  test(
    'Suspend Reader with reason and remarks, then reinstate',
    testCase({ id: 'TC-RDR-012', module: MODULE, priority: 'High' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('suspends and reinstates two test readers');
      const readers = await testReaders(rdr, 2, 'RDR-012');
      for (const [serial, reason] of [[readers[0], 'Lost'], [readers[1], 'Others']]) {
        await test.step(`${serial}: Suspend (${reason}, "QA baseline suspend")`, async () => {
          await rdr.setStatus('Suspend', serial, reason, 'QA baseline suspend');
        });
        await test.step(`${serial}: Suspended in the list and details; Suspended Date today; Reinstate offered; history`, async () => {
          const row = await rdr.findSerial(serial);
          expect((await rdr.rowCells(row.first()))['Status']).toBe('Suspended');
          expect(await rdr.quicklinkOptions(row.first())).toContain('Reinstate Reader');
          await rdr.quicklinkGo(row.first(), 'View Details');
          await expect.soft(rdr.main, 'Suspended Date: today').toContainText(portalDate());
          await expect(rdr.button('Reinstate Reader')).toBeVisible();
          await expect(rdr.button('Suspend Reader')).toHaveCount(0);
          const last = (await rdr.statusHistory()).rows.at(-1)!;
          expect(`${last['Status']} / ${last['Reason']} / ${last['Description']}`).toBe(`Suspended / ${reason} / QA baseline suspend`);
        });
        await test.step(`${serial}: Reinstate ("QA baseline reinstate") -> Active, Suspend back, history Reinstate`, async () => {
          const row = await rdr.findSerial(serial);
          await rdr.quicklinkGo(row.first(), 'Reinstate Reader');
          await expect.soft(rdr.main, '"Suspended" shown on the Reinstate form').toContainText('Suspended');
          await rdr.submitStatusForm('Reinstate', serial, 'Reinstate', 'QA baseline reinstate');
          expect(await statusOf(rdr, serial)).toBe('Active');
          await rdr.openDetails(serial);
          await expect(rdr.button('Suspend Reader')).toBeVisible();
          const last = (await rdr.statusHistory()).rows.at(-1)!;
          expect(`${last['Status']} / ${last['Reason']} / ${last['Description']}`).toBe('Active / Reinstate / QA baseline reinstate');
        });
      }
    }
  );

  test(
    'Permanently Suspended reader cannot be reinstated',
    testCase({ id: 'TC-RDR-013', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      await rdr.openQuicklink('Reader Summary');
      await rdr.filter({ status: 'Permanently Suspended' });
      test.skip(!(await rdr.rows.count()), 'No Permanently Suspended reader on the portal');
      const serial = (await rdr.rowCells(rdr.rows.first()))['Reader Serial No.'];
      await test.step(`${serial}: Quicklink offers View Details only`, async () => {
        expect(await rdr.quicklinkOptions(rdr.rows.first())).toEqual(['View Details']);
      });
      await test.step(`${serial}: details show no Reinstate Reader (nor Suspend Reader)`, async () => {
        await rdr.quicklinkGo(rdr.rows.first(), 'View Details');
        await expect(rdr.button('Reinstate Reader')).toHaveCount(0);
        await expect(rdr.button('Suspend Reader')).toHaveCount(0);
        await rdr.captureScreen(`Permanently Suspended reader ${serial}`);
      });
    }
  );

  test(
    'Reinstated reader can take payments again',
    testCase({ id: 'TC-RDR-014', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      await rdr.openQuicklink('Reader Summary');
      await rdr.filter({ status: 'Active' });
      await rdr.captureStep('Active readers: after reinstating a physical reader, the tester does a card sale with it');
      humanAction('needs a physical card reader (reinstated in the portal) and a test card: a card sale must be approved');
    }
  );

  test(
    'All Readers (Reader Summary): search and filter field validation',
    testCase({ id: 'TC-RDR-015', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      await rdr.openQuicklink('Reader Summary');
      await test.step('Search box "Serial Number"; dates picker-only, default last 10 years; Status options', async () => {
        await expect(rdr.searchBox).toHaveValue('Serial Number');
        for (const n of ['from', 'to']) expect(await rdr.input(n, rdr.filterForm).getAttribute('readonly'), `${n} read-only`).not.toBeNull();
        await expect(rdr.input('from', rdr.filterForm)).toHaveValue(portalDate({ years: -10 }));
        await expect(rdr.input('to', rdr.filterForm)).toHaveValue(portalDate());
        expect(await rdr.options('status', rdr.filterForm)).toEqual(READER_STATUSES);
      });
      await test.step('Special characters \' " < > % in the serial search: plain text, no error page, no rows', async () => {
        await rdr.search(`'"<>%`);
        await rdr.captureStep('Serial search with special characters');
        await expect(rdr.errorPage).toHaveCount(0);
        expect(await rdr.rows.count(), 'no rows').toBe(0);
      });
      await test.step('Special characters in the MID filter: no error page, no rows', async () => {
        await rdr.openQuicklink('Reader Summary');
        await rdr.filter({ mid: `'"<>%` });
        await rdr.captureStep('MID filter with special characters');
        await expect(rdr.errorPage).toHaveCount(0);
        expect(await rdr.rows.count(), 'no rows').toBe(0);
      });
      await test.step('Long serial (51 characters): no error page', async () => {
        await rdr.search('S'.repeat(51));
        await expect(rdr.errorPage).toHaveCount(0);
      });
      await test.step('Company view (All Companies > View Readers of the working company): Status options, dates', async () => {
        const { mid } = await workingCompany(rdr);
        await rdr.page.goto('/company');
        await rdr.search(mid);
        await rdr.quicklinkGo(rdr.rows.first(), 'View Readers');
        await expect(rdr.errorPage).toHaveCount(0);
        expect.soft(await rdr.options('status', rdr.filterForm), 'company view Status options').toEqual(READER_STATUSES);
        for (const n of ['from', 'to']) expect.soft(await rdr.input(n, rdr.filterForm).getAttribute('readonly'), `company view ${n} read-only`).not.toBeNull();
      });
    }
  );

  test(
    'Reinstate Reader form: field validation (mandatory, format and length)',
    testCase({ id: 'TC-RDR-016', module: MODULE, priority: 'Medium' }),
    async ({ readersPage: rdr }) => {
      requireUatChanges('suspends a test reader so its Reinstate form can be checked; ends reinstated');
      const [serial] = await testReaders(rdr, 1, 'RDR-016');
      await rdr.setStatus('Suspend', serial, 'Lost', 'QA RDR-016 suspend');
      const row = await rdr.findSerial(serial);
      await rdr.quicklinkGo(row.first(), 'Reinstate Reader');
      await test.step('Reason: Reinstate only (default); counter 250', async () => {
        expect(await rdr.options('reason')).toEqual(['Reinstate']);
        expect(await rdr.selected('reason')).toBe('Reinstate');
        expect(await rdr.remaining()).toBe('250');
      });
      // Each kind of blank remarks on its own, so the report shows which ones the portal catches:
      // Submit -> the remarks error must show and the reader must stay Suspended. If the portal wrongly
      // reinstates it, that is recorded and the reader is suspended again for the next try.
      const blanks: { label: string; text: string }[] = [
        { label: 'completely empty', text: '' },
        { label: 'only spaces "   "', text: '   ' },
        { label: 'only a tab and a new line', text: '\t\n' }
      ];
      let first = true;
      for (const b of blanks) {
        await test.step(`Remarks ${b.label}: remarks error shown, reader stays Suspended`, async () => {
          if (!first) {
            const r = await rdr.findSerial(serial);
            await rdr.quicklinkGo(r.first(), 'Reinstate Reader');
          }
          first = false;
          await rdr.fillCounted('description', b.text);
          await rdr.captureStep(`Reinstate: remarks ${b.label}, before Submit`);
          await rdr.button('Submit').click();
          await rdr.page.waitForLoadState('networkidle').catch(() => {});
          const errorShown = await rdr.error('descriptionError').isVisible().catch(() => false);
          const message = errorShown ? (await rdr.error('descriptionError').innerText()).trim() : '';
          await rdr.captureStep(`After Submit with remarks ${b.label}: ${errorShown ? `error "${message}"` : 'NO error shown'}`);
          const status = await statusOf(rdr, serial);
          test.info().annotations.push({ type: 'info', description: `Remarks ${b.label}: ${errorShown ? `error "${message}"` : 'no error'}; reader ${status}` });
          expect.soft(errorShown, `remarks ${b.label}: an error must be shown`).toBe(true);
          expect.soft(status, `remarks ${b.label}: the reader must not be reinstated`).toBe('Suspended');
          if (status !== 'Suspended') await rdr.setStatus('Suspend', serial, 'Lost', 'QA RDR-016 suspend again');
        });
      }
      await test.step('250 accepted, 251 cut to 250', async () => {
        const r = await rdr.findSerial(serial);
        if ((await rdr.rowCells(r.first()))['Status'] !== 'Suspended') return;
        await rdr.quicklinkGo(r.first(), 'Reinstate Reader');
        await rdr.fillCounted('description', 'y'.repeat(251));
        expect((await rdr.input('description').inputValue()).length).toBe(250);
        expect(await rdr.remaining()).toBe('0');
      });
      await test.step('Valid remarks: reinstated (Active)', async () => {
        if ((await statusOf(rdr, serial)) === 'Suspended') await rdr.setStatus('Reinstate', serial, 'Reinstate', 'QA RDR-016 reinstate');
        expect(await statusOf(rdr, serial)).toBe('Active');
      });
    }
  );
});
