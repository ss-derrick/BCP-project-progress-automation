import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { Timeouts } from '../../portals.config';

// FASSBAYAR ONLY - Manage Transactions > Bill Payment Report
// (/transaction/billPaymentBatchList). APH has no such screen, so this page
// lives in fassbayar/pages, not common/pages.
// Read-only scan 18 Nov 2026: explore/scan/results/bill-payment-uat-fassbayar-*
//
// Filter form (filterForm, GET): Business Name | MID | Status [Select One|Successful|
//   Unsuccessful|Pending|Processing] | Date [#fromdate3] to [#todate3] | Search
// Results table #dataRow: Date/Time | Status | Business Name(MID) | Quicklink [View Details]

export interface BillPaymentRow {
  dateTime: string;
  status: string;
  businessName: string;
  mid: string;
}

export class BillPaymentReportPage extends BasePage {
  readonly menuTab = this.page.locator('#topNavi a[href="/transaction"]');
  readonly link = this.page.getByRole('link', { name: 'Bill Payment Report', exact: true }).first();
  readonly form = this.page.locator('form[name="filterForm"]');
  readonly businessNameInput = this.form.locator('input[name="businessName"]');
  readonly midInput = this.form.locator('input[name="mid"]');
  readonly statusSelect = this.form.locator('select[name="status"]');
  readonly fromDate = this.page.locator('#fromdate3');
  readonly toDate = this.page.locator('#todate3');
  readonly searchButton = this.form.getByRole('link', { name: 'Search', exact: true });
  readonly totalRecords = this.page.getByText(/Total Records:\s*[\d,]+/);
  readonly rows = this.page.locator('#dataRow tr.dataListMid');

  // Top menu "Manage Transactions" -> left panel "Bill Payment Report"
  async open(): Promise<void> {
    await this.menuTab.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.link.click();
    await expect(this.page).toHaveURL(/\/transaction\/billPaymentBatchList/, { timeout: Timeouts.pageLoad });
    await expect(this.businessNameInput).toBeVisible();
    await this.captureScreen('Bill Payment Report');
  }

  // Date boxes are read-only jQuery UI date pickers: set through the picker.
  // The page switches the pickers on only after load, so retry until the box shows it.
  async setDateRange(from: string, to: string): Promise<void> {
    await this.page.waitForLoadState('load');
    for (const [box, value] of [[this.fromDate, from], [this.toDate, to]] as const) {
      await expect(async () => {
        await box.evaluate((el, v) => {
          const w = window as unknown as {
            $?: (e: Element) => { datepicker?: (cmd: string, v?: string) => unknown; data?: (k: string) => unknown };
          };
          const jq = w.$?.(el);
          if (jq?.datepicker && jq.data?.('datepicker')) jq.datepicker('setDate', v);
        }, value);
        await expect(box).toHaveValue(value, { timeout: 1_000 });
      }, `Set date to ${value}`).toPass({ timeout: 10_000 });
    }
  }

  // Business Name and/or MID / Status + date range, then Search
  async search(options: { businessName?: string; mid?: string; status?: string; from?: string; to?: string }): Promise<void> {
    if (options.businessName) await this.typeInto(this.businessNameInput, options.businessName);
    if (options.mid) await this.typeInto(this.midInput, options.mid);
    if (options.status) await this.statusSelect.selectOption(options.status);
    if (options.from && options.to) await this.setDateRange(options.from, options.to);
    await this.captureScreen('Bill Payment Report - filter set');
    await this.scrollToElement(this.searchButton);
    await this.searchButton.click();
    await this.page.waitForURL(/billPaymentBatchList\?/, { timeout: Timeouts.pageLoad });
  }

  async getTotalRecords(): Promise<number> {
    const text = await this.totalRecords.first().innerText();
    const match = text.match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  // "Harris_LH(800030000000171)" -> businessName + mid
  async readRow(row: Locator): Promise<BillPaymentRow> {
    const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    const nameMid = cells[2] ?? '';
    const match = nameMid.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    return {
      dateTime: cells[0] ?? '',
      status: cells[1] ?? '',
      businessName: match ? match[1].trim() : nameMid,
      mid: match ? match[2].trim() : ''
    };
  }

  async openDetails(row: Locator): Promise<void> {
    const viewDetails = row.getByRole('link', { name: 'View Details', exact: true });
    await this.scrollToElement(viewDetails);
    await viewDetails.click();
    await this.page.waitForURL(/\/transaction\/billPaymentBatch\?batchId=/, { timeout: Timeouts.pageLoad });
  }
}
