import { test as base, expect } from '@playwright/test';
import { BLOCKED_PAGE_TEXT } from '../config/testConfig';
import { LoginPage } from '../pages/LoginPage';
import { AddCompanyPage } from '../pages/company/AddCompanyPage';
import { AddParentCompanyPage } from '../pages/company/AddParentCompanyPage';

// ============================================================
// Base test for EVERY portal. Specs in common/tests import { test } from
// here; portal specs import their portal's fixtures (aph/fixtures,
// fassbayar/fixtures), which extend this one with portal-only pages.
//
// The shared pages already work on the portal of the run (ENV_NAME ->
// portals.config.ts). If a portal ever needs its own version of a page,
// its fixtures file overrides that fixture with the portal class.
// ============================================================

type SharedPages = {
  loginPage: LoginPage;
  addCompanyPage: AddCompanyPage;
  addParentCompanyPage: AddParentCompanyPage;
};

type AutoFixtures = {
  detectBlockedEnvironment: void;
};

export const test = base.extend<SharedPages & AutoFixtures>({

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  addCompanyPage: async ({ page }, use) => {
    await use(new AddCompanyPage(page));
  },

  addParentCompanyPage: async ({ page }, use) => {
    await use(new AddParentCompanyPage(page));
  },

  // AUTOMATIC ENVIRONMENT BLOCK DETECTION
  // If a test fails while a firewall "blocked" page is on screen, tag it
  // blocked-env so the report doesn't count it as a product defect.
  detectBlockedEnvironment: [
    async ({ page }, use, testInfo) => {
      await use();

      if (!BLOCKED_PAGE_TEXT || testInfo.status === testInfo.expectedStatus) return;

      const blocked = await page.getByText(BLOCKED_PAGE_TEXT).isVisible().catch(() => false);
      if (blocked) {
        testInfo.annotations.push({
          type: 'blocked-env',
          description: `Environment returned "${BLOCKED_PAGE_TEXT}"`
        });
        console.log('Environment issue detected: page blocked');
      }
    },
    { auto: true }
  ]
});

export { expect };
