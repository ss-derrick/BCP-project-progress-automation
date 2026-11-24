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

  // Newest transaction on the list (it opens on today's date: not archived yet). '' if none today.
  // Column "Transaction ID" (APH) / "Transaction ID (Business Name)" (Fassbayar): the ID is the first word.
  async newestTransactionId(): Promise<string> {
    if (!(await this.rows.count())) return '';
    const row = await this.readRow(this.rows.first());
    const column = Object.keys(row).find((h) => h.startsWith('Transaction ID')) ?? '';
    return (row[column] ?? '').split(/\s+/)[0];
  }

  // Older transactions are in the archive: APH shows their details only 22:00 - 06:00
  readonly archiveClosed = this.page.getByText(/Archive data can only be viewed between/);

  // Row's "View Details" button (a plain link - no Quicklink dropdown here).
  // Returns 'archive' when the portal shows the archive-hours message instead of the details.
  async openDetails(row: Locator): Promise<'details' | 'archive'> {
    const viewDetails = row.getByRole('link', { name: 'View Details', exact: true });
    await this.scrollToElement(viewDetails);
    await viewDetails.click();
    // The portal can answer with its error page instead of the details (APH, 22 Nov 2026):
    // report that page's message, not a bare timeout
    const errorPage = this.page.getByText('An error has occurred.', { exact: true });
    await Promise.race([
      this.page.waitForURL(/\/transaction\/viewDetails\?/, { timeout: Timeouts.pageLoad }),
      errorPage.waitFor({ timeout: Timeouts.pageLoad }).then(() => {
        throw new Error('Portal error page "An error has occurred. Please try again..." instead of the transaction details (View Details)');
      })
    ]);
    await this.page.waitForLoadState('load');
    return (await this.archiveClosed.isVisible().catch(() => false)) ? 'archive' : 'details';
  }
}
