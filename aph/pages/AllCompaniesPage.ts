import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { formatPortalDate } from '../../common/utils/portalDate';
import { Timeouts } from '../../common/config/testConfig';

// APH System Portal - "All Companies" (top menu, /company/list)
// Locators taken from explore/allCompanies.explore.ts (17 Nov 2026).
//
// Page layout:
//   Search for a Company  [MID / Name of Business / Authoriser] [Search]
//   Status [Select One|Active|Suspended]  Date [from] to [to]  [Search]
//   Total Records: N   Page x of y
//   table #dataRow: MID (Business Name) | Authoriser | Status | Date | Quicklink [Go]
//   pagination, [Export to CSV]

// Quicklink menu options this page object may open. "Suspend Company
// Access" is deliberately NOT here: it changes a real UAT company.
export const Quicklink = {
  VIEW_DETAILS: 'View Details',
  VIEW_MOBILE_USERS: 'View Mobile Users',
  VIEW_READERS: 'View Readers',
  VIEW_TRANSACTIONS: 'View Transactions',
  VIEW_CREDIT_SETTLEMENTS: 'View Credit Settlements'
} as const;
export type QuicklinkOption = typeof Quicklink[keyof typeof Quicklink];

export type CompanyStatus = 'Active' | 'Suspended';

// One company row, as shown in the table
export interface CompanyRow {
  mid: string;            // e.g. '202610011060002-ACS' (first MID if several)
  businessName: string;   // text in brackets under the MID
  authoriser: string;
  status: string;         // 'ACTIVE' / 'SUSPENDED'
  date: string;           // Created / Activation / Suspended date
}

export class AllCompaniesPage extends BasePage {

  // Top menu tab
  readonly menuTab: Locator;

  // Content area
  readonly content: Locator;
  readonly listTitle: Locator;
  readonly searchResultsTitle: Locator;

  // Search for a Company
  readonly searchInput: Locator;
  readonly searchButton: Locator;

  // Filter
  readonly statusSelect: Locator;
  readonly fromDate: Locator;
  readonly toDate: Locator;
  readonly filterButton: Locator;

  // Results
  readonly totalRecords: Locator;
  readonly pageInfo: Locator;
  readonly rows: Locator;
  readonly noRecordMessage: Locator;
  readonly nextPageLink: Locator;
  readonly exportCsvButton: Locator;

  constructor(page: Page) {
    super(page);

    this.menuTab = page.locator('#topNavi a[href="/company"]');

    this.content = page.locator('#rightMainContent');
    this.listTitle = this.content.getByText('All Companies', { exact: true });
    this.searchResultsTitle = this.content.getByText('Search Results', { exact: true });

    this.searchInput = page.locator('#search');
    this.searchButton = page.locator('form[name="searchForm"] a.button');

    this.statusSelect = page.locator('form[name="filterForm"] select[name="status"]');
    this.fromDate = page.locator('#fromdate1');
    this.toDate = page.locator('#todate1');
    this.filterButton = page.locator('form[name="filterForm"] a.button');

    this.totalRecords = page.locator('#totalRecord');
    this.pageInfo = page.locator('#pageInfo');
    this.rows = page.locator('#dataRow tr.dataListMid');
    this.noRecordMessage = this.content.getByText('No record found');
    this.nextPageLink = page.locator('#pagination a#next');
    this.exportCsvButton = page.getByRole('link', { name: 'Export to CSV' });
  }

  // ---------- navigation ----------

  // Open through the top menu, like a user (needs to be logged in)
  async open(): Promise<void> {
    await this.menuTab.click();
    await this.verifyListPage();
  }

  async verifyListPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/company\/list/);
    await expect(this.listTitle).toBeVisible();
    await expect(this.searchInput).toBeVisible();
    await expect(this.statusSelect).toBeAttached();
    await expect(this.totalRecords).toContainText('Total Records:');
  }

  // ---------- search ----------

  // Search by MID, Name of Business or Authoriser
  async search(keyword: string): Promise<void> {
    // The box holds its hint as a real value; clicking clears it
    await this.typeInto(this.searchInput, keyword);
    await this.scrollToElement(this.searchButton);
    await this.searchButton.click();
    await expect(this.page).toHaveURL(/\/company\/search\?search=/);
    await expect(this.searchResultsTitle).toBeVisible();
  }

  async verifyNoRecordFound(keyword: string): Promise<void> {
    await expect(this.noRecordMessage).toBeVisible();
    await expect(this.content).toContainText(`Your search entry (${keyword}) does not exist`);
    await expect(this.rows).toHaveCount(0);
  }

  // ---------- filter ----------

  // Set the Date filter range. Both boxes are read-only jQuery UI date
  // pickers, so the date is set through the page's own datepicker (falls
  // back to writing the value if the datepicker is not available).
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
  async filter(options: { status?: CompanyStatus; from?: Date; to?: Date }): Promise<void> {
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

  async filterByStatus(status: CompanyStatus): Promise<void> {
    await this.statusSelect.selectOption(status);
    await this.scrollToElement(this.filterButton);
    await this.filterButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ---------- results ----------

  async getTotalRecords(): Promise<number> {
    const text = await this.totalRecords.innerText();
    const match = text.match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // "Page 1 of 59" -> { current: 1, last: 59 }
  async getPageInfo(): Promise<{ current: number; last: number }> {
    const text = await this.pageInfo.innerText();
    const match = text.match(/Page\s+(\d+)\s+of\s+(\d+)/);
    return match
      ? { current: Number(match[1]), last: Number(match[2]) }
      : { current: 0, last: 0 };
  }

  // The row whose text contains this MID / business name / authoriser
  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async readRow(row: Locator): Promise<CompanyRow> {
    const cells = row.locator('td');
    const midCell = (await cells.nth(0).innerText()).trim();
    const nameMatch = midCell.match(/\(([^)]*)\)\s*$/);
    return {
      mid: midCell.split(/[,\n]/)[0].trim(),
      businessName: nameMatch ? nameMatch[1].trim() : '',
      authoriser: (await cells.nth(1).innerText()).trim(),
      status: (await cells.nth(2).innerText()).trim(),
      date: (await cells.nth(3).innerText()).trim()
    };
  }

  async readAllRows(): Promise<CompanyRow[]> {
    const out: CompanyRow[] = [];
    for (let i = 0; i < await this.rows.count(); i++) {
      out.push(await this.readRow(this.rows.nth(i)));
    }
    return out;
  }

  async goToNextPage(): Promise<void> {
    await this.scrollToElement(this.nextPageLink);
    await this.nextPageLink.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ---------- quicklink ----------

  // Choose a Quicklink option on a row and press Go (read-only options only)
  async openQuicklink(row: Locator, option: QuicklinkOption): Promise<void> {
    // The real <select> is transparent over a styled <span>; selecting on
    // it fires the page's own onchange, which sets the form action
    await row.locator('select.selectInTable').selectOption({ label: option });
    await this.captureScreen(`Quicklink "${option}" chosen`);
    await row.getByRole('link', { name: 'Go' }).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ---------- export ----------

  // Click Export to CSV and return the downloaded file's name.
  // The export is slow on UAT (~36 s for 881 companies on 17 Nov 2026).
  async exportCsv(timeout = 120_000): Promise<string> {
    const downloadPromise = this.page.waitForEvent('download', { timeout });
    await this.exportCsvButton.click({ noWaitAfter: true });
    const download = await downloadPromise;
    return download.suggestedFilename();
  }
}
