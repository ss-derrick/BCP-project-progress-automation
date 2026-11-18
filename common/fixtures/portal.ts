import { test as base, expect } from './base';
import { PORTAL } from '../../portals.config';
import type { AddCompanyFormPage } from '../pages/AddCompanyFormPage';

// THE ONE PLACE that hands shared tests the portal's version of a page.
// (The only file in common/ allowed to import from aph/ and fassbayar/.)
// Shared tests:  import { test, expect } from '../fixtures/portal'
import { AphAddCompanyFormPage } from '../../aph/pages/AphAddCompanyFormPage';
import { FassbayarAddCompanyFormPage } from '../../fassbayar/pages/FassbayarAddCompanyFormPage';

type PortalPages = {
  addCompanyFormPage: AddCompanyFormPage;
};

export const test = base.extend<PortalPages>({
  addCompanyFormPage: async ({ page }, use) => {
    await use(PORTAL === 'fassbayar' ? new FassbayarAddCompanyFormPage(page) : new AphAddCompanyFormPage(page));
  }
});

export { expect };
