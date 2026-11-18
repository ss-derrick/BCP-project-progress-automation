import { test as base, expect } from '../../common/fixtures/base';

// FassBayar-only page objects. The shared ones (loginPage, addCompanyPage,
// addParentCompanyPage) and the blocked-page check come from
// common/fixtures/base.ts.
import { HomePage } from '../pages/HomePage';
import { CompanyDetailsPage } from '../pages/CompanyDetailsPage';
import { CompanyListPage } from '../pages/CompanyListPage';
import { BulkCompanyUploadPage } from '../pages/BulkCompanyUploadPage';
import { ParentCompanyDetailsPage } from '../pages/ParentCompanyDetailsPage';
import { ParentCompanyListPage } from '../pages/ParentCompanyListPage';
import { UploadCompanyLogoPage } from '../pages/UploadCompanyLogoPage';
import { RemoveCompanyLogoPage } from '../pages/RemoveCompanyLogoPage';

type FassBayarPages = {
  homePage: HomePage;
  companyDetailsPage: CompanyDetailsPage;
  companyListPage: CompanyListPage;
  bulkCompanyUploadPage: BulkCompanyUploadPage;       // Bulk Company Upload (Create)
  bulkCompanyEditUploadPage: BulkCompanyUploadPage;   // Bulk Company Upload (Edit)
  parentCompanyDetailsPage: ParentCompanyDetailsPage;
  parentCompanyListPage: ParentCompanyListPage;
  uploadCompanyLogoPage: UploadCompanyLogoPage;
  removeCompanyLogoPage: RemoveCompanyLogoPage;
};

// Specs in fassbayar/tests import { test, expect } from here
export const test = base.extend<FassBayarPages>({
  homePage: async ({ page }, use) => { await use(new HomePage(page)); },
  companyDetailsPage: async ({ page }, use) => { await use(new CompanyDetailsPage(page)); },
  companyListPage: async ({ page }, use) => { await use(new CompanyListPage(page)); },
  bulkCompanyUploadPage: async ({ page }, use) => { await use(new BulkCompanyUploadPage(page, 'create')); },
  bulkCompanyEditUploadPage: async ({ page }, use) => { await use(new BulkCompanyUploadPage(page, 'edit')); },
  parentCompanyDetailsPage: async ({ page }, use) => { await use(new ParentCompanyDetailsPage(page)); },
  parentCompanyListPage: async ({ page }, use) => { await use(new ParentCompanyListPage(page)); },
  uploadCompanyLogoPage: async ({ page }, use) => { await use(new UploadCompanyLogoPage(page)); },
  removeCompanyLogoPage: async ({ page }, use) => { await use(new RemoveCompanyLogoPage(page)); }
});

export { expect };
