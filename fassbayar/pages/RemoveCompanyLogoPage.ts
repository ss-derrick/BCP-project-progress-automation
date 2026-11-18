import { expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { CompanyPicker } from './components/CompanyPicker';
import { logoUpdatedCount } from './UploadCompanyLogoPage';
import { Timeouts } from '../../common/config/testConfig';

// All Companies > Remove Company Logo (/company/removeCompanyLogo)
// 3-step wizard: Details -> Review & Confirm -> Complete
// The list only offers companies that HAVE a logo.
export class RemoveCompanyLogoPage extends BasePage {
  readonly quicklink = this.page.locator('a[href="/company/removeCompanyLogo"]').filter({ visible: true }).first();

  // Step 1: Details - two-list company picker
  readonly companies = new CompanyPicker(this.page);
  readonly submitButton = this.page.locator('a.next[id="1"]');

  // Step 2: Review & Confirm
  readonly reviewStep = this.page.locator('#step2');
  readonly confirmButton = this.page.locator('#submitThis');

  // Step 3: Complete
  readonly successMessage = this.page.getByText('Your request is successful');

  async open(): Promise<void> {
    await this.quicklink.click();
    await this.page.waitForURL(/\/company\/removeCompanyLogo/, { timeout: Timeouts.pageLoad });
    await expect(this.companies.available).toBeVisible();
    await this.captureScreen('Remove Company Logo');
  }

  // ---------- Step 1: Details ----------

  // First company in the list whose name passes `accept`
  async firstCompany(accept: (name: string) => boolean, description: string): Promise<string> {
    try {
      return await this.companies.firstCompany(accept, description);
    } catch {
      throw new Error(
        `No ${description} with a logo is in the Remove Company Logo list. ` +
        'Run Upload Company Logo (TC-FASSBAYAR-011) first, or set REMOVE_LOGO_COMPANY_ID.'
      );
    }
  }

  async moveCompany(companyId: string): Promise<string> {
    const name = await this.companies.moveOne(companyId);
    await this.captureScreen(`Company moved - ${name}`);
    return name;
  }

  async submit(): Promise<void> {
    await this.scrollToElement(this.submitButton);
    await this.submitButton.click();
    await expect(this.confirmButton).toBeVisible({ timeout: Timeouts.pageLoad });
  }

  // ---------- Step 2: Review & Confirm ----------

  async verifyReview(companyNames: string[]): Promise<void> {
    await expect(this.page.getByText('Business Name').filter({ visible: true }).first()).toBeVisible();
    for (const name of companyNames) {
      await expect(this.page.getByText(name, { exact: true }).filter({ visible: true }).first(),
        `Review should list "${name}"`).toBeVisible();
    }
    await this.captureScreen('Review & Confirm');
  }

  async confirm(): Promise<void> {
    await this.scrollToElement(this.confirmButton);
    await this.confirmButton.click();
    await this.page.waitForURL(/\/company\/doRemoveCompanyLogo/, { timeout: Timeouts.pageLoad });
  }

  // ---------- Step 3: Complete ----------

  async verifyComplete(companiesUpdated: number): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    await expect(this.page.locator('body')).toContainText(logoUpdatedCount(companiesUpdated));
    await this.captureScreen('Complete - request successful');
  }

  // After removal the company must no longer be offered on this page
  async verifyNotListed(companyId: string): Promise<void> {
    await this.page.goto('/company/removeCompanyLogo');
    await expect(
      this.companies.available.locator(`option[value="${companyId}"]`),
      `Company ${companyId} should no longer have a logo`
    ).toHaveCount(0);
  }
}
