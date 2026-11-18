import { expect } from '@playwright/test';
import { CompanyDetailsPage } from './CompanyDetailsPage';
import { ParentCompanyData } from '../testdata/parentCompanyData';

// Parent Company Details (/company/viewParentCompanyDetails?itemid=...)
// Same label/value layout as the company details page
export class ParentCompanyDetailsPage extends CompanyDetailsPage {
  readonly currentlyViewing = this.page.getByText('You are currently viewing');
  readonly linkCompaniesButton = this.page.getByRole('link', { name: 'Link Companies' });
  readonly editCompanyDetailsButton = this.page.getByRole('link', { name: 'Edit Company Details' });

  override async goto(itemId: string): Promise<void> {
    await this.page.goto(`/company/viewParentCompanyDetails?itemid=${itemId}`);
  }

  async verifyParentDetails(data: ParentCompanyData, userId: string): Promise<void> {
    await expect(this.page).toHaveURL(/viewParentCompanyDetails\?itemid=\d+/);
    await expect(this.currentlyViewing).toBeVisible();
    await expect(this.page.getByText(`Business Name: ${data.businessName}`)).toBeVisible();
    await expect(this.page.getByText('Parent Company Details')).toBeVisible();
    await expect(this.activationDate).not.toBeEmpty();
    await expect(this.linkCompaniesButton).toBeVisible();

    await this.verifyBusinessAndAuthoriser(data, userId);
    await this.captureScreen('Parent company details');
  }
}
