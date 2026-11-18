import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { formatPortalDate } from '../../common/utils/portalDate';
import { Timeouts } from '../../common/config/testConfig';

// APH System Portal - "Parent Company Summary"
// (All Companies > Quicklinks > Parent Company Summary, /company/parentCompanyListing)
// Locators taken from explore/parentCompany.explore.ts (17 Nov 2026).
//
// Page layout (same style as All Companies):
//   Search for a Company [Name of Business / Authoriser] [Search] -> /company/searchParent?search=
//   All Parent Companies   Status / Date filter
//   Total Records: N   Page x of y
//   table #dataRow: Business Name | Authoriser | Status | Merchant Type | Created Date | Quicklink [Go]
//
// Quicklink options: View Details, Link Companies, Unlink Companies,
// Suspend Company Access. Only "View Details" is allowed here - the others
// change UAT data.

export interface ParentCompanyRow {
  businessName: string;
  authoriser: string;
  status: string;
  merchantType: string;
  createdDate: string;
}

export class ParentCompanySummaryPage extends BasePage {

  readonly quicklink: Locator;
  readonly content: Locator;
  readonly listTitle: Locator;
  readonly searchResultsTitle: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly totalRecords: Locator;
  readonly rows: Locator;
  readonly noRecordMessage: Locator;

  // Filter (same form as All Companies)
  readonly statusSelect: Locator;
  readonly fromDate: Locator;
  readonly toDate: Locator;
  readonly filterButton: Locator;

  constructor(page: Page) {
    super(page);

    // The panel has two links to this page; use the visible one by name
    this.quicklink = page.locator('#leftPanel').getByRole('link', { name: 'Parent Company Summary' });
    this.content = page.locator('#rightMainContent');
    this.listTitle = this.content.getByText('All Parent Companies', { exact: true });
    this.searchResultsTitle = this.content.getByText('Search Results', { exact: true });
    this.searchInput = page.locator('#search');
    this.searchButton = page.locator('form[name="searchForm"] a.button');
    this.totalRecords = page.locator('#totalRecord');
    this.rows = page.locator('#dataRow tr.dataListMid');
    this.noRecordMessage = this.content.getByText('No record found');

    this.statusSelect = page.locator('form[name="filterForm"] select[name="status"]');
    this.fromDate = page.locator('#fromdate1');
    this.toDate = page.locator('#todate1');
    this.filterButton = page.locator('form[name="filterForm"] a.button');
  }

  // Open from the All Companies Quicklinks panel (be on All Companies first)
  async open(): Promise<void> {
    await this.quicklink.click();
    await expect(this.page).toHaveURL(/\/company\/parentCompanyListing/);
    await expect(this.listTitle).toBeVisible();
  }

  // Search by Name of Business / Authoriser
  async search(keyword: string): Promise<void> {
    await this.typeInto(this.searchInput, keyword);
    await this.searchButton.click();
    await expect(this.page).toHaveURL(/\/company\/searchParent\?search=/);
    await expect(this.searchResultsTitle).toBeVisible();
  }

  // Date filter range. Both boxes are read-only jQuery UI date pickers,
  // so the date is set through the page's own datepicker.
  async setDateRange(from: Date, to: Date): Promise<void> {
    for (const [box, date] of [[this.fromDate, from], [this.toDate, to]] as const) {
      const text = formatPortalDate(date);
      // Wait until the page has turned the box into a date picker: setting
      // the value earlier gets overwritten with the default when it starts.
      await expect(box).toHaveClass(/hasDatepicker/, { timeout: Timeouts.pageLoad });
      await box.evaluate((el, value) => {
        const w = window as unknown as { $?: (e: Element) => { datepicker?: (cmd: string, v: string) => void } };
        const jq = w.$?.(el);
        if (jq?.datepicker) {
          jq.datepicker('setDate', value);
        } else {
          (el as HTMLInputElement).value = value;
        }
      }, text);
      await expect(box).toHaveValue(text);
    }
  }

  // Status + Date filter in one search
  async filter(options: { status?: 'Active' | 'Suspended'; from?: Date; to?: Date }): Promise<void> {
    if (options.status) {
      await this.statusSelect.selectOption(options.status);
    }
    if (options.from && options.to) {
      await this.setDateRange(options.from, options.to);
    }
    await this.captureScreen('Filter set');
    await this.scrollToElement(this.filterButton);
    await this.filterButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async readAllRows(): Promise<ParentCompanyRow[]> {
    const out: ParentCompanyRow[] = [];
    for (let i = 0; i < await this.rows.count(); i++) {
      out.push(await this.readRow(this.rows.nth(i)));
    }
    return out;
  }

  async getTotalRecords(): Promise<number> {
    const match = (await this.totalRecords.innerText()).match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // The row containing this text (business name / authoriser)
  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async readRow(row: Locator): Promise<ParentCompanyRow> {
    const cell = async (i: number) => (await row.locator('td').nth(i).innerText()).trim();
    return {
      businessName: await cell(0),
      authoriser: await cell(1),
      status: await cell(2),
      merchantType: await cell(3),
      createdDate: await cell(4)
    };
  }

  // Quicklink "View Details" -> Go (the only Quicklink option allowed here)
  async openViewDetails(row: Locator): Promise<void> {
    await row.locator('select').selectOption({ label: 'View Details' });
    await this.captureScreen('Quicklink "View Details" chosen');
    await row.getByRole('link', { name: 'Go' }).click();
    await expect(this.page).toHaveURL(/viewParentCompanyDetails/);
  }
}
