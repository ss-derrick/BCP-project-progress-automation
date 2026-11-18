import { expect } from '@playwright/test';
import { BasePage } from '../../common/pages/BasePage';
import { CompanyPicker } from './components/CompanyPicker';
import { Timeouts } from '../../common/config/testConfig';

// "Number of Company(s) Logo Updated  N" on the Complete step of both logo pages
export const logoUpdatedCount = (n: number) =>
  new RegExp(`Number of Company\\(s\\) Logo\\s*Updated\\s*${n}\\b`);

// All Companies > Upload Company Logo (/company/uploadCompanyLogo)
// 4-step wizard: Logo -> Company -> Review & Confirm -> Complete
// Each step has its own Next button: <a class="next" id="1">, id="2"
export class UploadCompanyLogoPage extends BasePage {
  readonly quicklink = this.page.locator('a[href="/company/uploadCompanyLogo"]').filter({ visible: true }).first();

  // Step 1: Logo ("Browse" is a styled hidden <input type=file>)
  readonly fileInput = this.page.locator('#realupload');
  readonly fileName = this.page.locator('#fakeupload');
  readonly logoNextButton = this.page.locator('a.next[id="1"]');

  // Step 2: Company. The list only offers companies WITHOUT a logo.
  readonly companies = new CompanyPicker(this.page);
  readonly companyNextButton = this.page.locator('a.next[id="2"]');

  // Step 3: Review & Confirm
  readonly reviewStep = this.page.locator('#step3');
  readonly reviewHeading = this.reviewStep.getByText('Selected Company Logo');
  readonly reviewCompanySection = this.reviewStep.getByText('Selected Company Section');
  readonly confirmButton = this.page.locator('#submitThis');

  // Step 4: Complete
  readonly successMessage = this.page.getByText('Your request is successful');

  async open(): Promise<void> {
    await this.quicklink.click();
    await this.page.waitForURL(/\/company\/uploadCompanyLogo/, { timeout: Timeouts.pageLoad });
    await expect(this.page.getByText('Only allowed to upload JPEG and PNG format')).toBeVisible();
    await this.captureScreen('Upload Company Logo');
  }

  // ---------- Step 1: Logo ----------

  async chooseLogo(filePath: string, fileName: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    // The page shows the logo in its preview box (and not always the file
    // name next to Browse). Acceptance is proven by nextFromLogo(): the
    // Company step only opens for a valid JPEG/PNG.
    await this.pause();
    await this.captureScreen(`Logo chosen - ${fileName}`);
  }

  async nextFromLogo(): Promise<void> {
    await this.scrollToElement(this.logoNextButton);
    await this.logoNextButton.click();
    await expect(
      this.companies.available,
      'Company step did not open - the logo may have been rejected (JPEG/PNG only)'
    ).toBeVisible({ timeout: Timeouts.pageLoad });
  }

  // ---------- Step 2: Company ----------

  // Newest company (highest id) without a logo whose name passes `accept`
  async newestCompany(accept: (name: string) => boolean, description: string): Promise<string> {
    try {
      return await this.companies.newestCompany(accept, description);
    } catch {
      throw new Error(
        `No ${description} without a logo is left in the Upload Company Logo list. ` +
        'Run the Add a Company test (TC-FASSBAYAR-001) or Remove Company Logo (TC-FASSBAYAR-012), ' +
        'or set LOGO_COMPANY_ID.'
      );
    }
  }

  // Move ONE company to the right-hand list
  async moveCompany(companyId: string): Promise<string> {
    const name = await this.companies.moveOne(companyId);
    await this.captureScreen(`Company moved - ${name}`);
    return name;
  }

  async nextFromCompany(): Promise<void> {
    await this.scrollToElement(this.companyNextButton);
    await this.companyNextButton.click();
    await expect(this.reviewHeading).toBeVisible({ timeout: Timeouts.pageLoad });
  }

  // ---------- Step 3: Review & Confirm ----------

  async verifyReview(companyNames: string[]): Promise<void> {
    await expect(this.reviewCompanySection).toBeVisible();
    for (const name of companyNames) {
      await expect(this.reviewStep.getByText(name, { exact: true }),
        `Review should list "${name}"`).toBeVisible();
    }
    await this.captureScreen('Review & Confirm');
  }

  async confirm(): Promise<void> {
    await this.scrollToElement(this.confirmButton);
    await this.confirmButton.click();
    await this.page.waitForURL(/\/company\/doUploadCompanyLogo/, { timeout: Timeouts.pageLoad });
  }

  // ---------- Step 4: Complete ----------

  async verifyComplete(companiesUpdated: number): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    await expect(this.page.locator('body')).toContainText(logoUpdatedCount(companiesUpdated));
    await this.captureScreen('Complete - request successful');
  }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
