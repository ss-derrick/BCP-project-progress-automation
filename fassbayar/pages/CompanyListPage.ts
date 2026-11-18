import { expect, Locator } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { Timeouts } from '../../common/config/testConfig';

// Options of the "Quicklink" dropdown in each result row
export type Quicklink =
  | 'View Details'
  | 'View Mobile Users'
  | 'View Readers'
  | 'View Transactions'
  | 'View Credit Settlements'
  | 'Suspend Company Access';

// All Companies > Company Summary (/company/list) and its search results
// (/company/search?search=...)
export class CompanyListPage extends BasePage {
  readonly searchInput = this.page.locator('#search');
  // First "Search" button = the "Search for a Company" box (the second one
  // belongs to the Status / Date filter)
  readonly searchButton = this.page.getByRole('link', { name: 'Search', exact: true }).first();
  readonly heading = this.page.getByRole('heading', { name: /All Companies|Search Results/ });
  readonly totalRecords = this.page.getByText(/Total Records:\s*\d+/);
  readonly resultRows = this.page.locator('#dataRow tr.dataListMid');

  async verifyOpened(): Promise<void> {
    await this.page.waitForURL(/\/company\/(list)?$/, { timeout: Timeouts.pageLoad });
    await expect(this.searchInput).toBeVisible();
    await this.captureScreen('All Companies');
  }

  // "Search for a Company" by MID / Name of Business / Authoriser
  async search(term: string): Promise<void> {
    await this.scrollToElement(this.searchInput);
    await this.typeInto(this.searchInput, term);
    await this.searchButton.click();
    await this.page.waitForURL(/\/company\/search\?search=/, { timeout: Timeouts.pageLoad });
    await expect(this.page.getByText('Search Results')).toBeVisible();
  }

  // Result row containing the given text (e.g. a MID)
  row(text: string): Locator {
    return this.resultRows.filter({ hasText: text });
  }

  async verifySearchResult(
    term: string,
    expected: { businessName?: string; authoriser?: string; status?: string } = {}
  ): Promise<void> {
    await expect(this.page.getByText('You are currently viewing')).toBeVisible();
    await expect(this.row(term), `Search result should list "${term}"`).toHaveCount(1);

    const cells = this.row(term).locator('td');
    if (expected.businessName) await expect(cells.nth(0)).toContainText(`(${expected.businessName})`);
    if (expected.authoriser) await expect(cells.nth(1)).toHaveText(expected.authoriser);
    if (expected.status) await expect(cells.nth(2)).toHaveText(expected.status);

    await this.captureScreen(`Search results - ${term}`);
  }

  // Pick a Quicklink option in the row and click "Go"
  async openQuicklink(term: string, option: Quicklink): Promise<void> {
    const row = this.row(term);
    const dropdown = row.locator('select.selectInTable');
    await this.scrollToElement(row);
    await dropdown.selectOption({ label: option });
    await expect(row.locator('span.select')).toHaveText(option);
    await this.captureScreen(`Quicklink "${option}" selected`);
    await row.getByRole('link', { name: 'Go' }).click();
  }
}
