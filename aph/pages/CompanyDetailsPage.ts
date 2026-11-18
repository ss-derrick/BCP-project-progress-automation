import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';

// APH System Portal - Company details (All Companies -> Quicklink
// "View Details" -> Go). URL contains "viewDetails".
//
// Layout (from the screenshot taken 17 Nov 2026):
//   You are currently viewing  MID: <mid>             [Switch Company]
//   Company Details [Edit Company Details]
//     Activation Date: <date>                          Status History >>
//     Business Details     Business Name, Short Name, BRN, Address, ...
//     Authoriser Details   User ID, Salutation, Name, Contact No., Email
//     Transactions Limit
//   MID Settings           Merchant ID (MID), Status, Service Provider, Payment Type
//   ... bottom buttons: Reset Password / Suspend Company Access /
//       Suspend Authoriser  -> NEVER clicked by tests (they change UAT data)
//
// Locators use visible text (not yet checked against the page HTML).
// If one fails, run explore/ on this page and tighten it.
export class CompanyDetailsPage extends BasePage {

  readonly content: Locator;
  readonly currentlyViewing: Locator;
  readonly companyDetailsTitle: Locator;
  readonly businessDetailsTitle: Locator;
  readonly authoriserDetailsTitle: Locator;
  readonly midSettingsTitle: Locator;

  constructor(page: Page) {
    super(page);

    this.content = page.locator('#rightMainContent');
    this.currentlyViewing = this.content.getByText('You are currently viewing');
    this.companyDetailsTitle = this.content.getByText('Company Details', { exact: true });
    this.businessDetailsTitle = this.content.getByText('Business Details', { exact: true });
    this.authoriserDetailsTitle = this.content.getByText('Authoriser Details', { exact: true });
    this.midSettingsTitle = this.content.getByText('MID Settings', { exact: true });
  }

  // The details page of this MID is shown, with its main sections
  async verifyDetailsPage(mid: string): Promise<void> {
    await expect(this.page).toHaveURL(/viewDetails/);
    await expect(this.currentlyViewing).toBeVisible();
    await expect(this.content).toContainText(`MID: ${mid}`);

    await expect(this.companyDetailsTitle).toBeVisible();
    await expect(this.businessDetailsTitle).toBeVisible();
    await expect(this.authoriserDetailsTitle).toBeVisible();
    await expect(this.midSettingsTitle).toBeVisible();
  }

  // A "Label  value" line is shown somewhere in the details,
  // e.g. verifyField('Business Name', 'Test APH Sync FB')
  async verifyField(label: string, value: string): Promise<void> {
    await expect(this.content).toContainText(label);
    await expect(this.content).toContainText(value);
  }
}
