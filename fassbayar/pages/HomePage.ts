import { expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { Timeouts } from '../../common/config/testConfig';

// Portal home (/console) + top menu
export class HomePage extends BasePage {
  readonly allCompaniesMenu = this.page.locator('a[href="/company"]').first();
  readonly addCompanyLink = this.page.locator('a[href="/company/register"]');

  // Top menu "All Companies" (Company Summary list)
  async openAllCompanies(): Promise<void> {
    await this.allCompaniesMenu.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.failIfLoggedOut();
  }

  // Top menu "All Companies" > "Add a Company"
  async openAddCompany(): Promise<void> {
    await this.allCompaniesMenu.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.failIfLoggedOut();
    await this.pause();
    await this.addCompanyLink.filter({ visible: true }).first().click();
    await this.page.waitForURL(/\/company\/register/, { timeout: Timeouts.pageLoad });
    await expect(this.page.locator('#businessName')).toBeVisible();
    await this.captureScreen('Add a Company - empty form');
  }

  // The portal allows one session per user: a login elsewhere (another
  // worker, a person using the same account) sends this one back to login.
  async failIfLoggedOut(): Promise<void> {
    expect(
      this.page.url(),
      'Session was logged out - the same user probably logged in elsewhere ' +
      '(another test worker or a person). Run with --workers=1.'
    ).not.toMatch(/\/auth\/login/);
  }
}
