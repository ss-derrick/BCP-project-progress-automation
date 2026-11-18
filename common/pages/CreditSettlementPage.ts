import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

// System Portal - Manage Credit Settlements (/creditSettlement/list).
// SHARED by both portals (read-only scan of 18 Nov 2026). Differences handled here:
//   Date filter: APH input name "to" (#todate3), Fassbayar "from" (#singledate3) -> located by class .filterDate
//   Column 4:    APH "Mobile User ID", Fassbayar "Mobile User ID (Business Name)"
//   Batch No.:   APH shows it zero-padded in the list (000127), Fassbayar not (193) -> compared as numbers
// Screens: list + filters, Batch No. search, View Details (batch), View all credit
// settlements (per company), Schedule Force Settlement (4-step wizard; only step 1 opened).

export interface SettlementRow {
  dateTime: string;
  status: string;
  batchNo: string;
  mobileUserId: string;     // first line of column 4 (Fassbayar adds "(Business Name)" below)
  tid: string;
  mid: string;
}

export const SETTLEMENT_STATUSES = ['Successful', 'Unsuccessful', 'Pending', 'Processing'];

// "18 Nov 2026" in the portal's time zone (the Date filter's default = today)
export const portalToday = (): string =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })
    .format(new Date());

export class CreditSettlementPage extends BasePage {

  readonly title = this.page.locator('.barPaddTitle');
  readonly quicklinks = this.page.locator('#leftPanel a');
  readonly batchSearchBox = this.page.locator('#search');
  readonly filterForm = this.page.locator('form[name="filterForm"]');
  readonly tidFilter = this.filterForm.locator('input[name="tid"]');
  readonly mobileUserFilter = this.filterForm.locator('input[name="muid"]');
  readonly statusFilter = this.filterForm.locator('select[name="status"]');
  readonly dateFilter = this.filterForm.locator('input.filterDate');
  readonly filterLabels = this.filterForm.locator('.formLabel');
  readonly filterSearchButton = this.filterForm.locator('a.button', { hasText: 'Search' });
  readonly totalRecords = this.page.locator('#totalRecord .leftTR, .leftTR').first();
  readonly pageInfo = this.page.locator('#pageInfo');
  readonly rows = this.page.locator('#dataRow tr.dataListMid');
  readonly headers = this.page.locator('#dataRow tr.dataTitleMid th');
  readonly noRecord = this.page.getByText(/No record found/);
  // APH: Batch No. search falls back to the archive, open only 22:00-06:00
  readonly archiveClosed = this.page.getByText(/Archive data can only be viewed between/);

  constructor(page: Page) {
    super(page);
  }

  // ---------- open ----------

  async open(): Promise<void> {
    await this.page.goto('/creditSettlement/list');
    await this.page.waitForLoadState('load');
    await expect(this.title.first()).toHaveText('All Credit Settlements');
  }

  // ---------- read the list ----------

  async totalCount(): Promise<number> {
    if (!(await this.totalRecords.isVisible().catch(() => false))) return 0;
    const m = (await this.totalRecords.innerText()).match(/Total Records:\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  async readRows(): Promise<SettlementRow[]> {
    return this.rows.evaluateAll((trs) => trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll(':scope > td')).map((td) => (td as HTMLElement).innerText.trim());
      const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
      const tidMid = lines(cells[4] ?? '');
      return {
        dateTime: lines(cells[0] ?? '').join(' '),
        status: cells[1] ?? '',
        batchNo: cells[2] ?? '',
        mobileUserId: lines(cells[3] ?? '')[0] ?? '',
        tid: tidMid[0] ?? '',
        mid: (tidMid[1] ?? '').replace(/[()]/g, '')
      };
    }));
  }

  // ---------- filters ----------

  async filter(f: { tid?: string; mobileUserId?: string; status?: string }): Promise<void> {
    if (f.tid !== undefined) await this.typeInto(this.tidFilter, f.tid);
    if (f.mobileUserId !== undefined) await this.typeInto(this.mobileUserFilter, f.mobileUserId);
    if (f.status !== undefined) await this.statusFilter.selectOption(f.status);
    await this.filterSearchButton.click();
    await this.page.waitForLoadState('load');
  }

  // ---------- batch no. search ----------

  async searchBatch(batchNo: string): Promise<void> {
    await this.typeInto(this.batchSearchBox, batchNo);
    await this.batchSearchBox.press('Enter');
    await this.page.waitForURL(/\/creditSettlement\/search/);
    await this.page.waitForLoadState('load');
  }

  // ---------- row quicklinks ----------

  async openDetails(row = 0): Promise<void> {
    await this.rows.nth(row).getByText('View Details', { exact: true }).click();
    await this.page.waitForURL(/\/creditSettlement\/batch/);
    await this.page.waitForLoadState('load');
  }

  async openViewAll(row = 0): Promise<void> {
    await this.rows.nth(row).getByText('View all credit settlements').click();
    await this.page.waitForURL(/\/creditSettlement\/company/);
    await this.page.waitForLoadState('load');
  }

  async openScheduleForceSettlement(): Promise<void> {
    await this.quicklinks.filter({ hasText: 'Schedule Force Settlement' }).click();
    await this.page.waitForURL(/\/creditSettlement\/searchCompany/);
    await this.page.waitForLoadState('load');
  }
}
