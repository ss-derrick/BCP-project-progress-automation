import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Timeouts } from '../../portals.config';

// System Portal - Manage Transactions > Transaction Summary (/transaction/list)
// and its search results (/transaction/search?search=<trxID>). SHARED by every
// portal (read-only scan of both, 18 Nov 2026: explore/scan/results/transaction-summary-*).
//
// The list's columns differ per portal (Fassbayar adds Business Name, Mobile User,
// Scheme Ref Id; APH has Refunded), so rows are read BY HEADER NAME, never by position.
// Search results, both portals: Date/Time | Transaction ID | Status | Amount |
//   Approval Code | Verification Method | TID(MID) | Quicklink [View Details]

export type TransactionRow = Record<string, string>;   // header -> cell text

export class TransactionSummaryPage extends BasePage {
  readonly menuTab = this.page.locator('#topNavi a[href="/transaction"]');
  readonly searchInput = this.page.locator('form[name="searchForm"] #search');
  readonly searchButton = this.page.locator('form[name="searchForm"]').getByRole('link', { name: 'Search', exact: true });
  readonly searchResultsTitle = this.page.getByText('Search Results', { exact: true });
  readonly totalRecords = this.page.getByText(/Total Records:\s*[\d,]+/);
  readonly table = this.page.locator('#dataRow');
  readonly rows = this.table.locator('tr.dataListMid');

  // Top menu "Manage Transactions" -> lands on Transaction Summary
  async open(): Promise<void> {
    await this.menuTab.click();
    await expect(this.page).toHaveURL(/\/transaction\/list/, { timeout: Timeouts.pageLoad });
    await expect(this.searchInput).toBeVisible();
    await this.captureScreen('Manage Transactions - Transaction Summary');
  }

  // Search by Transaction ID
  async search(keyword: string): Promise<void> {
    await this.scrollToElement(this.searchInput);
    await this.typeInto(this.searchInput, keyword);
    await this.searchButton.click();
    await this.page.waitForURL(/\/transaction\/search\?search=/, { timeout: Timeouts.pageLoad });
    await expect(this.searchResultsTitle).toBeVisible();
  }

  async getTotalRecords(): Promise<number> {
    const text = await this.totalRecords.first().innerText();
    const match = text.match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // The row whose text contains this Transaction ID
  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  // { 'Transaction ID': '...', 'Status': 'Approved', 'Amount': '3.40', ... }
  async readRow(row: Locator): Promise<TransactionRow> {
    const headers = (await this.table.locator('tr.dataTitleMid th').allInnerTexts())
      .map((h) => h.replace(/\s+/g, ' ').trim());
    const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    const out: TransactionRow = {};
    headers.forEach((h, i) => { if (h) out[h] = cells[i] ?? ''; });
    return out;
  }

  // Row's "View Details" button (a plain link - no Quicklink dropdown here)
  async openDetails(row: Locator): Promise<void> {
    const viewDetails = row.getByRole('link', { name: 'View Details', exact: true });
    await this.scrollToElement(viewDetails);
    await viewDetails.click();
    await this.page.waitForURL(/\/transaction\/viewDetails\?/, { timeout: Timeouts.pageLoad });
  }
}
