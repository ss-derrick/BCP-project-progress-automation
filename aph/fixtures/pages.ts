import { test as base, expect } from '../../common/fixtures/base';

// APH-only page objects. The shared ones (loginPage, addCompanyPage,
// addParentCompanyPage) and the blocked-page check come from
// common/fixtures/base.ts.
import { ConsolePage } from '../pages/ConsolePage';
import { AllCompaniesPage } from '../pages/AllCompaniesPage';
import { CompanyDetailsPage } from '../pages/CompanyDetailsPage';
import { ParentCompanySummaryPage } from '../pages/ParentCompanySummaryPage';
import { ParentCompanyDetailsPage } from '../pages/ParentCompanyDetailsPage';

// Add one line here for every new APH page object
type AphPages = {
  consolePage: ConsolePage;
  allCompaniesPage: AllCompaniesPage;
  companyDetailsPage: CompanyDetailsPage;
  parentCompanySummaryPage: ParentCompanySummaryPage;
  parentCompanyDetailsPage: ParentCompanyDetailsPage;
};

// Specs in aph/tests import { test, expect } from here
export const test = base.extend<AphPages>({
  consolePage: async ({ page }, use) => { await use(new ConsolePage(page)); },
  allCompaniesPage: async ({ page }, use) => { await use(new AllCompaniesPage(page)); },
  companyDetailsPage: async ({ page }, use) => { await use(new CompanyDetailsPage(page)); },
  parentCompanySummaryPage: async ({ page }, use) => { await use(new ParentCompanySummaryPage(page)); },
  parentCompanyDetailsPage: async ({ page }, use) => { await use(new ParentCompanyDetailsPage(page)); }
});

export { expect };
