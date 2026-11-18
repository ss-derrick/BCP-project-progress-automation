import { test, expect } from '../fixtures/base';
import { testCase } from '../utils/testCase';
import { loginAs } from '../flows/loginFlow';
import { ENV_NAME, PORTAL_PROFILE } from '../../portals.config';
import {
  CreditSettlementPage, SETTLEMENT_STATUSES, portalToday, type SettlementRow
} from '../pages/CreditSettlementPage';

// SHARED: Manage Credit Settlements, on every portal (APH + Fassbayar).
// READ-ONLY: only opens pages, filters and searches. Schedule Force Settlement
// is opened at step 1 (Search) only - nothing is scheduled or confirmed.
// Test data = the settlements already on the environment: each test takes a
// real row from today's list (the Date filter defaults to today). No rows
// today -> the test is skipped with the reason.

const MODULE = 'Credit Settlement';
const rules = PORTAL_PROFILE.creditSettlement;   // Batch Details differences (portals.config.ts)
const num = (batchNo: string) => Number(batchNo.replace(/\D/g, ''));

async function firstRowOrSkip(cs: CreditSettlementPage): Promise<SettlementRow> {
  const [row] = await cs.readRows();
  test.skip(!row, `No credit settlement on ${ENV_NAME} for ${portalToday()}: nothing to use as test data`);
  return row!;
}

test.describe('Manage Credit Settlements (shared)', () => {

  test.beforeEach(async ({ loginPage, consolePage, creditSettlementPage: cs }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open Manage Credit Settlements', async () => {
      await cs.open();
    });
  });

  test(
    'Credit Settlement list shows its search, filters, columns and quicklinks',
    testCase({ id: 'TC-CS-001', module: MODULE, priority: 'High' }),
    async ({ creditSettlementPage: cs }) => {
      await test.step('Quicklinks: Credit Settlement Summary, Schedule Force Settlement', async () => {
        await expect(cs.quicklinks).toHaveText(['Credit Settlement Summary', 'Schedule Force Settlement']);
      });
      await test.step('Search for a Batch No. box', async () => {
        await expect(cs.batchSearchBox).toBeVisible();
        await expect(cs.batchSearchBox).toHaveValue('Batch No.');
      });
      await test.step(`Filters: TID, Mobile User ID, Status, Date (= today, ${portalToday()})`, async () => {
        await expect(cs.tidFilter).toBeVisible();
        await expect(cs.mobileUserFilter).toBeVisible();
        const options = (await cs.statusFilter.locator('option').allInnerTexts()).map((t) => t.trim());
        expect(options).toEqual(['Select One', ...SETTLEMENT_STATUSES]);
        await expect(cs.dateFilter).toHaveValue(portalToday());
      });
      await test.step('Columns: Date/Time, Status, Batch No., Mobile User ID, TID (MID), Quicklink', async () => {
        const headers = (await cs.headers.allInnerTexts()).map((h) => h.replace(/\s+/g, ' ').trim());
        expect(headers.slice(0, 3)).toEqual(['Date/ Time', 'Status', 'Batch No.']);
        expect(headers[3]).toMatch(/^Mobile User ID/);      // Fassbayar adds "(Business Name)"
        expect(headers.slice(4)).toEqual(['TID (MID)', 'Quicklink']);
      });
      await test.step('Total Records matches the list', async () => {
        const total = await cs.totalCount();
        const shown = await cs.rows.count();
        console.log(`${ENV_NAME} | ${total} settlements today, ${shown} on page 1 (${await cs.pageInfo.innerText()})`);
        expect(shown).toBeLessThanOrEqual(total);
        if (total > 0) expect(shown).toBeGreaterThan(0);
        await cs.captureScreen('Credit Settlement list');
      });
    }
  );

  test(
    'Filter by Status shows only settlements with that status',
    testCase({ id: 'TC-CS-002', module: MODULE, priority: 'High' }),
    async ({ creditSettlementPage: cs }) => {
      for (const status of SETTLEMENT_STATUSES) {
        await test.step(`Status = ${status}`, async () => {
          await cs.open();
          await cs.filter({ status });
          const rows = await cs.readRows();
          console.log(`${ENV_NAME} | status ${status}: ${rows.length} rows`);
          if (rows.length === 0) await expect(cs.rows).toHaveCount(0);
          for (const r of rows) expect(r.status, `batch ${r.batchNo}`).toBe(status);
          await expect(cs.statusFilter).toHaveValue(status);     // filter kept after search
          await cs.captureScreen(`Status ${status}`);
        });
      }
    }
  );

  test(
    'Filter by Terminal ID (TID) shows only that terminal\'s settlements',
    testCase({ id: 'TC-CS-003', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs }) => {
      const sample = await firstRowOrSkip(cs);
      await test.step(`TID = ${sample.tid}`, async () => {
        await cs.filter({ tid: sample.tid });
        const rows = await cs.readRows();
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(r.tid, `batch ${r.batchNo}`).toBe(sample.tid);
        await cs.captureScreen(`TID ${sample.tid}`);
      });
    }
  );

  test(
    'Filter by Mobile User ID shows only that user\'s settlements',
    testCase({ id: 'TC-CS-004', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs }) => {
      const sample = await firstRowOrSkip(cs);
      await test.step(`Mobile User ID = ${sample.mobileUserId}`, async () => {
        await cs.filter({ mobileUserId: sample.mobileUserId });
        const rows = await cs.readRows();
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(r.mobileUserId, `batch ${r.batchNo}`).toBe(sample.mobileUserId);
        await cs.captureScreen(`Mobile User ID ${sample.mobileUserId}`);
      });
    }
  );

  test(
    'Search for an existing Batch No. shows that batch',
    testCase({ id: 'TC-CS-005', module: MODULE, priority: 'High' }),
    async ({ creditSettlementPage: cs, page }) => {
      const sample = await firstRowOrSkip(cs);
      await test.step(`Search Batch No. ${sample.batchNo}`, async () => {
        await cs.searchBatch(sample.batchNo);
        await expect(page.getByText(/You are currently viewing\s*Batch No\./)).toBeVisible();
        const rows = await cs.readRows();
        expect(rows.length).toBeGreaterThan(0);
        // the same batch no. can exist on several terminals / days: every row must be this number
        for (const r of rows) expect(num(r.batchNo), `row ${r.tid} ${r.dateTime}`).toBe(num(sample.batchNo));
        expect(rows.some((r) => r.tid === sample.tid), `the batch of TID ${sample.tid} is listed`).toBe(true);
        await cs.captureScreen(`Batch No. ${sample.batchNo}`);
      });
    }
  );

  test(
    'Search for a Batch No. that does not exist shows "No record found"',
    testCase({ id: 'TC-CS-006', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs }) => {
      await test.step('Search Batch No. 999999', async () => {
        await cs.searchBatch('999999');
        // APH: a batch not in recent data is looked up in the ARCHIVE, which only
        // opens 22:00-06:00; in the daytime it says so instead of "No record found"
        await expect(cs.noRecord.or(cs.archiveClosed)).toBeVisible();
        if (await cs.archiveClosed.isVisible()) {
          await cs.captureScreen('Batch No. 999999 - archive closed');
          test.skip(true, `${ENV_NAME}: "${(await cs.archiveClosed.innerText()).trim()}" - run between 22:00 and 06:00 to check "No record found"`);
        }
        await expect(cs.noRecord).toBeVisible();
        await expect(cs.rows).toHaveCount(0);
        await cs.captureScreen('Batch No. 999999 - no record');
      });
    }
  );

  test(
    'View Details opens the batch with its summary and transactions',
    testCase({ id: 'TC-CS-007', module: MODULE, priority: 'High' }),
    async ({ creditSettlementPage: cs, page }) => {
      const sample = await firstRowOrSkip(cs);

      await test.step(`View Details of batch ${sample.batchNo} (${sample.status})`, async () => {
        await cs.openDetails(0);
        const header = await page.getByText(/Batch No\.\s*:\s*\d+/).first().innerText();
        expect(num(header.split(':')[1] ?? ''), 'batch no. in the page title').toBe(num(sample.batchNo));
        await expect(page.getByText(/The credit settlement for this batch/)).toBeVisible();
        await expect(page.getByText('Total Amount', { exact: true })).toBeVisible();
        await expect(page.getByText('Total Refunded Amount', { exact: true }))
          .toHaveCount(rules.showsRefundedTotal ? 1 : 0);
        await expect(page.locator('.barPaddTitle')).toHaveText('Batch Details');
      });

      if (/pending/i.test(sample.status)) {
        await test.step(`Pending batch: "Settle Credit" ${rules.settleCreditButton ? 'offered' : 'not offered'} on ${PORTAL_PROFILE.name} (never clicked)`, async () => {
          await expect(page.getByRole('link', { name: 'Settle Credit' })).toHaveCount(rules.settleCreditButton ? 1 : 0);
        });
      }

      await test.step(`Batch Details filters: ${rules.batchFilters.join(', ')}`, async () => {
        const labels = (await cs.filterLabels.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
        expect(labels).toEqual(rules.batchFilters);
        const options = (await cs.statusFilter.locator('option').allInnerTexts()).map((t) => t.trim());
        expect(options).toEqual(['Select One', ...rules.transactionStatuses]);
      });

      await test.step('Transactions table or "No record found"', async () => {
        const rows = await cs.rows.count();
        if (rows > 0) {
          const headers = (await cs.headers.allInnerTexts()).map((h) => h.replace(/\s+/g, ' ').trim());
          expect(headers).toEqual(['Date/ Time', 'Transaction ID', 'TID', 'Approval Code', 'Status', 'Amount', 'Quicklink']);
        } else {
          await expect(cs.noRecord).toBeVisible();
        }
        console.log(`${ENV_NAME} | batch ${sample.batchNo}: ${rows} transactions`);
        await cs.captureScreen(`Batch ${sample.batchNo} details`);
      });

      await test.step('Back to Previous Page returns to the list', async () => {
        await page.getByText('Back to Previous Page').click();
        await expect(page).toHaveURL(/\/creditSettlement\/list/);
        await expect(cs.title.first()).toHaveText('All Credit Settlements');
      });
    }
  );

  test(
    'View all credit settlements opens the company\'s settlements',
    testCase({ id: 'TC-CS-008', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs, page }) => {
      const sample = await firstRowOrSkip(cs);
      await test.step(`View all credit settlements of TID ${sample.tid}'s company`, async () => {
        await cs.openViewAll(0);
        await expect(page.getByText(/MID:\s*\d+/).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'View Company Details' })).toBeVisible();
        await expect(cs.title.first()).toHaveText('All Credit Settlements');
        await expect(cs.tidFilter).toBeVisible();
        await expect(cs.mobileUserFilter).toBeVisible();
        const rows = await cs.readRows();
        expect(rows.length, 'the settlement we came from is in the company list').toBeGreaterThan(0);
        expect(rows.some((r) => num(r.batchNo) === num(sample.batchNo) && r.tid === sample.tid)).toBe(true);
        await cs.captureScreen('Company credit settlements');
      });
    }
  );

  test(
    'Schedule Force Settlement opens at step 1 (Search company)',
    testCase({ id: 'TC-CS-009', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs, page }) => {
      await test.step('Quicklinks > Schedule Force Settlement', async () => {
        await cs.openScheduleForceSettlement();
        await expect(page.locator('.barPaddTitle')).toHaveText('Schedule Force Settlement');
        await expect(page.locator('#steps')).toContainText('Search');
        await expect(page.locator('#steps')).toContainText('Schedule');
        await expect(page.locator('#steps')).toContainText('Review & Confirm');
        await expect(page.locator('#steps')).toContainText('Complete');
        await expect(page.locator('#info1')).toHaveClass(/\bon\b/);      // step 1 active
        await expect(page.locator('#search')).toHaveValue('MID / Name of Business / Authoriser');
        await cs.captureScreen('Schedule Force Settlement - step 1');
      });
      // nothing scheduled: the wizard is never taken past step 1
    }
  );
});
