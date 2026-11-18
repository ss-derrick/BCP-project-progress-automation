import { test as base, expect } from '@playwright/test';
import { BLOCKED_PAGE_TEXT, ENV_NAME, PORTAL_PROFILE, type PortalProfile } from '../../portals.config';

// Shared page objects (same screens on every portal)
import { LoginPage } from '../pages/LoginPage';
import { ConsolePage } from '../pages/ConsolePage';
import { HomePage } from '../pages/HomePage';
import { CreditSettlementPage } from '../pages/CreditSettlementPage';

// BASE TEST for every portal.
//   common/tests/*  import { test } from '../fixtures/base'
//   aph/tests/*     import { test } from '../fixtures/pages'  (= this + APH pages)
//   fassbayar/...   import { test } from '../fixtures/pages'  (= this + Fassbayar pages)
// When a screen's two versions are merged into common/pages, its fixture
// moves here and returns the portal override when one exists, e.g.
//   addCompanyPage: async ({ page }, use) => use(PORTAL === 'fassbayar'
//     ? new FassbayarAddCompanyPage(page) : new AddCompanyPage(page))

type SharedPages = {
  loginPage: LoginPage;
  consolePage: ConsolePage;
  homePage: HomePage;
  creditSettlementPage: CreditSettlementPage;
};

type AutoFixtures = {
  detectBlockedEnvironment: void;
};

export const test = base.extend<SharedPages & AutoFixtures>({

  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  consolePage: async ({ page }, use) => { await use(new ConsolePage(page)); },
  homePage: async ({ page }, use) => { await use(new HomePage(page)); },
  creditSettlementPage: async ({ page }, use) => { await use(new CreditSettlementPage(page)); },

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

// A shared scenario that needs a screen only some portals have:
//   requireFeature('logoUpload');   at the start of the test
// -> skipped on portals without it, with the reason in the report.
export function requireFeature(feature: keyof PortalProfile['features']): void {
  test.skip(
    !PORTAL_PROFILE.features[feature],
    `${PORTAL_PROFILE.name} (${ENV_NAME}) has no "${feature}" (portals.config.ts)`
  );
}

export { expect };
