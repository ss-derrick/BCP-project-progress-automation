import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';

// APH System Portal - Parent company details
// (Parent Company Summary > Quicklink "View Details" > Go,
//  /company/viewParentCompanyDetails?itemid=<id>)
// Layout from explore/parentCompany.explore.ts (17 Nov 2026):
//   You are currently viewing  Business Name: <name>          [Link Companies]
//   Parent Company Details [Edit Company Details]
//     Activation Date: <date>                                  Status History >>
//     Business Details        Business Name, Short Name, BRN, Address, Postcode, City, State, Contact
//     Authoriser Details      User ID, Salutation, Name, Contact No., Email Address
//     Business Configurations Merchant Type
//   API Authentication Setting
//   All Child Companies       Total Records: N, table: Business Name (MID) | Authoriser | Status | Merchant Type
//
// Link Companies / Edit Company Details / Unlink Company change UAT data -
// never clicked by tests.
export class ParentCompanyDetailsPage extends BasePage {

  readonly content: Locator;
  readonly currentlyViewing: Locator;
  readonly detailsTitle: Locator;
  readonly businessDetailsTitle: Locator;
  readonly authoriserDetailsTitle: Locator;
  readonly businessConfigTitle: Locator;
  readonly childCompaniesTitle: Locator;
  readonly childTotalRecords: Locator;
  readonly childRows: Locator;

  constructor(page: Page) {
    super(page);

    this.content = page.locator('#rightMainContent');
    this.currentlyViewing = this.content.getByText('You are currently viewing');
    this.detailsTitle = this.content.getByText('Parent Company Details', { exact: true });
    this.businessDetailsTitle = this.content.getByText('Business Details', { exact: true });
    this.authoriserDetailsTitle = this.content.getByText('Authoriser Details', { exact: true });
    this.businessConfigTitle = this.content.getByText('Business Configurations', { exact: true });
    this.childCompaniesTitle = this.content.getByText('All Child Companies', { exact: true });
    this.childTotalRecords = page.locator('#totalRecord');
    this.childRows = page.locator('#dataRow tr.dataListMid');
  }

  // The details page of this parent company is shown, with its sections
  async verifyDetailsPage(businessName: string): Promise<void> {
    await expect(this.page).toHaveURL(/viewParentCompanyDetails\?itemid=\d+/);
    await expect(this.currentlyViewing).toBeVisible();
    await expect(this.content).toContainText(`Business Name: ${businessName}`);
    await expect(this.detailsTitle).toBeVisible();
    await expect(this.businessDetailsTitle).toBeVisible();
    await expect(this.authoriserDetailsTitle).toBeVisible();
    await expect(this.businessConfigTitle).toBeVisible();
  }

  // "Label  value" shown together, e.g. verifyField('Merchant Type', 'Master Merchant')
  async verifyField(label: string, value: string): Promise<void> {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.content).toContainText(new RegExp(`${escape(label)}\\s*${escape(value)}`));
  }

  async getChildTotalRecords(): Promise<number> {
    const match = (await this.childTotalRecords.innerText()).match(/Total Records:\s*([\d,]+)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // Child company row containing this text (name or MID)
  childRow(text: string): Locator {
    return this.childRows.filter({ hasText: text });
  }
}
