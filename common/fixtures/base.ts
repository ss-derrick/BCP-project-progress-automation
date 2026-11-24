import { test as base, expect } from '@playwright/test';
import { BLOCKED_PAGE_TEXT, ENV_NAME, PORTAL_PROFILE, type PortalProfile } from '../../portals.config';

// Shared page objects (same screens on every portal)
import { LoginPage } from '../pages/LoginPage';
import { ConsolePage } from '../pages/ConsolePage';
import { HomePage } from '../pages/HomePage';
import { CompanySummaryPage } from '../pages/CompanySummaryPage';
import { TransactionSummaryPage } from '../pages/TransactionSummaryPage';
import { TransactionDetailsPage } from '../pages/TransactionDetailsPage';
import { CreditSettlementPage } from '../pages/CreditSettlementPage';
import { AdministratorPage } from '../pages/AdministratorPage';
import { ReadersPage } from '../pages/ReadersPage';
import { cssMarks, failureCardShot } from '../utils/screenMarks';
import { sheetCases } from '../utils/sheetExpected';
import { explainMessages, failureParts } from '../utils/explainFailure';

// BASE TEST for every portal.
//   common/tests/<module>/*  import { test } from '../../fixtures/base'
//   aph/tests/<module>/*     import { test } from '../../fixtures/pages'  (= this + APH pages)
//   fassbayar/tests/<module>/* import { test } from '../../fixtures/pages'  (= this + Fassbayar pages)
// When a screen's two versions are merged into common/pages, its fixture
// moves here and returns the portal override when one exists, e.g.
//   addCompanyPage: async ({ page }, use) => use(PORTAL === 'fassbayar'
//     ? new FassbayarAddCompanyPage(page) : new AddCompanyPage(page))

type SharedPages = {
  loginPage: LoginPage;
  consolePage: ConsolePage;
  homePage: HomePage;
  companySummaryPage: CompanySummaryPage;
  transactionSummaryPage: TransactionSummaryPage;
  transactionDetailsPage: TransactionDetailsPage;
  creditSettlementPage: CreditSettlementPage;
  administratorPage: AdministratorPage;
  readersPage: ReadersPage;
};

type AutoFixtures = {
  detectBlockedEnvironment: void;
  screenEveryPage: void;
  failureScreen: void;
};

export const test = base.extend<SharedPages & AutoFixtures>({

  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  consolePage: async ({ page }, use) => { await use(new ConsolePage(page)); },
  homePage: async ({ page }, use) => { await use(new HomePage(page)); },
  companySummaryPage: async ({ page }, use) => { await use(new CompanySummaryPage(page)); },
  transactionSummaryPage: async ({ page }, use) => { await use(new TransactionSummaryPage(page)); },
  transactionDetailsPage: async ({ page }, use) => { await use(new TransactionDetailsPage(page)); },
  creditSettlementPage: async ({ page }, use) => { await use(new CreditSettlementPage(page)); },
  administratorPage: async ({ page }, use) => { await use(new AdministratorPage(page)); },
  readersPage: async ({ page }, use) => { await use(new ReadersPage(page)); },

  // A step screenshot of EVERY page the test lands on (report: one per screen, in order), so a failure
  // can be traced screen by screen. Pages whose page objects already shoot every screen are left out:
  // Administrator (/admin), Manage Readers (/reader, /company views opened from there are shot too) and login.
  // Off for one run: $env:STEP_SCREENSHOTS='false'
  screenEveryPage: [
    async ({ page }, use, testInfo) => {
      if (process.env.STEP_SCREENSHOTS === 'false') return use();
      let busy = Promise.resolve();
      const onNavigate = (frame: import('@playwright/test').Frame) => {
        if (frame !== page.mainFrame()) return;
        busy = busy.then(async () => {
          try {
            await page.waitForLoadState('load', { timeout: 15_000 });
            const path = new URL(page.url()).pathname;
            if (/^\/(admin|reader|auth|login|console)(\/|$)/.test(path) || path === '/') return;   // shot by their page objects / login flow
            const title = (await page.locator('.barPaddTitle, .title24Black').first().innerText({ timeout: 1_000 }).catch(() => '')).trim();
            // caption + red boxes via screenshot-only CSS (the test may be clicking meanwhile)
            const body = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70, style: cssMarks(`Screen: ${title || path}`) });
            await testInfo.attach(`screen: ${title || path}`, { body, contentType: 'image/jpeg' });
          } catch { /* page closed or test finished */ }
        });
      };
      page.on('framenavigated', onNavigate);
      await use();
      page.off('framenavigated', onNavigate);
      await busy;
    },
    { auto: true }
  ],

  // Failed checks marked ON the screen where they happened:
  //  - while the test runs: as soon as a check fails (soft checks too), a screenshot of that very screen
  //    with a red "FAILED HERE" banner naming the check (screenshot-only CSS: the test is not disturbed);
  //  - when the test stops on a failure: a screenshot of where it stopped with the remaining failures and
  //    the error messages boxed in red. The report shows these instead of Playwright's plain final screenshot.
  failureScreen: [
    async ({ page }, use, testInfo) => {
      // failure card (common/utils/screenMarks.ts): the Excel sheet's Expected Result of this test's case
      // (green) next to each failed check "should be ... / portal shows ..." (red), the screen under it
      const automationId = testInfo.annotations.find((a) => a.type === 'id')?.description ?? '';
      const sheet = automationId ? sheetCases(automationId) : [];
      const where = () => { try { return new URL(page.url()).pathname; } catch { return ''; } };
      const card = async (errors: typeof testInfo.errors, stopped: boolean) => {
        const lines = explainMessages(errors.map((e) => e.message ?? String(e.value ?? '')));
        const checks = (lines.length ? lines : ['see the report Notes']).map(failureParts);
        const body = await failureCardShot(page, {
          testTitle: `${testInfo.title}${stopped ? (testInfo.status === 'timedOut' ? ' (timed out here)' : ' (test stopped here)') : ''}`,
          automationId, where: where(), checks, sheet
        });
        if (body) await testInfo.attach(`screen: FAILED - ${(lines[0] ?? '').slice(0, 80)}`, { body, contentType: 'image/jpeg' }).catch(() => {});
      };
      let seen = 0;
      let busy: Promise<void> = Promise.resolve();
      const shootNew = () => {
        if (testInfo.errors.length <= seen || page.isClosed()) return;
        const fresh = testInfo.errors.slice(seen);
        seen = testInfo.errors.length;
        busy = busy.then(() => card(fresh, false)).catch(() => {});
      };
      const timer = setInterval(shootNew, 200);
      await use();
      clearInterval(timer);
      await busy;
      if (testInfo.status === testInfo.expectedStatus || testInfo.status === 'skipped' || page.isClosed()) return;
      if (testInfo.errors.length <= seen) return;                  // every failure already shot where it happened
      await card(testInfo.errors.slice(seen), true);
    },
    { auto: true }
  ],

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
