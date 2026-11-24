import { test, expect } from '../../fixtures/base';
import { testCase } from '../../utils/testCase';
import { loginAs } from '../../flows/loginFlow';
import { ENV_NAME, PORTAL_PROFILE } from '../../../portals.config';
import { CreditSettlementPage, SETTLEMENT_STATUSES, type SettlementRow } from '../../pages/CreditSettlementPage';
import { portalToday, portalDaysAgo } from '../../utils/portalDate';

// Manage Credit Settlements - SHARED: runs on APH and Fassbayar.
// (Written by Derrick, merged into this structure 18 Nov 2026.)
// READ-ONLY: only opens pages, filters and searches. Schedule Force Settlement
// is opened at step 1 (Search) only - nothing is scheduled or confirmed.
// "Settle Credit" is never clicked.
// Test data = the settlements already on the environment: each test takes a
// real row from today's list (the Date filter defaults to today). No rows
// today -> it goes back a day at a time (up to LOOKBACK_DAYS) and uses the
// newest day that has settlements. Still none -> the list with the Date filter
// cleared (every settlement). APH 23 Nov 2026: a day search returned 0 even for
// days that have settlements (20 Nov: 4 in the full list) - reported as a finding.
// None at all -> skipped with the reason.
// Portal differences (batch page) come from portals.config.ts creditSettlement.
// Run only this module:  npx playwright test --grep @credit-settlement

const MODULE = 'Manage Credit Settlements';
const rules = PORTAL_PROFILE.creditSettlement;   // Batch Details differences (portals.config.ts)
const num = (batchNo: string) => Number(batchNo.replace(/\D/g, ''));

const LOOKBACK_DAYS = 7;

// First settlement of the newest day that has any (today first). The list stays filtered on that day.
async function firstRowOrSkip(cs: CreditSettlementPage): Promise<SettlementRow & { day: string }> {
  for (let n = 0; n <= LOOKBACK_DAYS; n++) {
    const day = portalDaysAgo(n);
    if (n > 0) await cs.searchDate(day);
    const [row] = await cs.readRows();
    if (row) {
      if (n > 0) test.info().annotations.push({ type: 'test data', description: `No settlement today; used ${day} (${n} day(s) back)` });
      return { ...row, day };
    }
  }
  // every settlement (no date filter); the list stays like that for the test (day = '')
  await cs.searchAllDates();
  const [any] = await cs.readRows();
  if (any) {
    const [d, m, y] = any.dateTime.split(' / ')[0].split(' ');                                  // "20 11 2026"
    const day = `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}`;
    test.info().annotations.push({ type: 'finding',
      description: `Date filter found no settlement in the last ${LOOKBACK_DAYS} days, but the full list's newest settlement is on ${day}: the Date filter misses it (test used the full list)` });
    return { ...any, day: '' };
  }
  test.skip(true, `No credit settlement on ${ENV_NAME} at all: nothing to use as test data. ` +
    'Human action: make a card sale and settle it on a test terminal, then re-run');
  throw new Error('unreachable');
}

test.describe('Manage Credit Settlements > Credit Settlement Summary', { tag: '@credit-settlement' }, () => {

  test.beforeEach(async ({ loginPage, consolePage, creditSettlementPage: cs }) => {
    await loginAs({ loginPage, consolePage });
    await test.step('Open Manage Credit Settlements', async () => {
      await cs.open();
    });
  });

  test(
    'Credit Settlement list shows its search, filters, columns and quicklinks',
    testCase({
      id: 'TC-CS-001', module: MODULE, priority: 'High', suite: ['smoke'],
      gaps: [{
        description: "Only today's settlements are used (the Date filter default); searching other dates with the date picker is not tested.",
        impact: 'A defect when filtering past dates would not be caught.'
      }, {
        description: 'Only page 1 of the results is checked; paging (next / previous page) is not tested.',
        impact: 'A paging defect would not be caught.'
      }]
    }),
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
      // No settlement today (e.g. a Sunday): the portal shows "No record found. Please try again"
      // instead of the table and "Total Records" (seen 22 Nov 2026) -> check that, not the columns
      if (await cs.headers.count() === 0) {
        await test.step('No settlement today: "No record found" instead of the list', async () => {
          await expect(cs.noRecord).toBeVisible();
          await expect(cs.rows).toHaveCount(0);
          console.log(`${ENV_NAME} | no credit settlement on ${portalToday()}: empty list shown`);
          await cs.captureScreen('Credit Settlement list - no record today');
        });
        return;
      }
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
      await test.step(`Search Batch No. ${sample.batchNo} (${sample.day || 'from the full list'})`, async () => {
        await cs.searchBatch(sample.batchNo);
        // older batches can be in the archive, which APH only opens 22:00-06:00
        if (await cs.archiveClosed.isVisible().catch(() => false)) {
          test.skip(true, `Human action required: batch ${sample.batchNo} (${sample.day || sample.dateTime}) is in the archive, viewable only 22:00-06:00; search it in that window`);
        }
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
    'Search for a Batch No. that does not exist shows "No record found" or the archive-hours message',
    testCase({ id: 'TC-CS-006', module: MODULE, priority: 'Medium' }),
    async ({ creditSettlementPage: cs }) => {
      await test.step('Search Batch No. 999999', async () => {
        await cs.searchBatch('999999');
      });

      // A batch not in recent data is looked up in the ARCHIVE, which only opens
      // 22:00-06:00. Both answers are EXPECTED (QA team, 19 Nov 2026), on both portals:
      //   daytime -> "Archive data can only be viewed between 22:00 and 06:00 ..."
      //   night   -> "No record found"
      // Either one = pass (no skip). Neither = fail.
      await expect(cs.noRecord.or(cs.archiveClosed), 'No record found or the archive-hours message').toBeVisible();

      if (await cs.archiveClosed.isVisible()) {
        const message = (await cs.archiveClosed.innerText()).trim();
        await test.step(`Archive closed at this hour (expected): "${message}"`, async () => {
          await expect(cs.rows).toHaveCount(0);
          await cs.captureScreen('Batch No. 999999 - archive closed');
        });
      } else {
        await test.step('"No record found" (expected)', async () => {
          await expect(cs.noRecord).toBeVisible();
          await expect(cs.rows).toHaveCount(0);
          await cs.captureScreen('Batch No. 999999 - no record');
        });
      }
    }
  );

  test(
    'View Details opens the batch with its summary and transactions',
    testCase({
      id: 'TC-CS-007', module: MODULE, priority: 'High',
      gaps: [{
        description: `Batch Details filters (${rules.batchFilters.join(', ')}) are checked to be there but not used to filter transactions.`,
        impact: "A defect in filtering a batch's transactions would not be caught."
      }, {
        description: '"Download Sale Report" of a successful batch and the transaction quicklinks are not tested.',
        impact: 'A defect in the sale report download would not be caught.'
      }],
      manual: rules.settleCreditButton ? [{
        title: `Settle Credit on a pending batch (${PORTAL_PROFILE.name})`,
        reason: 'Settle Credit settles a real batch and cannot be undone, so automation never clicks it.',
        handling: 'Test Settle Credit by hand on a test batch before each release.'
      }] : []
    }),
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
        // company list also defaults to today: same day as the sample, or every date
        if (!sample.day) await cs.searchAllDates();
        else if (sample.day !== portalToday()) await cs.searchDate(sample.day);
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
    testCase({
      id: 'TC-CS-009', module: MODULE, priority: 'Medium',
      manual: [{
        title: 'Schedule Force Settlement: Schedule > Review & Confirm > Complete',
        reason: 'Finishing the wizard schedules a real force settlement for a company, so automation stops at step 1 (Search company).',
        handling: 'Test scheduling by hand on a test company before each release, or agree a safe test company so it can be automated.'
      }]
    }),
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
