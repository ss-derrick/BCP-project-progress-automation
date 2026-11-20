import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Timeouts } from '../../portals.config';

// System Portal - All Companies > Company Summary (/company/list) and its
// search results (/company/search?search=...). SHARED by every portal: same
// search box and result table on APH and Fassbayar (APH explored 17 Nov 2026,
// Fassbayar team's explore-dumps/11-search-results).
//
// Result table #dataRow, one tr.dataListMid per company:
//   0 MID(s) + "(Business Name)" | 1 Authoriser | 2 Status | 3 Date | 4 Quicklink [Go]

export interface CompanyRow {
  mids: string[];         // every MID shown, e.g. ['000452839489382-ACS', '800389283402930-FP']
  businessName: string;   // text in brackets under the MIDs
  authoriser: string;
  status: string;         // 'ACTIVE' / 'Suspended' (the portal mixes the case)
  date: string;
}

export class CompanySummaryPage extends BasePage {
  readonly searchInput = this.page.locator('#search');
  // First "Search" = the "Search for a Company" box (the second one is the Status / Date filter)
  readonly searchButton = this.page.getByRole('link', { name: 'Search', exact: true }).first();
  readonly searchResultsTitle = this.page.getByText('Search Results', { exact: true });
  readonly totalRecords = this.page.getByText(/Total Records:\s*[\d,]+/);
  readonly rows = this.page.locator('#dataRow tr.dataListMid');

  // After homePage.openAllCompanies()
  async verifyOpened(): Promise<void> {
    await expect(this.page).toHaveURL(/\/company(\/list)?(\?.*)?$/, { timeout: Timeouts.pageLoad });
    await expect(this.searchInput).toBeVisible();
    await this.captureScreen('All Companies - Company Summary');
  }

  // "Search for a Company" by MID (plain, no suffix) / Name of Business / Authoriser
  async search(keyword: string): Promise<void> {
    // The box holds its hint as a real value; typeInto clears it first
    await this.scrollToElement(this.searchInput);
    await this.typeInto(this.searchInput, keyword);
    await this.searchButton.click();
    await this.page.waitForURL(/\/company\/search\?search=/, { timeout: Timeouts.pageLoad });
    await expect(this.searchResultsTitle).toBeVisible();
  }

  // "Total Records: 1" -> 1
  async getTotalRecords(): Promise<number> {
    const text = await this.totalRecords.first().innerText();
    const match = text.match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // The row whose text contains this MID / business name / authoriser
  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async readRow(row: Locator): Promise<CompanyRow> {
    const cells = row.locator('td');
    const midCell = (await cells.nth(0).innerText()).trim();
    const nameMatch = midCell.match(/\(([^)]*)\)\s*$/);
    const midText = midCell.replace(/\([^)]*\)\s*$/, '');
    return {
      mids: midText.split(/[,\n]/).map((m) => m.trim()).filter(Boolean),
      businessName: nameMatch ? nameMatch[1].trim() : '',
      authoriser: (await cells.nth(1).innerText()).trim(),
      status: (await cells.nth(2).innerText()).trim(),
      date: (await cells.nth(3).innerText()).trim()
    };
  }
}
