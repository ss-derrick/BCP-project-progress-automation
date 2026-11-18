import { test, expect, Locator } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { Timeouts } from '../../common/config/testConfig';

// One row of the "All Parent Companies" table
export interface ParentCompanyRow {
  businessName: string;
  authoriser: string;
  status: string;
  merchantType: string;
  createdDate: string;
}

// All Companies > Parent Company Summary (/company/parentCompanyListing)
// and its search results (/company/searchParent?search=...)
export class ParentCompanyListPage extends BasePage {
  readonly quicklink = this.page.locator('a[href="/company/parentCompanyListing"]').filter({ visible: true }).first();
  readonly searchInput = this.page.locator('#search');
  // First "Search" = the "Search for a Company" box (second = Status / Date filter)
  readonly searchButton = this.page.getByRole('link', { name: 'Search', exact: true }).first();
  readonly rows = this.page.locator('#dataRow tr.dataListMid');
  readonly generalError = this.page.getByText('An error has occurred. Please try again.');

  async open(): Promise<void> {
    await this.quicklink.click();
    await this.page.waitForURL(/\/company\/parentCompanyListing/, { timeout: Timeouts.pageLoad });
    await expect(this.page.getByText('All Parent Companies')).toBeVisible();
    await expect(this.rows.first()).toBeVisible();
    await this.captureScreen('Parent Company Summary');
  }

  private async readRow(row: Locator): Promise<ParentCompanyRow> {
    const cell = async (i: number) => (await row.locator('td').nth(i).innerText()).trim();
    return {
      businessName: await cell(0),
      authoriser: await cell(1),
      status: await cell(2),
      merchantType: await cell(3),
      createdDate: await cell(4)
    };
  }

  // Newest parent company = first row of the listing
  async latestRow(): Promise<ParentCompanyRow> {
    return this.readRow(this.rows.first());
  }

  // "Search for a Company" by Name of Business / Authoriser
  async search(term: string): Promise<void> {
    await this.scrollToElement(this.searchInput);
    await this.typeInto(this.searchInput, term);
    await this.searchButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForURL(/\/(company\/searchParent|issue\/generalError)/, { timeout: Timeouts.pageLoad });
  }

  // The search must list the expected parent company.
  // Fails with a BUG message if the portal shows its general error page.
  async verifySearchFinds(term: string, expected: ParentCompanyRow): Promise<void> {
    if (/\/issue\/generalError/.test(this.page.url()) || (await this.generalError.isVisible())) {
      await this.captureScreen(`BUG - search "${term}" shows error page`);
      const bug =
        `BUG: Parent Company search for "${term}" shows the general error page ` +
        `("An error has occurred. Please try again.") instead of the results. ` +
        `/company/searchParent redirects (302) to /issue/generalError whenever the ` +
        `search has matches; a search with no matches loads normally.`;
      test.info().annotations.push({ type: 'bug', description: bug });
      throw new Error(bug);
    }

    const match = this.rows.filter({ hasText: expected.businessName }).filter({ hasText: expected.authoriser });
    await expect(
      match,
      `Search for "${term}" should list "${expected.businessName}" (authoriser ${expected.authoriser})`
    ).toHaveCount(1);
    await expect(match.locator('td').nth(2)).toHaveText(expected.status);
    await expect(match.locator('td').nth(3)).toHaveText(expected.merchantType);
    await this.captureScreen(`Search results - ${term}`);
  }
}
